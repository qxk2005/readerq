'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Play, Music, Sparkles, FileText, AlignLeft, RefreshCw } from 'lucide-react';
import { formatTimestamp, separateBilingualText } from '@/lib/subtitleParser';

/**
 * Apple Music 沉浸歌词视效字幕面板 (Apple Music Lyrics Panel)
 * 用于电影模式 - 左右双面板模式右侧区域
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
  const scrollTimeoutRef = useRef(null);

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
      userScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
      }, 3000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // 自动垂直居中滚动到当前活跃段落 (Apple Music 歌词居中平滑效果)
  useEffect(() => {
    if (userScrollingRef.current || activeIndex < 0) return;
    if (!activeItemRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const item = activeItemRef.current;
    const containerHeight = container.clientHeight;
    const itemTop = item.offsetTop;
    const itemHeight = item.clientHeight;

    const targetScrollTop = itemTop - containerHeight / 2 + itemHeight / 2;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
  }, [activeIndex]);

  if (!subtitles || subtitles.length === 0) {
    return (
      <div className="apple-music-lyrics-empty" style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: '13px',
        padding: '24px',
        textAlign: 'center',
        background: 'rgba(18, 18, 22, 0.6)',
        backdropFilter: 'blur(12px)',
      }}>
        <Music size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <div>暂无双语歌词字幕数据</div>
      </div>
    );
  }

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

      {/* 滚动歌词区域 (Apple Music Lyrics View) */}
      <div
        ref={containerRef}
        className="apple-music-lyrics-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 24px 120px 24px',
          scrollBehavior: 'smooth',
        }}
      >
        {subtitles.map((seg, idx) => {
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

          return (
            <div
              key={idx}
              ref={isActive ? activeItemRef : null}
              onClick={() => onSeek?.(seg.time)}
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
                  {seg.timeStr || formatTimestamp(seg.time)}
                </span>
                {isActive && (
                  <Play size={10} fill="#FFDE00" style={{ color: '#FFDE00' }} />
                )}
              </div>

              {/* 中文歌词 (在上方：主内容，亮黄高对比) */}
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
                {zhText}
              </div>

              {/* 英文歌词 (在下方：参考内容，极小半透明) */}
              {(displayLang === 'bilingual' || displayLang === 'en') && enText && (
                <div
                  style={{
                    fontSize: isActive ? '13px' : '11px',
                    fontWeight: 400,
                    color: isActive ? '#FFDE00' : 'rgba(255, 255, 255, 0.5)',
                    marginTop: '4px',
                    lineHeight: 1.3,
                    letterSpacing: '0.01em',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {enText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
