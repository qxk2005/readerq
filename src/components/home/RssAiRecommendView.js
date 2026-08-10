'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Sparkles, Search, RefreshCw, AlertCircle, Clock, Rss } from 'lucide-react';
import ArticleCoverPlaceholder from '@/components/common/ArticleCoverPlaceholder';

const PRESET_TOPICS = [
  '🤖 AI与大模型',
  '💻 软件工程',
  '🎨 产品设计',
  '📈 商业趋势',
  '⚡ 效率工具',
  '📖 深度思考'
];

export default function RssAiRecommendView() {
  const { setSelectedDoc } = useApp();

  const [currentTopic, setCurrentTopic] = useState('');
  const [inputTopic, setInputTopic] = useState('');
  const [excludeHistory, setExcludeHistory] = useState(true);
  const [historyIds, setHistoryIds] = useState([]);
  
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [failedImages, setFailedImages] = useState(new Set());

  const handleGenerateRecommendations = useCallback(async (topicToUse) => {
    const targetTopic = (topicToUse || inputTopic || currentTopic || PRESET_TOPICS[0]).trim();
    if (!targetTopic) return;

    setIsLoading(true);
    setError(null);
    setCurrentTopic(targetTopic);

    try {
      const res = await fetch('/api/ai/topic-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetTopic,
          exclude_history: excludeHistory,
          history_ids: historyIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI 智能推荐失败，请重试');
      }

      setRecommendations(data.recommendations || []);
      
      // 更新历史推荐记录
      const newIds = (data.recommendations || []).map(r => r.doc?.id).filter(Boolean);
      if (newIds.length > 0) {
        setHistoryIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
    } catch (err) {
      console.error('获取 AI 主题推荐失败:', err);
      setError(err.message || '网络连接或 AI 接口异常');
    } finally {
      setIsLoading(false);
    }
  }, [inputTopic, currentTopic, excludeHistory, historyIds]);

  const handleImageError = useCallback((id) => {
    setFailedImages(prev => new Set(prev).add(id));
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: 'var(--color-bg-primary)',
      padding: '24px 32px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* 顶部控制面板 */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em'
              }}>
                AI 智能主题推荐探索
              </h2>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '12px',
                color: 'var(--color-text-tertiary)'
              }}>
                基于数千篇未读 RSS 文章 RAG 检索 · 5~10 篇热点精选与 AI 推荐理由
              </p>
            </div>
          </div>

          {currentTopic && (
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--color-accent)'
            }}>
              当前主题：{currentTopic}
            </div>
          )}
        </div>

        {/* Preset Topic Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {PRESET_TOPICS.map(topic => {
            const isSelected = currentTopic === topic;
            return (
              <button
                key={topic}
                onClick={() => {
                  setInputTopic(topic);
                  handleGenerateRecommendations(topic);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-bg-primary)',
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {topic}
              </button>
            );
          })}
        </div>

        {/* Search Input Bar & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '0 14px',
            height: '42px'
          }}>
            <Search size={18} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              value={inputTopic}
              onChange={(e) => setInputTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerateRecommendations();
              }}
              placeholder="输入主题关键字（如：独立开发、开源工具、大模型架构...）"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          <button
            onClick={() => handleGenerateRecommendations()}
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              height: '42px',
              padding: '0 20px',
              borderRadius: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isLoading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
            AI 生成推荐
          </button>
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              checked={excludeHistory}
              onChange={(e) => setExcludeHistory(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
            />
            优先排除历史已推荐文章
          </label>

          {recommendations.length > 0 && !isLoading && (
            <button
              onClick={() => handleGenerateRecommendations()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--color-accent)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> 🔄 换一批
            </button>
          )}
        </div>
      </div>

      {/* 推荐内容展现区域 */}
      {isLoading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: 'var(--color-accent)'
        }}>
          <div className="loading-spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
          <div style={{ fontSize: '14px', fontWeight: '600' }}>
            ✨ AI 正在为您从数千篇未读 RSS 文章中粗筛与深度解析《{currentTopic || '主题'}》...
          </div>
        </div>
      ) : error ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            padding: '24px 32px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            color: '#ef4444'
          }}>
            <AlertCircle size={32} />
            <div style={{ fontSize: '14px', fontWeight: '600' }}>⚠️ {error}</div>
            <button
              onClick={() => handleGenerateRecommendations()}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '8px' }}
            >
              重新生成推荐
            </button>
          </div>
        </div>
      ) : recommendations.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          paddingBottom: '32px'
        }}>
          {recommendations.map(({ doc, reason }) => {
            const hasValidImage = doc.image_url && !failedImages.has(doc.id);
            const sourceName = doc.site_name || doc.category || 'RSS';
            
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* 封面图片 / 渐变 Banner */}
                {hasValidImage ? (
                  <img
                    src={doc.image_url}
                    alt={doc.title}
                    onError={() => handleImageError(doc.id)}
                    style={{
                      width: '100%',
                      height: '140px',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <ArticleCoverPlaceholder doc={doc} height={110} />
                )}

                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'var(--color-text-primary)',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {doc.title || '无标题文档'}
                  </h3>

                  {/* 高亮 💡 AI 推荐理由 */}
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    borderLeft: '3px solid var(--color-accent)',
                    padding: '8px 10px',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '12px',
                    color: 'var(--color-accent)',
                    fontStyle: 'italic',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    💡 {reason}
                  </div>

                  <div style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Rss size={12} /> {sourceName}
                    </span>
                    {doc.reading_time && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {doc.reading_time} 分钟阅读
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 初始引导卡片 */
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '20px',
            padding: '36px 48px',
            maxWidth: '520px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-accent)'
            }}>
              <Sparkles size={28} />
            </div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
              探索 RSS 未读文章灵感推荐
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              点击上方常见 Preset 主题胶囊（如 🤖 AI与大模型、💻 软件工程）或输入任意主题关键字，AI 将为您检索未读 RSS 并精准推荐 5-10 篇热点精选！
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
