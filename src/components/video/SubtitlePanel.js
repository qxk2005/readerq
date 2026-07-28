'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { formatTimestamp, formatSubtitlesForAI, parseTimestamp } from '@/lib/subtitleParser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, FileText, BookOpen, RefreshCw, Sparkles, Upload, Trash2, CheckCircle, Play, Languages } from 'lucide-react';

// 动态解析包含时间戳的节点，并将时间戳转化为可点击跳转的跳播 Badge
const renderTextWithTimestamps = (textNode, onSeek) => {
  if (typeof textNode !== 'string') return textNode;

  const timestampRegex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = timestampRegex.exec(textNode)) !== null) {
    const startIdx = match.index;
    const timeStr = match[1];
    const fullMatch = match[0];

    if (startIdx > lastIdx) {
      parts.push(textNode.substring(lastIdx, startIdx));
    }

    const seconds = parseTimestamp(timeStr);

    parts.push(
      <span
        key={`${startIdx}_${timeStr}`}
        className="blog-timestamp-badge"
        onClick={(e) => {
          e.stopPropagation();
          if (onSeek) onSeek(seconds);
        }}
        title={`点击跳转到视频 ${timeStr} 处播放`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          padding: '1px 7px',
          margin: '0 4px',
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          color: 'var(--color-accent, #007aff)',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          border: '1px solid rgba(0, 122, 255, 0.25)',
          userSelect: 'none',
          verticalAlign: 'middle',
          transition: 'all 0.15s ease',
        }}
      >
        <Play size={10} fill="currentColor" />
        {timeStr}
      </span>
    );

    lastIdx = startIdx + fullMatch.length;
  }

  if (lastIdx < textNode.length) {
    parts.push(textNode.substring(lastIdx));
  }

  return parts.length > 0 ? parts : textNode;
};

const processChildrenForTimestamps = (children, onSeek) => {
  if (typeof children === 'string') {
    return renderTextWithTimestamps(children, onSeek);
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) =>
      typeof child === 'string'
        ? <span key={idx}>{renderTextWithTimestamps(child, onSeek)}</span>
        : child
    );
  }
  return children;
};

/**
 * 字幕面板组件
 * 支持字幕视图（自动滚动同步）和博客视图（AI 转译）
 */
