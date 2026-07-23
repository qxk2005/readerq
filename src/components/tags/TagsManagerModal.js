'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/utils';
import { Tag, Search, RefreshCw, X, FileText, HighlightingIcon, Clock, ArrowUpDown, Filter, Layers } from 'lucide-react';

export default function TagsManagerModal() {
  const {
    showTagsManager,
    setShowTagsManager,
    switchTag,
    syncData,
    isSyncing,
    fetchTags,
  } = useApp();

  const [tagsStats, setTagsStats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScopeTab, setActiveScopeTab] = useState('all'); // 'all' | 'documents' | 'highlights'
  const [sortBy, setSortBy] = useState('most_used'); // 'most_used' | 'recently_used' | 'name_asc'
  const [isSyncingTags, setIsSyncingTags] = useState(false);

  // 加载包含详细计数的标签数据
  const loadDetailedTags = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tags?detailed=true');
      const data = await res.json();
      if (data.success && Array.isArray(data.tags)) {
        setTagsStats(data.tags);
      }
    } catch (err) {
      console.error('加载标签统计数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showTagsManager) {
      loadDetailedTags();
    }
  }, [showTagsManager, loadDetailedTags]);

  // 手动同步云端最新标签
  const handleSyncTags = async () => {
    setIsSyncingTags(true);
    try {
      await syncData(false);
      await fetchTags();
      await loadDetailedTags();
    } catch (err) {
      console.error('同步标签失败:', err);
    } finally {
      setIsSyncingTags(false);
    }
  };

  // 根据分类 Tab、搜索关键字及排序模式过滤计算
  const filteredAndSortedTags = useMemo(() => {
    let result = [...tagsStats];

    // 1. Scope 筛选
    if (activeScopeTab === 'documents') {
      result = result.filter(t => (t.document_count || 0) > 0);
    } else if (activeScopeTab === 'highlights') {
      result = result.filter(t => (t.highlight_count || 0) > 0);
    }

    // 2. 搜索框过滤
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(t =>
        (t.name || '').toLowerCase().includes(q) || (t.key || '').toLowerCase().includes(q)
      );
    }

    // 3. 排序
    result.sort((a, b) => {
      if (sortBy === 'most_used') {
        return (b.total_count || 0) - (a.total_count || 0);
      }
      if (sortBy === 'recently_used') {
        const timeA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const timeB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });

    return result;
  }, [tagsStats, activeScopeTab, searchQuery, sortBy]);

  if (!showTagsManager) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowTagsManager(false)}>
      <div
        className="modal-content tags-manager-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '780px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-bg-glass)',
          backdropFilter: 'blur(25px) saturate(190%)',
          WebkitBackdropFilter: 'blur(25px) saturate(190%)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* 顶部 Header */}
        <div
          className="tags-manager-header"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <Tag size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: '600', margin: 0 }}>标签管理</h2>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                共 {tagsStats.length} 个标签 · 查看与过滤 Readwise 标签
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSyncTags}
              disabled={isSyncing || isSyncingTags}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw
                size={14}
                style={isSyncing || isSyncingTags ? { animation: 'spin 1s linear infinite' } : {}}
              />
              {isSyncing || isSyncingTags ? '同步中...' : '同步最新标签'}
            </button>

            <button
              className="btn-icon"
              onClick={() => setShowTagsManager(false)}
              style={{ borderRadius: '50%' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 搜索与工具栏 */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          {/* 实时搜索框 */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 240px',
              maxWidth: '360px',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="搜索标签名称..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '34px',
                paddingRight: '28px',
                height: '34px',
                fontSize: 'var(--text-xs)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            {searchQuery && (
              <button
                className="btn-icon"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '2px',
                  width: '20px',
                  height: '20px',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 范围 Tab */}
          <div
            className="tab-group"
            style={{
              display: 'flex',
              background: 'var(--color-bg-tertiary)',
              padding: '3px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <button
              className={`tab-btn ${activeScopeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveScopeTab('all')}
              style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
            >
              全部 ({tagsStats.length})
            </button>
            <button
              className={`tab-btn ${activeScopeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveScopeTab('documents')}
              style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
            >
              文档标签
            </button>
            <button
              className={`tab-btn ${activeScopeTab === 'highlights' ? 'active' : ''}`}
              onClick={() => setActiveScopeTab('highlights')}
              style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
            >
              高亮标签
            </button>
          </div>

          {/* 排序选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            <ArrowUpDown size={14} />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="most_used">按使用次数最多</option>
              <option value="recently_used">按最新使用时间</option>
              <option value="name_asc">按字母顺序 A-Z</option>
            </select>
          </div>
        </div>

        {/* 标签网格 / 列表视图 */}
        <div
          className="tags-manager-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--color-bg-primary)',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-text-tertiary)' }} />
            </div>
          ) : filteredAndSortedTags.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {filteredAndSortedTags.map(tag => (
                <div
                  key={tag.key}
                  className="tag-manager-card"
                  onClick={() => {
                    switchTag(tag.key);
                    setShowTagsManager(false);
                  }}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '600',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-primary)',
                        maxWidth: '150px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--color-primary)' }}>#</span>
                      <span>{tag.name}</span>
                    </div>

                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {tag.total_count || 0}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--color-text-tertiary)',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span>📄 {tag.document_count || 0} 文档</span>
                      <span>🖍️ {tag.highlight_count || 0} 高亮</span>
                    </div>
                    {tag.last_used_at && (
                      <span>{formatDate(tag.last_used_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '60px 0' }}>
              <div className="empty-state-icon"><Tag size={40} strokeWidth={1.5} /></div>
              <div className="empty-state-title">未找到标签</div>
              <div className="empty-state-description">
                {searchQuery ? '没有找到符合关键字的标签' : '当前范围内暂无任何标签'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
