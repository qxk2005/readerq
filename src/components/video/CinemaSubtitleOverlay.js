'use client';

import React, { useMemo } from 'react';

/**
 * 电影播放模式 - 画面浮动双语字幕组件 (Cinema Subtitle Overlay - Netflix Style)
 * 沉浸式挂载在 YouTube 视频视口上层
 *
 * ⚠️ 重要修复说明：
 * 此组件永远不返回 null，始终渲染一个固定结构的 DOM 树。
 * 使用 CSS display:none 控制显隐。这是因为：
 * 1. 组件是 YouTubePlayer 的兄弟节点，和被 YouTube IFrame API 篡改过 DOM 的元素共享同一个父容器
 * 2. 条件返回 null 会导致父容器的 DOM 子节点数量变化
 * 3. React 19 reconciler 在处理子节点变化时可能触碰被篡改的兄弟节点，导致 removeChild 异常
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

  // ⚠️ React Rules of Hooks: 所有 hooks 必须在条件返回之前无条件调用
  const topText = useMemo(() => {
    if (!activeSubtitle) return '';
    if (displayLang === 'zh') {
      return activeSubtitle.zh || activeSubtitle.text || '';
    }
    if (displayLang === 'en') {
      return activeSubtitle.en || activeSubtitle.text || '';
    }
    return activeSubtitle.zh || activeSubtitle.text || '';
  }, [activeSubtitle, displayLang]);

  const bottomText = useMemo(() => {
    if (!activeSubtitle) return '';
    if (displayLang !== 'bilingual') return '';
    if (activeSubtitle.zh && topText === activeSubtitle.zh) {
      return activeSubtitle.en || (activeSubtitle.text !== activeSubtitle.zh ? activeSubtitle.text : '');
    }
    if (activeSubtitle.en && topText !== activeSubtitle.en) {
      return activeSubtitle.en;
    }
    return '';
  }, [activeSubtitle, displayLang, topText]);

  // 判断是否应该显示 overlay
  const shouldShow = !dualPanel && enabled && activeSubtitle && (topText || bottomText);

  // 字号映射表
  const sizeStyles = {
    small: { main: '15px', sub: '11px', padding: '6px 16px' },
    medium: { main: '18px', sub: '12px', padding: '8px 20px' },
    large: { main: '22px', sub: '13px', padding: '10px 24px' },
    xlarge: { main: '26px', sub: '14px', padding: '12px 28px' },
  };

  const currentSize = sizeStyles[fontSize] || sizeStyles.medium;

  const positionStyle = position === 'top'
    ? { top: '24px', bottom: 'auto' }
    : { bottom: '42px', top: 'auto' };

  // ⚠️ 永远不返回 null！始终渲染固定结构的 DOM，用 display:none 控制显隐
  return (
    <div
      className={`cinema-subtitle-overlay-container ${position}`}
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '850px',
        display: shouldShow ? 'flex' : 'none',
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
          animation: shouldShow ? 'cinemaSubtitleFadeIn 0.2s ease-out forwards' : 'none',
        }}
      >
        {/* 第一行 (在上)：中文为主内容 */}
        <div
          className="cinema-subtitle-line top-main"
          style={{
            fontSize: currentSize.main,
            fontWeight: 600,
            color: '#FFDE00',
            letterSpacing: '0.025em',
            lineHeight: 1.35,
            display: topText ? undefined : 'none',
          }}
        >
          <span>{topText || ''}</span>
        </div>

        {/* 第二行 (在下)：英文为参考内容 */}
        <div
          className="cinema-subtitle-line bottom-ref"
          style={{
            fontSize: currentSize.sub,
            fontWeight: 400,
            color: 'rgba(240, 240, 245, 0.82)',
            marginTop: topText ? '4px' : '0px',
            letterSpacing: '0.015em',
            lineHeight: 1.25,
            display: bottomText ? undefined : 'none',
          }}
        >
          <span>{bottomText || ''}</span>
        </div>
      </div>
    </div>
  );
}
