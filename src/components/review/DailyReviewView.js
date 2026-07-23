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
  RefreshCw
} from 'lucide-react';

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

  // 提交回顾动作
  const handleAction = async (actionType) => {
    if (!currentHl || isSubmitting) return;
    setIsSubmitting(true);

    const targetHlId = currentHl.id;
    setActionHistory(prev => ({ ...prev, [targetHlId]: actionType }));

    try {
      const res = await fetch('/api/daily-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highlightId: targetHlId,
          action: actionType,
          targetCount: highlights.length,
        }),
      });

      const data = await res.json();
      if (data.success && data.statResult) {
        setStats(prev => ({
          ...prev,
          todayReviewedCount: data.statResult.reviewedCount,
          streakDays: data.statResult.streakDays,
        }));
      }
    } catch (err) {
      console.error('提交动作失败:', err);
    } finally {
      setIsSubmitting(false);
      // 下一张
      if (currentIndex < highlights.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShowCelebration(true);
      }
    }
  };

  // 键盘快捷键响应
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'review' || showCelebration || !currentHl) return;
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
  }, [activeTab, showCelebration, currentHl, handleAction]);

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
          padding: '3px', 
          borderRadius: 'var(--radius-md)' 
        }}>
          <button
            onClick={() => setActiveTab('review')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', fontSize: '13px', fontWeight: activeTab === 'review' ? '600' : '400',
              backgroundColor: activeTab === 'review' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'review' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'review' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <BookOpen size={14} /> 每日高亮 ({highlights.length})
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', fontSize: '13px', fontWeight: activeTab === 'stats' ? '600' : '400',
              backgroundColor: activeTab === 'stats' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'stats' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: activeTab === 'stats' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <BarChart3 size={14} /> 回顾统计
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

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab('stats')}
                    style={{ padding: '12px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: '600' }}
                  >
                    <BarChart3 size={16} /> 查看回顾统计
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowCelebration(false);
                      setCurrentIndex(0);
                    }}
                    style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '14px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
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

                      {currentHl.source_url && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => window.open(currentHl.source_url, '_blank')}
                          title="查看原网页"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>

                    {/* 高亮引用正文 Highlight Text */}
                    <blockquote style={{
                      fontSize: '18px',
                      lineHeight: '1.7',
                      fontWeight: '500',
                      color: 'var(--color-text-primary)',
                      margin: '0 0 24px',
                      padding: 0,
                      fontFamily: 'SF Pro Display, -apple-system, sans-serif'
                    }}>
                      “{currentHl.text}”
                    </blockquote>

                    {/* 个人笔记展示 Note */}
                    {currentHl.note && (
                      <div style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '20px',
                        borderLeft: '3px solid var(--color-accent)'
                      }}>
                        💡 <strong>我的笔记：</strong> {currentHl.note}
                      </div>
                    )}

                    {/* 标签列表 */}
                    {currentHl.tags && currentHl.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        {currentHl.tags.map(tag => (
                          <span key={tag} style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            backgroundColor: 'var(--color-bg-tertiary)',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 底部操作控制条 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      paddingTop: '20px',
                      borderTop: '1px solid var(--color-border-light)'
                    }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={currentIndex === 0}
                          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                          style={{ borderRadius: '10px' }}
                        >
                          <ChevronLeft size={16} /> 上一条
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAction('favorite')}
                          style={{
                            borderRadius: '10px',
                            color: actionHistory[currentHl.id] === 'favorite' ? '#ef4444' : 'inherit'
                          }}
                        >
                          <Heart size={16} fill={actionHistory[currentHl.id] === 'favorite' ? '#ef4444' : 'none'} /> 收藏 (F)
                        </button>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAction('reviewed')}
                          style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: '600' }}
                        >
                          已复习 / 下一条 (Space) <ChevronRight size={16} />
                        </button>
                      </div>
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
                      title={`${d}: 已复习 ${count}/5 条`}
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        backgroundColor: isDone ? '#34c759' : count > 0 ? 'rgba(52, 199, 89, 0.35)' : 'var(--color-bg-tertiary)',
                        color: isDone || count > 0 ? '#fff' : 'var(--color-text-tertiary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justify: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        transition: 'transform 0.15s',
                        cursor: 'pointer'
                      }}
                    >
                      <div>{d.slice(8)}日</div>
                      {count > 0 && <div style={{ fontSize: '9px', opacity: 0.9 }}>{count}条</div>}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
