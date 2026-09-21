'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { ReaderQLogoSymbol } from '@/components/ui/ReaderQLogo';
import { LOCATION_LABELS, CATEGORY_LABELS, formatDate, truncateText, extractDomain } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, LOCATION_ICONS_SVG, getCategoryIcon } from '@/components/ui/icons';
import { 
  Search, Inbox, Clock, Archive, RefreshCw, FileText, Tag, Trash2, RotateCcw,
  PanelLeftClose, PanelLeftOpen, LayoutList, AlignJustify, ChevronDown,
  Plus, Sun, Moon, Sparkles, Settings, Wand2, Compass, Layers, CheckCircle2,
  SlidersHorizontal, Check
} from 'lucide-react';
import ArticleCoverPlaceholder from '@/components/common/ArticleCoverPlaceholder';
import SourceSwitcherPopover from '@/components/layout/SourceSwitcherPopover';

// 折叠左侧栏的图标
const SidebarCloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

// 挂载在 body 上的单行模式悬浮预览卡片 (Portal，带精准对齐指示小三角与一体化连带视觉)
function SlimDocPreviewPortal({ doc, anchorRect, onMouseEnter, onMouseLeave, onMoveDoc }) {
  if (!doc || !anchorRect || typeof window === 'undefined') return null;

  // 定位计算：贴在列表项右侧 6px 处，箭头刚好贴合原条目
  const left = Math.min(window.innerWidth - 330, anchorRect.right + 6);
  const estimatedHeight = 220;
  
  // 让浮层主标题行与当前条目中心自然对齐
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  let top = anchorCenterY - 45;

  // 上下屏幕边界防溢出保护
  if (top + estimatedHeight > window.innerHeight - 16) {
    top = Math.max(16, window.innerHeight - estimatedHeight - 16);
  }
  if (top < 16) top = 16;

  // 计算指示小三角在浮层内的垂直居中位置，精确指向 anchorCenterY
  const arrowTop = Math.max(16, Math.min(estimatedHeight - 16, anchorCenterY - top));

  const tagList = Array.isArray(doc.tags)
    ? doc.tags.map(t => typeof t === 'string' ? t : t.name || '').filter(Boolean)
    : (doc.tags && typeof doc.tags === 'object' ? Object.keys(doc.tags).filter(Boolean) : []);

  const content = (
    <div
      className="slim-doc-preview-portal"
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 99999,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 精准指向当前条目中心的一体化指示角 */}
      <div 
        className="preview-portal-arrow"
        style={{ top: `${arrowTop}px` }}
      />

      <div className="preview-portal-header">
        <span className="preview-domain-pill">
          {extractDomain(doc.source_url || doc.url) || doc.category || '文章'}
        </span>
        {doc.reading_time && (
          <span className="preview-meta-pill">⏱️ {doc.reading_time}</span>
        )}
      </div>

      <div className="preview-portal-title">{doc.title || '无标题'}</div>

      {doc.summary && (
        <div className="preview-portal-summary">
          {truncateText(doc.summary, 120)}
        </div>
      )}

      {tagList.length > 0 && (
        <div className="preview-portal-tags">
          {tagList.slice(0, 3).map(tag => (
            <span key={tag} className="preview-tag-item">#{tag}</span>
          ))}
        </div>
      )}

      <div className="preview-portal-footer">
        <span className="preview-date-text">
          {formatDate(doc.updated_at || doc.created_at)}
        </span>
        <div className="preview-actions-row" onClick={(e) => e.stopPropagation()}>
          <button className="doc-card-action-btn" title="移至收件箱" onClick={() => onMoveDoc(doc.id, 'new')}><Inbox size={13} /></button>
          <button className="doc-card-action-btn" title="移至稍后阅读" onClick={() => onMoveDoc(doc.id, 'later')}><Clock size={13} /></button>
          <button className="doc-card-action-btn" title="移至归档" onClick={() => onMoveDoc(doc.id, 'archive')}><Archive size={13} /></button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function DocumentCard({ doc, index, isActive, isPreviewActive, onClick, isSelectionMode, isSelected, onToggleSelect, onMoveDoc, onDeleteDoc, currentView, docListMode, onHoverDoc, onLeaveDoc }) {
  const { docListElements } = useTheme();
  const { switchTag } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [doc.image_url]);

  const isTopItem = index !== undefined && index <= 1;

  const tagList = Array.isArray(doc.tags)
    ? doc.tags.map(t => typeof t === 'string' ? t : t.name || '').filter(Boolean)
    : (doc.tags && typeof doc.tags === 'object' ? Object.keys(doc.tags).filter(Boolean) : []);

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

  // 模式 1：精简单行列表模式 (Slim View)
  if (docListMode === 'slim') {
    return (
      <div
        className={`doc-card-slim-item ${isActive ? 'active' : ''} ${isPreviewActive ? 'is-preview-active' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onMouseEnter={(e) => onHoverDoc?.(e, doc)}
        onMouseLeave={onLeaveDoc}
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

        <div className="doc-card-slim-title">
          {doc.title || '无标题'}
        </div>

        {doc.reading_progress > 0 && doc.reading_progress < 1 ? (
          <span className="doc-card-slim-progress-dot" title={`已读 ${Math.round(doc.reading_progress * 100)}%`} />
        ) : (
          <span className="doc-card-slim-type" title={doc.category}>
            {getCategoryIcon(doc.category, 11)}
          </span>
        )}
      </div>
    );
  }

  // 模式 3：标准卡片视图
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

export default function UnifiedSidebarList({ width }) {
  const {
    documents, selectedDoc, setSelectedDoc,
    currentView, currentCategory, currentTag,
    switchView, switchCategory, switchTag,
    searchQuery, setSearchQuery,
    isLoading, fetchDocuments,
    page, hasMore, isFetchingMore,
    batchMoveDocuments, batchDeleteDocuments,
    syncData, isSyncing, emptyTrash,
    sidebarCollapsed, setSidebarCollapsed,
    docListMode, setDocListMode,
    setShowAddUrl, setShowSettings, launchOnboardingWizard,
    stats, tags
  } = useApp();

  const { theme, toggleTheme } = useTheme();

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const triggerRef = useRef(null);

  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const handleEmptyTrash = useCallback(async () => {
    setShowEmptyConfirm(false);
    if (emptyTrash) {
      await emptyTrash();
    }
  }, [emptyTrash]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortBy, setSortBy] = useState('updated');

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

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const handleMoveDoc = useCallback(async (docId, location) => {
    await batchMoveDocuments([docId], location);
  }, [batchMoveDocuments]);

  // 计算当前分类标题与图标
  const getCurrentCategoryMeta = () => {
    if (currentTag) {
      const tagObj = tags?.find(t => t.key === currentTag || t.name === currentTag);
      return {
        title: `#${currentTag}`,
        icon: <Tag size={16} />,
        count: tagObj?.total_count || null
      };
    }
    if (currentCategory) {
      return {
        title: CATEGORY_LABELS[currentCategory] || currentCategory,
        icon: CATEGORY_ICONS_SVG[currentCategory] || <FileText size={16} />,
        count: stats.byCategory?.[currentCategory] || null
      };
    }
    if (currentView === 'home') {
      return {
        title: '首页瀑布流',
        icon: <Compass size={16} style={{ color: 'var(--color-accent)' }} />,
        badge: 'Feed'
      };
    }
    if (currentView === 'daily-review') {
      return {
        title: '每日回顾',
        icon: <Sparkles size={16} style={{ color: '#ff9500' }} />,
        badge: 'Review'
      };
    }
    if (currentView === 'zen-read') {
      return {
        title: '禅阅读',
        icon: <Wand2 size={16} style={{ color: '#8b5cf6' }} />,
        badge: 'Zen'
      };
    }
    if (currentView === 'all') {
      return {
        title: '全部文档',
        icon: <Layers size={16} />,
        count: stats.total || null
      };
    }
    return {
      title: LOCATION_LABELS[currentView] || currentView,
      icon: LOCATION_ICONS_SVG[currentView] || <Inbox size={16} />,
      count: stats.byLocation?.[currentView] || null
    };
  };

  const categoryMeta = getCurrentCategoryMeta();

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

  const isSpecialView = ['home', 'daily-review', 'zen-read'].includes(currentView);

  // 单行模式悬浮预览状态与定时器
  const [hoveredDocState, setHoveredDocState] = useState(null); // { doc, anchorRect }
  const hoverTimerRef = useRef(null);

  const handleHoverDoc = useCallback((e, doc) => {
    if (docListMode !== 'slim') return;
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredDocState({ doc, anchorRect: rect });
    }, 120);
  }, [docListMode]);

  const handleLeaveDoc = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredDocState(null);
    }, 150);
  }, []);

  const handlePortalMouseEnter = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
  }, []);

  const handlePortalMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredDocState(null);
    }, 100);
  }, []);

  // 视图或分类变化时重置悬浮卡片
  useEffect(() => {
    setHoveredDocState(null);
  }, [currentView, currentCategory, currentTag, docListMode]);

  return (
    <div 
      className={`unified-sidebar-list doclist-mode-${docListMode}`}
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* 顶部专属红绿灯拖拽区 (Window Top Drag Strip: 38px) */}
      <div className="sidebar-top-drag-strip" />

      {/* 顶部第一行：品牌 Logo、添加文章、收起侧栏 */}
      <div className="unified-header-top">
        <div className="sidebar-logo">
          <ReaderQLogoSymbol size={24} />
          <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>ReaderQ</span>
          <span className="pro-badge">PRO</span>
        </div>

        <div className="unified-top-actions">
          {/* 收起侧栏按钮 */}
          <button
            className="btn-icon header-action-btn"
            onClick={() => setSidebarCollapsed(true)}
            data-tooltip="收起左栏 (快捷键 [ )"
          >
            <SidebarCloseIcon />
          </button>

          {/* 添加文章/文档按钮 */}
          <button
            className="btn-icon header-action-btn"
            onClick={() => setShowAddUrl(true)}
            data-tooltip="添加文章或文档 (Cmd+N)"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 顶部第二行：方案 B 分类大胶囊下拉触发器 + 视图模式切换 */}
      <div className="unified-header-nav">
        {/* 分类下拉触发按钮与 Popover */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            ref={triggerRef}
            className={`source-switcher-trigger ${isPopoverOpen ? 'active' : ''}`}
            onClick={() => setIsPopoverOpen(prev => !prev)}
            data-tooltip="点击切换文章分类或模块"
          >
            <span className="trigger-icon">{categoryMeta.icon}</span>
            <span className="trigger-title">{categoryMeta.title}</span>
            {categoryMeta.count !== undefined && categoryMeta.count !== null && (
              <span className="trigger-count">{categoryMeta.count} 篇</span>
            )}
            {categoryMeta.badge && (
              <span className="trigger-badge">{categoryMeta.badge}</span>
            )}
            <ChevronDown size={14} className={`trigger-chevron ${isPopoverOpen ? 'rotate' : ''}`} />
          </button>

          {/* 分类下拉弹出层 */}
          <SourceSwitcherPopover
            isOpen={isPopoverOpen}
            onClose={() => setIsPopoverOpen(false)}
            triggerRef={triggerRef}
          />
        </div>

        {/* 视图模式两档切换 (全量卡片 <-> 单行紧凑) */}
        <div className="view-mode-toggle-group">
          <button
            className={`view-toggle-btn ${docListMode === 'full' ? 'active' : ''}`}
            onClick={() => setDocListMode('full')}
            data-tooltip="卡片视图 (快捷键 \)"
          >
            <LayoutList size={13} />
          </button>
          <button
            className={`view-toggle-btn ${docListMode === 'slim' ? 'active' : ''}`}
            onClick={() => setDocListMode('slim')}
            data-tooltip="单行列表 (快捷键 \)"
          >
            <AlignJustify size={13} />
          </button>
        </div>

        {/* 垃圾箱清空快捷操作 */}
        {currentView === 'trash' && documents.some(d => d.location === 'trash') && (
          <button
            className="btn-icon"
            onClick={() => setShowEmptyConfirm(true)}
            data-tooltip="清空垃圾箱"
            style={{ color: '#ef4444', flexShrink: 0 }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* 搜索框与多选工具条 */}
      {!isSpecialView && (
        <div className="unified-search-toolbar">
          <div className="doclist-search" style={{ margin: 0, width: '100%' }}>
            <span className="doclist-search-icon"><Search size={14} /></span>
            <input
              type="text"
              placeholder="搜索当前文档..."
              value={searchQuery}
              onChange={handleSearch}
              id="unified-search-input"
            />
          </div>
        </div>
      )}

      {/* 排序与批量工具条 (卡片与单行模式均可用) */}
      {!isSpecialView && (
        <div className="doclist-toolbar" style={{ padding: '6px 14px', borderBottom: '1px solid var(--color-border-light)' }}>
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
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{sortedDocs.length} 篇文档</span>
              <span 
                style={{ marginLeft: '10px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '12px' }} 
                onClick={() => setIsSelectionMode(true)}
              >
                多选
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
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
                    outline: 'none',
                  }}
                >
                  <option value="updated">最新更新</option>
                  <option value="title">标题</option>
                  <option value="progress">阅读进度</option>
                </select>
              </span>
            </>
          )}
        </div>
      )}

      {/* 中间主要滚动区 */}
      <div 
        className="unified-list-content"
        onScroll={() => {
          if (hoveredDocState) setHoveredDocState(null);
        }}
      >
        {/* 特殊视图专属概览面板 */}
        {currentView === 'home' ? (
          <div className="module-overview-panel">
            <div className="overview-card">
              <div className="overview-card-header">
                <Compass size={18} style={{ color: 'var(--color-accent)' }} />
                <span className="overview-card-title">首页瀑布流</span>
              </div>
              <p className="overview-card-desc">
                聚合所有未读与收件箱推荐内容，采用沉浸瀑布流体验。右侧已为你准备好最新订阅流。
              </p>
              <div className="overview-stats-grid">
                <div className="stat-box">
                  <div className="stat-box-val">{stats.byLocation?.new || 0}</div>
                  <div className="stat-box-lbl">收件箱待阅</div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-val">{stats.total || 0}</div>
                  <div className="stat-box-lbl">总收藏文档</div>
                </div>
              </div>
            </div>

            <div className="overview-card secondary">
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                快速切换
              </div>
              <button 
                className="btn btn-ghost btn-sm overview-quick-action" 
                onClick={() => switchView('new')}
              >
                <Inbox size={14} /> 进入收件箱纯列表
              </button>
              <button 
                className="btn btn-ghost btn-sm overview-quick-action" 
                onClick={() => switchView('later')}
              >
                <Clock size={14} /> 查看稍后阅读
              </button>
            </div>
          </div>
        ) : currentView === 'daily-review' ? (
          <div className="module-overview-panel">
            <div className="overview-card">
              <div className="overview-card-header">
                <Sparkles size={18} style={{ color: '#ff9500' }} />
                <span className="overview-card-title">每日回顾 (Review)</span>
              </div>
              <p className="overview-card-desc">
                基于间隔重复（Spaced Repetition）算法，每天为你温故知新高亮要点与精彩书摘。
              </p>
              <div className="overview-stats-grid">
                <div className="stat-box">
                  <div className="stat-box-val" style={{ color: '#ff9500' }}>每日 5 条</div>
                  <div className="stat-box-lbl">推荐重点</div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-val">记忆强化</div>
                  <div className="stat-box-lbl">间隔复习</div>
                </div>
              </div>
            </div>
          </div>
        ) : currentView === 'zen-read' ? (
          <div className="module-overview-panel">
            <div className="overview-card">
              <div className="overview-card-header">
                <Wand2 size={18} style={{ color: '#8b5cf6' }} />
                <span className="overview-card-title">禅阅读 (Zen Mode)</span>
              </div>
              <p className="overview-card-desc">
                专为心流阅读打造，去除了所有干扰元素，提供全屏极简排版与单手键盘翻页体验。
              </p>
              <div className="overview-stats-grid">
                <div className="stat-box">
                  <div className="stat-box-val" style={{ color: '#8b5cf6' }}>零干扰</div>
                  <div className="stat-box-lbl">专注纯净</div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-val">空格翻页</div>
                  <div className="stat-box-lbl">键盘极速</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 常规分类：文档列表 */
          <>
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
                    isPreviewActive={hoveredDocState?.doc?.id === doc.id}
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
                    onHoverDoc={handleHoverDoc}
                    onLeaveDoc={handleLeaveDoc}
                  />
                ))}
                {/* 滚动触发点 */}
                <div ref={observerTarget} style={{ height: '20px', margin: '10px 0', display: 'flex', justifyContent: 'center' }}>
                  {isFetchingMore && <span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span>}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ paddingTop: '60px' }}>
                <div className="empty-state-icon"><Inbox size={44} strokeWidth={1.2} /></div>
                <div className="empty-state-title">暂无文档</div>
                <div className="empty-state-description">
                  {searchQuery
                    ? '没有找到匹配的文档，换个关键词试试'
                    : '当前分类下暂无文章，可点击底部刷新同步最新内容'}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 悬停单行列表项时的无遮挡 Portal 浮层预览 */}
      {hoveredDocState && (
        <SlimDocPreviewPortal
          doc={hoveredDocState.doc}
          anchorRect={hoveredDocState.anchorRect}
          onMouseEnter={handlePortalMouseEnter}
          onMouseLeave={handlePortalMouseLeave}
          onMoveDoc={handleMoveDoc}
        />
      )}

      {/* 批量操作工具浮条 */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="batch-action-bar" style={{
          position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-primary)', padding: '8px 16px', borderRadius: '32px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: '8px', zIndex: 100,
          border: '1px solid var(--color-border)', alignItems: 'center'
        }}>
          {currentView === 'trash' ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'new'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><RotateCcw size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 恢复</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={async () => { if (confirm('确定要彻底删除选中的文档吗？此操作无法撤销。')) { await batchDeleteDocuments(Array.from(selectedIds)); setIsSelectionMode(false); setSelectedIds(new Set()); } }}><Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> 彻底删除</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '4px', whiteSpace: 'nowrap' }}>移动至</span>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'new'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Inbox size={14} /></button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'later'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Clock size={14} /></button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'archive'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Archive size={14} /></button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={async () => { await batchMoveDocuments(Array.from(selectedIds), 'trash'); setIsSelectionMode(false); setSelectedIds(new Set()); }}><Trash2 size={14} /></button>
            </>
          )}
        </div>
      )}

      {/* 清空垃圾箱对话框 */}
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

      {/* 底部常驻功能按钮行 (刷新、深色、向导、设置图标不变) */}
      <div className="unified-sidebar-footer">
        <button
          className="btn-icon footer-btn"
          onClick={() => {
            if (!isSyncing) syncData({ full: false });
          }}
          data-tooltip={isSyncing ? '同步中...' : '增量同步数据'}
          disabled={isSyncing}
          style={{ opacity: isSyncing ? 0.7 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={17} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>

        <button
          className="btn-icon footer-btn"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? '浅色模式' : '深色模式'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button
          className="btn-icon footer-btn"
          onClick={launchOnboardingWizard}
          data-tooltip="配置向导"
        >
          <Sparkles size={17} style={{ color: 'var(--color-accent, #007aff)' }} />
        </button>

        <button
          className="btn-icon footer-btn"
          onClick={() => setShowSettings(true)}
          data-tooltip="系统设置"
        >
          <Settings size={17} />
        </button>
      </div>
    </div>
  );
}
