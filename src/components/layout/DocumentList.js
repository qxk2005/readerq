'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { LOCATION_LABELS, formatDate, truncateText, extractDomain } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, getCategoryIcon } from '@/components/ui/icons';
import { Search, Inbox, Clock, Archive, RefreshCw, FileText, Tag, Trash2, RotateCcw, PanelLeftClose, PanelLeftOpen, LayoutList, AlignJustify, Grid, Columns } from 'lucide-react';

import ArticleCoverPlaceholder from '@/components/common/ArticleCoverPlaceholder';

function DocumentCard({ doc, index, isActive, onClick, isSelectionMode, isSelected, onToggleSelect, onMoveDoc, onDeleteDoc, currentView, docListMode }) {
  const { docListElements } = useTheme();
  const { switchTag } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [doc.image_url]);

  // 前 2 篇文档距离顶部较近，Popover 智能向下弹出；其余篇目向上弹出
  const isTopItem = index !== undefined && index <= 1;

  // 解析文章的标签列表
  const tagList = Array.isArray(doc.tags)
    ? doc.tags.map(t => typeof t === 'string' ? t : t.name || '').filter(Boolean)
    : (doc.tags && typeof doc.tags === 'object' ? Object.keys(doc.tags).filter(Boolean) : []);

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

  const visibleTags = tagList.slice(0, 2);
  const extraTagsCount = tagList.length - visibleTags.length;

  // --- 模式 1：CRM 图标轨模式 (68px Icon Dock) ---
  if (docListMode === 'micro') {
    return (
      <div
        className={`doc-card-micro-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        {/* 左侧 Active 垂直指示条 (Slack/Linear 经典 CRM 选中样式) */}
        {isActive && <div className="micro-active-indicator" />}

        <div className="doc-card-micro-thumb-wrapper">
          {doc.image_url && !imgFailed ? (
            <img
              className="doc-card-micro-image"
              src={doc.image_url}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ArticleCoverPlaceholder doc={doc} mode="thumb" width="42px" height="42px" />
          )}

          {/* 文章分类微型角标 */}
          <span className="doc-card-micro-type-badge" title={doc.category || '文章'}>
            {getCategoryIcon(doc.category, 9)}
          </span>

          {/* 底部已读进度线条 */}
          {doc.reading_progress > 0 && doc.reading_progress < 1 && (
            <div className="doc-card-micro-progress-track">
              <div
                className="doc-card-micro-progress-bar"
                style={{ width: `${doc.reading_progress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* 鼠标悬停 CRM 级 Popover 浮层预览 */}
        <div className={`doc-card-compact-popover ${isTopItem ? 'popover-down' : 'popover-up'}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-accent)', background: 'rgba(0,122,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
              {extractDomain(doc.source_url || doc.url) || doc.category || '文章'}
            </span>
            {doc.reading_time && (
              <span style={{ fontSize: '10.5px', color: 'var(--color-text-tertiary)' }}>
                ⏱️ {doc.reading_time}
              </span>
            )}
          </div>

          <div className="doc-card-compact-popover-title">{doc.title || '无标题'}</div>

          {doc.summary && (
            <div className="doc-card-compact-popover-summary">
              {truncateText(doc.summary, 90)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-border-light)' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--color-text-tertiary)' }}>
              {formatDate(doc.updated_at || doc.created_at)}
            </span>
            <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
              <button className="doc-card-action-btn" title="收件箱" onClick={() => onMoveDoc(doc.id, 'new')}><Inbox size={12} /></button>
              <button className="doc-card-action-btn" title="稍后阅读" onClick={() => onMoveDoc(doc.id, 'later')}><Clock size={12} /></button>
              <button className="doc-card-action-btn" title="归档" onClick={() => onMoveDoc(doc.id, 'archive')}><Archive size={12} /></button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 模式 2：CRM 精简单行列表模式 (200px Slim View) ---
  if (docListMode === 'slim') {
    return (
      <div
        className={`doc-card-slim-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <div className="doc-card-slim-cover">
          {doc.image_url && !imgFailed ? (
            <img
              src={doc.image_url}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
              style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
            />
          ) : (
            <ArticleCoverPlaceholder doc={doc} mode="thumb" width="28px" height="28px" />
          )}
        </div>

        <div className="doc-card-slim-title" title={doc.title}>
          {doc.title || '无标题'}
        </div>

        {doc.reading_progress > 0 && doc.reading_progress < 1 ? (
          <span className="doc-card-slim-progress-dot" title={`已读 ${Math.round(doc.reading_progress * 100)}%`} />
        ) : (
          <span className="doc-card-slim-type" title={doc.category}>
            {getCategoryIcon(doc.category, 11)}
          </span>
        )}

        {/* 悬停 Popover 浮层预览 */}
        <div className={`doc-card-compact-popover ${isTopItem ? 'popover-down' : 'popover-up'}`} style={{ left: '196px' }}>
          <div className="doc-card-compact-popover-title">{doc.title || '无标题'}</div>
          {headerMetaItems.length > 0 && (
            <div className="doc-card-compact-popover-meta">
              {headerMetaItems.join(' · ')}
            </div>
          )}
          {doc.summary && (
            <div className="doc-card-compact-popover-summary">
              {truncateText(doc.summary, 90)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`doc-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`} onClick={handleClick}>
      <div className="doc-card-header">
        {isSelectionMode && (
          <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={isSelected} readOnly style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', pointerEvents: 'none' }} />
          </div>
        )}
        {doc.image_url && !imgFailed ? (
          <img
            className="doc-card-image"
            src={doc.image_url}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <ArticleCoverPlaceholder doc={doc} mode="thumb" />
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
      
      {/* 底部信息与标签排版区 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', gap: '8px', position: 'relative' }}>
        {footerMetaItems.length > 0 && (
          <div className="doc-card-meta" style={{ marginTop: 0, flexShrink: 0 }}>
            {footerMetaItems.map((item, idx) => (
              <span key={idx}>
                {idx > 0 && ' · '}
                {item}
              </span>
            ))}
          </div>
        )}

        {/* 文章标签列表展示 (纯 CSS :hover 驱动 + 拓展隐形桥梁，零闪退 100% 稳固) */}
        {docListElements?.tags !== false && tagList.length > 0 && (
          <div 
            className="doc-card-tags-container"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleTags.map(tag => (
              <span 
                key={tag}
                onClick={(e) => { e.stopPropagation(); switchTag(tag); }}
                title={`点击筛选标签: ${tag}`}
                style={{
                  fontSize: '10px',
                  lineHeight: '1.2',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(0, 122, 255, 0.08)',
                  color: 'var(--color-accent)',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  border: '1px solid rgba(0, 122, 255, 0.15)',
                  transition: 'all 0.15s ease'
                }}
              >
                #{tag}
              </span>
            ))}

            {extraTagsCount > 0 && (
              <span 
                style={{
                  fontSize: '10px',
                  lineHeight: '1.2',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)'
                }}
              >
                +{extraTagsCount}
              </span>
            )}

            {/* 全量标签 Popover 浮层 (CSS :hover 保持恒定) */}
            <div 
              className={`doc-card-tags-popover ${isTopItem ? 'popover-down' : 'popover-up'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: '100%', fontSize: '10px', fontWeight: '700', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>
                🏷️ 本文所有标签 ({tagList.length})
              </div>
              {tagList.map(tag => (
                <span
                  key={tag}
                  onClick={(e) => { e.stopPropagation(); switchTag(tag); }}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    color: 'var(--color-accent)',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Tag size={10} /> #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

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
    emptyTrash,
    docListMode, setDocListMode
  } = useApp();

  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const handleEmptyTrash = useCallback(async () => {
    setShowEmptyConfirm(false);
    if (emptyTrash) {
      await emptyTrash();
    }
  }, [emptyTrash]);

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
    <div className={`doclist-panel doclist-container doclist-mode-${docListMode}`} style={{ width: `${width}px` }}>
      {showEmptyConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-bg-card, #1e1e1e)',
            padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: '1px solid var(--color-border)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>清空垃圾箱</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              确定要清空垃圾箱中的所有文章吗？此操作将彻底删除所有文章，并自动同步至 Readwise 云端。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEmptyConfirm(false)}>取消</button>
              <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', fontWeight: 'bold' }} onClick={handleEmptyTrash}>
                清空垃圾箱
              </button>
            </div>
          </div>
        </div>
      )}

      {docListMode === 'micro' ? (
        <div className="doclist-compact-header" style={{
          padding: '12px 0 8px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid var(--color-border-light)',
          flexShrink: 0,
        }}>
          <button
            className="btn-icon"
            onClick={() => setDocListMode('full')}
            data-tooltip="展开文章列表 (全量卡片模式, 快捷键 '\')"
            style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <PanelLeftOpen size={18} style={{ color: 'var(--color-accent)' }} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setDocListMode('slim')}
            data-tooltip="切换为单行极简列表 (200px)"
            style={{ width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
          >
            <AlignJustify size={14} />
          </button>
          <div
            style={{
              fontSize: '10px',
              fontWeight: '700',
              color: 'var(--color-text-tertiary)',
              padding: '2px 6px',
              borderRadius: '8px',
              background: 'var(--color-bg-tertiary)',
            }}
            title={`当前共 ${sortedDocs.length} 篇文档`}
          >
            {sortedDocs.length}
          </div>
        </div>
      ) : docListMode === 'slim' ? (
        <div className="doclist-slim-header" style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-border-light)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sortedDocs.length} 篇文档
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="btn-icon"
              onClick={() => setDocListMode('micro')}
              data-tooltip="图标轨模式 (68px)"
              style={{ width: '24px', height: '24px', padding: 0 }}
            >
              <Grid size={14} />
            </button>
            <button
              className="btn-icon"
              onClick={() => setDocListMode('full')}
              data-tooltip="展开全量卡片 (380px)"
              style={{ width: '24px', height: '24px', padding: 0 }}
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="doclist-header">
          <div className="doclist-title">
            <span>{getViewTitle()}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* CRM 级三档 View Mode Switcher */}
              <div style={{
                display: 'flex',
                background: 'var(--color-bg-tertiary)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid var(--color-border-light)'
              }}>
                <button
                  className={`btn-icon ${docListMode === 'full' ? 'active' : ''}`}
                  onClick={() => setDocListMode('full')}
                  data-tooltip="卡片视图 (380px)"
                  style={{ width: '24px', height: '24px', padding: 0, borderRadius: '6px', background: docListMode === 'full' ? 'var(--color-bg-card)' : 'transparent', color: docListMode === 'full' ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
                >
                  <LayoutList size={13} />
                </button>
                <button
                  className={`btn-icon ${docListMode === 'slim' ? 'active' : ''}`}
                  onClick={() => setDocListMode('slim')}
                  data-tooltip="单行极简 (200px)"
                  style={{ width: '24px', height: '24px', padding: 0, borderRadius: '6px', background: docListMode === 'slim' ? 'var(--color-bg-card)' : 'transparent', color: docListMode === 'slim' ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
                >
                  <AlignJustify size={13} />
                </button>
                <button
                  className={`btn-icon ${docListMode === 'micro' ? 'active' : ''}`}
                  onClick={() => setDocListMode('micro')}
                  data-tooltip="图标轨 (68px)"
                  style={{ width: '24px', height: '24px', padding: 0, borderRadius: '6px', background: docListMode === 'micro' ? 'var(--color-bg-card)' : 'transparent', color: docListMode === 'micro' ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
                >
                  <Grid size={13} />
                </button>
              </div>

              {currentView === 'trash' && documents.some(d => d.location === 'trash') && (
                <button
                  className="btn-icon"
                  onClick={() => setShowEmptyConfirm(true)}
                  data-tooltip="清空垃圾箱"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                className="btn-icon"
                onClick={() => {
                  if (!isSyncing) syncData({ full: false });
                }}
                disabled={isSyncing}
                data-tooltip={isSyncing ? "同步中..." : "增量同步"}
                style={{ opacity: isSyncing ? 0.7 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={18} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
              </button>
            </div>
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
      )}

      {docListMode === 'full' && (
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
              {(currentView === 'feed' || currentCategory === 'rss' || currentCategory === 'feed') && (
                <span
                  style={{
                    marginLeft: '10px',
                    cursor: 'pointer',
                    color: 'var(--color-accent)',
                    fontWeight: '600',
                    fontSize: '12px'
                  }}
                  onClick={() => setSelectedDoc(null)}
                >
                  🤖 AI 推荐
                </span>
              )}
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
      )}

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
            {sortedDocs.map((doc, idx) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                index={idx}
                isActive={selectedDoc?.id === doc.id}
                onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
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
                docListMode={docListMode}
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
