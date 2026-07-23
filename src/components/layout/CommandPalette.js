'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

import { RefreshCw, Inbox, Plus, Bot, Settings, Home, Clock, Archive, Rss, Search, Palette, Tag } from 'lucide-react';

const COMMANDS = [
  { id: 'sync', icon: <RefreshCw size={16} />, label: '同步 Readwise 数据', shortcut: ['Ctrl', 'Shift', 'S'], action: 'sync' },
  { id: 'sync-full', icon: <Inbox size={16} />, label: '全量同步数据', action: 'syncFull' },
  { id: 'add-url', icon: <Plus size={16} />, label: '添加文章 URL', shortcut: ['Ctrl', 'N'], action: 'addUrl' },
  { id: 'ai', icon: <Bot size={16} />, label: '打开/关闭 AI 助手', shortcut: ['Ctrl', 'Shift', 'A'], action: 'toggleAi' },
  { id: 'view-all', icon: <Home size={16} />, label: '查看全部文档', action: 'viewAll' },
  { id: 'view-new', icon: <Inbox size={16} />, label: '查看收件箱', action: 'viewNew' },
  { id: 'view-later', icon: <Clock size={16} />, label: '查看稍后阅读', action: 'viewLater' },
  { id: 'view-archive', icon: <Archive size={16} />, label: '查看归档', action: 'viewArchive' },
  { id: 'view-feed', icon: <Rss size={16} />, label: '查看订阅源', action: 'viewFeed' },
  { id: 'search', icon: <Search size={16} />, label: '搜索文档', shortcut: ['Ctrl', 'F'], action: 'search' },
  { id: 'addUrl', icon: <Plus size={16} />, label: '添加文章或 URL', shortcut: ['Ctrl', 'N'], action: 'addUrl' },
  { id: 'tags', icon: <Tag size={16} />, label: '管理标签 (查看统计/过滤/同步)', action: 'manageTags' },
  { id: 'settings', icon: <Settings size={16} />, label: '设置', action: 'settings' },
  { id: 'theme', icon: <Palette size={16} />, label: '切换深色/浅色模式', shortcut: ['Ctrl', 'Shift', 'L'], action: 'toggleTheme' },
];

export default function CommandPalette() {
  const { showCommandPalette, setShowCommandPalette, syncData, switchView, setShowAiPanel, showAiPanel, setShowSettings, setShowAddUrl, setShowTagsManager } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const filtered = query
    ? COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  useEffect(() => {
    if (showCommandPalette) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCommandPalette]);

  const executeCommand = useCallback((cmd) => {
    setShowCommandPalette(false);
    switch (cmd.action) {
      case 'sync': syncData(false); break;
      case 'syncFull': syncData(true); break;
      case 'addUrl': setShowAddUrl(true); break;
      case 'manageTags': setShowTagsManager(true); break;
      case 'toggleAi': setShowAiPanel(!showAiPanel); break;
      case 'settings': setShowSettings(true); break;
      case 'viewAll': switchView('all'); break;
      case 'viewNew': switchView('new'); break;
      case 'viewLater': switchView('later'); break;
      case 'viewArchive': switchView('archive'); break;
      case 'viewFeed': switchView('feed'); break;
      case 'search':
        setTimeout(() => document.getElementById('search-input')?.focus(), 100);
        break;
      case 'toggleTheme':
        document.documentElement.setAttribute('data-theme',
          document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
        );
        break;
    }
  }, [syncData, setShowCommandPalette, setShowAiPanel, showAiPanel, setShowSettings, switchView, setShowAddUrl]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowCommandPalette(false);
    }
  };

  if (!showCommandPalette) return null;

  return (
    <div
      className="command-palette-overlay"
      onClick={() => setShowCommandPalette(false)}
    >
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="输入命令..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette-list">
          {filtered.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={`command-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => executeCommand(cmd)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="command-palette-item-icon">{cmd.icon}</span>
              <span>{cmd.label}</span>
              {cmd.shortcut && (
                <span className="command-palette-shortcut">
                  {cmd.shortcut.map((k, i) => <kbd key={i}>{k}</kbd>)}
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-palette-item" style={{ color: 'var(--color-text-tertiary)' }}>
              没有匹配的命令
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
