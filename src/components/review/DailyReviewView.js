'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sparkles, 
  Flame, 
  Trophy, 
  CheckCircle2, 
  Heart, 
  Share2, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  BookOpen, 
  Calendar, 
  BarChart3, 
  Bookmark, 
  Check, 
  ExternalLink,
  Award,
  Zap,
  RefreshCw,
  Edit3,
  ListOrdered,
  Tag,
  Plus,
  X,
  FileText,
  Save
} from 'lucide-react';

/**
 * 渲染卡片 Markdown 正文与图文
 * 优雅提取并展示 Markdown 图片，自动转义 **加粗** 和 [链接]，并防止超长 URL 撑爆卡片
 */
function renderMarkdownContent(text, fontSize = '17px', textColor = 'var(--color-text-primary)') {
  if (!text) return null;

  // 1. 提取 Markdown 图片 ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [];
  let match;
  while ((match = imageRegex.exec(text)) !== null) {
    images.push({ alt: match[1], url: match[2] });
  }

  // 清理字符串中的 Markdown 图片语法，只保留文本
  let cleanText = text.replace(imageRegex, '').trim();

  // 2. 转换 **加粗**
  cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 3. 转换 [文本](url)
  cleanText = cleanText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent); text-decoration: underline; word-break: break-all;">$1</a>');

  return (
    <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', width: '100%' }}>
      <div 
        dangerouslySetInnerHTML={{ __html: cleanText }} 
        style={{
          fontSize,
          lineHeight: fontSize === '17px' ? '1.8' : '1.6',
          color: textColor,
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
          fontFamily: 'SF Pro Display, -apple-system, sans-serif'
        }}
      />
      {images.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.alt || '高亮插图'}
              style={{
                maxWidth: '100%',
                maxHeight: '360px',
                borderRadius: '12px',
                objectFit: 'contain',
                border: '1px solid var(--color-border-light)',
                backgroundColor: 'var(--color-bg-secondary)',
                display: 'block'
              }}
              onError={(e) => e.target.style.display = 'none'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyReviewView({ onBackToArticles }) {
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'stats'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [highlights, setHighlights] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState(null);
  const [actionHistory, setActionHistory] = useState({}); // { highlightId: 'reviewed' | 'favorite' | 'discard' }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // 高亮与标签编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [editingNote, setEditingNote] = useState('');
  const [editingTags, setEditingTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [allSystemTags, setAllSystemTags] = useState([]);

  // 加载系统现有全量标签 (用于编辑标签自动完成)
  useEffect(() => {
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => {
        if (data.tags && Array.isArray(data.tags)) {
          setAllSystemTags(data.tags.map(t => typeof t === 'string' ? t : t.name).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  // 本文章全部高亮 Drawer 面板状态
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerHighlights, setDrawerHighlights] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Readwise 官方 Complete 打卡完成同步状态
  const [completeSyncing, setCompleteSyncing] = useState(false);
  const [completeSynced, setCompleteSynced] = useState(false);

  const syncReadwiseComplete = useCallback(async () => {
    setCompleteSyncing(true);
    try {
      const res = await fetch('/api/daily-review/complete', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCompleteSynced(true);
      }
    } catch (err) {
      console.warn('同步 Readwise 官方 Complete 打卡失败:', err);
    } finally {
      setCompleteSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (showCelebration) {
      syncReadwiseComplete();
    }
  }, [showCelebration, syncReadwiseComplete]);

  // 加载每日回顾数据
  const fetchDailyReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/daily-review');
      const data = await res.json();
      if (data.success) {
        setHighlights(data.highlights || []);
        setStats(data.stats || null);

        // 如果今日已经做过部分复习，自动从未复习的第一张开始
        const reviewedHls = new Set(data.stats?.todayReviewedHls || []);
        const firstUnreviewedIdx = (data.highlights || []).findIndex(h => !reviewedHls.has(h.id));
        if (firstUnreviewedIdx > -1) {
          setCurrentIndex(firstUnreviewedIdx);
        } else if ((data.highlights || []).length > 0 && reviewedHls.size >= (data.highlights || []).length) {
          setShowCelebration(true);
        }
      } else {
        setError(data.error || '加载每日回顾失败');
      }
    } catch (err) {
      console.error('加载每日回顾失败:', err);
      setError('网络异常，无法加载每日回顾');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyReview();
  }, [fetchDailyReview]);

  // 当前展示的高亮项
  const currentHl = useMemo(() => {
    return highlights[currentIndex] || null;
  }, [highlights, currentIndex]);

  // 打开当前文章的全部高亮 Drawer
  const handleOpenArticleDrawer = async (title) => {
    if (!title) return;
    setDrawerTitle(title);
    setShowDrawer(true);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/daily-review/article-highlights?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      setDrawerHighlights(data.highlights || []);
    } catch (err) {
      console.error('获取文章高亮异常:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // 进入编辑模式
  const handleStartEdit = () => {
    if (!currentHl) return;
    setEditingText(currentHl.text || '');
    setEditingNote(currentHl.note || '');
    setEditingTags(currentHl.tags ? [...currentHl.tags] : []);
    setIsEditing(true);
  };

  // 保存 Markdown 与标签编辑
  const handleSaveEdit = async () => {
    if (!currentHl) return;
    setSaveLoading(true);

    const updatedHl = {
      ...currentHl,
      text: editingText,
      note: editingNote,
      tags: editingTags,
    };

    // 1. 0ms 乐观立即更新前端展示
    setHighlights(prev => prev.map((item, idx) => idx === currentIndex ? updatedHl : item));
    setIsEditing(false);

    // 2. 后台保存
    try {
      await fetch('/api/daily-review/update-highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highlightId: currentHl.id,
          text: editingText,
          note: editingNote,
          tags: editingTags,
        }),
      });
    } catch (err) {
      console.error('保存高亮编辑失败:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  // 添加标签
  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '');
    if (trimmed && !editingTags.includes(trimmed)) {
      setEditingTags(prev => [...prev, trimmed]);
      setNewTagInput('');
    }
  };

  // 移除标签
  const handleRemoveTag = (tagToRemove) => {
    setEditingTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // 快捷直接添加/移除标签 (常态卡片无需进入大编辑模式)
  const [quickTagInput, setQuickTagInput] = useState('');
  const [showQuickTagInput, setShowQuickTagInput] = useState(false);

  const handleQuickAddTag = (tagToAdd) => {
    if (!currentHl || !tagToAdd) return;
    const trimmed = tagToAdd.trim().replace(/^#/, '');
    if (!trimmed) return;

    const currentTags = currentHl.tags || [];
    if (currentTags.includes(trimmed)) return;

    const newTags = [...currentTags, trimmed];

    // 1. 0ms 前端即时显示
    setHighlights(prev => prev.map((item, idx) => idx === currentIndex ? { ...item, tags: newTags } : item));
    setQuickTagInput('');
    setShowQuickTagInput(false);

    // 2. 后台静默保存
    fetch('/api/daily-review/update-highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        highlightId: currentHl.id,
        text: currentHl.text,
        note: currentHl.note,
        tags: newTags,
      }),
    }).catch(err => console.warn('快捷添加标签异常:', err));
  };

  const handleQuickRemoveTag = (tagToRemove) => {
    if (!currentHl || !tagToRemove) return;
    const newTags = (currentHl.tags || []).filter(t => t !== tagToRemove);

    setHighlights(prev => prev.map((item, idx) => idx === currentIndex ? { ...item, tags: newTags } : item));

    fetch('/api/daily-review/update-highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        highlightId: currentHl.id,
        text: currentHl.text,
        note: currentHl.note,
        tags: newTags,
      }),
    }).catch(err => console.warn('快捷删除标签异常:', err));
  };

  // 提交回顾动作 (乐观 UI 0 毫秒秒切，后台异步静默同步，彻底卡顿)
  const handleAction = (actionType) => {
    if (!currentHl) return;

    const targetHlId = currentHl.id;
    setActionHistory(prev => ({ ...prev, [targetHlId]: actionType }));

    // 1. 0 毫秒立即秒切下一张或触发全屏打卡庆祝
    if (currentIndex < highlights.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowCelebration(true);
    }

    // 2. 后台异步发送，不阻塞卡片流畅翻阅
    fetch('/api/daily-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        highlightId: targetHlId,
        action: actionType,
        targetCount: highlights.length,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.statResult) {
          setStats(prev => ({
            ...prev,
            todayReviewedCount: data.statResult.reviewedCount,
            streakDays: data.statResult.streakDays,
          }));
        }
      })
      .catch(err => {
        console.warn('后台同步回顾记录异常 (不卡顿 UI):', err);
      });
  };

  // 键盘快捷键响应 (编辑模式及焦点在输入框时严密禁用)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'review' || showCelebration || !currentHl || isEditing) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleAction('reviewed');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleAction('favorite');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showCelebration, currentHl, isEditing, handleAction]);

  if (loading) {
    return (
      <div className="daily-review-page" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="loading-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }} />
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>正在为您加载 Readwise 每日回顾...</div>
      </div>
    );
  }

  return (
    <div className="daily-review-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: 'var(--color-bg-primary)',
      overflowY: 'auto'
    }}>
      {/* 顶部导航与选项卡 Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justify: 'space-between', 
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '36px', height: '36px', borderRadius: '10px', 
            background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(0, 122, 255, 0.25)'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--color-text-primary)' }}>
              每日回顾 (Daily Review)
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              基于 Readwise 间隔重复算法，重温灵感划线
            </div>
          </div>
        </div>

        {/* 顶部 Sub-Tabs */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'var(--color-bg-tertiary)', 
          padding: '4px', 
          borderRadius: 'var(--radius-lg)',
          marginLeft: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('review')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: 'var(--radius-md)',
              border: 'none', fontSize: '13px', fontWeight: activeTab === 'review' ? '600' : '500',
              backgroundColor: activeTab === 'review' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'review' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'review' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <BookOpen size={15} /> 每日高亮 ({highlights.length})
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: 'var(--radius-md)',
              border: 'none', fontSize: '13px', fontWeight: activeTab === 'stats' ? '600' : '500',
              backgroundColor: activeTab === 'stats' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'stats' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'stats' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <BarChart3 size={15} /> 回顾统计
          </button>
        </div>
      </div>

      {/* 主视图内容区域 */}
      <div style={{ flex: 1, padding: 'var(--space-6)', maxWidth: '900px', width: '100%', margin: '0 auto' }}>
        
        {/* =================== TAB 1: 每日回顾卡片 =================== */}
        {activeTab === 'review' && (
          <>
            {showCelebration ? (
              /* 完成打卡全屏庆祝 Banner */
              <div className="review-celebration-card" style={{
                background: 'linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 100%)',
                color: '#fff',
                borderRadius: '24px',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                animation: 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div style={{ 
                  width: '72px', height: '72px', borderRadius: '50%', 
                  background: 'rgba(255, 149, 0, 0.2)', color: '#ff9500',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', border: '2px solid rgba(255, 149, 0, 0.4)'
                }}>
                  <Flame size={36} />
                </div>
                <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 12px' }}>
                  🎉 今日回顾已全部完成！
                </h2>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', maxWidth: '480px', margin: '0 auto 32px' }}>
                  太棒了！您已成功复习了今日 {highlights.length} 条精选高亮，习惯正在慢慢重塑您的知识记忆。
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '36px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.08)', padding: '16px 28px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>连续打卡 (Streak)</div>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#ff9500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Flame size={24} /> {stats?.streakDays || 1} 天
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.08)', padding: '16px 28px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>累计已复习高亮</div>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#007aff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={24} /> {stats?.totalReviewed || highlights.length} 条
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={syncReadwiseComplete}
                    disabled={completeSyncing}
                    style={{ 
                      padding: '12px 24px', 
                      borderRadius: '12px', 
                      fontSize: '14px', 
                      fontWeight: '600',
                      backgroundColor: completeSynced ? '#34c759' : '#007aff',
                      boxShadow: '0 4px 14px rgba(0,122,255,0.3)'
                    }}
                  >
                    <CheckCircle2 size={16} /> {completeSyncing ? '同步官方中...' : completeSynced ? '✨ 已同步 Readwise 官方打卡完成' : '同步至 Readwise 官方'}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('stats')}
                    style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
                  >
                    <BarChart3 size={16} /> 查看回顾统计
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowCelebration(false);
                      setCurrentIndex(0);
                    }}
                    style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
                  >
                    <RotateCcw size={16} /> 再次重温卡片
                  </button>
                </div>
              </div>
            ) : highlights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
                <CheckCircle2 size={48} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--color-success)' }} />
                <h3>暂无待复习高亮</h3>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>您可以先在 ReaderQ 中阅读文章并划词高亮，系统将自动生成每日回顾。</p>
              </div>
            ) : (
              /* 单张卡片 Flashcard 视图 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 顶部进度条 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                    卡片 {currentIndex + 1} / {highlights.length}
                  </div>
                  <div style={{ width: '180px', height: '6px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${((currentIndex + 1) / highlights.length) * 100}%`,
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* 主复习 Flashcard 卡片 */}
                {currentHl && (
                  <div className="daily-review-card" style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderRadius: '20px',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                    padding: '36px',
                    position: 'relative',
                    borderLeft: `6px solid var(--highlight-${currentHl.color || 'yellow'})`,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    overflow: 'hidden',
                    transition: 'all 0.25s ease'
                  }}>
                    {/* 卡片所属来源文章元数据 Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {currentHl.image_url && (
                          <img 
                            src={currentHl.image_url} 
                            alt="" 
                            style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} 
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                            {currentHl.title}
                          </div>
                          {currentHl.author && (
                            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                              作者: {currentHl.author}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenArticleDrawer(currentHl.title)}
                          title="查看属于本文章的所有划线高亮"
                          style={{ borderRadius: '8px', fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <ListOrdered size={14} /> 本文全部高亮 <ChevronRight size={14} />
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleStartEdit}
                          title="编辑高亮 Markdown 正文与标签"
                          style={{ borderRadius: '8px', fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit3 size={14} /> {isEditing ? '编辑中' : '编辑'}
                        </button>

                        {currentHl.source_url && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => window.open(currentHl.source_url, '_blank')}
                            title="查看原网页"
                            style={{ padding: '4px' }}
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 编辑模式与常规展示模式 */}
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px', backgroundColor: 'var(--color-bg-secondary)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Edit3 size={14} /> 编辑高亮 Markdown 文本 (支持上下拖拽调节高度)
                          </label>
                          <textarea
                            className="form-input"
                            rows={8}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            style={{ 
                              width: '100%', 
                              minHeight: '180px',
                              resize: 'vertical',
                              fontFamily: 'var(--font-mono)', 
                              fontSize: '13.5px', 
                              lineHeight: '1.7', 
                              borderRadius: '12px',
                              padding: '14px'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💡 编辑个人笔记 Note (支持上下拖拽调节高度)
                          </label>
                          <textarea
                            className="form-input"
                            rows={3}
                            placeholder="写下关于此高亮的心得或笔记..."
                            value={editingNote}
                            onChange={(e) => setEditingNote(e.target.value)}
                            style={{ 
                              width: '100%', 
                              minHeight: '80px',
                              resize: 'vertical',
                              fontSize: '13px', 
                              lineHeight: '1.6', 
                              borderRadius: '12px',
                              padding: '12px'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Tag size={14} /> 管理与添加标签 (自动匹配完成)
                          </label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            {editingTags.map(tag => (
                              <span key={tag} style={{
                                fontSize: '12px',
                                color: 'var(--color-accent)',
                                backgroundColor: 'rgba(0, 122, 255, 0.12)',
                                padding: '5px 12px',
                                borderRadius: '16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '600'
                              }}>
                                #{tag}
                                <button onClick={() => handleRemoveTag(tag)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                                  <X size={13} />
                                </button>
                              </span>
                            ))}
                          </div>

                          <div style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="输入新标签后回车或从建议中选择..."
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                style={{ flex: 1, fontSize: '13px', borderRadius: '10px', padding: '8px 12px' }}
                              />
                              <button className="btn btn-secondary btn-sm" onClick={handleAddTag} style={{ borderRadius: '10px', padding: '0 16px' }}>
                                <Plus size={14} /> 添加
                              </button>
                            </div>

                            {/* 标签自动完成匹配下拉列表 */}
                            {newTagInput.trim() && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '4px',
                                backgroundColor: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                boxShadow: 'var(--shadow-md)',
                                zIndex: 100,
                                maxHeight: '160px',
                                overflowY: 'auto',
                                padding: '6px'
                              }}>
                                {allSystemTags
                                  .filter(t => t.toLowerCase().includes(newTagInput.trim().toLowerCase()) && !editingTags.includes(t))
                                  .slice(0, 8)
                                  .map(suggestedTag => (
                                    <div
                                      key={suggestedTag}
                                      onClick={() => {
                                        setEditingTags(prev => [...prev, suggestedTag]);
                                        setNewTagInput('');
                                      }}
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        color: 'var(--color-text-primary)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Tag size={12} style={{ color: 'var(--color-accent)' }} /> #{suggestedTag} (点击选中)
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button className="btn btn-secondary" onClick={() => setIsEditing(false)} style={{ borderRadius: '10px', padding: '8px 18px', fontSize: '13px' }}>
                            取消
                          </button>
                          <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saveLoading} style={{ borderRadius: '10px', padding: '8px 22px', fontSize: '13px', fontWeight: '600' }}>
                            <Save size={15} /> {saveLoading ? '保存中...' : '保存修改'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 高亮引用正文 Highlight Text (Markdown 渲染 + 防溢出) */}
                        <div style={{ margin: '0 0 24px', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '100%' }}>
                          {renderMarkdownContent(currentHl.text)}
                        </div>

                        {/* 个人笔记展示 Note (支持 Markdown 格式) */}
                        {currentHl.note && (
                          <div style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            padding: '14px 18px',
                            borderRadius: '14px',
                            fontSize: '13.5px',
                            color: 'var(--color-text-primary)',
                            marginBottom: '22px',
                            borderLeft: '4px solid var(--color-accent)',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-accent)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              💡 我的笔记 Note
                            </div>
                            {renderMarkdownContent(currentHl.note, '13.5px', 'var(--color-text-secondary)')}
                          </div>
                        )}

                        {/* 标签列表与快捷直接添加标签控制组 (无需进入大编辑模式) */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
                          {(currentHl.tags || []).map(tag => (
                            <span 
                              key={tag} 
                              style={{
                                fontSize: '12px',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-bg-tertiary)',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '500',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              #{tag}
                              <button 
                                onClick={() => handleQuickRemoveTag(tag)} 
                                title="移除此标签"
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0, display: 'flex', alignItems: 'center' }}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}

                          {/* 快捷直接添加标签按键 */}
                          {showQuickTagInput ? (
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="输入标签名..."
                                autoFocus
                                value={quickTagInput}
                                onChange={(e) => setQuickTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleQuickAddTag(quickTagInput);
                                  } else if (e.key === 'Escape') {
                                    setShowQuickTagInput(false);
                                  }
                                }}
                                style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '8px', width: '130px', height: '28px' }}
                              />
                              <button 
                                className="btn btn-primary btn-sm" 
                                onClick={() => handleQuickAddTag(quickTagInput)}
                                style={{ height: '28px', padding: '0 10px', fontSize: '11px', borderRadius: '6px' }}
                              >
                                确定
                              </button>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                onClick={() => setShowQuickTagInput(false)}
                                style={{ height: '28px', padding: '0 6px', fontSize: '11px' }}
                              >
                                ✕
                              </button>

                              {/* 快捷标签自动补全弹出浮层 */}
                              {quickTagInput.trim() && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  marginTop: '4px',
                                  backgroundColor: 'var(--color-bg-card)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '10px',
                                  boxShadow: 'var(--shadow-md)',
                                  zIndex: 100,
                                  maxHeight: '140px',
                                  width: '180px',
                                  overflowY: 'auto',
                                  padding: '4px'
                                }}>
                                  {allSystemTags
                                    .filter(t => t.toLowerCase().includes(quickTagInput.trim().toLowerCase()) && !(currentHl.tags || []).includes(t))
                                    .slice(0, 6)
                                    .map(suggestedTag => (
                                      <div
                                        key={suggestedTag}
                                        onClick={() => handleQuickAddTag(suggestedTag)}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          color: 'var(--color-text-primary)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      >
                                        <Tag size={11} style={{ color: 'var(--color-accent)' }} /> #{suggestedTag}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowQuickTagInput(true)}
                              style={{
                                fontSize: '12px',
                                color: 'var(--color-accent)',
                                backgroundColor: 'rgba(0, 122, 255, 0.08)',
                                border: '1px solid rgba(0, 122, 255, 0.2)',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '600',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Plus size={13} /> 添加标签
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* 底部操作控制条 (统一居中、等间距 16px) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      paddingTop: '24px',
                      marginTop: '8px',
                      borderTop: '1px solid var(--color-border-light)'
                    }}>
                      <button
                        className="btn btn-secondary"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        style={{ 
                          height: '42px', 
                          padding: '0 20px', 
                          borderRadius: '12px', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px' 
                        }}
                      >
                        <ChevronLeft size={16} /> 上一条
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAction('favorite')}
                        style={{
                          height: '42px',
                          padding: '0 20px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: actionHistory[currentHl.id] === 'favorite' ? '#ef4444' : 'inherit'
                        }}
                      >
                        <Heart size={16} fill={actionHistory[currentHl.id] === 'favorite' ? '#ef4444' : 'none'} /> 收藏 (F)
                      </button>

                      <button
                        className="btn btn-primary"
                        onClick={() => handleAction('reviewed')}
                        style={{
                          height: '42px',
                          padding: '0 24px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(0, 122, 255, 0.3)'
                        }}
                      >
                        已复习 / 下一条 (Space) <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* =================== TAB 2: 回顾统计 =================== */}
        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 顶栏三大数据卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              
              {/* 连续打卡 */}
              <div style={{
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flame size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>当前连续打卡</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                    {stats?.streakDays || 0} <span style={{ fontSize: '13px', fontWeight: '400' }}>天</span>
                  </div>
                </div>
              </div>

              {/* 最长纪录 */}
              <div style={{
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>最长连续纪录</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                    {stats?.bestStreak || 0} <span style={{ fontSize: '13px', fontWeight: '400' }}>天</span>
                  </div>
                </div>
              </div>

              {/* 累计复习高亮 */}
              <div style={{
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>累计复习高亮</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                    {stats?.totalReviewed || 0} <span style={{ fontSize: '13px', fontWeight: '400' }}>条</span>
                  </div>
                </div>
              </div>

            </div>

            {/* 近 30 天复习打卡热力网格 */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--color-border)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} /> 近 30 天复习热力打卡
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                  目标: 每天 {stats?.targetCount || highlights.length || 5} 条 (自动对齐 Readwise)
                </div>
              </div>

              {/* 30 天 Grid 网格 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px' }}>
                {Array.from({ length: 30 }).map((_, idx) => {
                  const d = new Date(Date.now() - (29 - idx) * 86400000).toISOString().split('T')[0];
                  const statItem = (stats?.statsList || []).find(s => s.review_date === d);
                  const count = statItem?.reviewed_count || 0;
                  const isDone = count >= 5;

                  return (
                    <div 
                      key={d}
                      title={`${d}: 已复习 ${count}/${stats?.targetCount || 15} 条`}
                      style={{
                        height: '46px',
                        borderRadius: '10px',
                        backgroundColor: isDone ? '#34c759' : count > 0 ? 'rgba(52, 199, 89, 0.35)' : 'var(--color-bg-tertiary)',
                        color: isDone || count > 0 ? '#fff' : 'var(--color-text-tertiary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        lineHeight: '1.2',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ textAlign: 'center', width: '100%' }}>{d.slice(8)}日</div>
                      {count > 0 && <div style={{ fontSize: '9px', opacity: 0.9, textAlign: 'center', marginTop: '2px' }}>{count}条</div>}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 本文章全部高亮右侧抽屉 Drawer */}
      {showDrawer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => setShowDrawer(false)}>
          <div style={{
            width: '460px',
            maxWidth: '90vw',
            height: '100%',
            backgroundColor: 'var(--color-bg-card)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Drawer 头部 Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-bg-secondary)'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📚 本文所有划线高亮 ({drawerHighlights.length})
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '4px 0 0', color: 'var(--color-text-primary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {drawerTitle}
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDrawer(false)} style={{ padding: '6px', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer 滚动列表 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {drawerLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>
                  加载文章高亮中...
                </div>
              ) : drawerHighlights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>
                  本文暂无其他高亮记录
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {drawerHighlights.map((hl, idx) => (
                    <div key={hl.id || idx} style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border-light)',
                      borderLeft: `4px solid var(--highlight-${hl.color || 'yellow'})`,
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px', fontWeight: '600' }}>
                        高亮 #{idx + 1} · {hl.created_at ? new Date(hl.created_at).toLocaleDateString() : ''}
                      </div>

                      <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                        {renderMarkdownContent(hl.text)}
                      </div>

                      {hl.note && (
                        <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)', padding: '10px 14px', borderRadius: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-accent)', marginBottom: '4px' }}>💡 笔记 Note</div>
                          {renderMarkdownContent(hl.note, '12.5px', 'var(--color-text-secondary)')}
                        </div>
                      )}

                      {hl.tags && hl.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                          {hl.tags.map(tag => (
                            <span key={tag} style={{ fontSize: '10px', color: 'var(--color-accent)', backgroundColor: 'rgba(0, 122, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
