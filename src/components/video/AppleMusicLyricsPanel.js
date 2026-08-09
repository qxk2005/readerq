'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Play, Music, Sparkles, FileText, AlignLeft, RefreshCw } from 'lucide-react';
import { formatTimestamp, separateBilingualText } from '@/lib/subtitleParser';

/**
 * Apple Music 沉浸歌词视效字幕面板 (Apple Music Lyrics Panel)
 * 用于电影模式 - 左右双面板模式右侧区域
 *
 * ⚠️ 重要修复说明：
 * 1. 不使用条件返回 (early return) 来切换不同 JSX 树，避免整个 DOM 被替换
 * 2. 底部悬浮按钮改为 CSS display 控制，避免 DOM 插入/移除操作
 * 3. 所有子元素始终渲染，通过 CSS display/opacity 控制显隐
 * 
 * @param {Array} subtitles - 字幕段落数组 [{ time, timeStr, text, zh, en }]
 * @param {number} currentTime - 当前播放秒数
 * @param {function} onSeek - 跳转播放函数 (seconds) => void
 * @param {string} title - 视频标题
 * @param {string} displayLang - 显示语言 ('bilingual' | 'zh' | 'en')
 */
export default function AppleMusicLyricsPanel({
  subtitles = [],
  currentTime = 0,
  onSeek,
  title,
  displayLang = 'bilingual',
}) {
  const containerRef = useRef(null);
  const activeItemRef = useRef(null);
  const userScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const progScrollTimeoutRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 计算当前活跃的字幕行索引
  const activeIndex = useMemo(() => {
    if (!subtitles || subtitles.length === 0 || currentTime === undefined) return -1;
    let idx = -1;
    for (let i = 0; i < subtitles.length; i++) {
      if (subtitles[i].time <= currentTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [subtitles, currentTime]);

  // 监听用户手动滚动，暂时停止 3 秒自动居中滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 隔离代码调用 scrollTo 产生的程序化 DOM scroll 事件
      if (isProgrammaticScrollRef.current) return;

      userScrollingRef.current = true;
      setIsUserScrolling(true);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
        setIsUserScrolling(false);
      }, 3000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (progScrollTimeoutRef.current) clearTimeout(progScrollTimeoutRef.current);
    };
  }, []);

  // 居中滚动函数
  const scrollToActive = useCallback(() => {
    if (!activeItemRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const item = activeItemRef.current;
    const containerHeight = container.clientHeight;
    const itemTop = item.offsetTop;
    const itemHeight = item.clientHeight;

    const targetScrollTop = itemTop - containerHeight / 2 + itemHeight / 2;

    isProgrammaticScrollRef.current = true;
    if (progScrollTimeoutRef.current) clearTimeout(progScrollTimeoutRef.current);

    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });

    // 覆盖 smooth scroll 的动画时长
    progScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 450);
  }, []);

  // 自动垂直居中滚动到当前活跃段落
  useEffect(() => {
    if (userScrollingRef.current || activeIndex < 0) return;
    scrollToActive();
  }, [activeIndex, scrollToActive]);

  // 点击歌词行跳转处理（解锁手势限制）
  const handleItemClick = useCallback((time) => {
    userScrollingRef.current = false;
    setIsUserScrolling(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (onSeek) onSeek(time);
  }, [onSeek]);

  const hasSubtitles = subtitles && subtitles.length > 0;

  return (
    <div
      className="apple-music-lyrics-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(20, 20, 26, 0.95) 0%, rgba(12, 12, 16, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 顶栏：标题与模式标识 */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
          <Music size={15} style={{ color: '#FFDE00' }} />
          <span>同步歌词面板</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>点击行跳转播放</span>
        </div>
      </div>

      {/* 空状态提示 (始终渲染，通过 display 控制，避免条件返回导致的整棵 DOM 树替换) */}
      <div
        className="apple-music-lyrics-empty"
        style={{
          display: hasSubtitles ? 'none' : 'flex',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: '13px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <Music size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <div><span>暂无双语歌词字幕数据</span></div>
      </div>

      {/* 滚动歌词区域 (Apple Music Lyrics View) — 始终渲染，无字幕时隐藏 */}
      <div
        ref={containerRef}
        className="apple-music-lyrics-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 24px 120px 24px',
          scrollBehavior: 'smooth',
          display: hasSubtitles ? undefined : 'none',
        }}
      >
        {hasSubtitles && subtitles.map((seg, idx) => {
          const isActive = idx === activeIndex;

          let zh = seg.zh;
          let text = seg.text || '';
          if (!zh && /[\u4e00-\u9fa5]/.test(text) && /[a-zA-Z]/.test(text)) {
            const sep = separateBilingualText(text);
            text = sep.text;
            zh = sep.zh;
          }

          const zhText = zh || (/[\u4e00-\u9fa5]/.test(text) ? text : '');
          const enText = (text && text !== zhText && /[a-zA-Z]/.test(text)) ? text : (seg.en || '');
          const segKey = seg.id || `lyric_${seg.time}_${idx}`;

          return (
            <div
              key={segKey}
              ref={isActive ? activeItemRef : null}
              onClick={() => handleItemClick(seg.time)}
              className={`apple-music-lyric-item ${isActive ? 'active' : ''}`}
              style={{
                marginBottom: isActive ? '20px' : '14px',
                marginTop: isActive ? '20px' : '0px',
                padding: isActive ? '14px 18px' : '8px 12px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
                boxShadow: isActive ? '0 8px 30px rgba(0, 0, 0, 0.35)' : 'none',
                opacity: isActive ? 1 : 0.45,
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                transformOrigin: 'left center',
                borderLeft: isActive ? '3px solid #FFDE00' : '3px solid transparent',
              }}
            >
              {/* 时间戳与播放指示 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#FFDE00' : 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>{seg.timeStr || formatTimestamp(seg.time)}</span>
                </span>
                {/* Play 图标始终渲染，通过 display 控制显隐 */}
                <span style={{ display: isActive ? 'inline-flex' : 'none', alignItems: 'center' }}>
                  <Play size={10} fill="#FFDE00" style={{ color: '#FFDE00' }} />
                </span>
              </div>

              {/* 中文歌词 (在上方：主内容) */}
              <div
                style={{
                  fontSize: isActive ? '19px' : '16px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                  lineHeight: 1.4,
                  letterSpacing: '0.015em',
                  transition: 'all 0.25s ease',
                }}
              >
                <span>{zhText}</span>
              </div>

              {/* 英文歌词 (始终渲染，通过 display 控制显隐) */}
              <div
                style={{
                  fontSize: isActive ? '13px' : '11px',
                  fontWeight: 400,
                  color: isActive ? '#FFDE00' : 'rgba(255, 255, 255, 0.5)',
                  marginTop: '4px',
                  lineHeight: 1.3,
                  letterSpacing: '0.01em',
                  transition: 'all 0.25s ease',
                  display: ((displayLang === 'bilingual' || displayLang === 'en') && enText) ? undefined : 'none',
                }}
              >
                <span>{enText || ''}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 用户手动滚动时显示的"恢复自动居中"悬浮按钮 — 始终渲染，通过 display 控制显隐，避免 removeChild */}
      <button
        onClick={() => {
          userScrollingRef.current = false;
          setIsUserScrolling(false);
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollToActive();
        }}
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          zIndex: 30,
          display: isUserScrolling ? 'flex' : 'none',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '20px',
          backgroundColor: 'rgba(255, 222, 0, 0.95)',
          color: '#000000',
          fontWeight: '700',
          fontSize: '12px',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <RefreshCw size={13} />
        <span>📍 恢复自动居中</span>
      </button>
    </div>
  );
}
