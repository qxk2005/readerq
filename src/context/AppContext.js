'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [currentView, setCurrentView] = useState('new'); // location filter
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentTag, setCurrentTag] = useState(null);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState({ total: 0, byLocation: {}, byCategory: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 获取文档
  const fetchDocuments = useCallback(async (options = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const location = options.location || currentView;
      if (location && location !== 'all') params.set('location', location);
      if (options.category || currentCategory) params.set('category', options.category || currentCategory);
      if (options.tag || currentTag) params.set('tag', options.tag || currentTag);
      if (options.search || searchQuery) params.set('search', options.search || searchQuery);
      if (options.sync) params.set('sync', 'true');

      const res = await fetch(`/api/readwise/documents?${params.toString()}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setDocuments(data.documents || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('获取文档失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentView, currentCategory, currentTag, searchQuery]);

  // 同步数据
  const syncData = useCallback(async (full = false) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/readwise/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 同步后刷新文档
      await fetchDocuments();

      // 刷新标签
      const tagsRes = await fetch('/api/readwise/tags');
      const tagsData = await tagsRes.json();
      if (tagsData.tags) setTags(tagsData.tags);

      return data;
    } catch (err) {
      setSyncError(err.message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDocuments]);

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

  // 视图变化时重新获取
  useEffect(() => {
    fetchDocuments();
  }, [currentView, currentCategory, currentTag, fetchDocuments]);

  const value = {
    documents,
    selectedDoc,
    setSelectedDoc,
    currentView,
    currentCategory,
    currentTag,
    tags,
    stats,
    searchQuery,
    setSearchQuery,
    isLoading,
    isSyncing,
    syncError,
    showAiPanel,
    setShowAiPanel,
    showCommandPalette,
    setShowCommandPalette,
    showSettings,
    setShowSettings,
    showAddUrl,
    setShowAddUrl,
    sidebarCollapsed,
    setSidebarCollapsed,
    fetchDocuments,
    syncData,
    saveDocument,
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
