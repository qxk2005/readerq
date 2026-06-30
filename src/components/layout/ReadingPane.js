'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { formatDate, extractDomain, CATEGORY_LABELS } from '@/lib/utils';
import { getTextOffset, restoreHighlights } from '@/lib/highlight';
import GhostReader from '@/components/ai/GhostReader';
import HighlightEditor from '@/components/HighlightEditor';
import TagInput from '@/components/TagInput';
import { BookOpen, Link, Info, Edit3, Bot, Loader2, ClipboardList, AlertTriangle, RefreshCw, CheckCircle2, XCircle, ImageIcon, Upload } from 'lucide-react';

export default function ReadingPane() {
  const { 
    selectedDoc, 
    rightPanelTab, 
    setRightPanelTab, 
    isContentLoading, 
    contentError, 
    fetchDocumentDetails, 
    updateDocumentLocally,
    tags: allTags 
  } = useApp();
  
  const { fontSize, lineHeight, contentWidth, fontFamily } = useTheme();

  const [highlights, setHighlights] = useState([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(true);
  const [selection, setSelection] = useState(null);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [verifyingHlId, setVerifyingHlId] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState({}); // { [id]: { synced: boolean, message: string } }
  const [docTags, setDocTags] = useState([]);
  const [docNote, setDocNote] = useState('');
  const [isSavingDocMetadata, setIsSavingDocMetadata] = useState(false);
  const [highlightsError, setHighlightsError] = useState(null);
  const [imageUploadStatus, setImageUploadStatus] = useState({}); // { [highlightId]: { status: 'uploading'|'success'|'error', images: [] } }
  
  // 在渲染阶段同步检测文档切换，瞬间进入 Loading 状态并重置高亮，防止闪烁
  const [prevDocId, setPrevDocId] = useState(null);
  if (selectedDoc?.id !== prevDocId) {
    setPrevDocId(selectedDoc?.id);
    setIsLoadingHighlights(true);
    setHighlights([]);
    setHighlightsError(null);
  }

  const articleRef = useRef(null);

  // 加载文档的标签和备注
  useEffect(() => {
    if (selectedDoc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocTags(selectedDoc.tags ? Object.keys(selectedDoc.tags) : []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocNote(selectedDoc.notes || '');
    }
  }, [selectedDoc]);

  // 内部的高亮获取函数，提取出来以便可以手动重试
  const fetchHighlights = async (docId, isMounted = { current: true }) => {
    console.log('[DEBUG] fetchHighlights running for:', docId);
    setIsLoadingHighlights(true);
    setHighlightsError(null);
    try {
      const res = await fetch(`/api/highlights?documentId=${docId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      console.log('[DEBUG] fetchHighlights data received:', data.highlights?.length);
      if (isMounted.current && data.highlights) {
        setHighlights(data.highlights);
      }
    } catch (e) {
      console.error('获取高亮失败', e);
      if (isMounted.current) {
        setHighlightsError(e.message || '获取高亮失败');
      }
    } finally {
      if (isMounted.current) setIsLoadingHighlights(false);
    }
  };

  // 获取高亮
  useEffect(() => {
    console.log('[DEBUG] useEffect for fetchHighlights triggered. selectedDoc:', selectedDoc?.id);
    if (!selectedDoc) return;
    const isMounted = { current: true };
    fetchHighlights(selectedDoc.id, isMounted);
    
    return () => {
      console.log('[DEBUG] useEffect cleanup for selectedDoc:', selectedDoc?.id);
      isMounted.current = false;
    };
  }, [selectedDoc?.id]);

  // 清理文章 HTML：移除可能破坏全局布局的 <style> 和 <script> 标签
  const sanitizeArticleHtml = (html) => {
    if (!html) return html;
    // 移除 <style> 标签及其内容（防止文章内嵌 CSS 覆盖全局变量和 body 样式）
    let cleaned = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    // 移除 <script> 标签及其内容（安全防护）
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
    // 移除 <link rel="stylesheet"> 标签（防止加载外部样式表）
    cleaned = cleaned.replace(/<link[^>]*rel=["']stylesheet["'][^>]*\/?>/gi, '');
    return cleaned;
  };

  // 渲染高亮
  useEffect(() => {
    if (articleRef.current && !isContentLoading && !isLoadingHighlights && selectedDoc?.html_content) {
      // 必须先重置 DOM 避免多次添加 <mark> 导致文本 offset 计算错误
      articleRef.current.innerHTML = sanitizeArticleHtml(selectedDoc.html_content);
      setTimeout(() => {
        if (!articleRef.current) return;
        restoreHighlights(articleRef.current, highlights, (hl, e) => {
          const rect = e.target.getBoundingClientRect();
          setEditingHighlight({ ...hl, rect });
        });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id, isContentLoading, isLoadingHighlights, highlights]);

  // 从选区 Range 中提取包含的 <img> 元素 URL
  const extractImagesFromRange = (range) => {
    const fragment = range.cloneContents();
    const images = [];
    const imgElements = fragment.querySelectorAll('img');
    imgElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        images.push({
          src,
          alt: img.getAttribute('alt') || '图片',
        });
      }
    });
    return images;
  };

  // 从选区中提取文本，保留块级元素边界的换行
  const extractSelectionText = (range) => {
    const BLOCK_ELEMENTS = new Set([
      'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BR', 'HR', 'BLOCKQUOTE', 'PRE', 'TR', 'DT', 'DD',
      'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION'
    ]);
    
    const fragment = range.cloneContents();
    const parts = [];
    
    const walk = (node, olCounter = null) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName;
        if (tagName === 'BR') {
          parts.push('\n');
          return;
        }
        // 处理 <img> 标签：提取为占位文本
        if (tagName === 'IMG') {
          const alt = node.getAttribute('alt') || '图片';
          const src = node.getAttribute('src') || '';
          parts.push(`[图片: ${alt}]`);
          return;
        }
        const isBlock = BLOCK_ELEMENTS.has(tagName);
        // 在块级元素开头插入换行（如果前面已经有内容）
        if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
          parts.push('\n');
        }
        // 为列表项添加标记符号
        if (tagName === 'LI') {
          if (olCounter) {
            parts.push(`${olCounter.value++}. `);
          } else {
            parts.push('• ');
          }
        }
        // 有序列表：传递计数器给子节点
        const childCounter = (tagName === 'OL') ? { value: 1 } : olCounter;
        for (const child of node.childNodes) {
          walk(child, childCounter);
        }
        // 在块级元素结尾插入换行
        if (isBlock && parts.length > 0 && parts[parts.length - 1] !== '\n') {
          parts.push('\n');
        }
      }
    };
    
    for (const child of fragment.childNodes) {
      walk(child);
    }
    
    return parts.join('').trim();
  };

  // 监听选中文本 & 高亮点击（事件委托）
  const handleMouseUp = (e) => {
    // 检测是否点击了已有的高亮 <mark> 元素（事件委托模式）
    const clickedMark = e.target.closest('mark[data-highlight-id]');
    if (clickedMark && articleRef.current?.contains(clickedMark)) {
      const sel = window.getSelection();
      // 只有简单点击（未拖选文本）才打开编辑器
      if (sel && sel.isCollapsed) {
        const hlId = clickedMark.dataset.highlightId;
        const hl = highlights.find(h => String(h.id) === String(hlId));
        if (hl) {
          const rect = clickedMark.getBoundingClientRect();
          setEditingHighlight({ ...hl, rect });
          setSelection(null);
          return;
        }
      }
    }

    // 非高亮点击：处理文本选区（新建高亮）
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !articleRef.current) {
      if (selection) setSelection(null);
      return;
    }

    if (!articleRef.current.contains(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = extractSelectionText(range);
    const images = extractImagesFromRange(range);

    if (text || images.length > 0) {
      let location_start = getTextOffset(articleRef.current, range.startContainer, range.startOffset);
      let location_end = getTextOffset(articleRef.current, range.endContainer, range.endOffset);
      
      // 当选区起止点落在非文本节点（如 <img> 的父元素）上时，
      // getTextOffset 无法匹配到文本节点会返回 -1。
      // 此时通过遍历选区前后的文本节点来估算偏移量。
      if (location_start < 0) {
        const container = range.startContainer;
        if (container.nodeType === Node.ELEMENT_NODE) {
          const childNodes = container.childNodes;
          for (let i = range.startOffset - 1; i >= 0; i--) {
            const child = childNodes[i];
            if (child) {
              const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT, null, false);
              let lastText = null;
              let n;
              while ((n = walker.nextNode())) lastText = n;
              if (lastText) {
                location_start = getTextOffset(articleRef.current, lastText, lastText.textContent.length);
                break;
              }
            }
          }
          if (location_start < 0) {
            for (let i = range.startOffset; i < childNodes.length; i++) {
              const child = childNodes[i];
              if (child) {
                const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT, null, false);
                const firstText = walker.nextNode();
                if (firstText) {
                  location_start = getTextOffset(articleRef.current, firstText, 0);
                  break;
                }
              }
            }
          }
          // 无法确定精确位置时设为 null，让 restoreHighlights 的模糊匹配来定位
        }
      }

      if (location_end < 0) {
        const container = range.endContainer;
        if (container.nodeType === Node.ELEMENT_NODE) {
          const childNodes = container.childNodes;
          for (let i = range.endOffset; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (child) {
              const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT, null, false);
              const firstText = walker.nextNode();
              if (firstText) {
                location_end = getTextOffset(articleRef.current, firstText, 0);
                break;
              }
            }
          }
          if (location_end < 0) {
            for (let i = range.endOffset - 1; i >= 0; i--) {
              const child = childNodes[i];
              if (child) {
                const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT, null, false);
                let lastText = null;
                let n;
                while ((n = walker.nextNode())) lastText = n;
                if (lastText) {
                  location_end = getTextOffset(articleRef.current, lastText, lastText.textContent.length);
                  break;
                }
              }
            }
          }
          // 无法确定精确位置时设为 null，让 restoreHighlights 的模糊匹配来定位
        }
      }

      // 如果仍无法确定偏移量（-1），设为 null 以触发 restoreHighlights 的模糊文本匹配
      if (location_start < 0) location_start = null;
      if (location_end < 0) location_end = null;
      
      setSelection({
        text: text || (images.length > 0 ? images.map(i => `[图片: ${i.alt}]`).join('\n') : ''),
        location_start,
        location_end,
        images,
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width }
      });
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) setSelection(null);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleCreateHighlight = async (color) => {
    if (!selection || !selectedDoc) return;
    
    const selectionImages = selection.images || [];
    const selectionRect = selection.rect;
    
    const newHl = {
      id: crypto.randomUUID(),
      document_id: selectedDoc.id,
      text: selection.text,
      title: selectedDoc.title,
      source_url: selectedDoc.url || selectedDoc.source_url,
      color,
      location_start: selection.location_start,
      location_end: selection.location_end,
      note: '',
      tags: {}
    };

    setSelection(null);
    window.getSelection().removeAllRanges();

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlight: newHl, syncToReadwise: true })
      });
      const data = await res.json();
      if (data.success) {
        const createdHighlight = data.highlight;
        setHighlights(prev => [...prev, createdHighlight]);
        // Show edit UI immediately after creation
        setEditingHighlight({ ...createdHighlight, rect: selectionRect });

        // 如果选区包含图片，异步上传到 OSS
        if (selectionImages.length > 0) {
          uploadImagesToOss(createdHighlight.id, createdHighlight.text, selectionImages);
        }
      }
    } catch (e) {
      console.error('保存高亮失败', e);
    }
  };

  // 异步上传选区中的图片到 OSS 并更新高亮文本
  const uploadImagesToOss = async (highlightId, originalText, images) => {
    if (!images || images.length === 0) return;

    setImageUploadStatus(prev => ({
      ...prev,
      [highlightId]: { status: 'uploading', images: images.map(i => ({ ...i, ossUrl: null, error: null })) }
    }));

    let updatedText = originalText;
    const uploadResults = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const res = await fetch('/api/oss/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: img.src,
            documentId: selectedDoc.id,
          }),
        });
        const data = await res.json();
        if (data.success && data.ossUrl) {
          // 替换占位文本为 Markdown 图片格式
          const placeholder = `[图片: ${img.alt}]`;
          const markdownImg = `![${img.alt}](${data.ossUrl})`;
          updatedText = updatedText.replace(placeholder, markdownImg);
          uploadResults.push({ ...img, ossUrl: data.ossUrl, error: null });
        } else {
          uploadResults.push({ ...img, ossUrl: null, error: data.error || '上传失败' });
        }
      } catch (err) {
        uploadResults.push({ ...img, ossUrl: null, error: err.message });
      }
    }

    // 更新上传状态
    const allSuccess = uploadResults.every(r => r.ossUrl);
    setImageUploadStatus(prev => ({
      ...prev,
      [highlightId]: {
        status: allSuccess ? 'success' : 'error',
        images: uploadResults,
      }
    }));

    // 如果有任何图片上传成功，更新高亮文本
    if (uploadResults.some(r => r.ossUrl) && updatedText !== originalText) {
      handleUpdateHighlight(highlightId, { text: updatedText });
    }
  };

  const handleUpdateHighlight = async (id, updates) => {
    try {
      const res = await fetch(`/api/highlights/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setHighlights(prev => prev.map(h => h.id === id ? data.highlight : h));
        setEditingHighlight(prev => prev ? { ...prev, ...data.highlight } : null);
        
        if (updates.tags) {
          const newHlTags = Object.keys(updates.tags);
          if (newHlTags.length > 0) {
            const currentDocTags = new Set(docTags);
            let hasNew = false;
            for (const t of newHlTags) {
              if (!currentDocTags.has(t)) {
                currentDocTags.add(t);
                hasNew = true;
              }
            }
            if (hasNew) {
              handleTagsChange(Array.from(currentDocTags));
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHighlight = async (id) => {
    try {
      await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      setHighlights(prev => prev.filter(h => h.id !== id));
      setEditingHighlight(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTagsChange = async (newTags) => {
    if (!selectedDoc) return;
    setDocTags(newTags);
    try {
      await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
      
      const tagsObj = {};
      newTags.forEach(t => tagsObj[t] = 1);
      updateDocumentLocally(selectedDoc.id, { tags: tagsObj });
    } catch (e) {
      console.error(e);
    }
  };

  if (!selectedDoc) {
    return (
      <div className="reading-panel">
        <div className="empty-state">
          <div className="empty-state-icon"><BookOpen size={48} strokeWidth={1} /></div>
          <div className="empty-state-title">选择一篇文章开始阅读</div>
          <div className="empty-state-description">
            从左侧列表中选择一篇文章，或使用 Cmd+K 打开命令面板
          </div>
        </div>
      </div>
    );
  }

  const articleFont = fontFamily === 'serif' ? 'var(--font-reading)' : 'var(--font-ui)';

  return (
    <div className="reading-panel" onMouseUp={handleMouseUp}>
      {/* 动态注入微动画 */}
      <style>{`
        .highlight-toolbar {
          position: fixed;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-lg);
          border-radius: var(--radius-md);
          padding: var(--space-2);
          display: flex;
          gap: var(--space-2);
          z-index: 1000;
          transform: translate(-50%, 0);
          margin-top: 8px;
        }
        .selection-toolbar {
          transform: translate(-50%, -100%) !important;
          margin-top: -10px !important;
        }
        .highlight-color-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .highlight-color-btn:hover {
          transform: scale(1.1);
        }
        mark.highlight-color.yellow { background-color: var(--highlight-yellow, #fef08a); }
        mark.highlight-color.green { background-color: var(--highlight-green, #bbf7d0); }
        mark.highlight-color.blue { background-color: var(--highlight-blue, #bfdbfe); }
        mark.highlight-color.purple { background-color: var(--highlight-purple, #ddd6fe); }
        mark.highlight-color.red { background-color: var(--highlight-red, #fecaca); }
        
        .tag-input-container {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        @keyframes pulse-loading {
          0%, 100% { opacity: 0.5; background-color: var(--color-bg-tertiary); }
          50% { opacity: 0.9; background-color: var(--color-bg-hover); }
        }
        @keyframes spin-loading {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-banner {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
      `}</style>
      {/* 选中文本高亮工具栏 */}
      {selection && (
        <div 
          className="highlight-toolbar selection-toolbar" 
          style={{ top: selection.rect.top, left: selection.rect.left + selection.rect.width / 2 }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <button className="highlight-color-btn" style={{backgroundColor: '#fef08a'}} onClick={() => handleCreateHighlight('yellow')} />
          <button className="highlight-color-btn" style={{backgroundColor: '#bbf7d0'}} onClick={() => handleCreateHighlight('green')} />
          <button className="highlight-color-btn" style={{backgroundColor: '#bfdbfe'}} onClick={() => handleCreateHighlight('blue')} />
          <button className="highlight-color-btn" style={{backgroundColor: '#ddd6fe'}} onClick={() => handleCreateHighlight('purple')} />
          <button className="highlight-color-btn" style={{backgroundColor: '#fecaca'}} onClick={() => handleCreateHighlight('red')} />
        </div>
      )}

      {/* 编辑已有高亮工具栏 */}
      {editingHighlight && (
        <HighlightEditor 
          highlight={editingHighlight} 
          onUpdate={handleUpdateHighlight}
          onDelete={handleDeleteHighlight}
          onClose={() => setEditingHighlight(null)}
          allTags={allTags}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', minWidth: 0 }} className="article-scroll-container" id="article-scroll-container">
      {/* 阅读头部 */}
      <div className="reading-header">
        <div className="reading-header-left">
          {selectedDoc.source_url && (
            <a
              href={selectedDoc.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 'var(--text-xs)' }}
            >
              <Link size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> {extractDomain(selectedDoc.source_url)}
            </a>
          )}
          {selectedDoc.category && (
            <span className="tag-pill">
              {CATEGORY_LABELS[selectedDoc.category] || selectedDoc.category}
            </span>
          )}
          {selectedDoc.reading_progress > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              已读 {Math.round(selectedDoc.reading_progress * 100)}%
            </span>
          )}
        </div>
        <div className="reading-header-right">
          <button
            className="btn-icon"
            onClick={() => setRightPanelTab(rightPanelTab === 'info' ? null : 'info')}
            data-tooltip="文档信息"
            style={rightPanelTab === 'info' ? { color: 'var(--color-accent)' } : {}}
          >
            <Info size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setRightPanelTab(rightPanelTab === 'notebook' ? null : 'notebook')}
            data-tooltip="笔记"
            style={rightPanelTab === 'notebook' ? { color: 'var(--color-accent)' } : {}}
          >
            <Edit3 size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setRightPanelTab(rightPanelTab === 'chat' ? null : 'chat')}
            data-tooltip="AI助手"
            style={rightPanelTab === 'chat' ? { color: 'var(--color-accent)' } : {}}
          >
            <Bot size={16} />
          </button>
        </div>
      </div>

      {/* 阅读内容 */}
      <div className="reading-content">
        <article
          className="reading-article"
          style={{
            maxWidth: `${contentWidth}px`,
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            fontFamily: articleFont,
          }}
        >
          {(isContentLoading || isLoadingHighlights) ? (
            <div className="reading-article-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', margin: 'var(--space-6) 0' }}>
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-accent-light)',
                  borderLeft: '4px solid var(--color-accent)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  animation: 'pulse-banner 2s infinite ease-in-out'
                }}>
                  <Loader2 size={18} style={{ animation: 'spin-loading 2s linear infinite' }} />
                  <span>正在同步并排版文章与高亮...</span>
                </div>
                <div style={{ height: '2.5em', width: '60%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out', backgroundColor: 'var(--color-border)', marginBottom: 'var(--space-6)' }} />
                <div style={{ height: '1.2em', width: '90%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out', backgroundColor: 'var(--color-border)' }} />
                <div style={{ height: '1.2em', width: '100%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.2s', backgroundColor: 'var(--color-border)' }} />
                <div style={{ height: '1.2em', width: '85%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.4s', backgroundColor: 'var(--color-border)' }} />
                <div style={{ height: '1.2em', width: '95%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.6s', backgroundColor: 'var(--color-border)' }} />
                <div style={{ height: '1.2em', width: '70%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.8s', backgroundColor: 'var(--color-border)' }} />
              </div>
            </div>
          ) : (
            <>
              <h1 className="reading-article-title">{selectedDoc.title || '无标题'}</h1>

              <div className="reading-article-meta">
                {selectedDoc.author && (
                  <span className="reading-article-author">{selectedDoc.author}</span>
                )}
                {selectedDoc.published_date && (
                  <span>{formatDate(selectedDoc.published_date)}</span>
                )}
                {selectedDoc.word_count && (
                  <span>{selectedDoc.word_count} 字</span>
                )}
                {selectedDoc.reading_time && (
                  <span>{selectedDoc.reading_time}</span>
                )}
              </div>

              {/* 摘要 */}
              {selectedDoc.summary && (
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 'var(--space-6)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  lineHeight: '1.7',
                  borderLeft: '3px solid var(--color-accent)',
                }}>
                  <div style={{ fontWeight: '600', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={16} /> 摘要</span>
                  </div>
                  {selectedDoc.summary}
                </div>
              )}

              {/* 文章正文 */}
              {selectedDoc.html_content !== null ? (
                selectedDoc.html_content ? (
                  <div
                    ref={articleRef}
                    className="reading-article-body"
                  />
                ) : (
                  <div className="reading-article-body">
                    <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                      此文章未提供正文内容，或无法解析 HTML。您可以通过上方链接在原始网站阅读。
                    </p>
                    {selectedDoc.notes && (
                      <div style={{ marginTop: 'var(--space-6)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Edit3 size={18} /> 笔记</h3>
                        <p>{selectedDoc.notes}</p>
                      </div>
                    )}
                  </div>
                )
              ) : contentError ? (
                <div className="reading-article-body" style={{ margin: 'var(--space-6) 0' }}>
                  <div style={{
                    padding: 'var(--space-4)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderLeft: '4px solid var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-4)'
                  }}>
                    <div style={{ fontWeight: '600', color: 'var(--color-danger)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /> 获取正文内容失败</div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>{contentError}</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => fetchDocumentDetails(selectedDoc.id)}
                    style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-4)' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><RefreshCw size={14} /> 重新同步正文</span>
                  </button>
                </div>
              ) : (
                <div className="reading-article-body">
                  <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    文章正文暂未加载。请先同步完整内容，或点击上方链接在原始网站阅读。
                  </p>
                </div>
              )}
            </>
          )}
        </article>
      </div> {/* Close reading-content */}
      </div> {/* Close article-scroll-container */}

      {/* 右侧边栏 (Tabs: Info, Notebook, Chat) */}
      {rightPanelTab && (
        <div className="right-sidebar" style={{ width: '320px', minWidth: '320px', borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
        
        {/* Tab Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 var(--space-4)' }}>
          {['info', 'notebook', 'chat'].map(tab => (
            <button
              key={tab}
              onClick={() => setRightPanelTab(tab)}
              style={{
                flex: 1,
                padding: 'var(--space-3) 0',
                background: 'none',
                border: 'none',
                borderBottom: rightPanelTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: rightPanelTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontWeight: rightPanelTab === tab ? '600' : '400',
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'info' ? '信息' : tab === 'notebook' ? `笔记 (${highlights.length})` : 'AI助手'}
            </button>
          ))}
        </div>

        {/* Tab Content Container */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          {/* Info Tab */}
          {rightPanelTab === 'info' && (
            <div style={{ padding: 'var(--space-4)' }}>
              {/* Metadata */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>Metadata</h3>
                <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                  <div>Type</div><div style={{color: 'var(--color-text-primary)'}}>{selectedDoc.category || 'Article'}</div>
                  <div>Domain</div><div style={{color: 'var(--color-text-primary)'}}>{extractDomain(selectedDoc.url) || extractDomain(selectedDoc.source_url) || '-'}</div>
                  <div>Published</div><div style={{color: 'var(--color-text-primary)'}}>{selectedDoc.published_date ? new Date(selectedDoc.published_date).toLocaleDateString() : '-'}</div>
                  <div>Length</div><div style={{color: 'var(--color-text-primary)'}}>{selectedDoc.word_count ? `${selectedDoc.word_count} words` : '-'}</div>
                  <div>Progress</div><div style={{color: 'var(--color-text-primary)'}}>{Math.round((selectedDoc.reading_progress || 0) * 100)}%</div>
                  <div>Language</div><div style={{color: 'var(--color-text-primary)'}}>{selectedDoc.language || 'Chinese'}</div>
                </div>
              </div>
              
              {/* Document Tags */}
              <div style={{ marginTop: 'var(--space-6)' }}>
                <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>Document Tags</h3>
                <TagInput 
                  value={docTags}
                  onChange={handleTagsChange}
                  allTags={allTags.map(t => t.name)}
                  placeholder="添加文档标签..."
                />
              </div>
            </div>
          )}

          {/* Notebook Tab */}
          {rightPanelTab === 'notebook' && (
            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', flex: 1, overflowY: 'auto' }}>
              {/* Document Metadata Form */}
              <div style={{ backgroundColor: 'var(--color-bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Document Note</h3>
                  <textarea
                    placeholder="Add a document note..."
                    style={{ width: '100%', minHeight: '60px', padding: 'var(--space-2)', fontSize: '13px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', resize: 'vertical', color: 'var(--color-text-primary)' }}
                    value={docNote}
                    onChange={(e) => setDocNote(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button 
                    className="btn btn-primary btn-sm"
                    disabled={isSavingDocMetadata}
                    onClick={async () => {
                      setIsSavingDocMetadata(true);
                      try {
                        let finalTags = [...docTags];
                        if (!finalTags.includes('readerq')) {
                          finalTags.push('readerq');
                          setDocTags(finalTags);
                        }
                        
                        await fetch(`/api/documents/${selectedDoc.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notes: docNote, tags: finalTags })
                        });
                        
                        // Update locally immediately to avoid Readwise API eventual consistency race condition
                        const tagsObj = {};
                        finalTags.forEach(t => tagsObj[t] = { name: t });
                        updateDocumentLocally(selectedDoc.id, { notes: docNote, tags: tagsObj });
                      } catch (err) {
                        console.error('Save doc metadata failed:', err);
                      } finally {
                        setIsSavingDocMetadata(false);
                      }
                    }}
                  >
                    {isSavingDocMetadata ? '保存中...' : '保存文档信息'}
                  </button>
                </div>
              </div>

              {/* Highlights List */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>Highlights ({highlights.length})</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {highlights.map(hl => {
                    // 检测高亮文本中的 Markdown 图片
                    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
                    const mdImages = [];
                    let match;
                    while ((match = mdImageRegex.exec(hl.text)) !== null) {
                      mdImages.push({ alt: match[1], url: match[2] });
                    }
                    // 去掉 Markdown 图片语法后的纯文本显示
                    const textWithoutImages = hl.text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();
                    const uploadStatus = imageUploadStatus[hl.id];

                    return (
                    <div 
                      key={hl.id} 
                      className="highlight-card"
                      style={{ 
                        padding: 'var(--space-3)', 
                        backgroundColor: 'var(--color-bg-primary)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const mark = articleRef.current?.querySelector(`mark[data-highlight-id="${hl.id}"]`);
                        if (mark) {
                          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          setEditingHighlight({ ...hl, rect: mark.getBoundingClientRect() });
                        }
                      }}
                    >
                      {/* 高亮文本 */}
                      {textWithoutImages && (
                        <div style={{ 
                          borderLeft: `4px solid var(--highlight-${hl.color || 'yellow'})`, 
                          paddingLeft: 'var(--space-2)',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'pre-line'
                        }}>
                          {textWithoutImages}
                        </div>
                      )}

                      {/* 图床图片预览 */}
                      {mdImages.length > 0 && (
                        <div style={{ 
                          marginTop: textWithoutImages ? 'var(--space-2)' : '0',
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 'var(--space-2)' 
                        }}>
                          <div style={{ 
                            fontSize: '11px', 
                            color: 'var(--color-text-tertiary)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            fontWeight: '600'
                          }}>
                            <ImageIcon size={12} /> 图床图片 ({mdImages.length})
                          </div>
                          {mdImages.map((img, idx) => (
                            <div key={idx} style={{ 
                              borderRadius: 'var(--radius-sm)', 
                              overflow: 'hidden',
                              border: '1px solid var(--color-border-light)',
                              background: 'var(--color-bg-tertiary)',
                            }}>
                              <img 
                                src={img.url} 
                                alt={img.alt}
                                style={{ 
                                  width: '100%', 
                                  maxHeight: '160px', 
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(img.url, '_blank');
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                                }}
                              />
                              <div style={{ 
                                display: 'none', 
                                padding: 'var(--space-2)',
                                color: 'var(--color-danger)',
                                fontSize: '11px',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <XCircle size={12} /> 图片加载失败
                              </div>
                              <div style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                color: 'var(--color-text-tertiary)',
                                wordBreak: 'break-all',
                                borderTop: '1px solid var(--color-border-light)'
                              }}>
                                {img.alt || '图片'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 图片上传状态指示 */}
                      {uploadStatus && (
                        <div style={{ 
                          marginTop: 'var(--space-2)', 
                          padding: 'var(--space-2)',
                          background: uploadStatus.status === 'uploading' ? 'var(--color-accent-light)' 
                            : uploadStatus.status === 'success' ? 'rgba(34, 197, 94, 0.06)' 
                            : 'rgba(239, 68, 68, 0.06)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {uploadStatus.status === 'uploading' && (
                            <>
                              <Upload size={12} style={{ animation: 'pulse-banner 1.5s infinite' }} />
                              <span style={{ color: 'var(--color-accent)' }}>正在上传图片到图床...</span>
                            </>
                          )}
                          {uploadStatus.status === 'success' && (
                            <>
                              <CheckCircle2 size={12} style={{ color: 'var(--color-success)' }} />
                              <span style={{ color: 'var(--color-success)' }}>
                                {uploadStatus.images.length} 张图片已上传到图床
                              </span>
                            </>
                          )}
                          {uploadStatus.status === 'error' && (
                            <>
                              <XCircle size={12} style={{ color: 'var(--color-danger)' }} />
                              <span style={{ color: 'var(--color-danger)' }}>
                                部分图片上传失败: {uploadStatus.images.filter(i => i.error).map(i => i.error).join('; ')}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Verify Sync Status */}
                      <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {verifyStatus[hl.id] ? (
                          <span style={{ fontSize: '11px', color: verifyStatus[hl.id].synced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {verifyStatus[hl.id].synced ? <span style={{display:'flex', alignItems:'center', gap:'4px'}}><CheckCircle2 size={12}/>已同步至 Readwise</span> : <span style={{display:'flex', alignItems:'center', gap:'4px'}}><XCircle size={12}/>{verifyStatus[hl.id].message}</span>}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>未验证同步</span>
                        )}
                        
                        <button 
                          className="btn btn-ghost btn-sm" 
                          style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', minHeight: 'auto' }}
                          disabled={verifyingHlId === hl.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setVerifyingHlId(hl.id);
                            try {
                              const res = await fetch(`/api/highlights/${hl.id}/verify`);
                              const data = await res.json();
                              setVerifyStatus(prev => ({
                                ...prev,
                                [hl.id]: data.synced ? { synced: true } : { synced: false, message: data.message || '未找到' }
                              }));
                            } catch (err) {
                              setVerifyStatus(prev => ({
                                ...prev,
                                [hl.id]: { synced: false, message: '验证请求失败' }
                              }));
                            } finally {
                              setVerifyingHlId(null);
                            }
                          }}
                        >
                          {verifyingHlId === hl.id ? '正在验证...' : '验证同步状态'}
                        </button>
                      </div>

                      {hl.note && (
                        <div style={{ marginTop: 'var(--space-2)', fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Edit3 size={12} /> {hl.note}</span>
                        </div>
                      )}
                      {hl.tags && Object.keys(hl.tags).length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {Object.keys(hl.tags).map(t => (
                            <span key={t} style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );})}
                  {isLoadingHighlights ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px', marginTop: 'var(--space-4)' }}>
                      <div className="loading-spinner" style={{ width: '16px', height: '16px', margin: '0 auto var(--space-2)' }}></div>
                      加载中...
                    </div>
                  ) : highlightsError ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-danger)', fontSize: '13px', marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div>获取高亮失败</div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>{highlightsError}</div>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => fetchHighlights(selectedDoc.id, { current: true })}
                        style={{ fontSize: '12px' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><RefreshCw size={12} /> 重新加载</span>
                      </button>
                    </div>
                  ) : highlights.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px', marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div>暂无高亮。在左侧正文中划词即可添加。</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        如有 Readwise 高亮，请先点击左侧栏的 <RefreshCw size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> 同步按钮同步数据。
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {rightPanelTab === 'chat' && (
            <GhostReader />
          )}

        </div>
      </div>
      )}
      </div>
    </div>
  );
}
