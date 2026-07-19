'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { LOCATION_LABELS, formatDate, truncateText, extractDomain } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, getCategoryIcon } from '@/components/ui/icons';
import { Search, Inbox, Clock, Archive, RefreshCw, FileText, Tag, Trash2, RotateCcw, Plus } from 'lucide-react';

function DocumentCard({ doc, isActive, onClick, isSelectionMode, isSelected, onToggleSelect, onMoveDoc, onDeleteDoc, currentView }) {
  const { docListElements } = useTheme();

  // 聚合 header meta 信息并使用中点安全连接
  const headerMetaItems = [];
  if (doc.author && docListElements?.author !== false) {
    headerMetaItems.push(doc.author);
  }
  if (doc.source_url) {
    headerMetaItems.push(extractDomain(doc.source_url));
  }
  if (doc.reading_time && docListElements?.readingTime !== false) {
    headerMetaItems.push(doc.reading_time);
  }

  // 聚合 footer meta 信息并使用中点安全连接
  const footerMetaItems = [];
  if (docListElements?.createdAt !== false) {
    footerMetaItems.push(formatDate(doc.updated_at || doc.created_at));
  }
  if (doc.reading_progress > 0 && docListElements?.readingProgress !== false) {
    footerMetaItems.push(`已读 ${Math.round(doc.reading_progress * 100)}%`);
  }

  const handleClick = (e) => {
    if (isSelectionMode) {
      e.preventDefault();
      onToggleSelect(doc.id);
    } else {
      onClick();
    }
  };

  return (
    <div className={`doc-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`} onClick={handleClick}>
      <div className="doc-card-header">
        {isSelectionMode && (
          <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={isSelected} readOnly style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', pointerEvents: 'none' }} />
          </div>
        )}
        {doc.image_url ? (
          <img
            className="doc-card-image"
            src={doc.image_url}
            alt=""
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="doc-card-image-placeholder">
            {CATEGORY_ICONS_SVG[doc.category] || <FileText size={24} />}
          </div>
        )}
        <div className="doc-card-info">
          <div className="doc-card-title">{doc.title || '无标题'}</div>
          {headerMetaItems.length > 0 && (
            <div className="doc-card-meta">
              {headerMetaItems.map((item, idx) => (
                <span key={idx}>
                  {idx > 0 && ' · '}
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {doc.summary && docListElements?.summary !== false && (
        <div className="doc-card-summary">{truncateText(doc.summary, 120)}</div>
      )}
      {footerMetaItems.length > 0 && (
        <div className="doc-card-meta" style={{ marginTop: '6px' }}>
          {footerMetaItems.map((item, idx) => (
            <span key={idx}>
              {idx > 0 && ' · '}
              {item}
            </span>
          ))}
        </div>
      )}
      {doc.reading_progress > 0 && doc.reading_progress < 1 && docListElements?.readingProgress !== false && (
        <div className="doc-card-progress">
          <div
            className="doc-card-progress-bar"
            style={{ width: `${doc.reading_progress * 100}%` }}
          />
        </div>
      )}
      {!isSelectionMode && (
        <div className="doc-card-actions">
          {currentView === 'trash' ? (
            <>
              <button className="doc-card-action-btn" title="恢复文章" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'new'); }}><RotateCcw size={14} /></button>
              <button className="doc-card-action-btn" style={{ color: 'var(--color-danger)' }} title="彻底删除" onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }}><Trash2 size={14} /></button>
            </>
          ) : (
            <>
              <button className="doc-card-action-btn" title="Inbox" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'new'); }}><Inbox size={14} /></button>
              <button className="doc-card-action-btn" title="Later" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'later'); }}><Clock size={14} /></button>
              <button className="doc-card-action-btn" title="Archive" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'archive'); }}><Archive size={14} /></button>
              <button className="doc-card-action-btn" style={{ color: 'var(--color-danger)' }} title="Delete" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'trash'); }}><Trash2 size={14} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentList({ width }) {
  const {
    documents, selectedDoc, setSelectedDoc,
    currentView, currentCategory, currentTag,
    searchQuery, setSearchQuery,
    isLoading, fetchDocuments,
    page, hasMore, isFetchingMore,
    batchMoveDocuments,
    batchDeleteDocuments,
    syncData, isSyncing,
    setShowAddUrl
  } = useApp();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const observerTarget = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingMore) {
          fetchDocuments({ page: page + 1 });
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isFetchingMore, page, fetchDocuments]);

  const [sortBy, setSortBy] = useState('updated');

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const handleMoveDoc = useCallback(async (docId, location) => {
    await batchMoveDocuments([docId], location);
  }, [batchMoveDocuments]);

  const getViewTitle = () => {
    if (currentTag) return <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Tag size={16} /> {currentTag}</span>;
    if (currentCategory) return <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>{getCategoryIcon(currentCategory, 16)} {currentCategory}</span>;
    if (currentView === 'all') return <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}><FileText size={16} /> 全部文档</span>;
    return LOCATION_LABELS[currentView] || currentView;
  };

  const sortedDocs = [...documents].sort((a, b) => {
    if (sortBy === 'updated') {
      return new Date(b.last_highlighted_at || b.updated_at || b.created_at || 0) - 
             new Date(a.last_highlighted_at || a.updated_at || a.created_at || 0);
    }
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortBy === 'progress') {
      return (b.reading_progress || 0) - (a.reading_progress || 0);
    }
    return 0;
  });

  return (
    <div 
      className="doclist-panel"
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : {}}
    >
      <div className="doclist-header">
        <div className="doclist-title">
          <span>{getViewTitle()}</span>
          <button
            className="btn-icon"
            onClick={() => {
              if (!isSyncing) syncData({ full: false, location: currentView });
            }}
            disabled={isSyncing}
            data-tooltip={isSyncing ? "同步中..." : "增量同步"}
            style={{ opacity: isSyncing ? 0.7 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={18} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowAddUrl(true)}
            data-tooltip="添加文章或文档"
            style={{ marginLeft: '6px' }}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="doclist-search">
          <span className="doclist-search-icon"><Search size={14} /></span>
          <input
            type="text"
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={handleSearch}
            id="search-input"
          />
        </div>
      </div>

      <div className="doclist-toolbar">
        {isSelectionMode ? (
          <>
            <span style={{ cursor: 'pointer', color: 'var(--color-accent)' }} onClick={() => setSelectedIds(new Set(sortedDocs.map(d => d.id)))}>全选</span>
            <span style={{ marginLeft: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }} onClick={() => setSelectedIds(new Set())}>清空</span>
            <span style={{ marginLeft: '12px' }}>已选 {selectedIds.size} 篇</span>
            <span style={{ marginLeft: 'auto' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}>取消</button>
            </span>
          </>
        ) : (
          <>
            <span>{sortedDocs.length} 篇文档</span>
            <span style={{ marginLeft: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '12px' }} onClick={() => setIsSelectionMode(true)}>
              多选
            </span>
            <span style={{ marginLeft: 'auto' }}>
              排序：
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                }}
              >
                <option value="updated">最近更新</option>
                <option value="title">标题</option>
                <option value="progress">阅读进度</option>
              </select>
            </span>
          </>
        )}
      </div>

      <div className="doclist-content">
        {isLoading ? (
          <div style={{ padding: '16px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div className="loading-skeleton" style={{ height: '80px', marginBottom: '8px' }} />
              </div>
            ))}
          </div>
        ) : sortedDocs.length > 0 ? (
          <>
            {sortedDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isActive={selectedDoc?.id === doc.id}
                onClick={() => setSelectedDoc(doc)}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(doc.id)}
                onToggleSelect={(id) => {
                  const newSet = new Set(selectedIds);
                  if (newSet.has(id)) newSet.delete(id);
                  else newSet.add(id);
                  setSelectedIds(newSet);
                }}
                onMoveDoc={handleMoveDoc}
                onDeleteDoc={batchDeleteDocuments}
                currentView={currentView}
              />
            ))}
            {/* Observer Target for Infinite Scroll */}
            <div ref={observerTarget} style={{ height: '20px', margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
              {isFetchingMore && <span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span>}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ paddingTop: '60px' }}>
            <div className="empty-state-icon"><Inbox size={48} strokeWidth={1} /></div>
            <div className="empty-state-title">暂无文档</div>
            <div className="empty-state-description">
              {searchQuery
                ? '没有找到匹配的文档，试试其他关键词'
                : <>点击左下角 <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 4px' }} /> 同步按钮从 Readwise 获取文档</>
              }
            </div>
          </div>
        )}
      </div>

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="batch-action-bar" style={{
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-primary)', padding: '8px 16px', borderRadius: '32px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: '8px', zIndex: 100,
          border: '1px solid var(--color-border)', alignItems: 'center'
        }}>
          {currentView === 'trash' ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'new'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><RotateCcw size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 恢复文档</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={async () => { if (confirm('确定要彻底删除选中的文档吗？此操作无法撤销。')) { await batchDeleteDocuments(Array.from(selectedIds)); setIsSelectionMode(false); setSelectedIds(new Set()); } }}><Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 彻底删除</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '8px', whiteSpace: 'nowrap' }}>移动到</span>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'new'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Inbox size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 收件箱</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'later'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Clock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 稍后阅读</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'archive'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Archive size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 归档</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'trash'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 删除</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
