'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * YouTube IFrame Player API 封装组件
 * 
 * @param {string} videoId - YouTube 视频 ID
 * @param {function} onTimeUpdate - 播放时间更新回调 (currentTime: number)
 * @param {function} onStateChange - 播放状态变化回调 (state: number)
 * @param {string} subtitleLang - 字幕语言代码 ('auto', 'zh', 'en', 'ja', 'ko' 等)
 * @param {string} size - 播放器尺寸 ('small', 'medium', 'large')
 * @param {React.Ref} playerRef - 暴露播放器实例的 ref
 */
export default function YouTubePlayer({ videoId, onTimeUpdate, onStateChange, subtitleLang = 'auto', size = 'medium', playerRef }) {
  const containerRef = useRef(null);
  const internalPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [availableCaptions, setAvailableCaptions] = useState([]);

  // 播放器高度映射
  const sizeHeights = {
    small: '240px',
    medium: '360px',
    large: '480px',
  };

  // 加载 YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 如果 API 已加载，直接初始化
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }

    // 设置全局回调
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (existingCallback) existingCallback();
      initPlayer();
    };

    // 检查是否已经有 script 标签
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (internalPlayerRef.current) {
        try { internalPlayerRef.current.destroy(); } catch { /* ignore */ }
        internalPlayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // videoId 变化时重新加载
  useEffect(() => {
    if (isReady && internalPlayerRef.current && videoId) {
      try {
        internalPlayerRef.current.loadVideoById(videoId);
      } catch { /* ignore */ }
    }
  }, [videoId, isReady]);

  // 字幕语言变化时切换
  useEffect(() => {
    if (!isReady || !internalPlayerRef.current) return;
    try {
      const player = internalPlayerRef.current;
      if (subtitleLang === 'off') {
        player.unloadModule('captions');
      } else {
        player.loadModule('captions');
        if (subtitleLang && subtitleLang !== 'auto') {
          // 延迟设置字幕，确保 captions 模块已加载
          setTimeout(() => {
            try {
              player.setOption('captions', 'track', { languageCode: subtitleLang });
            } catch { /* ignore */ }
          }, 500);
        }
      }
    } catch { /* ignore */ }
  }, [subtitleLang, isReady]);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || !videoId || !window.YT) return;

    try {
      const player = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          cc_load_policy: subtitleLang !== 'off' ? 1 : 0,
          cc_lang_pref: subtitleLang !== 'auto' && subtitleLang !== 'off' ? subtitleLang : undefined,
          hl: 'zh-CN',
        },
        events: {
          onReady: (event) => {
            internalPlayerRef.current = event.target;
            if (playerRef) playerRef.current = event.target;
            setIsReady(true);

            // 尝试获取可用的字幕轨道
            try {
              const tracks = event.target.getOption('captions', 'tracklist');
              if (tracks && Array.isArray(tracks)) {
                setAvailableCaptions(tracks.map(t => ({
                  code: t.languageCode,
                  name: t.languageName || t.displayName || t.languageCode,
                })));
              }
            } catch { /* 某些视频可能没有字幕 */ }

            // 启动时间更新定时器
            timerRef.current = setInterval(() => {
              try {
                if (internalPlayerRef.current && typeof internalPlayerRef.current.getCurrentTime === 'function') {
                  const state = internalPlayerRef.current.getPlayerState();
                  // 只在播放状态时上报时间
                  if (state === 1) { // YT.PlayerState.PLAYING
                    const time = internalPlayerRef.current.getCurrentTime();
                    if (onTimeUpdate) onTimeUpdate(time);
                  }
                }
              } catch { /* ignore */ }
            }, 500);
          },
          onStateChange: (event) => {
            if (onStateChange) onStateChange(event.data);
          },
        },
      });

      internalPlayerRef.current = player;
    } catch (err) {
      console.error('YouTube Player 初始化失败:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // 跳转到指定时间
  const seekTo = useCallback((seconds) => {
    if (internalPlayerRef.current && typeof internalPlayerRef.current.seekTo === 'function') {
      internalPlayerRef.current.seekTo(seconds, true);
    }
  }, []);

  // 暴露 seekTo 方法
  useEffect(() => {
    if (playerRef) {
      playerRef.current = {
        seekTo,
        getPlayer: () => internalPlayerRef.current,
      };
    }
  }, [playerRef, seekTo]);

  if (!videoId) {
    return (
      <div className="youtube-player-container" style={{ height: sizeHeights[size] }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-sm)',
        }}>
          无法识别 YouTube 视频链接
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-player-container" style={{ maxHeight: sizeHeights[size] }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
