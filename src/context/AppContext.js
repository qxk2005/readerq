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
  const [syncError, setSyncError] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
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
    isContentLoading,
    contentError,
    fetchDocuments,
    fetchDocumentDetails,
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
