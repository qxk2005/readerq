'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import Sidebar from '@/components/layout/Sidebar';
import DocumentList from '@/components/layout/DocumentList';
import ReadingPane from '@/components/layout/ReadingPane';
import CommandPalette from '@/components/layout/CommandPalette';

import SettingsModal from '@/components/settings/SettingsModal';
import AddUrlModal from '@/components/ui/AddUrlModal';

export default function HomePage() {
  const {
    setShowCommandPalette,
    setShowAiPanel,
    showAiPanel,
    setSidebarCollapsed,
    sidebarCollapsed,
    setShowAddUrl,
    syncData,
    isSyncing,
    syncError,
  } = useApp();
  const { toggleTheme } = useTheme();

  // 侧边栏与列表栏的自定义宽度状态 (以 px 为单位)
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [docListWidth, setDocListWidth] = useState(380);

  // 在客户端组件挂载后加载已保存的宽度，避免 Hydration 错误
  useEffect(() => {
    const savedSidebar = localStorage.getItem('readerq_sidebar_width');
    if (savedSidebar) {
      setSidebarWidth(parseInt(savedSidebar, 10));
    }
    const savedDocList = localStorage.getItem('readerq_doclist_width');
    if (savedDocList) {
      setDocListWidth(parseInt(savedDocList, 10));
    }
  }, []);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingDocList, setIsResizingDocList] = useState(false);

  // 拖拽调整 Sidebar 宽度
  const handleSidebarResizeStart = (e) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // 导航栏宽度限制在 160px 到 450px 之间
      const newWidth = Math.max(160, Math.min(450, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 拖拽调整 DocumentList 宽度
  const handleDocListResizeStart = (e) => {
    e.preventDefault();
    setIsResizingDocList(true);
    const startX = e.clientX;
    const startWidth = docListWidth;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // 列表栏宽度限制在 240px 到 600px 之间
      const newWidth = Math.max(240, Math.min(600, startWidth + deltaX));
      setDocListWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingDocList(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 宽度变化并拖动结束时保存到 localStorage
  useEffect(() => {
    if (!isResizingSidebar && sidebarWidth !== 240) {
      localStorage.setItem('readerq_sidebar_width', sidebarWidth.toString());
    }
  }, [sidebarWidth, isResizingSidebar]);

  useEffect(() => {
    if (!isResizingDocList && docListWidth !== 380) {
      localStorage.setItem('readerq_doclist_width', docListWidth.toString());
    }
  }, [docListWidth, isResizingDocList]);

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K -> 命令面板
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }

      // Cmd/Ctrl + N -> 添加 URL
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowAddUrl(true);
      }

      // Cmd/Ctrl + Shift + A -> AI 面板
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAiPanel(prev => !prev);
      }

      // Cmd/Ctrl + Shift + S -> 同步
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        syncData(false);
      }

      // Cmd/Ctrl + Shift + L -> 切换主题
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        toggleTheme();
      }

      // [ -> 切换侧栏
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }

      // ] -> 切换 AI 面板
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShowAiPanel(prev => !prev);
      }

      // Escape -> 关闭弹窗
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCommandPalette, setShowAiPanel, setSidebarCollapsed, syncData, toggleTheme, setShowAddUrl]);

  return (
    <>
      <div className="titlebar"></div>
      <div 
        className="app-layout"
        style={isResizingSidebar || isResizingDocList ? { cursor: 'col-resize', userSelect: 'none' } : {}}
      >
        <Sidebar width={sidebarWidth} />
        {!sidebarCollapsed && (
          <div 
            className={`resizer-bar ${isResizingSidebar ? 'dragging' : ''}`} 
            onMouseDown={handleSidebarResizeStart} 
          />
        )}
        <DocumentList width={docListWidth} />
        <div 
          className={`resizer-bar ${isResizingDocList ? 'dragging' : ''}`} 
          onMouseDown={handleDocListResizeStart} 
        />
        <ReadingPane />
      </div>

      {/* 同步状态通知 */}
      {isSyncing && (
        <div className="toast">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className="loading-spinner" style={{ width: '14px', height: '14px' }} />
            正在同步 Readwise 数据...
          </div>
        </div>
      )}

      {syncError && (
        <div className="toast" style={{ background: 'var(--color-danger)' }}>
          同步失败: {syncError}
        </div>
      )}

      {/* 弹窗层 */}
      <CommandPalette />
      <SettingsModal />
      <AddUrlModal />
    </>
  );
}
