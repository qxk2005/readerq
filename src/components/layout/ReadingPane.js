'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { formatDate, extractDomain, CATEGORY_LABELS } from '@/lib/utils';
import { getTextOffset, restoreHighlights } from '@/lib/highlight';
import GhostReader from '@/components/ai/GhostReader';
import HighlightEditor from '@/components/HighlightEditor';
import TagInput from '@/components/TagInput';

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
  const [editingTags, setEditingTags] = useState(false);
  const [verifyingHlId, setVerifyingHlId] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState({}); // { [id]: { synced: boolean, message: string } }
  const [docTags, setDocTags] = useState([]);
  const [docNote, setDocNote] = useState('');
  const [isSavingDocMetadata, setIsSavingDocMetadata] = useState(false);
  const [highlightsError, setHighlightsError] = useState(null);
  
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

  // 渲染高亮
  useEffect(() => {
    if (articleRef.current && !isContentLoading && !isLoadingHighlights && selectedDoc?.html_content) {
      // 必须先重置 DOM 避免多次添加 <mark> 导致文本 offset 计算错误
      articleRef.current.innerHTML = selectedDoc.html_content;
      setTimeout(() => {
        if (!articleRef.current) return;
        restoreHighlights(articleRef.current, highlights, (hl, target) => {
          const rect = target.getBoundingClientRect();
          setEditingHighlight({ ...hl, rect });
        });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc?.id, isContentLoading, isLoadingHighlights, highlights]);

  // 监听选中文本
  const handleMouseUp = () => {
    // If we are clicking inside the editing toolbar, ignore
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !articleRef.current) {
      if (selection) setSelection(null);
      return;
    }

    if (!articleRef.current.contains(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = sel.toString().trim();

    if (text) {
      const location_start = getTextOffset(articleRef.current, range.startContainer, range.startOffset);
      const location_end = getTextOffset(articleRef.current, range.endContainer, range.endOffset);
      
      if (location_start >= 0 && location_end >= 0) {
        setSelection({
          text,
          location_start,
          location_end,
          rect: { top: rect.top, left: rect.left + rect.width / 2, width: rect.width }
        });
      }
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
        setHighlights([...highlights, data.highlight]);
        // Show edit UI immediately after creation
        setEditingHighlight({ ...data.highlight, rect: selection.rect });
      }
    } catch (e) {
      console.error('保存高亮失败', e);
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
        setHighlights(highlights.map(h => h.id === id ? data.highlight : h));
        setEditingHighlight(prev => prev ? { ...prev, ...data.highlight } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHighlight = async (id) => {
    try {
      await fetch(`/api/highlights/${id}`, { method: 'DELETE' });
      setHighlights(highlights.filter(h => h.id !== id));
      setEditingHighlight(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDocumentTag = async () => {
    if (!newTag.trim() || !selectedDoc) return;
    const tag = newTag.trim();
    if (docTags.includes(tag)) return;
    
    const newTags = [...docTags, tag];
    setDocTags(newTags);
    setNewTag('');
    
    try {
      await fetch(`/api/documents/${selectedDoc.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveDocumentTag = async (tagToRemove) => {
    const newTags = docTags.filter(t => t !== tagToRemove);
    setDocTags(newTags);
    try {
      await fetch(`/api/documents/${selectedDoc.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!selectedDoc) {
    return (
      <div className="reading-panel">
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
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
    <div className="reading-panel" onMouseUp={handleMouseUp} style={{ flexDirection: 'row' }}>
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
          transform: translate(-50%, -100%);
          margin-top: -10px;
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
          className="highlight-toolbar" 
          style={{ top: selection.rect.top, left: selection.rect.left }}
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

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} className="article-scroll-container" id="article-scroll-container">

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
              🔗 {extractDomain(selectedDoc.source_url)}
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
            onClick={() => setRightPanelTab(rightPanelTab === 'chat' ? 'notebook' : 'chat')}
            data-tooltip={rightPanelTab === 'chat' ? '关闭 AI 助手' : '打开 AI 助手'}
            style={rightPanelTab === 'chat' ? { color: 'var(--color-accent)' } : {}}
          >
            🤖
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
                  <span style={{ fontSize: 'var(--text-lg)', animation: 'spin-loading 2s linear infinite', display: 'inline-block' }}>🌀</span>
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
                    📋 摘要
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
                        <h3>📝 笔记</h3>
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
                    <div style={{ fontWeight: '600', color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>⚠️ 获取正文内容失败</div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>{contentError}</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => fetchDocumentDetails(selectedDoc.id)}
                    style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-4)' }}
                  >
                    🔄 重新同步正文
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
              {tab === 'info' ? 'Info' : tab === 'notebook' ? 'Notebook' : 'Chat'}
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Document Tags</h3>
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingTags(!editingTags)}
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                  >
                    {editingTags ? '完成' : '编辑'}
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {docTags.map(tag => (
                    <span key={tag} className="tag-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      {tag}
                      {editingTags && (
                        <button 
                          onClick={() => handleRemoveDocumentTag(tag)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '0 2px' }}
                        >×</button>
                      )}
                    </span>
                  ))}
                  {docTags.length === 0 && !editingTags && (
                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '12px' }}>暂无标签</span>
                  )}
                </div>

                {editingTags && (
                  <div className="tag-input-container" style={{ marginTop: 'var(--space-3)' }}>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="输入新标签..." 
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddDocumentTag();
                      }}
                      style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddDocumentTag} style={{ fontSize: '12px' }}>添加</button>
                  </div>
                )}
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
                
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Document Tags</h3>
                  <TagInput 
                    value={docTags}
                    onChange={setDocTags}
                    allTags={allTags.map(t => t.name)}
                    placeholder="添加文档标签..."
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
                  {highlights.map(hl => (
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
                      <div style={{ 
                        borderLeft: `4px solid var(--highlight-${hl.color || 'yellow'})`, 
                        paddingLeft: 'var(--space-2)',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        color: 'var(--color-text-primary)'
                      }}>
                        {hl.text}
                      </div>
                      
                      {/* Verify Sync Status */}
                      <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {verifyStatus[hl.id] ? (
                          <span style={{ fontSize: '11px', color: verifyStatus[hl.id].synced ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {verifyStatus[hl.id].synced ? '✅ 已同步至 Readwise' : `❌ ${verifyStatus[hl.id].message}`}
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
                          📝 {hl.note}
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
                  ))}
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
                        🔄 重新加载
                      </button>
                    </div>
                  ) : highlights.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px', marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div>暂无高亮。在左侧正文中划词即可添加。</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        如有 Readwise 高亮，请先点击左侧栏的 🔄 同步按钮同步数据。
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
    </div>
  );
}
