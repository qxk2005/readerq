'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { parseSubtitles, extractYouTubeId, parseSRT } from '@/lib/subtitleParser';
import YouTubePlayer from './YouTubePlayer';
import SubtitlePanel from './SubtitlePanel';
import { Maximize2, Minimize2, Captions, LogIn } from 'lucide-react';

/**
 * 视频阅读主容器
 * 当文档类型为 video 时替代原有的文章正文区域
 * 上方：YouTube 嵌入播放器
 * 下方：字幕/博客面板
 * 
 * @param {Object} selectedDoc - 当前选中的文档对象
 */
export default function VideoReadingPane({ selectedDoc }) {
  const { videoSettings } = useTheme();
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

  // 加载用户上传的字幕
  useEffect(() => {
    if (!selectedDoc?.id) return;
    setIsLoadingSubtitles(true);
    fetch(`/api/documents/${selectedDoc.id}/subtitles`)
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.subtitles?.length > 0) {
          setUploadedSubtitles(data.subtitles);
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

  // 最终使用的字幕：优先用户上传 > html_content 解析
  const subtitles = useMemo(() => {
    if (uploadedSubtitles && uploadedSubtitles.length > 0) {
      return uploadedSubtitles;
    }
    return htmlSubtitles;
  }, [uploadedSubtitles, htmlSubtitles]);

  // 是否正在使用用户上传的字幕
  const isUsingUploadedSubtitles = uploadedSubtitles && uploadedSubtitles.length > 0;

  // 播放器时间更新回调
  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  // 字幕点击跳转
  const handleSeek = useCallback((seconds) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds);
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

  // 拖拽调整高度处理
  const handleMouseDown = useCallback((e) => {
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

  return (
    <div className="video-reading-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 上方：YouTube 播放器区域 */}
      <div 
        className={`video-player-section ${isPlayerCollapsed ? 'collapsed' : ''}`}
        style={{ height: isPlayerCollapsed ? 'auto' : `${playerHeight}px`, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div className="video-player-controls" style={{ flexShrink: 0 }}>
          <div className="video-player-controls-left">
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
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsPlayerCollapsed(!isPlayerCollapsed)}
            title={isPlayerCollapsed ? '展开播放器' : '折叠播放器'}
          >
            {isPlayerCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              window.open('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com&readerq-internal-popup=1', 'youtube-login');
            }}
            title="登录 YouTube (如遇机器人验证)"
            style={{ marginLeft: '4px' }}
          >
            <LogIn size={14} />
            <span style={{ marginLeft: '4px', fontSize: '12px' }}>登录以播放</span>
          </button>
        </div>
        {!isPlayerCollapsed && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <YouTubePlayer
              videoId={videoId}
              onTimeUpdate={handleTimeUpdate}
              subtitleLang={captionLang}
              playerRef={playerRef}
            />
          </div>
        )}
      </div>

      {/* 拖拽调整大小把手 */}
      {!isPlayerCollapsed && (
        <div 
          className="video-resizer"
          onMouseDown={handleMouseDown}
          title="上下拖拽调整播放器大小"
          style={{
            height: '6px',
            cursor: 'row-resize',
            backgroundColor: 'var(--color-border-light)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{ width: '30px', height: '2px', backgroundColor: 'var(--color-text-tertiary)', borderRadius: '1px' }}></div>
        </div>
      )}

      {/* 下方：字幕/博客面板 */}
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
      />
      </div>
    </div>
  );
}
