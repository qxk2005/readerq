'use client';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { LOCATION_LABELS, LOCATION_ICONS, CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/utils';

export default function Sidebar() {
  const {
    currentView, currentCategory, currentTag,
    switchView, switchCategory, switchTag,
    tags, stats, sidebarCollapsed, setSidebarCollapsed,
    setShowSettings, setShowAddUrl, syncData, isSyncing,
  } = useApp();
  const { theme, toggleTheme } = useTheme();

  const locations = [
    { key: 'new', icon: LOCATION_ICONS.new, label: LOCATION_LABELS.new },
    { key: 'later', icon: LOCATION_ICONS.later, label: LOCATION_LABELS.later },
    { key: 'shortlist', icon: LOCATION_ICONS.shortlist, label: LOCATION_LABELS.shortlist },
    { key: 'archive', icon: LOCATION_ICONS.archive, label: LOCATION_LABELS.archive },
    { key: 'feed', icon: LOCATION_ICONS.feed, label: LOCATION_LABELS.feed },
  ];

  const categories = [
    { key: 'article', icon: CATEGORY_ICONS.article, label: CATEGORY_LABELS.article },
    { key: 'pdf', icon: CATEGORY_ICONS.pdf, label: CATEGORY_LABELS.pdf },
    { key: 'epub', icon: CATEGORY_ICONS.epub, label: CATEGORY_LABELS.epub },
    { key: 'email', icon: CATEGORY_ICONS.email, label: CATEGORY_LABELS.email },
    { key: 'rss', icon: CATEGORY_ICONS.rss, label: CATEGORY_LABELS.rss },
    { key: 'tweet', icon: CATEGORY_ICONS.tweet, label: CATEGORY_LABELS.tweet },
    { key: 'video', icon: CATEGORY_ICONS.video, label: CATEGORY_LABELS.video },
  ];

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <div className="sidebar-logo">
            <img src="/logo.png" alt="ReaderQ Logo" className="sidebar-logo-img" />
            <span>ReaderQ</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          data-tooltip={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {/* 主导航 */}
        <div className="sidebar-section">
          {!sidebarCollapsed && <div className="sidebar-section-title">导航</div>}
          <button
            className={`sidebar-item ${currentView === 'all' && !currentCategory && !currentTag ? 'active' : ''}`}
            onClick={() => switchView('all')}
          >
            <span className="sidebar-item-icon">🏠</span>
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

        {/* 标签 */}
        {!sidebarCollapsed && tags.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">标签</div>
            {tags.slice(0, 15).map(tag => (
              <button
                key={tag.key}
                className={`sidebar-item ${currentTag === tag.key ? 'active' : ''}`}
                onClick={() => switchTag(tag.key)}
              >
                <span className="sidebar-item-icon">🏷️</span>
                <span className="sidebar-item-label">{tag.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn-icon"
          onClick={() => setShowAddUrl(true)}
          data-tooltip="添加文章"
        >
          ➕
        </button>
        <button
          className="btn-icon"
          onClick={() => syncData(false)}
          data-tooltip={isSyncing ? '同步中...' : '同步数据'}
          disabled={isSyncing}
          style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}}
        >
          🔄
        </button>
        <button
          className="btn-icon"
          onClick={toggleTheme}
          data-tooltip={theme === 'dark' ? '浅色模式' : '深色模式'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          className="btn-icon"
          onClick={() => setShowSettings(true)}
          data-tooltip="设置"
        >
          ⚙️
        </button>
      </div>
    </aside>
  );
}
