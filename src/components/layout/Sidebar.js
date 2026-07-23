'use client';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { LOCATION_LABELS, CATEGORY_LABELS } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, LOCATION_ICONS_SVG } from '@/components/ui/icons';
import { Home, Tag, Plus, RefreshCw, Sun, Moon, Settings, SlidersHorizontal } from 'lucide-react';

// 折叠左侧栏的矩形图标 (同 Readwise 官方)
const SidebarCloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

// 展开左侧栏的矩形图标 (同 Readwise 官方)
const SidebarOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="M14 9l3 3-3 3" />
  </svg>
);

export default function Sidebar({ width }) {
  const {
    currentView, currentCategory, currentTag,
    switchView, switchCategory, switchTag,
    tags, stats, sidebarCollapsed, setSidebarCollapsed,
    setShowSettings, setShowAddUrl, setShowTagsManager, syncData, isSyncing,
  } = useApp();
  const { theme, toggleTheme } = useTheme();

  const locations = [
    { key: 'new', icon: LOCATION_ICONS_SVG.new, label: LOCATION_LABELS.new },
    { key: 'later', icon: LOCATION_ICONS_SVG.later, label: LOCATION_LABELS.later },
    { key: 'shortlist', icon: LOCATION_ICONS_SVG.shortlist, label: LOCATION_LABELS.shortlist },
    { key: 'archive', icon: LOCATION_ICONS_SVG.archive, label: LOCATION_LABELS.archive },
    { key: 'feed', icon: LOCATION_ICONS_SVG.feed, label: LOCATION_LABELS.feed },
    { key: 'trash', icon: LOCATION_ICONS_SVG.trash, label: LOCATION_LABELS.trash },
  ];

  const categories = [
    { key: 'article', icon: CATEGORY_ICONS_SVG.article, label: CATEGORY_LABELS.article },
    { key: 'pdf', icon: CATEGORY_ICONS_SVG.pdf, label: CATEGORY_LABELS.pdf },
    { key: 'epub', icon: CATEGORY_ICONS_SVG.epub, label: CATEGORY_LABELS.epub },
    { key: 'email', icon: CATEGORY_ICONS_SVG.email, label: CATEGORY_LABELS.email },
    { key: 'rss', icon: CATEGORY_ICONS_SVG.rss, label: CATEGORY_LABELS.rss },
    { key: 'tweet', icon: CATEGORY_ICONS_SVG.tweet, label: CATEGORY_LABELS.tweet },
    { key: 'video', icon: CATEGORY_ICONS_SVG.video, label: CATEGORY_LABELS.video },
  ];

  return (
    <aside 
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
      style={(!sidebarCollapsed && width) ? { width: `${width}px`, minWidth: `${width}px` } : {}}
    >
      <div className="sidebar-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {!sidebarCollapsed ? (
          <>
            {/* LOGO 靠左 */}
            <div className="sidebar-logo" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '700',
              fontSize: '1.15rem',
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)'
            }}>
              <img src="/logo.png" alt="ReaderQ Logo" className="sidebar-logo-img" style={{ width: '20px', height: '20px' }} />
              <span>ReaderQ</span>
            </div>

            {/* 同一行右侧有收拢左侧栏按钮以及加号添加按钮 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {/* 收拢左侧栏按钮 */}
              <button
                className="btn-icon add-doc-btn-header"
                onClick={() => setSidebarCollapsed(true)}
                data-tooltip="折叠侧栏"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  padding: '0'
                }}
              >
                <SidebarCloseIcon />
              </button>

              {/* 圆圈加号添加按钮 */}
              <button
                className="btn-icon add-doc-btn-header"
                onClick={() => setShowAddUrl(true)}
                data-tooltip="添加文章或文档"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  padding: '0'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          /* 折叠状态下只显示一个展开按钮，避开 macOS 红绿灯已在 globals.css 中处理 */
          <button
            className="btn-icon add-doc-btn-header"
            onClick={() => setSidebarCollapsed(false)}
            data-tooltip="展开侧栏"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '0'
            }}
          >
            <SidebarOpenIcon />
          </button>
        )}
      </div>


      <nav className="sidebar-nav">
        {/* 主导航 */}
        <div className="sidebar-section">
          {!sidebarCollapsed && <div className="sidebar-section-title">导航</div>}
          <button
            className={`sidebar-item ${currentView === 'all' && !currentCategory && !currentTag ? 'active' : ''}`}
            onClick={() => switchView('all')}
          >
            <span className="sidebar-item-icon"><Home size={16} /></span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label">全部</span>
                {stats.total > 0 && <span className="sidebar-item-count">{stats.total}</span>}
              </>
            )}
          </button>
          {locations.map(loc => (
            <button
              key={loc.key}
              className={`sidebar-item ${currentView === loc.key && !currentCategory ? 'active' : ''}`}
              onClick={() => switchView(loc.key)}
            >
              <span className="sidebar-item-icon">{loc.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="sidebar-item-label">{loc.label}</span>
                  {stats.byLocation?.[loc.key] > 0 && (
                    <span className="sidebar-item-count">{stats.byLocation[loc.key]}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* 类别筛选 */}
        <div className="sidebar-section">
          {!sidebarCollapsed && <div className="sidebar-section-title">类别</div>}
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`sidebar-item ${currentCategory === cat.key ? 'active' : ''}`}
              onClick={() => switchCategory(cat.key)}
            >
              <span className="sidebar-item-icon">{cat.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="sidebar-item-label">{cat.label}</span>
                  {stats.byCategory?.[cat.key] > 0 && (
                    <span className="sidebar-item-count">{stats.byCategory[cat.key]}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* 标签 Section (只显示最近使用的 4 个标签，最后一行是固定的标签管理按钮) */}
        {tags.length > 0 && (
          <div className="sidebar-section">
            {!sidebarCollapsed && (
              <div className="sidebar-section-title">
                <span>最近标签</span>
              </div>
            )}
            {tags.slice(0, 4).map(tag => (
              <button
                key={tag.key}
                className={`sidebar-item ${currentTag === tag.key ? 'active' : ''}`}
                onClick={() => switchTag(tag.key)}
              >
                <span className="sidebar-item-icon"><Tag size={16} /></span>
                {!sidebarCollapsed && <span className="sidebar-item-label">{tag.name}</span>}
              </button>
            ))}

            {/* 最后一行固定的标签管理按钮 */}
            <button
              className="sidebar-item"
              onClick={() => setShowTagsManager(true)}
              data-tooltip={sidebarCollapsed ? "管理所有标签" : undefined}
              style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}
            >
              <span className="sidebar-item-icon"><SlidersHorizontal size={16} /></span>
              {!sidebarCollapsed && (
                <span className="sidebar-item-label" style={{ fontWeight: '500' }}>标签管理...</span>
              )}
            </button>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn-icon"
          onClick={() => syncData(false)}
          data-tooltip={isSyncing ? '同步中...' : '同步数据'}
          disabled={isSyncing}
          style={{ opacity: isSyncing ? 0.7 : 1, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={18} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
        <button
          className="btn-icon"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? '浅色模式' : '深色模式'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="btn-icon"
          onClick={() => setShowSettings(true)}
          data-tooltip="设置"
        >
          <Settings size={18} />
        </button>
      </div>
    </aside>
  );
}
