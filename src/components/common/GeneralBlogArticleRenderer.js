'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link as LinkIcon, RefreshCw, Sparkles, Loader2, Cpu, CheckCircle2 } from 'lucide-react';

/**
 * 通用文章 AI 博客 Markdown 渲染器
 * 支持流式生成进度显示、[原文](#quote-...) 锚点转换及重置生成操作
 */
const GeneralBlogArticleRenderer = React.memo(function GeneralBlogArticleRenderer({
  blogContent,
  onQuoteClick,
  articleRef,
  isGenerating,
  streamProgress,
  onRegenerate,
  onRendered,
}) {
  // 内部 ref 用于跟踪 .blog-article 容器
  const internalRef = useRef(null);
  const resolvedRef = articleRef || internalRef;

  // 当 blogContent 改变且不在生成中时，通知父组件 DOM 已就绪
  const lastNotifiedContentRef = useRef('');
  useEffect(() => {
    if (blogContent && !isGenerating && onRendered && resolvedRef.current) {
      // 避免对同一个内容重复通知
      if (lastNotifiedContentRef.current === blogContent) return;
      lastNotifiedContentRef.current = blogContent;
      // 等待 React 完成 DOM 更新后再回调
      const timer = setTimeout(() => {
        if (resolvedRef.current) {
          onRendered(resolvedRef.current);
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [blogContent, isGenerating, onRendered, resolvedRef]);
  const components = useMemo(() => ({
    a: ({ href, children }) => {
      if (href && href.startsWith('#quote-')) {
        const quoteText = href.replace(/^#quote-/, '');
        return (
          <span
            className="blog-quote-anchor"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onQuoteClick) onQuoteClick(quoteText);
            }}
            title="点击浮动预览对应原文段落"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 8px',
              margin: '0 4px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 122, 255, 0.12)',
              color: 'var(--color-accent, #007aff)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid rgba(0, 122, 255, 0.25)',
              userSelect: 'none',
              verticalAlign: 'middle',
              transition: 'all 0.15s ease',
            }}
          >
            <LinkIcon size={11} />
            {children || '原文'}
          </span>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
  }), [onQuoteClick]);

  // 尚未收到流式内容时的生成进度与动效视图
  if (isGenerating && !blogContent) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          margin: '32px 0',
          borderRadius: '16px',
          backgroundColor: 'var(--color-bg-secondary, rgba(0, 122, 255, 0.03))',
          border: '1px solid var(--color-border-subtle, rgba(0, 122, 255, 0.15))',
          gap: '20px',
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-accent, #007aff)' }} />
          <Cpu size={16} style={{ position: 'absolute', color: 'var(--color-accent, #007aff)' }} />
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            AI 智能博客导读提炼中...
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-accent, #007aff)', fontWeight: 500 }}>
            {streamProgress || '正在连接 AI 大模型进行长文逻辑拆解...'}
          </div>
        </div>

        {/* 动态脉冲骨架屏预览 */}
        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <div style={{ height: '14px', width: '70%', borderRadius: '4px', backgroundColor: 'var(--color-border, rgba(0, 122, 255, 0.1))', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: '14px', width: '95%', borderRadius: '4px', backgroundColor: 'var(--color-border, rgba(0, 122, 255, 0.1))', animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
          <div style={{ height: '14px', width: '85%', borderRadius: '4px', backgroundColor: 'var(--color-border, rgba(0, 122, 255, 0.1))', animation: 'pulse 1.5s ease-in-out 0.4s infinite' }} />
        </div>
      </div>
    );
  }

  // 无内容且未在生成
  if (!blogContent) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <p style={{ marginBottom: '16px', fontSize: '14px' }}>该文章尚未生成 AI 博客导读。</p>
        {onRegenerate && (
          <button
            className="btn btn-primary"
            onClick={onRegenerate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', fontSize: '13px', borderRadius: '20px' }}
          >
            <Sparkles size={14} />
            立即生成 AI 博客
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="blog-article reading-article-body" ref={resolvedRef}>
      {/* 实时流式生成中顶部进度状态条 */}
      {isGenerating && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 122, 255, 0.08)',
            border: '1px solid rgba(0, 122, 255, 0.25)',
            fontSize: '13px',
            color: 'var(--color-accent, #007aff)',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={16} className="animate-spin" />
            <span>{streamProgress || 'AI 正在实时流式撰写博客中...'}</span>
          </div>
          <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: 600 }}>{blogContent.length} 字</span>
        </div>
      )}

      {/* 实时流式输出的 Markdown 文章渲染 */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {blogContent}
      </ReactMarkdown>

      {/* 生成完成后的底部重新生成按钮 */}
      {onRegenerate && !isGenerating && (
        <div style={{ marginTop: '36px', paddingTop: '16px', borderTop: '1px dashed var(--color-border-subtle, rgba(0,0,0,0.1))', textAlign: 'right' }}>
          <button
            onClick={onRegenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
              borderRadius: '8px',
              padding: '5px 12px',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} /> 重新生成 AI 博客
          </button>
        </div>
      )}
    </div>
  );
});

export default GeneralBlogArticleRenderer;
