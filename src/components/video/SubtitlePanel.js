'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { formatTimestamp, formatSubtitlesForAI } from '@/lib/subtitleParser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, FileText, BookOpen, RefreshCw, Sparkles } from 'lucide-react';

/**
 * 字幕面板组件
 * 支持字幕视图（自动滚动同步）和博客视图（AI 转译）
 * 
 * @param {Array} subtitles - 解析后的字幕段落数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @param {function} onSeek - 跳转到指定时间的回调
 * @param {boolean} autoScroll - 是否自动滚动
 * @param {string} title - 视频标题
 * @param {string} blogPrompt - 用户自定义的博客转译提示词
 */
export default function SubtitlePanel({ subtitles, currentTime, onSeek, autoScroll = true, title, blogPrompt }) {
  const [mode, setMode] = useState('subtitle'); // 'subtitle' | 'blog'
  const [blogContent, setBlogContent] = useState('');
  const [isBlogLoading, setIsBlogLoading] = useState(false);
  const [blogError, setBlogError] = useState(null);
  const scrollContainerRef = useRef(null);
  const activeSegmentRef = useRef(null);
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // 计算当前活跃的字幕段落索引
  const activeIndex = useMemo(() => {
    if (!subtitles || subtitles.length === 0 || currentTime === undefined) return -1;
    // 找到最后一个 time <= currentTime 的段落
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

  // 监听用户手动滚动，暂停自动滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      userScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      // 用户停止滚动后 3 秒恢复自动滚动
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

  // 自动滚动到当前活跃段落
  useEffect(() => {
    if (mode !== 'subtitle' || !autoScroll || userScrollingRef.current || activeIndex < 0) return;
    if (!activeSegmentRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const element = activeSegmentRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // 检查元素是否在可视区域内
    const isVisible = elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
    if (!isVisible) {
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = relativeTop - containerRect.height / 3;
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
  }, [activeIndex, mode, autoScroll]);

  // 生成博客文章
  const generateBlog = useCallback(async () => {
    if (!subtitles || subtitles.length === 0) return;
    
    setIsBlogLoading(true);
    setBlogError(null);
    setBlogContent('');

    try {
      const transcript = formatSubtitlesForAI(subtitles);
      const res = await fetch('/api/ai/blog-convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: title || '未知视频',
          customPrompt: blogPrompt || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `请求失败 (${res.status})`);
      }

      // 流式读取
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setBlogContent(accumulated);
      }
    } catch (err) {
      console.error('博客转译失败:', err);
      setBlogError(err.message);
    } finally {
      setIsBlogLoading(false);
    }
  }, [subtitles, title, blogPrompt]);


  return (
    <div className="subtitle-panel">
      {/* 工具栏 */}
      <div className="subtitle-toolbar">
        <div className="subtitle-toolbar-tabs">
          <button
            className={`subtitle-tab-btn ${mode === 'subtitle' ? 'active' : ''}`}
            onClick={() => setMode('subtitle')}
          >
            <FileText size={14} />
            字幕正文
          </button>
          <button
            className={`subtitle-tab-btn ${mode === 'blog' ? 'active' : ''}`}
            onClick={() => setMode('blog')}
          >
            <BookOpen size={14} />
            博客文章
          </button>
        </div>
        {mode === 'blog' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={generateBlog}
            disabled={isBlogLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)' }}
          >
            {isBlogLoading ? (
              <><Loader2 size={14} className="spin" /> 生成中...</>
            ) : blogContent ? (
              <><RefreshCw size={14} /> 重新生成</>
            ) : (
              <><Sparkles size={14} /> 生成博客</>
            )}
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="subtitle-content" ref={scrollContainerRef}>
        {mode === 'subtitle' ? (
          /* 字幕视图 */
          subtitles && subtitles.length > 0 ? (
            <div className="subtitle-segments">
              {subtitles.map((seg, index) => (
                <div
                  key={index}
                  ref={index === activeIndex ? activeSegmentRef : null}
                  className={`subtitle-segment ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => onSeek && onSeek(seg.time)}
                >
                  {!seg.estimated && (
                    <span className="subtitle-timestamp">
                      {seg.timeStr}
                    </span>
                  )}
                  <span className="subtitle-text">{seg.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="subtitle-empty">
              <FileText size={32} />
              <p>此视频暂无可解析的字幕内容</p>
            </div>
          )
        ) : (
          /* 博客视图 */
          <div className="blog-article-container">
            {blogError && (
              <div className="blog-error">
                <p>博客转译失败: {blogError}</p>
                <button className="btn btn-sm" onClick={generateBlog}>重试</button>
              </div>
            )}
            {blogContent ? (
              <div className="blog-article reading-article-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {blogContent}
                </ReactMarkdown>
              </div>
            ) : !isBlogLoading ? (
              <div className="subtitle-empty">
                <Sparkles size={32} />
                <p>点击上方「生成博客」按钮，AI 将把字幕转译为 InfoQ 风格的博客文章</p>
              </div>
            ) : (
              <div className="subtitle-empty">
                <Loader2 size={32} className="spin" />
                <p>正在调用 AI 生成博客文章，请稍候...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
