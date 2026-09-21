'use client';

import { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { LOCATION_LABELS, CATEGORY_LABELS } from '@/lib/utils';
import { CATEGORY_ICONS_SVG, LOCATION_ICONS_SVG } from '@/components/ui/icons';
import { 
  Compass, Layers, Sparkles, Wand2, Tag, SlidersHorizontal, Check, Trash2 
} from 'lucide-react';

export default function SourceSwitcherPopover({ isOpen, onClose, triggerRef }) {
  const popoverRef = useRef(null);
  const {
    currentView,
    currentCategory,
    currentTag,
    switchView,
    switchCategory,
    switchTag,
    stats,
    tags,
    setShowTagsManager,
  } = useApp();

  // 点击外部和 ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const libraryLocations = [
    { key: 'new', icon: LOCATION_ICONS_SVG.new, label: LOCATION_LABELS.new, count: stats.byLocation?.new },
    { key: 'later', icon: LOCATION_ICONS_SVG.later, label: LOCATION_LABELS.later, count: stats.byLocation?.later },
    { key: 'shortlist', icon: LOCATION_ICONS_SVG.shortlist, label: LOCATION_LABELS.shortlist, count: stats.byLocation?.shortlist },
    { key: 'archive', icon: LOCATION_ICONS_SVG.archive, label: LOCATION_LABELS.archive, count: stats.byLocation?.archive },
  ];

  const categories = [
    { key: 'article', icon: CATEGORY_ICONS_SVG.article, label: CATEGORY_LABELS.article, count: stats.byCategory?.article },
    { key: 'video', icon: CATEGORY_ICONS_SVG.video, label: CATEGORY_LABELS.video, count: stats.byCategory?.video },
    { key: 'pdf', icon: CATEGORY_ICONS_SVG.pdf, label: CATEGORY_LABELS.pdf, count: stats.byCategory?.pdf },
    { key: 'epub', icon: CATEGORY_ICONS_SVG.epub, label: CATEGORY_LABELS.epub, count: stats.byCategory?.epub },
    { key: 'rss', icon: CATEGORY_ICONS_SVG.rss, label: CATEGORY_LABELS.rss, count: stats.byCategory?.rss },
    { key: 'email', icon: CATEGORY_ICONS_SVG.email, label: CATEGORY_LABELS.email, count: stats.byCategory?.email },
    { key: 'tweet', icon: CATEGORY_ICONS_SVG.tweet, label: CATEGORY_LABELS.tweet, count: stats.byCategory?.tweet },
  ];

  const handleSelectView = (viewKey) => {
    switchView(viewKey);
    onClose();
  };

  const handleSelectCategory = (catKey) => {
    switchCategory(catKey);
    onClose();
  };

  const handleSelectTag = (tagKey) => {
    switchTag(tagKey);
    onClose();
  };

  const handleOpenTagsManager = () => {
    setShowTagsManager(true);
    onClose();
  };

  return (
    <div className="source-switcher-popover" ref={popoverRef}>
      <div className="source-switcher-scroll-area">
        {/* 分组一：智能分类 */}
        <div className="popover-group">
          <div className="popover-group-title">智能分类</div>
          {/* 首页 */}
          <button
            type="button"
            className={`popover-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => handleSelectView('home')}
          >
            <span className="popover-item-icon"><Compass size={16} /></span>
            <span className="popover-item-label">首页瀑布流</span>
            {currentView === 'home' && <Check size={14} className="popover-item-check" />}
          </button>

          {/* 全部 */}
          <button
            type="button"
            className={`popover-item ${currentView === 'all' && !currentCategory && !currentTag ? 'active' : ''}`}
            onClick={() => handleSelectView('all')}
          >
            <span className="popover-item-icon"><Layers size={16} /></span>
            <span className="popover-item-label">全部文档</span>
            {stats.total > 0 && <span className="popover-item-count">{stats.total}</span>}
            {currentView === 'all' && !currentCategory && !currentTag && (
              <Check size={14} className="popover-item-check" />
            )}
          </button>

          {/* 收件箱、稍后阅读、短列表、归档 */}
          {libraryLocations.map(loc => {
            const isSelected = currentView === loc.key && !currentCategory && !currentTag;
            return (
              <button
                key={loc.key}
                type="button"
                className={`popover-item ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectView(loc.key)}
              >
                <span className="popover-item-icon">{loc.icon}</span>
                <span className="popover-item-label">{loc.label}</span>
                {loc.count > 0 && <span className="popover-item-count">{loc.count}</span>}
                {isSelected && <Check size={14} className="popover-item-check" />}
              </button>
            );
          })}
        </div>

        {/* 分组二：精读与探索 */}
        <div className="popover-group">
          <div className="popover-group-title">精读与探索</div>
          {/* 每日回顾 */}
          <button
            type="button"
            className={`popover-item ${currentView === 'daily-review' ? 'active' : ''}`}
            onClick={() => handleSelectView('daily-review')}
          >
            <span className="popover-item-icon" style={{ color: '#ff9500' }}>
              <Sparkles size={16} />
            </span>
            <span className="popover-item-label">每日回顾</span>
            <span className="popover-item-badge review">Review</span>
            {currentView === 'daily-review' && <Check size={14} className="popover-item-check" />}
          </button>

          {/* 禅阅读 */}
          <button
            type="button"
            className={`popover-item ${currentView === 'zen-read' ? 'active' : ''}`}
            onClick={() => handleSelectView('zen-read')}
          >
            <span className="popover-item-icon" style={{ color: '#8b5cf6' }}>
              <Wand2 size={16} />
            </span>
            <span className="popover-item-label">禅阅读</span>
            <span className="popover-item-badge zen">Zen</span>
            {currentView === 'zen-read' && <Check size={14} className="popover-item-check" />}
          </button>

          {/* 订阅源 */}
          <button
            type="button"
            className={`popover-item ${currentView === 'feed' && !currentCategory ? 'active' : ''}`}
            onClick={() => handleSelectView('feed')}
          >
            <span className="popover-item-icon">{LOCATION_ICONS_SVG.feed}</span>
            <span className="popover-item-label">{LOCATION_LABELS.feed}</span>
            {stats.byLocation?.feed > 0 && (
              <span className="popover-item-count">{stats.byLocation.feed}</span>
            )}
            {currentView === 'feed' && !currentCategory && (
              <Check size={14} className="popover-item-check" />
            )}
          </button>
        </div>

        {/* 分组三：内容类型 */}
        <div className="popover-group">
          <div className="popover-group-title">内容类型</div>
          {categories.map(cat => {
            const isSelected = currentCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                className={`popover-item ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectCategory(cat.key)}
              >
                <span className="popover-item-icon">{cat.icon}</span>
                <span className="popover-item-label">{cat.label}</span>
                {cat.count > 0 && <span className="popover-item-count">{cat.count}</span>}
                {isSelected && <Check size={14} className="popover-item-check" />}
              </button>
            );
          })}
        </div>

        {/* 分组四：我的标签 */}
        <div className="popover-group">
          <div className="popover-group-title">我的标签</div>
          {tags && tags.length > 0 ? (
            tags.slice(0, 6).map(tag => {
              const isSelected = currentTag === tag.key;
              return (
                <button
                  key={tag.key}
                  type="button"
                  className={`popover-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectTag(tag.key)}
                >
                  <span className="popover-item-icon"><Tag size={14} /></span>
                  <span className="popover-item-label">{tag.name}</span>
                  {tag.total_count > 0 && (
                    <span className="popover-item-count">{tag.total_count}</span>
                  )}
                  {isSelected && <Check size={14} className="popover-item-check" />}
                </button>
              );
            })
          ) : (
            <div className="popover-empty-tip">暂无标签</div>
          )}

          {/* 标签管理... */}
          <button
            type="button"
            className="popover-item secondary-action"
            onClick={handleOpenTagsManager}
          >
            <span className="popover-item-icon"><SlidersHorizontal size={14} /></span>
            <span className="popover-item-label">标签管理...</span>
          </button>
        </div>

        {/* 分组五：系统与垃圾箱 */}
        <div className="popover-group" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            type="button"
            className={`popover-item trash ${currentView === 'trash' && !currentCategory ? 'active' : ''}`}
            onClick={() => handleSelectView('trash')}
          >
            <span className="popover-item-icon">{LOCATION_ICONS_SVG.trash}</span>
            <span className="popover-item-label">{LOCATION_LABELS.trash}</span>
            {stats.byLocation?.trash > 0 && (
              <span className="popover-item-count">{stats.byLocation.trash}</span>
            )}
            {currentView === 'trash' && !currentCategory && (
              <Check size={14} className="popover-item-check" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
