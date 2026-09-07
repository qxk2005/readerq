'use client';

import React, { useMemo, useEffect, useRef, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link as LinkIcon, RefreshCw, Sparkles, Loader2, Cpu } from 'lucide-react';
import { sanitizeMarkdownQuotes } from '@/lib/utils';

/**
 * 局部错误边界：用于捕获并自愈任何浏览器 DOM 协调异常
 * 例如在包含文本选区或第三方划词扩展修改 DOM 时，React 19 可能抛出
 * "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node"
 * 发生此类异常时，通过重置内部 key 自动卸载并重建纯净 DOM 树，彻底避免应用崩溃或红屏
 */
class BlogRendererErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorKey: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[GeneralBlogArticleRenderer] 捕获到 Markdown DOM 渲染异常，已触发安全自愈重挂载:', error?.message);
    this.setState(prev => ({
      errorKey: prev.errorKey + 1,
      hasError: false
    }));
  }

  render() {
    return (
      <React.Fragment key={this.state.errorKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

/**
 * 通用文章 AI 博客 Markdown 渲染器
 * 支持流式生成进度显示、[原文](#quote-...) 锚点转换及重置生成操作
 */
const GeneralBlogArticleRenderer = React.memo(
  function GeneralBlogArticleRenderer({
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

    // 在 Effect 中将 DOM 引用同步回父组件传入的 articleRef，遵守 React 19 不可变性规范
    useEffect(() => {
      if (articleRef) {
        if (typeof articleRef === 'function') {
          articleRef(internalRef.current);
        } else if (typeof articleRef === 'object') {
          articleRef.current = internalRef.current;
        }
      }
    }, [articleRef]);

    // 当 blogContent 改变且不在生成中时，通知父组件 DOM 已就绪
    useEffect(() => {
      if (blogContent && !isGenerating && onRendered) {
        const timer = setTimeout(() => {
          const domContainer = internalRef.current || (articleRef?.current) || document.querySelector('.blog-article');
          if (domContainer) {
            onRendered(domContainer);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [blogContent, isGenerating, onRendered, articleRef]);

    // 预处理 Markdown：自动清洗与 URI 编码 [原文](#quote-含空格或英文的短语) 中的 URL 部分
    // 解决 CommonMark 规范不允许 URL 包含未转义空格/特殊符号导致 [原文](#quote-foo bar) 无法解析为 <a> 链接的问题
    const sanitizedBlogContent = useMemo(() => {
      if (!blogContent) return '';
      return sanitizeMarkdownQuotes(blogContent);
    }, [blogContent]);

    // 生成轮次自增 Key：每次重新触发生成时递增，确保以干净且无任何 <mark> 污染的全新 DOM 树挂载
    const generationKeyRef = useRef(0);
    const prevGeneratingRef = useRef(isGenerating);
    useEffect(() => {
      if (!prevGeneratingRef.current && isGenerating) {
        generationKeyRef.current += 1;
      }
      prevGeneratingRef.current = isGenerating;
    }, [isGenerating]);

    const components = useMemo(() => ({
      a: ({ href, children }) => {
        if (href && href.startsWith('#quote-')) {
          const rawQuote = href.replace(/^#quote-/, '');
          let quoteText = rawQuote;
          try {
            quoteText = decodeURIComponent(rawQuote);
          } catch (e) {
            quoteText = rawQuote;
          }
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
      <BlogRendererErrorBoundary>
        <div
          className="blog-article reading-article-body"
          ref={internalRef}
          key={`blog-root-${generationKeyRef.current}`}
        >
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
            {sanitizedBlogContent}
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
      </BlogRendererErrorBoundary>
    );
  },
  (prevProps, nextProps) => {
    // 关键优化：精准 memo 比较，彻底阻断由于父组件 selection（划词圈定）、滚动位置、侧边栏展开折叠等局部状态变化引发的无谓重渲染
    // 避免在用户划选文本或已有 <mark> 标签存在时，React 尝试 DOM Reconciliation 导致 insertBefore 崩溃
    if (prevProps.blogContent !== nextProps.blogContent) return false;
    if (prevProps.isGenerating !== nextProps.isGenerating) return false;
    if (prevProps.streamProgress !== nextProps.streamProgress) return false;
    if (prevProps.onQuoteClick !== nextProps.onQuoteClick) return false;
    if (prevProps.onRegenerate !== nextProps.onRegenerate) return false;
    return true;
  }
);

export default GeneralBlogArticleRenderer;
