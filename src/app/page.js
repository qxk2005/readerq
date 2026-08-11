'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import Sidebar from '@/components/layout/Sidebar';
import DocumentList from '@/components/layout/DocumentList';
import ReadingPane from '@/components/layout/ReadingPane';
import CommandPalette from '@/components/layout/CommandPalette';

import SettingsModal from '@/components/settings/SettingsModal';
import AddUrlModal from '@/components/ui/AddUrlModal';
import TagsManagerModal from '@/components/tags/TagsManagerModal';
import OnboardingWizardModal from '@/components/onboarding/OnboardingWizardModal';
import DailyReviewView from '@/components/review/DailyReviewView';
import HomeFeedView from '@/components/home/HomeFeedView';
import ZenReadView from '@/components/zen/ZenReadView';

export default function HomePage() {
  const {
    currentView,
    switchView,
    selectedDoc,
    setSelectedDoc,
    setShowCommandPalette,
    setShowAiPanel,
    showAiPanel,
    setSidebarCollapsed,
    sidebarCollapsed,
    setShowAddUrl,
    cycleRightPanelTab,
    syncData,
    isSyncing,
    syncError,
    toast,
    showOnboardingWizard,
    setShowOnboardingWizard,
    isReopeningOnboarding,
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

    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.ui_sidebar_width) {
          setSidebarWidth(parseInt(data.ui_sidebar_width, 10));
        }
        if (data && data.ui_doclist_width) {
          setDocListWidth(parseInt(data.ui_doclist_width, 10));
        }
      })
      .catch(() => {});
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

  // 宽度变化并拖动结束时保存到 localStorage 与数据库
  useEffect(() => {
    if (!isResizingSidebar && sidebarWidth !== 240) {
      localStorage.setItem('readerq_sidebar_width', sidebarWidth.toString());
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_sidebar_width: sidebarWidth.toString() }),
      }).catch(() => {});
    }
  }, [sidebarWidth, isResizingSidebar]);

  useEffect(() => {
    if (!isResizingDocList && docListWidth !== 380) {
      localStorage.setItem('readerq_doclist_width', docListWidth.toString());
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_doclist_width: docListWidth.toString() }),
      }).catch(() => {});
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

      // ] -> 轮询切换右侧栏 (信息 -> 笔记 -> AI助手 -> 收拢)
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        cycleRightPanelTab();
      }

      // Escape -> 关闭弹窗
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCommandPalette, cycleRightPanelTab, setSidebarCollapsed, syncData, toggleTheme, setShowAddUrl]);

  return (
    <>
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
        {currentView === 'daily-review' ? (
          <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <DailyReviewView onBackToArticles={() => switchView('all')} />
          </div>
        ) : currentView === 'zen-read' ? (
          <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <ZenReadView onBackToArticles={() => switchView('all')} />
          </div>
        ) : currentView === 'home' ? (
          <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedDoc && (
              <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 首页直达正文阅读顶部返回栏 */}
                <div className="home-reading-header" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  background: 'var(--color-bg-secondary)',
                  borderBottom: '1px solid var(--color-border)',
                  zIndex: 10,
                  flexShrink: 0
                }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedDoc(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--color-accent)' }}
                  >
                    <ArrowLeft size={16} /> 返回首页瀑布流
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                    {selectedDoc.title}
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <ReadingPane />
                </div>
              </div>
            )}
            <div style={{ display: selectedDoc ? 'none' : 'block', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
              <HomeFeedView />
            </div>
          </div>
        ) : (
          <>
            <DocumentList width={docListWidth} />
            <div 
              className={`resizer-bar ${isResizingDocList ? 'dragging' : ''}`} 
              onMouseDown={handleDocListResizeStart} 
            />
            <ReadingPane />
          </>
        )}
      </div>

      {/* 全局操作提示 Toast */}
      {toast && (
        <div 
          className="toast"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: toast.type === 'error' ? 'var(--color-danger)' : toast.type === 'success' ? '#10b981' : 'var(--color-bg-tooltip)',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
            fontWeight: '500',
            zIndex: 2000,
          }}
        >
          {toast.type === 'success' && <CheckCircle2 size={16} />}
          {toast.type === 'error' && <XCircle size={16} />}
          {toast.type === 'warning' && <AlertCircle size={16} />}
          {toast.type === 'info' && <Info size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

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
      <TagsManagerModal />
      <OnboardingWizardModal
        isOpen={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        isReopening={isReopeningOnboarding}
      />
    </>
  );
}
