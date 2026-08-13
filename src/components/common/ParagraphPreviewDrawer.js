'use client';

import React, { useMemo } from 'react';
import { X, ExternalLink, Quote } from 'lucide-react';

/**
 * 博客模式下点击原文引用锚点时弹出的主题自适应浮动预览抽屉
 */
export default function ParagraphPreviewDrawer({
  isOpen,
  onClose,
  quoteText,
  paragraphText,
  onJumpToOriginal,
}) {
  const displayQuote = useMemo(() => {
    if (!quoteText) return '';
    try {
      return decodeURIComponent(quoteText).replace(/^#quote-/, '').trim();
    } catch {
      return quoteText.replace(/^#quote-/, '').trim();
    }
  }, [quoteText]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '680px',
        maxHeight: '48vh',
        zIndex: 9999,
        backgroundColor: 'var(--color-bg-elevated, var(--color-bg-primary, #ffffff))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '16px',
        border: '1px solid var(--color-border, rgba(0, 0, 0, 0.12))',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.22), 0 0 0 1px var(--color-border-subtle, rgba(255, 255, 255, 0.05)) inset',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUpDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 头部标题区域 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))',
          backgroundColor: 'var(--color-bg-secondary, rgba(0, 0, 0, 0.03))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-accent, #007aff)' }}>
          <Quote size={16} />
          <span>原文段落对比预览</span>
          {displayQuote && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0, 122, 255, 0.12)',
                color: 'var(--color-accent, #007aff)',
                maxWidth: '240px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={displayQuote}
            >
              “{displayQuote}”
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-tertiary, #8e8e93)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s ease',
          }}
          title="关闭预览"
        >
          <X size={18} />
        </button>
      </div>

      {/* 正文内容展示区域 */}
      <div
        style={{
          padding: '18px 22px',
          overflowY: 'auto',
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'var(--color-text-primary, #1e1e24)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          flex: 1,
        }}
      >
        {paragraphText ? (
          <div>{paragraphText}</div>
        ) : (
          <div style={{ color: 'var(--color-text-muted, #8e8e93)', fontStyle: 'italic' }}>
            未在正文中精确定位到该引用，建议切换至正文模式全文检索。
          </div>
        )}
      </div>

      {/* 底部操作工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '12px 18px',
          borderTop: '1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))',
          backgroundColor: 'var(--color-bg-secondary, rgba(0, 0, 0, 0.03))',
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border, rgba(0, 0, 0, 0.15))',
            backgroundColor: 'var(--color-bg-tertiary, transparent)',
            color: 'var(--color-text-secondary, #444444)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          关闭
        </button>
        {onJumpToOriginal && (
          <button
            onClick={() => {
              onClose();
              onJumpToOriginal();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--color-accent, #007aff)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
            }}
          >
            <ExternalLink size={14} />
            定位跳转至正文该处
          </button>
        )}
      </div>
    </div>
  );
}
