'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * YouTube 播放器组件 (使用 youtube.com 嵌入 + Electron Session Cookie 注入)
 * 
 * ⚠️ 核心设计原则：YouTube 的 DOM 操作完全脱离 React 的虚拟 DOM 管理
 * 
 * YouTube IFrame API 会替换传入的 <div> DOM 节点为 <iframe>。
 * 为了避免 React reconciler 与 YouTube 篡改后的 DOM 冲突
 * (导致 NotFoundError: Failed to execute 'removeChild' on 'Node')，
 * 本组件：
 * 1. 使用 useEffect + document.createElement 手动创建 YouTube 目标元素
 * 2. 容器 div 不包含任何 React 管理的子节点（children 为空）
 * 3. React reconciler 只管理容器 div 本身的属性，不管理其子节点
 * 4. 不使用条件返回（return null 或多路径 return），始终渲染同一个 DOM 结构
 *
 * @param {string} videoId - YouTube 视频 ID
 * @param {function} onTimeUpdate - 播放时间更新回调
 * @param {function} onStateChange - 播放状态变化回调
 * @param {string} subtitleLang - 字幕语言代码
 * @param {React.Ref} playerRef - 暴露播放器实例的 ref
 */
const YouTubePlayer = React.memo(function YouTubePlayer({ videoId, onTimeUpdate, onStateChange, subtitleLang = 'auto', playerRef }) {
  const containerRef = useRef(null);
  const internalPlayerRef = useRef(null);
  const timerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // 跳转到指定时间并开始播放
  const seekTo = useCallback((seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return;

    if (internalPlayerRef.current && typeof internalPlayerRef.current.seekTo === 'function') {
      try {
        const duration = typeof internalPlayerRef.current.getDuration === 'function' ? internalPlayerRef.current.getDuration() : 0;
        const targetTime = (duration > 0 && seconds >= duration) ? Math.max(0, duration - 2) : seconds;
        
        internalPlayerRef.current.seekTo(targetTime, true);
        if (typeof internalPlayerRef.current.playVideo === 'function') {
          internalPlayerRef.current.playVideo();
        }
      } catch (e) {
        console.warn('SeekTo error:', e);
      }
    } else {
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [seconds, true]
        }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: []
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
      // 清理旧的播放器
      if (internalPlayerRef.current) {
        try {
          internalPlayerRef.current.destroy();
        } catch { /* ignore */ }
        internalPlayerRef.current = null;
      }

      // 清空容器（移除旧的 YouTube 元素），这是手动 DOM 操作，不经过 React
      const container = containerRef.current;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // 手动创建 YouTube 目标元素（不通过 React JSX 渲染）
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player-div';
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      container.appendChild(playerDiv);

      setIsReady(false);

      let cleanOrigin = undefined;
      if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('file://')) {
          cleanOrigin = origin;
        }
      }

      const player = new window.YT.Player(playerDiv, {
        videoId: videoId,
        host: 'https://www.youtube.com',
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
                  if (state === 1) {
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
            console.warn('YouTube Player API 触发错误，自动切换直链嵌入模式:', event.data);
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

  // iframe fallback 模式：手动创建 iframe（不通过 React JSX）
  useEffect(() => {
    if (!useIframeFallback || !videoId || !containerRef.current) return;
    
    const container = containerRef.current;
    // 清空容器
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;
    const iframe = document.createElement('iframe');
    iframe.id = 'youtube-fallback-iframe';
    iframe.src = embedUrl;
    iframe.title = 'YouTube Video';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
  }, [useIframeFallback, videoId]);

  // 加载 YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined' || useIframeFallback) return;

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
  }, [initPlayer, useIframeFallback]);

  // videoId 变化时重置
  useEffect(() => {
    setUseIframeFallback(false);
    if (isReady && internalPlayerRef.current && videoId) {
      try {
        internalPlayerRef.current.loadVideoById(videoId);
      } catch { /* ignore */ }
    }
  }, [videoId, isReady]);

  // ⚠️ 关键：始终渲染同一个 DOM 结构，容器 div 没有 React 管理的子节点
  // YouTube 的 DOM 操作（createElement → appendChild）在 useEffect 中完成
  // React reconciler 只管理 youtube-player-container 本身，不管理其内部内容
  // 这样即使 YouTube 替换了 div→iframe，React 也不会感知到变化
  return (
    <div
      className="youtube-player-container"
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        position: 'relative',
      }}
    >
      {/* 
        ⚠️ 不要在此处添加任何 React 管理的子节点！
        YouTube IFrame API 和 fallback iframe 的 DOM 操作
        全部通过 useEffect + document.createElement 完成。
        这样 React reconciler 永远不需要 reconcile 容器的子节点，
        避免了 YouTube DOM 篡改导致的 removeChild 异常。
      */}
    </div>
  );
});

export default YouTubePlayer;