export default function SubtitlePanel({ 
  subtitles, currentTime, onSeek, autoScroll = true, title, blogPrompt,
  documentId, isUsingUploadedSubtitles, onSubtitleUploaded, onSubtitleDeleted,
  articleRef, selectedDoc, onBlogUpdated,
  mode, onModeChange,
  hasNewerSubtitleVersion, onApplyNewerSubtitles, isApplyingNewerSubtitles, onIgnoreNewerSubtitles
}) {
  const [blogContent, setBlogContent] = useState('');
  const [isBlogLoading, setIsBlogLoading] = useState(false);
  const [blogError, setBlogError] = useState(null);
  const scrollContainerRef = useRef(null);
  const activeSegmentRef = useRef(null);
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // SRT 上传相关状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const srtFileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  // 跨客户端博客最新版本提醒控制 State
  const [hasNewerBlogVersion, setHasNewerBlogVersion] = useState(false);
  const [newerBlogContent, setNewerBlogContent] = useState('');
  const [blogSuccessNotice, setBlogSuccessNotice] = useState('');

  // 监听文档切换，自动加载博客内容并对比云端 OSS 最新版本
  useEffect(() => {
    if (!documentId) return;
    
    if (selectedDoc?.blog_content) {
      setBlogContent(selectedDoc.blog_content);
    }

    setIsBlogLoading(!selectedDoc?.blog_content);
    setBlogError(null);

    // 始终发起 API 获取与版本对比，探测云端 OSS 是否产生了跨客户端更新
    fetch(`/api/documents/${documentId}/blog`)
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.blogContent) {
          setBlogContent(data.blogContent);
          onBlogUpdated?.(data.blogContent);

          if (data.hasNewerVersion && data.newerBlogContent) {
            setHasNewerBlogVersion(true);
            setNewerBlogContent(data.newerBlogContent);
          } else {
            setHasNewerBlogVersion(false);
            setNewerBlogContent('');
          }
        } else {
          setBlogContent('');
        }
      })
      .catch(err => {
        console.error('加载博客失败:', err);
        setBlogError('加载博客失败，请重试');
      })
      .finally(() => {
        setIsBlogLoading(false);
      });
  }, [documentId]);

  // 应用跨客户端最新的博客版本
  const handleApplyNewerBlog = async () => {
    if (!newerBlogContent || !documentId) return;
    setBlogContent(newerBlogContent);
    setHasNewerBlogVersion(false);
    
    await saveBlogToServer(documentId, newerBlogContent);
    setBlogSuccessNotice('已成功切换并同步为最新云端博客版本！');
    setTimeout(() => setBlogSuccessNotice(''), 3500);
  };

  // 新增保存博客的辅助函数
  const saveBlogToServer = async (id, content) => {
    try {
      const res = await fetch(`/api/documents/${id}/blog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogContent: content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '同步博客失败');
      }
      onBlogUpdated?.(content);
    } catch (err) {
      console.error('[博客同步] 失败:', err);
    }
  };

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

      // 保存到本地及云端 OSS 同步
      if (accumulated && documentId) {
        await saveBlogToServer(documentId, accumulated);
      }
    } catch (err) {
      console.error('博客转译失败:', err);
      setBlogError(err.message);
    } finally {
      setIsBlogLoading(false);
    }
  }, [subtitles, title, blogPrompt, documentId]);

  // 上传 SRT 字幕文件
  const handleSrtUpload = useCallback(async (file) => {
    if (!file || !documentId) return;

    // 验证文件扩展名
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'srt') {
      setUploadError('请选择 .srt 格式的字幕文件');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/documents/${documentId}/subtitles`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || '上传字幕失败');
      }

      setUploadSuccess(data.ossSynced ? 'synced' : 'local');
      if (onSubtitleUploaded && data.subtitles) {
        onSubtitleUploaded(data.subtitles);
      }

      // 5 秒后清除成功提示
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err) {
      console.error('上传字幕失败:', err);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [documentId, onSubtitleUploaded]);

  // 删除用户上传的字幕
  const handleDeleteSubtitle = useCallback(async () => {
    if (!documentId) return;
    if (!confirm('确定要删除已上传的字幕吗？将恢复使用原始字幕数据。')) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/subtitles`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || '删除字幕失败');
      }
      if (onSubtitleDeleted) {
        onSubtitleDeleted();
      }
    } catch (err) {
      console.error('删除字幕失败:', err);
      setUploadError(err.message);
    }
  }, [documentId, onSubtitleDeleted]);

  // 文件选择处理
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleSrtUpload(file);
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 拖拽处理
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSrtUpload(file);
  };


  const [isTranslatingBilingual, setIsTranslatingBilingual] = useState(false);

  const handleTranslateBilingual = useCallback(async () => {
    if (!subtitles || subtitles.length === 0 || !documentId) return;
    setIsTranslatingBilingual(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srtContent: formatSubtitlesForAI(subtitles) }),
      });
      const data = await res.json();
      if (res.ok && data.subtitles) {
        onSubtitleUploaded?.(data.subtitles);
      }
    } catch (err) {
      console.error('翻译中英双语失败:', err);
    } finally {
      setIsTranslatingBilingual(false);
    }
  }, [subtitles, documentId, onSubtitleUploaded]);

  return (
    <div className="subtitle-panel">
      {/* 工具栏 */}
      <div className="subtitle-toolbar">
        <div className="subtitle-toolbar-tabs">
          <button
            className={`subtitle-tab-btn ${mode === 'subtitle' ? 'active' : ''}`}
            onClick={() => onModeChange?.('subtitle')}
          >
            <FileText size={14} />
            字幕正文
          </button>
          <button
            className={`subtitle-tab-btn ${mode === 'blog' ? 'active' : ''}`}
            onClick={() => onModeChange?.('blog')}
          >
            <BookOpen size={14} />
            博客文章
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* 生成双语按钮 */}
          {mode === 'subtitle' && subtitles && subtitles.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleTranslateBilingual}
              disabled={isTranslatingBilingual}
              title="调用 AI 翻译生成上面中文、下面英文的双语字幕"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}
            >
              {isTranslatingBilingual ? <Loader2 size={14} className="spin" /> : <Languages size={14} />}
              {isTranslatingBilingual ? '翻译中...' : '生成双语'}
            </button>
          )}

          {/* 字幕来源标识 */}
          {mode === 'subtitle' && isUsingUploadedSubtitles && (
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 8px',
              background: 'rgba(34, 197, 94, 0.08)',
              borderRadius: '10px',
            }}>
              <CheckCircle size={12} />
              用户字幕
            </span>
          )}
          {/* 上传/替换字幕按钮 */}
          {mode === 'subtitle' && documentId && (
            <>
              <input
                type="file"
                ref={srtFileInputRef}
                accept=".srt"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => srtFileInputRef.current?.click()}
                disabled={isUploading}
                title={isUsingUploadedSubtitles ? '替换字幕文件' : '上传 SRT 字幕'}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}
              >
                {isUploading ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Upload size={14} />
                )}
                {isUsingUploadedSubtitles ? '替换' : '上传字幕'}
              </button>
              {isUsingUploadedSubtitles && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleDeleteSubtitle}
                  title="删除用户上传的字幕"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
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
      </div>

      {/* 上传错误提示 */}
      {uploadError && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
          color: 'var(--color-danger)',
          fontSize: 'var(--text-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 4px' }}
          >✕</button>
        </div>
      )}
      {uploadSuccess && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(34, 197, 94, 0.08)',
          borderBottom: '1px solid rgba(34, 197, 94, 0.15)',
          color: 'var(--color-success)',
          fontSize: 'var(--text-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <CheckCircle size={12} />
          <span>
            {uploadSuccess === 'synced'
              ? '字幕上传成功，已同步到云端（其他设备可共享）'
              : '字幕上传成功（仅本地保存，配置 OSS 后可跨设备同步）'}
          </span>
        </div>
      )}

      {/* 内容区域 */}
      <div className="subtitle-content" ref={scrollContainerRef}>

        {mode === 'subtitle' ? (
          /* 字幕视图 (支持中英文双语) */
          <React.Fragment>
            {/* 📢 跨端最新双语字幕提醒 Banner */}
            {hasNewerSubtitleVersion && (
              <div style={{
                margin: '12px 16px 16px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.08), rgba(52, 199, 89, 0.08))',
                border: '1px solid rgba(0, 122, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0, 122, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  <Sparkles size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                  <span>检测到此视频已在其他设备更新了最新版本的双语字幕</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={onApplyNewerSubtitles}
                    disabled={isApplyingNewerSubtitles}
                    style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isApplyingNewerSubtitles ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                    {isApplyingNewerSubtitles ? '正在同步...' : '切换为最新字幕'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onIgnoreNewerSubtitles}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--color-text-tertiary)' }}
                  >
                    忽略
                  </button>
                </div>
              </div>
            )}

            {subtitles && subtitles.length > 0 ? (
              <div className="subtitle-segments">
              {subtitles.map((seg, index) => (
                <div
                  key={index}
                  ref={index === activeIndex ? activeSegmentRef : null}
                  className={`subtitle-segment ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => onSeek && onSeek(seg.time)}
                  style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}
                >
                  {!seg.estimated && (
                    <span className="subtitle-timestamp" style={{ cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}>
                      {seg.timeStr}
                    </span>
                  )}
                  <div className="subtitle-bilingual-content" style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    {/* 上面：中文 */}
                    <div className="subtitle-text-zh" style={{ fontWeight: '500', color: 'var(--color-text-primary)', fontSize: '14px', lineHeight: '1.5' }}>
                      {seg.zh || seg.text}
                    </div>
                    {/* 下面：英文 (只要源文本包含英文或拥有 seg.en，统一规范呈现下面英文) */}
                    {(() => {
                      const enText = seg.en || (/[a-zA-Z]{2,}/.test(seg.text) ? seg.text : '');
                      if (!enText || enText === seg.zh) return null;
                      return (
                        <div className="subtitle-text-en" style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', lineHeight: '1.4' }}>
                          {enText}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 无字幕时的上传入口 */
            <div
              className="subtitle-empty"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragOver ? '2px dashed var(--color-accent)' : '2px dashed transparent',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                background: isDragOver ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                cursor: documentId ? 'pointer' : 'default',
              }}
              onClick={() => documentId && srtFileInputRef.current?.click()}
            >
              <Upload size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: '8px' }} />
              <p style={{ fontWeight: '500', marginBottom: '4px' }}>此视频暂无可解析的字幕内容</p>
              {documentId && (
                <>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    拖拽 SRT 字幕文件到此处，或点击上传
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                    上传后将自动进行 ≤10秒 智能段落合并与 AI 中英文双语化
                  </p>
                </>
              )}
            </div>
          )}
        </React.Fragment>
      ) : (
          /* 博客视图 (支持章节与文本时间戳跳播) */
          <div className="blog-article-container">
            {/* 📢 跨端最新博客版本提醒 Banner */}
            {hasNewerBlogVersion && (
              <div style={{
                margin: '0 0 16px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.08), rgba(52, 199, 89, 0.08))',
                border: '1px solid rgba(0, 122, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0, 122, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  <Sparkles size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                  <span>检测到此视频已在其他设备生成了最新版本的博客文章</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleApplyNewerBlog}
                    style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={13} /> 切换为最新版本
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setHasNewerBlogVersion(false)}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--color-text-tertiary)' }}
                  >
                    忽略
                  </button>
                </div>
              </div>
            )}

            {/* 成功更新成功通知 */}
            {blogSuccessNotice && (
              <div style={{
                margin: '0 0 16px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: 'var(--color-success)',
                fontSize: '12.5px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle size={14} />
                <span>{blogSuccessNotice}</span>
              </div>
            )}

            {blogError && (
              <div className="blog-error">
                <p>博客转译失败: {blogError}</p>
                <button className="btn btn-sm" onClick={generateBlog}>重试</button>
              </div>
            )}
            {blogContent ? (
              <div className="blog-article reading-article-body" ref={articleRef}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1>{processChildrenForTimestamps(children, onSeek)}</h1>,
                    h2: ({ children }) => <h2>{processChildrenForTimestamps(children, onSeek)}</h2>,
                    h3: ({ children }) => <h3>{processChildrenForTimestamps(children, onSeek)}</h3>,
                    h4: ({ children }) => <h4>{processChildrenForTimestamps(children, onSeek)}</h4>,
                    p: ({ children }) => <p>{processChildrenForTimestamps(children, onSeek)}</p>,
                    li: ({ children }) => <li>{processChildrenForTimestamps(children, onSeek)}</li>,
                  }}
                >
                  {blogContent}
                </ReactMarkdown>
              </div>
            ) : !isBlogLoading ? (
              <div className="subtitle-empty">
                <Sparkles size={32} />
                <p>点击上方「生成博客」按钮，AI 将把字幕转译为带章节时间戳的博客文章</p>
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
