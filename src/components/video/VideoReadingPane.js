'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { parseSubtitles, extractYouTubeId } from '@/lib/subtitleParser';
import YouTubePlayer from './YouTubePlayer';
import SubtitlePanel from './SubtitlePanel';
import { Maximize2, Minimize2, Captions } from 'lucide-react';

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

  // 提取 YouTube 视频 ID
  const videoId = useMemo(() => {
    return extractYouTubeId(selectedDoc?.source_url || selectedDoc?.url);
  }, [selectedDoc?.source_url, selectedDoc?.url]);

  // 解析字幕
  const subtitles = useMemo(() => {
    return parseSubtitles(selectedDoc?.html_content);
  }, [selectedDoc?.html_content]);

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

  // 字幕语言选项
  const captionOptions = [
    { value: 'auto', label: '自动' },
    { value: 'zh-Hans', label: '中文(简体)' },
    { value: 'zh-Hant', label: '中文(繁体)' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'off', label: '关闭字幕' },
  ];

  return (
    <div className="video-reading-pane">
      {/* 上方：YouTube 播放器区域 */}
      <div className={`video-player-section ${isPlayerCollapsed ? 'collapsed' : ''}`}>
        <div className="video-player-controls">
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
        </div>
        {!isPlayerCollapsed && (
          <YouTubePlayer
            videoId={videoId}
            onTimeUpdate={handleTimeUpdate}
            subtitleLang={captionLang}
            size={videoSettings.playerSize || 'medium'}
            playerRef={playerRef}
          />
        )}
      </div>

      {/* 下方：字幕/博客面板 */}
      <SubtitlePanel
        subtitles={subtitles}
        currentTime={currentTime}
        onSeek={handleSeek}
        autoScroll={videoSettings.autoScroll !== false}
        title={selectedDoc?.title}
        blogPrompt={videoSettings.blogPrompt}
      />
    </div>
  );
}
