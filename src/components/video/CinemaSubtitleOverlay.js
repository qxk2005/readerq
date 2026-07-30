'use client';

import React, { useMemo } from 'react';

/**
 * 电影播放模式 - 画面浮动双语字幕组件 (Cinema Subtitle Overlay - Netflix Style)
 * 沉浸式挂载在 YouTube 视频视口上层
 *
 * Netflix 经典双语字幕规范：
 * 1. 中文在上（主要阅读内容）：采用 Netflix 标志性亮黄色 (#FFDE00)，中等清晰字号与黑描边阴影
 * 2. 英文在下（辅助参考内容）：采用 Netflix 冷白/半透明字 (rgba(240, 240, 245, 0.82))，最小参考字号
 * 3. 颜色强区分：中英文颜色显著区别，绝不混淆
 *
 * @param {Object} activeSubtitle - 当前时间戳对应的字幕段落 { text, zh, en, time }
 * @param {Object} cinemaConfig - 电影模式配置 { enabled, fontSize, position, style, displayLang }
 */
export default function CinemaSubtitleOverlay({ activeSubtitle, cinemaConfig = {} }) {
  const {
    enabled = true,
    fontSize = 'medium',
    position = 'bottom',
    style = 'netflix',
    displayLang = 'bilingual',
    dualPanel = false,
  } = cinemaConfig;

  // 如果双面板模式开启 (右侧已有歌词字幕)，或未启用电影模式，或无活跃字幕，则不渲染画面浮动字幕
  if (dualPanel || !enabled || !activeSubtitle) return null;

  // 1. 整理顶部主行内容 (Top Line - 中文优先作为主要内容)
  const topText = useMemo(() => {
    if (displayLang === 'zh') {
      return activeSubtitle.zh || activeSubtitle.text || '';
    }
    if (displayLang === 'en') {
      return activeSubtitle.en || activeSubtitle.text || '';
    }
    // bilingual 模式：中文在上作为主要内容 (优先 zh，若无 zh 则显示 text)
    return activeSubtitle.zh || activeSubtitle.text || '';
  }, [activeSubtitle, displayLang]);

  // 2. 整理底部副行内容 (Bottom Line - 英文/原文作为辅助参考内容)
  const bottomText = useMemo(() => {
    if (displayLang !== 'bilingual') return '';

    // 如果 topText 使用了 zh，底部副行显示英文 en (或非 zh 的 text)
    if (activeSubtitle.zh && topText === activeSubtitle.zh) {
      return activeSubtitle.en || (activeSubtitle.text !== activeSubtitle.zh ? activeSubtitle.text : '');
    }

    // 如果 topText 显示了纯 text 且存在独立的 en 且不相等，在底部参考显示 en
    if (activeSubtitle.en && topText !== activeSubtitle.en) {
      return activeSubtitle.en;
    }

    return '';
  }, [activeSubtitle, displayLang, topText]);

  // 如果主文字和副文字均为空，不渲染
  if (!topText && !bottomText) return null;

  // 字号映射表 (main: 中文主字号, sub: 英文参考字号-尽可能小)
  const sizeStyles = {
    small: { main: '15px', sub: '11px', padding: '6px 16px' },
    medium: { main: '18px', sub: '12px', padding: '8px 20px' },
    large: { main: '22px', sub: '13px', padding: '10px 24px' },
    xlarge: { main: '26px', sub: '14px', padding: '12px 28px' },
  };

  const currentSize = sizeStyles[fontSize] || sizeStyles.medium;

  // 位置样式
  const positionStyle = position === 'top'
    ? { top: '24px', bottom: 'auto' }
    : { bottom: '42px', top: 'auto' };

  return (
    <div
      className={`cinema-subtitle-overlay-container ${position}`}
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '850px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'none',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        ...positionStyle,
      }}
    >
      <div
        className={`cinema-subtitle-box style-${style}`}
        style={{
          textAlign: 'center',
          lineHeight: 1.35,
          padding: currentSize.padding,
          borderRadius: '14px',
          maxWidth: '100%',
          wordBreak: 'break-word',
          userSelect: 'none',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif',
          animation: 'cinemaSubtitleFadeIn 0.2s ease-out forwards',
        }}
      >
        {/* 第一行 (在上)：中文为主内容 (Netflix 经典亮黄 #FFDE00, 中等字号, 600 字重) */}
        {topText && (
          <div
            className="cinema-subtitle-line top-main"
            style={{
              fontSize: currentSize.main,
              fontWeight: 600,
              color: '#FFDE00', // Netflix 经典中文字幕黄
              letterSpacing: '0.025em',
              lineHeight: 1.35,
            }}
          >
            {topText}
          </div>
        )}

        {/* 第二行 (在下)：英文为参考内容 (Netflix 极小冷白/轻度半透明, 与中文形成鲜明颜色区别) */}
        {bottomText && (
          <div
            className="cinema-subtitle-line bottom-ref"
            style={{
              fontSize: currentSize.sub,
              fontWeight: 400,
              color: 'rgba(240, 240, 245, 0.82)', // Netflix 辅助英文冷白
              marginTop: topText ? '4px' : '0px',
              letterSpacing: '0.015em',
              lineHeight: 1.25,
            }}
          >
            {bottomText}
          </div>
        )}
      </div>
    </div>
  );
}
