'use client';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { ReaderQLogoSymbol } from '@/components/ui/ReaderQLogo';
import { LOCATION_LABELS, CATEGORY_LABELS } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, LOCATION_ICONS_SVG } from '@/components/ui/icons';
import { 
  Compass, Layers, Search, Plus, Tag, Settings,
  Sparkles, ChevronLeft, ChevronRight, Hash, Folder, Wand2, RefreshCw,
  Sun, Moon, Home, SlidersHorizontal
} from 'lucide-react';

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
    setShowSettings, setShowAddUrl, setShowTagsManager, syncData, isSyncing, launchOnboardingWizard,
  } = useApp();
  const { theme, toggleTheme } = useTheme();

  const libraryLocations = [
    { key: 'new', icon: LOCATION_ICONS_SVG.new, label: LOCATION_LABELS.new },
    { key: 'later', icon: LOCATION_ICONS_SVG.later, label: LOCATION_LABELS.later },
    { key: 'shortlist', icon: LOCATION_ICONS_SVG.shortlist, label: LOCATION_LABELS.shortlist },
    { key: 'archive', icon: LOCATION_ICONS_SVG.archive, label: LOCATION_LABELS.archive },
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
      {/* 顶部专属红绿灯拖拽区 (Window Top Drag Strip: 38px) */}
      <div className="sidebar-top-drag-strip" />

      {/* 品牌与侧栏控制头 */}
      <div className="sidebar-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        width: '100%',
        padding: sidebarCollapsed ? '0 8px 6px' : '0 12px 8px',
        boxSizing: 'border-box'
      }}>
        {!sidebarCollapsed ? (
          <>
            {/* LOGO 靠左 */}
            <div className="sidebar-logo" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '700',
              fontSize: '1.2rem',
              letterSpacing: '-0.03em',
              color: 'var(--color-text-primary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif',
              userSelect: 'none'
            }}>
              <ReaderQLogoSymbol size={26} />
              <span style={{ color: 'var(--color-text-primary)' }}>ReaderQ</span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.15), rgba(0, 113, 227, 0.08))',
                color: 'var(--color-accent)',
                letterSpacing: '0.04em',
                border: '1px solid rgba(0, 113, 227, 0.2)'
              }}>
                PRO
              </span>
            </div>

            {/* 同一行右侧有收拢左侧栏按钮以及加号添加按钮 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
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
                <Plus size={18} />
              </button>
            </div>
          </>
        ) : (
          /* 折叠状态下只显示一个展开按钮 */
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
        {/* 分组一：收件与书库 (INBOX & LIBRARY) */}
        <div className="sidebar-group-card">
          {/* 首页瀑布流按钮 */}
          <button
            className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => switchView('home')}
            data-tooltip={sidebarCollapsed ? "首页" : undefined}
          >
            <span className="sidebar-item-icon"><Compass size={16} /></span>
            {!sidebarCollapsed && (
              <span className="sidebar-item-label">首页</span>
            )}
          </button>
          {/* 全部文章库按钮 */}
          <button
            className={`sidebar-item ${currentView === 'all' && !currentCategory && !currentTag ? 'active' : ''}`}
            onClick={() => switchView('all')}
            data-tooltip={sidebarCollapsed ? "全部" : undefined}
          >
            <span className="sidebar-item-icon"><Layers size={16} /></span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label">全部</span>
                {stats.total > 0 && <span className="sidebar-item-count">{stats.total}</span>}
              </>
            )}
          </button>
          {/* 收件箱、稍后阅读、短列表、归档 */}
          {libraryLocations.map(loc => (
            <button
              key={loc.key}
              className={`sidebar-item ${currentView === loc.key && !currentCategory ? 'active' : ''}`}
              onClick={() => switchView(loc.key)}
              data-tooltip={sidebarCollapsed ? loc.label : undefined}
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

        {/* 分组二：精读与探索 (EXPLORATION & DISCOVERY) */}
        <div className="sidebar-group-card">
          {/* 每日回顾 (Daily Review) */}
          <button
            className={`sidebar-item ${currentView === 'daily-review' ? 'active' : ''}`}
            onClick={() => switchView('daily-review')}
            data-tooltip={sidebarCollapsed ? "每日回顾" : undefined}
          >
            <span className="sidebar-item-icon" style={{ color: '#ff9500' }}>
              <Sparkles size={16} />
            </span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label" style={{ fontWeight: '500' }}>每日回顾</span>
                <span className="sidebar-item-count" style={{ background: 'rgba(255, 149, 0, 0.12)', color: '#ff9500', fontWeight: '700' }}>Review</span>
              </>
            )}
          </button>

          {/* 禅阅读 (Zen Read) */}
          <button
            className={`sidebar-item ${currentView === 'zen-read' ? 'active' : ''}`}
            onClick={() => switchView('zen-read')}
            data-tooltip={sidebarCollapsed ? "禅阅读" : undefined}
          >
            <span className="sidebar-item-icon" style={{ color: '#8b5cf6' }}>
              <Wand2 size={16} />
            </span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label" style={{ fontWeight: '500' }}>禅阅读</span>
                <span className="sidebar-item-count" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', fontWeight: '700' }}>Zen</span>
              </>
            )}
          </button>

          {/* 订阅源 (Feed) */}
          <button
            className={`sidebar-item ${currentView === 'feed' && !currentCategory ? 'active' : ''}`}
            onClick={() => switchView('feed')}
            data-tooltip={sidebarCollapsed ? LOCATION_LABELS.feed : undefined}
          >
            <span className="sidebar-item-icon">{LOCATION_ICONS_SVG.feed}</span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label">{LOCATION_LABELS.feed}</span>
                {stats.byLocation?.['feed'] > 0 && (
                  <span className="sidebar-item-count">{stats.byLocation['feed']}</span>
                )}
              </>
            )}
          </button>
        </div>

        {/* 分组三：内容载体 (FORMATS & MEDIA) */}
        <div className="sidebar-group-card">
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`sidebar-item ${currentCategory === cat.key ? 'active' : ''}`}
              onClick={() => switchCategory(cat.key)}
              data-tooltip={sidebarCollapsed ? cat.label : undefined}
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

        {/* 分组四：知识网络 (KNOWLEDGE & SYSTEM) */}
        <div className="sidebar-group-card">
          {tags.slice(0, 4).map(tag => (
            <button
              key={tag.key}
              className={`sidebar-item ${currentTag === tag.key ? 'active' : ''}`}
              onClick={() => switchTag(tag.key)}
              data-tooltip={sidebarCollapsed ? tag.name : undefined}
            >
              <span className="sidebar-item-icon"><Tag size={15} /></span>
              {!sidebarCollapsed && <span className="sidebar-item-label">{tag.name}</span>}
            </button>
          ))}

          {/* 标签管理按钮 */}
          <button
            className="sidebar-item"
            onClick={() => setShowTagsManager(true)}
            data-tooltip={sidebarCollapsed ? "管理所有标签" : undefined}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="sidebar-item-icon"><SlidersHorizontal size={15} /></span>
            {!sidebarCollapsed && (
              <span className="sidebar-item-label" style={{ fontWeight: '450' }}>标签管理...</span>
            )}
          </button>

          {/* 垃圾箱 (系统回收站，安全收纳在知识网络组末尾) */}
          <button
            className={`sidebar-item ${currentView === 'trash' && !currentCategory ? 'active' : ''}`}
            onClick={() => switchView('trash')}
            data-tooltip={sidebarCollapsed ? LOCATION_LABELS.trash : undefined}
            style={{
              marginTop: '2px',
              color: currentView === 'trash' ? 'var(--color-danger)' : 'var(--color-text-tertiary)'
            }}
          >
            <span className="sidebar-item-icon" style={{ opacity: 0.85 }}>{LOCATION_ICONS_SVG.trash}</span>
            {!sidebarCollapsed && (
              <>
                <span className="sidebar-item-label">{LOCATION_LABELS.trash}</span>
                {stats.byLocation?.['trash'] > 0 && (
                  <span className="sidebar-item-count">{stats.byLocation['trash']}</span>
                )}
              </>
            )}
          </button>
        </div>
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
          onClick={launchOnboardingWizard}
          data-tooltip="配置向导"
        >
          <Sparkles size={18} style={{ color: 'var(--color-accent, #007aff)' }} />
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
