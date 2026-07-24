'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, _setSelectedDoc] = useState(null);
  const [currentView, setCurrentView] = useState('new'); // location filter
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentTag, setCurrentTag] = useState(null);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState({ total: 0, byLocation: {}, byCategory: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncCounts, setSyncCounts] = useState({ local: 0, remote: 0, lastSync: null });
  const [syncError, setSyncError] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState(null); // 'info', 'notebook', 'chat', null
  
  // 兼容现有的 showAiPanel 逻辑
  const showAiPanel = rightPanelTab === 'chat';
  const setShowAiPanel = (show) => setRightPanelTab(show ? 'chat' : null);

  // 轮询右侧面板状态：'info' (信息) -> 'notebook' (笔记) -> 'chat' (AI 助手) -> null (收拢)
  const cycleRightPanelTab = useCallback(() => {
    setRightPanelTab(prev => {
      if (prev === 'info') return 'notebook';
      if (prev === 'notebook') return 'chat';
      if (prev === 'chat') return null;
      return 'info';
    });
  }, []);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [showTagsManager, setShowTagsManager] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentError, setContentError] = useState(null);

  // 单篇文档正文按需同步
  const fetchDocumentDetails = useCallback(async (id) => {
    setIsContentLoading(true);
    setContentError(null);
    try {
      const res = await fetch(`/api/readwise/documents?id=${id}`);
      const fullDoc = await res.json();
      if (fullDoc && !fullDoc.error) {
        _setSelectedDoc(prev => (prev && prev.id === id ? fullDoc : prev));
        // 更新列表中的正文缓存，以便下次直接秒开
        setDocuments(prevDocs =>
          prevDocs.map(doc => (doc.id === id ? { ...doc, html_content: fullDoc.html_content } : doc))
        );
      } else {
        throw new Error(fullDoc.error || '获取文档内容失败');
      }
    } catch (err) {
      console.error('按需同步文档正文失败:', err);
      setContentError(err.message || '获取文档正文失败，请稍后重试');
    } finally {
      setIsContentLoading(false);
    }
  }, []);

  const setSelectedDoc = useCallback((doc) => {
    _setSelectedDoc(doc);
    if (doc && doc.html_content === null) {
      fetchDocumentDetails(doc.id);
    } else {
      setIsContentLoading(false);
      setContentError(null);
    }
  }, [fetchDocumentDetails]);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // 获取文档
  const fetchDocuments = useCallback(async (options = {}) => {
    const currentPage = options.page || 1;
    
    if (currentPage === 1) {
      setIsLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    
    try {
      const params = new URLSearchParams();
      const location = options.location || currentView;
      if (location && location !== 'all') params.set('location', location);
      if (options.category || currentCategory) params.set('category', options.category || currentCategory);
      if (options.tag || currentTag) params.set('tag', options.tag || currentTag);
      if (options.search || searchQuery) params.set('search', options.search || searchQuery);
      if (options.sync) params.set('sync', 'true');
      params.set('page', currentPage);
      params.set('limit', 50);

      const res = await fetch(`/api/readwise/documents?${params.toString()}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (currentPage === 1) {
        setDocuments(data.documents || []);
      } else {
        setDocuments(prev => {
          // 去重合并
          const existingIds = new Set(prev.map(d => d.id));
          const newDocs = (data.documents || []).filter(d => !existingIds.has(d.id));
          return [...prev, ...newDocs];
        });
      }
      
      setHasMore((data.documents || []).length === 50);
      setPage(currentPage);
      
      if (data.stats && currentPage === 1) setStats(data.stats);
    } catch (err) {
      console.error('获取文档失败:', err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [currentView, currentCategory, currentTag, searchQuery]);

  // 检查同步状态
  const checkSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/readwise/sync/status');
      const data = await res.json();
      
      setSyncStatus(data.status);
      setSyncProgress(data.progress);
      setSyncError(data.error);
      setSyncCounts({
        local: data.localCount,
        remote: data.remoteCount,
        lastSync: data.lastSyncTime
      });

      if (data.status === 'syncing' || data.status === 'canceling') {
        setIsSyncing(true);
      } else {
        if (isSyncing) {
          // 如果刚从 syncing 变为 idle/canceled/error，触发文档刷新
          fetchDocuments();
          fetchTags();
        }
        setIsSyncing(false);
      }
    } catch (e) {
      console.error('获取同步状态失败:', e);
    }
  }, [isSyncing, fetchDocuments]);

  // 定期轮询同步状态
  useEffect(() => {
    // 首次加载检查一次状态
    checkSyncStatus();

    // 如果正在同步，每秒轮询一次；如果空闲，为了防止其他端发起同步，每 10 秒轮询一次
    const interval = setInterval(checkSyncStatus, isSyncing ? 1000 : 10000);
    return () => clearInterval(interval);
  }, [isSyncing, checkSyncStatus]);

  // 同步数据 (修改为后台执行模式)
  const syncData = useCallback(async (options = {}) => {
    const full = typeof options === 'boolean' ? options : !!options.full;
    const location = typeof options === 'object' ? options.location : null;
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const res = await fetch('/api/readwise/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full, location }),
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || '同步启动失败');
      }
      
      // 触发一次立即状态检查
      checkSyncStatus();
    } catch (error) {
      console.error('同步错误:', error);
      setSyncError(error.message);
      setIsSyncing(false);
      setSyncStatus('error');
    }
  }, [isSyncing, checkSyncStatus]);

  // 取消同步
  const cancelSync = useCallback(async () => {
    if (!isSyncing || syncStatus === 'canceling') return;
    setSyncStatus('canceling');
    try {
      await fetch('/api/readwise/sync/cancel', { method: 'POST' });
    } catch (e) {
      console.error('取消同步发送失败:', e);
    }
  }, [isSyncing, syncStatus]);

  // 保存新文档
  const saveDocument = useCallback(async (url) => {
    try {
      const res = await fetch('/api/readwise/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchDocuments();
      return data;
    } catch (err) {
      console.error('保存文档失败:', err);
      throw err;
    }
  }, [fetchDocuments]);

  // 批量移动文档
  // 批量移动文档 (支持单 string id 或 string[] 数组)
  const batchMoveDocuments = useCallback(async (ids, location) => {
    try {
      const idArray = Array.isArray(ids) ? ids : [ids];
      if (idArray.length === 0) return true;

      // 乐观更新
      setDocuments(prev => prev.filter(doc => {
        if (idArray.includes(doc.id)) {
          if (currentView === 'all') return true;
          if (currentView === location) return true;
          if (['new', 'later', 'archive', 'trash', 'feed'].includes(currentView)) return false;
        }
        return true;
      }).map(doc => idArray.includes(doc.id) ? { ...doc, location } : doc));

      const res = await fetch('/api/readwise/documents/batch-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idArray, location })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      return true;
    } catch (err) {
      console.error('批量移动文档失败:', err);
      fetchDocuments({ page: 1 });
      throw err;
    }
  }, [currentView, fetchDocuments]);

  // 批量彻底物理删除文档 (支持单 string id 或 string[] 数组)
  const batchDeleteDocuments = useCallback(async (ids) => {
    try {
      const idArray = Array.isArray(ids) ? ids : [ids];
      if (idArray.length === 0) return true;

      // 乐观更新：过滤掉要彻底删除的文档
      setDocuments(prev => prev.filter(doc => !idArray.includes(doc.id)));
      
      const res = await fetch('/api/readwise/documents/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idArray })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 如果当前选中的文档被物理删除了，重置 selectedDoc 为 null
      setSelectedDoc(prev => (prev && idArray.includes(prev.id) ? null : prev));
      
      return true;
    } catch (err) {
      console.error('批量物理删除文档失败:', err);
      fetchDocuments({ page: 1 });
      throw err;
    }
  }, [fetchDocuments]);

  // 切换视图
  const switchView = useCallback((view) => {
    setCurrentView(view);
    setCurrentCategory(null);
    setCurrentTag(null);
    setSelectedDoc(null);
  }, []);

  // 切换类别
  const switchCategory = useCallback((category) => {
    setCurrentCategory(category);
    setCurrentView('all');
    setCurrentTag(null);
    setSelectedDoc(null);
  }, []);

  // 切换标签
  const switchTag = useCallback((tag) => {
    setCurrentTag(tag);
    setCurrentView('all');
    setCurrentCategory(null);
    setSelectedDoc(null);
  }, []);

  // 局部更新文档信息（避免全量拉取）
  const updateDocumentLocally = useCallback((id, updates) => {
    setDocuments(prevDocs => 
      prevDocs.map(doc => doc.id === id ? { ...doc, ...updates } : doc)
    );
    _setSelectedDoc(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  }, []);

  // 获取所有标签 (包含最后使用时间，并按最新使用时间降序排列)
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags?detailed=true');
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        const sorted = [...data.tags].sort((a, b) => {
          const timeA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
          const timeB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return (b.total_count || 0) - (a.total_count || 0);
        });
        setTags(sorted);
      }
    } catch (err) {
      console.error('获取标签列表失败:', err);
    }
  }, []);

  const [isSidebarInit, setIsSidebarInit] = useState(false);

  // 初始化加载 Sidebar 收起状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('readerq_sidebar_collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
    }
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.ui_sidebar_collapsed !== undefined && data.ui_sidebar_collapsed !== '') {
          setSidebarCollapsed(data.ui_sidebar_collapsed === 'true');
        }
      })
      .catch(() => {})
      .finally(() => setIsSidebarInit(true));
  }, []);

  // 当 sidebarCollapsed 发生变更时持久化保存
  useEffect(() => {
    if (!isSidebarInit) return;
    localStorage.setItem('readerq_sidebar_collapsed', sidebarCollapsed.toString());
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_sidebar_collapsed: sidebarCollapsed.toString() }),
    }).catch(() => {});
  }, [sidebarCollapsed, isSidebarInit]);

  // 初始化加载
  useEffect(() => {
    checkSyncStatus();
    fetchDocuments();
    fetchTags();
  }, [checkSyncStatus, fetchDocuments, fetchTags]);

  // 视图变化时重新获取
  useEffect(() => {
    fetchDocuments();
  }, [currentView, currentCategory, currentTag, fetchDocuments]);

  const value = {
    documents,
    selectedDoc,
    setSelectedDoc,
    updateDocumentLocally,
    currentView,
    currentCategory,
    currentTag,
    tags,
    stats,
    searchQuery,
    setSearchQuery,
    isLoading,
    isSyncing,
    syncStatus,
    syncProgress,
    syncCounts,
    syncError,
    page,
    hasMore,
    isFetchingMore,
    showAiPanel,
    setShowAiPanel,
    showCommandPalette,
    setShowCommandPalette,
    rightPanelTab,
    setRightPanelTab,
    cycleRightPanelTab,
    showSettings,
    setShowSettings,
    showAddUrl,
    setShowAddUrl,
    showTagsManager,
    setShowTagsManager,
    sidebarCollapsed,
    setSidebarCollapsed,
    isContentLoading,
    contentError,
    fetchDocuments,
    fetchDocumentDetails,
    syncData,
    cancelSync,
    saveDocument,
    batchMoveDocuments,
    batchDeleteDocuments,
    switchView,
    switchCategory,
    switchTag,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp 必须在 AppProvider 中使用');
  }
  return context;
}
