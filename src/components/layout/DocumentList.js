'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { LOCATION_LABELS, CATEGORY_ICONS, formatDate, truncateText, extractDomain } from '@/lib/utils';

function DocumentCard({ doc, isActive, onClick, isSelectionMode, isSelected, onToggleSelect, onMoveDoc }) {
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
            {CATEGORY_ICONS[doc.category] || '📄'}
          </div>
        )}
        <div className="doc-card-info">
          <div className="doc-card-title">{doc.title || '无标题'}</div>
          <div className="doc-card-meta">
            {doc.author && <span>{doc.author}</span>}
            {doc.source_url && <span>· {extractDomain(doc.source_url)}</span>}
            {doc.reading_time && <span>· {doc.reading_time}</span>}
          </div>
        </div>
      </div>
      {doc.summary && (
        <div className="doc-card-summary">{truncateText(doc.summary, 120)}</div>
      )}
      <div className="doc-card-meta" style={{ marginTop: '6px' }}>
        <span>{formatDate(doc.updated_at || doc.created_at)}</span>
        {doc.reading_progress > 0 && (
          <span>· 已读 {Math.round(doc.reading_progress * 100)}%</span>
        )}
      </div>
      {doc.reading_progress > 0 && doc.reading_progress < 1 && (
        <div className="doc-card-progress">
          <div
            className="doc-card-progress-bar"
            style={{ width: `${doc.reading_progress * 100}%` }}
          />
        </div>
      )}
      {!isSelectionMode && (
        <div className="doc-card-actions">
          <button className="doc-card-action-btn" title="Inbox" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'new'); }}>📥</button>
          <button className="doc-card-action-btn" title="Later" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'later'); }}>⏱️</button>
          <button className="doc-card-action-btn" title="Archive" onClick={(e) => { e.stopPropagation(); onMoveDoc(doc.id, 'archive'); }}>📦</button>
        </div>
      )}
    </div>
  );
}

export default function DocumentList() {
  const {
    documents, selectedDoc, setSelectedDoc,
    currentView, currentCategory, currentTag,
    searchQuery, setSearchQuery,
    isLoading, fetchDocuments,
    page, hasMore, isFetchingMore,
    batchMoveDocuments,
    syncData, isSyncing
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
    if (currentTag) return `🏷️ ${currentTag}`;
    if (currentCategory) return `${CATEGORY_ICONS[currentCategory] || ''} ${currentCategory}`;
    if (currentView === 'all') return '📚 全部文档';
    return `${LOCATION_LABELS[currentView] || currentView}`;
  };

  const sortedDocs = [...documents].sort((a, b) => {
    if (sortBy === 'updated') {
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
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
    <div className="doclist-panel">
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
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}}
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
        <div className="doclist-search">
          <span className="doclist-search-icon">🔍</span>
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
              />
            ))}
            {/* Observer Target for Infinite Scroll */}
            <div ref={observerTarget} style={{ height: '20px', margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
              {isFetchingMore && <span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span>}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ paddingTop: '60px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">暂无文档</div>
            <div className="empty-state-description">
              {searchQuery
                ? '没有找到匹配的文档，试试其他关键词'
                : '点击左下角 🔄 同步按钮从 Readwise 获取文档'
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
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '8px', whiteSpace: 'nowrap' }}>移动到</span>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'new'); setIsSelectionMode(false); setSelectedIds(new Set()); }}>📥 收件箱</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'later'); setIsSelectionMode(false); setSelectedIds(new Set()); }}>⏳ 稍后阅读</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'archive'); setIsSelectionMode(false); setSelectedIds(new Set()); }}>🗄️ 归档</button>
        </div>
      )}
    </div>
  );
}
