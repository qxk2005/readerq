'use client';

import { useEffect } from 'react';
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
      <div className="app-layout">
        <Sidebar />
        <DocumentList />
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
