'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { parseSubtitles, extractYouTubeId, parseSRT } from '@/lib/subtitleParser';
import YouTubePlayer from './YouTubePlayer';
import SubtitlePanel from './SubtitlePanel';
import AppleMusicLyricsPanel from './AppleMusicLyricsPanel';
import CinemaSubtitleOverlay from './CinemaSubtitleOverlay';
import { Maximize2, Minimize2, Captions, LogIn, ExternalLink, Film, Sliders, Columns } from 'lucide-react';

/**
 * 视频阅读主容器
 * 当文档类型为 video 时替代原有的文章正文区域
 * 上方：YouTube 嵌入播放器
 * 下方：字幕/博客面板
 * 
 * @param {Object} selectedDoc - 当前选中的文档对象
 */
export default function VideoReadingPane({ selectedDoc, articleRef, updateDocumentLocally, videoTabMode, onVideoTabChange }) {
  const { videoSettings, setVideoSettings } = useTheme();
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState(false);
  const [captionLang, setCaptionLang] = useState(videoSettings.subtitleLang || 'auto');
  
  // 播放器高度可拖拽状态
  const [playerHeight, setPlayerHeight] = useState(400); // 默认 400px
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // 用户上传的 SRT 字幕状态
  const [uploadedSubtitles, setUploadedSubtitles] = useState(null); // null = 未加载, [] = 无, [...] = 有
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);

  // 提取 YouTube 视频 ID
  const videoId = useMemo(() => {
    return extractYouTubeId(selectedDoc?.source_url || selectedDoc?.url);
  }, [selectedDoc?.source_url, selectedDoc?.url]);

  // 从 html_content 解析的字幕
  const htmlSubtitles = useMemo(() => {
    return parseSubtitles(selectedDoc?.html_content);
  }, [selectedDoc?.html_content]);

  // 跨客户端字幕/双语最新版本提醒控制 State
  const [hasNewerSubtitleVersion, setHasNewerSubtitleVersion] = useState(false);
  const [newerSrtContent, setNewerSrtContent] = useState('');
  const [isApplyingNewerSubtitles, setIsApplyingNewerSubtitles] = useState(false);
  const [subtitleVersionInfo, setSubtitleVersionInfo] = useState({ localUpdatedAt: null, ossUpdatedAt: null });

  // 加载用户上传的字幕并对比云端 OSS 最新版本
  useEffect(() => {
    if (!selectedDoc?.id) return;
    setIsLoadingSubtitles(true);
    fetch(`/api/documents/${selectedDoc.id}/subtitles`)
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.subtitles?.length > 0) {
          setUploadedSubtitles(data.subtitles);

          // 保存版本时间信息
          setSubtitleVersionInfo({
            localUpdatedAt: data.localUpdatedAt || null,
            ossUpdatedAt: data.ossUpdatedAt || null,
          });

          if (data.hasNewerVersion && data.newerSrtContent) {
            // 检查是否已被忽略（sessionStorage 持久化）
            const ignoredKey = `ignored_subtitle_${selectedDoc.id}`;
            const ignoredOssTime = sessionStorage.getItem(ignoredKey);
            const isIgnored = ignoredOssTime && data.ossUpdatedAt && ignoredOssTime === data.ossUpdatedAt;

            // 自动无缝升级策略：若未显式忽略，且本地无双语翻译或为空，首次直接自动载入云端最新双语字幕
            const localHasZh = data.subtitles?.some(s => s.zh);
            if (!isIgnored && !localHasZh) {
              fetch(`/api/documents/${selectedDoc.id}/subtitles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  srtContent: data.newerSrtContent,
                  ossTimestamp: data.ossUpdatedAt || new Date().toISOString(),
                }),
              }).then(r => r.json()).then(appliedData => {
                if (appliedData.subtitles) {
                  setUploadedSubtitles(appliedData.subtitles);
                  setHasNewerSubtitleVersion(false);
                  setNewerSrtContent('');
                }
              }).catch(() => {
                setHasNewerSubtitleVersion(true);
                setNewerSrtContent(data.newerSrtContent);
              });
            } else if (!isIgnored) {
              setHasNewerSubtitleVersion(true);
              setNewerSrtContent(data.newerSrtContent);
            } else {
              setHasNewerSubtitleVersion(false);
              setNewerSrtContent('');
            }
          } else {
            setHasNewerSubtitleVersion(false);
            setNewerSrtContent('');
          }
        } else {
          setUploadedSubtitles([]);
        }
      })
      .catch(err => {
        console.error('加载用户字幕失败:', err);
        setUploadedSubtitles([]);
      })
      .finally(() => setIsLoadingSubtitles(false));
  }, [selectedDoc?.id]);

  // 切换为云端最新版本的双语字幕
  const handleApplyNewerSubtitles = useCallback(async () => {
    if (!newerSrtContent || !selectedDoc?.id) return;
    setIsApplyingNewerSubtitles(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srtContent: newerSrtContent,
          // 传入云端时间戳，确保本地 updated_at >= 云端时间，消除版本差异
          ossTimestamp: subtitleVersionInfo.ossUpdatedAt || new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const finalSubs = (data.subtitles && data.subtitles.length > 0) ? data.subtitles : parseSRT(newerSrtContent);
        if (finalSubs && finalSubs.length > 0) {
          setUploadedSubtitles(finalSubs);
        }
        setHasNewerSubtitleVersion(false);
        setNewerSrtContent('');
        // 清除忽略记录
        sessionStorage.removeItem(`ignored_subtitle_${selectedDoc.id}`);
        // 更新本地版本时间为云端时间
        setSubtitleVersionInfo(prev => ({
          ...prev,
          localUpdatedAt: prev.ossUpdatedAt || new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.error('切换最新双语字幕失败:', e);
    } finally {
      setIsApplyingNewerSubtitles(false);
    }
  }, [newerSrtContent, selectedDoc?.id, subtitleVersionInfo.ossUpdatedAt]);


  // 最终使用的字幕：优先用户上传 > html_content 解析
  const subtitles = useMemo(() => {
    if (uploadedSubtitles && uploadedSubtitles.length > 0) {
      return uploadedSubtitles;
    }
    return htmlSubtitles;
  }, [uploadedSubtitles, htmlSubtitles]);

  // 电影模式配置与切换
  const cinemaConfig = useMemo(() => {
    return videoSettings?.cinemaMode || {
      enabled: true,
      fontSize: 'medium',
      position: 'bottom',
      style: 'pill',
      displayLang: 'bilingual',
    };
  }, [videoSettings?.cinemaMode]);

  const [showCinemaSettings, setShowCinemaSettings] = useState(false);

  const toggleCinemaMode = useCallback(() => {
    setVideoSettings(prev => ({
      ...prev,
      cinemaMode: {
        ...(prev.cinemaMode || {}),
        enabled: !(videoSettings?.cinemaMode?.enabled !== false),
      }
    }));
  }, [videoSettings?.cinemaMode?.enabled, setVideoSettings]);

  const updateCinemaConfig = useCallback((updates) => {
    setVideoSettings(prev => ({
      ...prev,
      cinemaMode: {
        ...(prev.cinemaMode || {}),
        ...updates,
      }
    }));
  }, [setVideoSettings]);

  const toggleDualPanel = useCallback(() => {
    setVideoSettings(prev => ({
      ...prev,
      cinemaMode: {
        ...(prev.cinemaMode || {}),
        dualPanel: !(videoSettings?.cinemaMode?.dualPanel === true),
      }
    }));
  }, [videoSettings?.cinemaMode?.dualPanel, setVideoSettings]);

  // 计算当前时间戳对应的活跃字幕
  const activeSubtitle = useMemo(() => {
    if (!subtitles || subtitles.length === 0 || currentTime === undefined) return null;
    let found = null;
    for (let i = 0; i < subtitles.length; i++) {
      if (subtitles[i].time <= currentTime) {
        found = subtitles[i];
      } else {
        break;
      }
    }
    return found;
  }, [subtitles, currentTime]);

  // 是否正在使用用户上传的字幕
  const isUsingUploadedSubtitles = uploadedSubtitles && uploadedSubtitles.length > 0;

  // 播放器时间更新回调
  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  // 字幕点击跳转
  const handleSeek = useCallback((seconds) => {
    if (typeof seconds === 'number' && !isNaN(seconds)) {
      setCurrentTime(seconds);
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds);
      }
    }
  }, []);

  // 字幕上传成功后刷新
  const handleSubtitleUploaded = useCallback((newSubtitles) => {
    setUploadedSubtitles(newSubtitles);
  }, []);

  // 字幕删除后刷新
  const handleSubtitleDeleted = useCallback(() => {
    setUploadedSubtitles([]);
  }, []);

  const captionOptions = [
    { value: 'auto', label: '自动' },
    { value: 'zh-Hans', label: '中文(简体)' },
    { value: 'zh-Hant', label: '中文(繁体)' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'off', label: '关闭字幕' },
  ];

  const upperSectionRef = useRef(null);

  // 左右分栏拖拽比例状态 (默认 58%)
  const [splitRatio, setSplitRatio] = useState(cinemaConfig.splitRatio || 58);
  const isHorizontalDragging = useRef(false);
  const startX = useRef(0);
  const startRatio = useRef(0);

  // 拖拽调整左右分栏比例处理
  const handleHorizontalMouseDown = useCallback((e) => {
    e.preventDefault();
    isHorizontalDragging.current = true;
    startX.current = e.clientX;
    startRatio.current = splitRatio;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isHorizontalDragging.current || !upperSectionRef.current) return;
      const containerWidth = upperSectionRef.current.clientWidth;
      if (containerWidth <= 0) return;

      const deltaX = moveEvent.clientX - startX.current;
      const deltaRatio = (deltaX / containerWidth) * 100;
      const newRatio = Math.max(25, Math.min(80, startRatio.current + deltaRatio));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      isHorizontalDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      updateCinemaConfig({ splitRatio: Math.round(splitRatio) });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [splitRatio, updateCinemaConfig]);

  // 拖拽调整上下高度处理 (播放器区域与下方博客面板)
  const handleVerticalMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = playerHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none'; // 拖拽时防止选中文本

    const handleMouseMove = (moveEvent) => {
      if (!isDragging.current) return;
      const deltaY = moveEvent.clientY - startY.current;
      const newHeight = Math.max(200, Math.min(startHeight.current + deltaY, window.innerHeight * 0.8));
      setPlayerHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [playerHeight]);

  const isDualPanel = cinemaConfig.dualPanel === true;

  return (
    <div className={`video-reading-pane ${isDualPanel ? 'dual-panel-mode' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶部控制栏 */}
      <div className="video-player-controls" style={{ flexShrink: 0, position: 'relative' }}>
        <div className="video-player-controls-left" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Captions size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <select
            className="video-caption-select"
            value={captionLang}
            onChange={(e) => setCaptionLang(e.target.value)}
          >
            {captionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* 电影模式 (Cinema Mode) 切换按钮与快捷控制 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '6px' }}>
            <button
              className={`btn btn-sm ${cinemaConfig.enabled !== false ? 'btn-cinema-active' : 'btn-ghost'}`}
              onClick={toggleCinemaMode}
              title={cinemaConfig.enabled !== false ? '关闭画面电影双语字幕' : '开启画面电影双语字幕'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 9px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                backgroundColor: cinemaConfig.enabled !== false ? 'rgba(255, 215, 0, 0.16)' : 'transparent',
                color: cinemaConfig.enabled !== false ? '#ffd700' : 'var(--color-text-secondary)',
                border: cinemaConfig.enabled !== false ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              <Film size={14} style={{ color: cinemaConfig.enabled !== false ? '#ffd700' : 'currentColor' }} />
              <span>电影字幕</span>
            </button>

            {/* 电影字幕设置展开按钮 */}
            {cinemaConfig.enabled !== false && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCinemaSettings(!showCinemaSettings)}
                title="调整电影字幕设置 (字号/位置/风格/语言)"
                style={{
                  padding: '2px 5px',
                  marginLeft: '2px',
                  borderRadius: '8px',
                  color: showCinemaSettings ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                }}
              >
                <Sliders size={13} />
              </button>
            )}

            {/* 电影字幕快捷设置 Popover */}
            {showCinemaSettings && cinemaConfig.enabled !== false && (
              <div
                className="cinema-settings-popover"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  zIndex: 100,
                  width: '240px',
                  padding: '12px',
                  backgroundColor: 'var(--color-bg-secondary, #1e1e1e)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                  border: '1px solid var(--color-border-light, rgba(255,255,255,0.15))',
                  fontSize: '12px',
                  color: 'var(--color-text-primary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontWeight: 'bold' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Film size={14} style={{ color: '#ffd700' }} />
                    电影字幕设置
                  </span>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                    onClick={() => setShowCinemaSettings(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* 字号大小 */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontSize: '11px' }}>字号大小</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { key: 'small', label: '小' },
                      { key: 'medium', label: '中' },
                      { key: 'large', label: '大' },
                      { key: 'xlarge', label: '特大' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => updateCinemaConfig({ fontSize: opt.key })}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                          backgroundColor: cinemaConfig.fontSize === opt.key ? 'var(--color-accent, #007aff)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.08))',
                          color: cinemaConfig.fontSize === opt.key ? '#fff' : 'var(--color-text-secondary)',
                          fontWeight: cinemaConfig.fontSize === opt.key ? '600' : 'normal',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 显示语言 */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontSize: '11px' }}>显示模式</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { key: 'bilingual', label: '中英双语' },
                      { key: 'zh', label: '仅中文' },
                      { key: 'en', label: '仅原文' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => updateCinemaConfig({ displayLang: opt.key })}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                          backgroundColor: cinemaConfig.displayLang === opt.key ? 'var(--color-accent, #007aff)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.08))',
                          color: cinemaConfig.displayLang === opt.key ? '#fff' : 'var(--color-text-secondary)',
                          fontWeight: cinemaConfig.displayLang === opt.key ? '600' : 'normal',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 字幕风格 */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontSize: '11px' }}>字幕风格</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { key: 'netflix', label: 'Netflix' },
                      { key: 'pill', label: '半透明框' },
                      { key: 'shadow', label: '描边' },
                      { key: 'clean', label: '极简' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => updateCinemaConfig({ style: opt.key })}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                          backgroundColor: cinemaConfig.style === opt.key ? 'var(--color-accent, #007aff)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.08))',
                          color: cinemaConfig.style === opt.key ? '#fff' : 'var(--color-text-secondary)',
                          fontWeight: cinemaConfig.style === opt.key ? '600' : 'normal',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 显示位置 */}
                <div>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px', fontSize: '11px' }}>显示位置</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { key: 'bottom', label: '画面底部' },
                      { key: 'top', label: '画面顶部' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => updateCinemaConfig({ position: opt.key })}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                          backgroundColor: cinemaConfig.position === opt.key ? 'var(--color-accent, #007aff)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.08))',
                          color: cinemaConfig.position === opt.key ? '#fff' : 'var(--color-text-secondary)',
                          fontWeight: cinemaConfig.position === opt.key ? '600' : 'normal',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 左右双面板模式 (Apple Music 歌词效果) 切换按钮 */}
          <button
            className={`btn btn-sm ${isDualPanel ? 'btn-cinema-active' : 'btn-ghost'}`}
            onClick={toggleDualPanel}
            title={isDualPanel ? '切回标准上下视图' : '开启左右双面板模式 (Apple Music 歌词效果)'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 9px',
              marginLeft: '6px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              backgroundColor: isDualPanel ? 'rgba(0, 122, 255, 0.16)' : 'transparent',
              color: isDualPanel ? '#007aff' : 'var(--color-text-secondary)',
              border: isDualPanel ? '1px solid rgba(0, 122, 255, 0.4)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Columns size={14} style={{ color: isDualPanel ? '#007aff' : 'currentColor' }} />
            <span>双面板模式</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isDualPanel && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsPlayerCollapsed(!isPlayerCollapsed)}
              title={isPlayerCollapsed ? '展开播放器' : '折叠播放器'}
            >
              {isPlayerCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          
          {selectedDoc?.source_url || selectedDoc?.url ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const targetUrl = selectedDoc.source_url || selectedDoc.url;
                if (targetUrl) window.open(targetUrl, '_blank');
              }}
              title="在系统浏览器中打开原视频"
              style={{ marginLeft: '4px' }}
            >
              <ExternalLink size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* 上方：播放器/双面板区域 (高度为 playerHeight，由上下把手拖拽) */}
      <div 
        ref={upperSectionRef}
        className={`video-player-section ${isPlayerCollapsed ? 'collapsed' : ''}`}
        style={{ 
          height: isPlayerCollapsed ? 0 : `${playerHeight}px`, 
          flexShrink: 0, 
          display: isPlayerCollapsed ? 'none' : 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 统一的播放器容器 — 无论双面板还是单面板，都渲染同一个 YouTubePlayer 实例 */}
        <div style={{ 
          flex: 1, 
          minHeight: 0, 
          display: 'flex', 
          flexDirection: 'row', 
          width: '100%', 
          overflow: 'hidden' 
        }}>
          {/* 左侧：YouTube 播放器 + CinemaSubtitleOverlay */}
          <div style={{ 
            flex: isDualPanel ? `0 0 ${splitRatio}%` : '1 1 auto',
            minWidth: 0, 
            height: '100%', 
            background: '#000', 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative' 
          }}>
            <YouTubePlayer
              videoId={videoId}
              onTimeUpdate={handleTimeUpdate}
              subtitleLang={captionLang}
              playerRef={playerRef}
            />
            <CinemaSubtitleOverlay activeSubtitle={activeSubtitle} cinemaConfig={cinemaConfig} />
          </div>

          {/* 左右拖拽把手 — 始终渲染，非双面板模式时隐藏 */}
          <div
            onMouseDown={handleHorizontalMouseDown}
            title="左右拖拽调整播放器与歌词面板比例"
            style={{
              width: '6px',
              cursor: 'col-resize',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
              display: isDualPanel ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
              zIndex: 10,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent, #007aff)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            <div style={{ width: '2px', height: '28px', backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: '1px' }}></div>
          </div>

          {/* 右侧面板：Apple Music 沉浸歌词视效字幕面板 — 始终渲染，非双面板模式时隐藏 */}
          <div style={{ flex: 1, minWidth: 0, height: '100%', display: isDualPanel ? undefined : 'none' }}>
            <AppleMusicLyricsPanel
              subtitles={subtitles}
              currentTime={currentTime}
              onSeek={handleSeek}
              title={selectedDoc?.title}
              displayLang={cinemaConfig.displayLang}
            />
          </div>
        </div>
      </div>

      {/* 上下拖拽把手 — 始终渲染，折叠时隐藏 */}
      <div 
        className="video-resizer"
        onMouseDown={handleVerticalMouseDown}
        title="上下拖拽调整上方播放器与下方博客面板比例"
        style={{
          height: '6px',
          cursor: 'row-resize',
          backgroundColor: 'var(--color-border-light)',
          flexShrink: 0,
          display: isPlayerCollapsed ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ width: '30px', height: '2px', backgroundColor: 'var(--color-text-tertiary)', borderRadius: '1px' }}></div>
      </div>


      {/* 下方：字幕 / 博客文章面板 (SubtitlePanel) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <SubtitlePanel
          subtitles={subtitles}
          currentTime={currentTime}
          onSeek={handleSeek}
          autoScroll={videoSettings.autoScroll !== false}
          title={selectedDoc?.title}
          blogPrompt={videoSettings.blogPrompt}
          documentId={selectedDoc?.id}
          isUsingUploadedSubtitles={isUsingUploadedSubtitles}
          onSubtitleUploaded={handleSubtitleUploaded}
          onSubtitleDeleted={handleSubtitleDeleted}
          articleRef={articleRef}
          selectedDoc={selectedDoc}
          onBlogUpdated={(content) => {
            updateDocumentLocally?.(selectedDoc.id, { blog_content: content });
          }}
          mode={videoTabMode}
          onModeChange={onVideoTabChange}
          hasNewerSubtitleVersion={hasNewerSubtitleVersion}
          onApplyNewerSubtitles={handleApplyNewerSubtitles}
          isApplyingNewerSubtitles={isApplyingNewerSubtitles}
          onIgnoreNewerSubtitles={() => {
            setHasNewerSubtitleVersion(false);
            if (subtitleVersionInfo.ossUpdatedAt && selectedDoc?.id) {
              sessionStorage.setItem(`ignored_subtitle_${selectedDoc.id}`, subtitleVersionInfo.ossUpdatedAt);
            }
          }}
          subtitleVersionInfo={subtitleVersionInfo}
        />
      </div>
    </div>
  );
}
