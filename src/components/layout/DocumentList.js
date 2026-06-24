'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { LOCATION_LABELS, CATEGORY_ICONS, formatDate, truncateText, extractDomain } from '@/lib/utils';

function DocumentCard({ doc, isActive, onClick }) {
  return (
    <div className={`doc-card ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="doc-card-header">
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
    </div>
  );
}

export default function DocumentList() {
  const {
    documents, selectedDoc, setSelectedDoc,
    currentView, currentCategory, currentTag,
    searchQuery, setSearchQuery,
    isLoading, fetchDocuments,
  } = useApp();

  const [sortBy, setSortBy] = useState('updated');

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

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
            onClick={() => fetchDocuments({ sync: true })}
            data-tooltip="刷新"
          >
            🔄
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
        <span>{sortedDocs.length} 篇文档</span>
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
          sortedDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              isActive={selectedDoc?.id === doc.id}
              onClick={() => setSelectedDoc(doc)}
            />
          ))
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
    </div>
  );
}
