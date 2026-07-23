'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * YouTube 播放器组件 (使用 youtube-nocookie.com 与智能 Fallback，解决嵌入“登录以播放 / Sign in to confirm you're not a bot”限制)
 * 
 * @param {string} videoId - YouTube 视频 ID
 * @param {function} onTimeUpdate - 播放时间更新回调 (currentTime: number)
 * @param {function} onStateChange - 播放状态变化回调 (state: number)
 * @param {string} subtitleLang - 字幕语言代码 ('auto', 'zh', 'en', 'ja', 'ko' 等)
 * @param {React.Ref} playerRef - 暴露播放器实例的 ref
 */
export default function YouTubePlayer({ videoId, onTimeUpdate, onStateChange, subtitleLang = 'auto', playerRef }) {
  const containerRef = useRef(null);
  const internalPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // 跳转到指定时间
  const seekTo = useCallback((seconds) => {
    if (internalPlayerRef.current && typeof internalPlayerRef.current.seekTo === 'function') {
      internalPlayerRef.current.seekTo(seconds, true);
    } else {
      // 原生 iframe 模式下通过 postMessage 尝试 seekTo
      const iframe = document.getElementById('youtube-fallback-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seconds, true]
        }), '*');
      }
    }
  }, []);

  // 暴露 seekTo 方法给父组件
  useEffect(() => {
    if (playerRef) {
      playerRef.current = {
        seekTo,
        getPlayer: () => internalPlayerRef.current,
      };
    }
  }, [playerRef, seekTo]);

  // 初始化播放器
  const initPlayer = useCallback(() => {
    if (!containerRef.current || !videoId || !window.YT) return;

    try {
      if (internalPlayerRef.current) {
        try {
          internalPlayerRef.current.destroy();
        } catch { /* ignore */ }
        internalPlayerRef.current = null;
      }

      setIsReady(false);

      // 如果来源是 localhost / 127.0.0.1，避免在 playerVars 传递非法的 origin 导致 YouTube 机器人拦截
      let cleanOrigin = undefined;
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('file://')) {
          cleanOrigin = origin;
        }
      }

      const player = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        host: 'https://www.youtube-nocookie.com', // 采用无跟踪/无阻拦域名
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          cc_load_policy: subtitleLang !== 'off' ? 1 : 0,
          cc_lang_pref: subtitleLang !== 'auto' && subtitleLang !== 'off' ? subtitleLang : undefined,
          hl: 'zh-CN',
          enablejsapi: 1,
          origin: cleanOrigin,
          widget_referrer: 'https://www.youtube.com'
        },
        events: {
          onReady: (event) => {
            internalPlayerRef.current = event.target;
            setIsReady(true);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              try {
                if (internalPlayerRef.current && typeof internalPlayerRef.current.getCurrentTime === 'function') {
                  const state = internalPlayerRef.current.getPlayerState();
                  if (state === 1) { // PLAYING
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
          onError: (event) => {
            console.warn('YouTube Player API 触发错误，自动切换直链无跟踪嵌入模式:', event.data);
            setUseIframeFallback(true);
          }
        },
      });

      internalPlayerRef.current = player;
    } catch (err) {
      console.error('YouTube Player 初始化异常:', err);
      setUseIframeFallback(true);
    }
  }, [videoId, subtitleLang, onTimeUpdate, onStateChange]);

  // 加载 YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) existingCallback();
        initPlayer();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (internalPlayerRef.current) {
        try { internalPlayerRef.current.destroy(); } catch { /* ignore */ }
        internalPlayerRef.current = null;
      }
    };
  }, [initPlayer]);

  // videoId 变化时重置
  useEffect(() => {
    setUseIframeFallback(false);
    if (isReady && internalPlayerRef.current && videoId) {
      try {
        internalPlayerRef.current.loadVideoById(videoId);
      } catch { /* ignore */ }
    }
  }, [videoId, isReady]);

  if (!videoId) {
    return (
      <div className="youtube-player-container" style={{ width: '100%', height: '100%', background: '#000' }}>
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

  // 直链强保障 Fallback iframe (解决登录验证机器人限制)
  if (useIframeFallback) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;
    return (
      <div className="youtube-player-container" style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
        <iframe
          id="youtube-fallback-iframe"
          src={embedUrl}
          title="YouTube Video"
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="youtube-player-container" style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}>
      <div id="youtube-player-div" ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
