'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Sparkles, Clock, BookOpen, User, Tag, Highlighter, Calendar, ArrowRight, RefreshCw, FileText, Video, Rss, Mail, Bookmark, Layers } from 'lucide-react';

/**
 * 艺术感备用封面生成组件（当文章没有封面图或加载失败时使用）
 */
function FallbackCover({ title, category, siteName }) {
  const gradient = useMemo(() => {
    const gradients = [
      'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      'linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%)',
      'linear-gradient(135deg, #2b1055 0%, #7597de 100%)',
      'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',
      'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
      'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
    ];
    let hash = 0;
    const str = title || 'ReaderQ';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }, [title]);

  const CategoryIcon = useMemo(() => {
    switch (category) {
      case 'video': return Video;
      case 'rss': return Rss;
      case 'email': return Mail;
      case 'pdf': return FileText;
      default: return BookOpen;
    }
  }, [category]);

  return (
    <div style={{
      width: '100%',
      height: '160px',
      background: gradient,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '16px',
      boxSizing: 'border-box',
      borderTopLeftRadius: 'var(--radius-lg)',
      borderTopRightRadius: 'var(--radius-lg)',
    }}>
      {/* 几何阴影背景图案 */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-10%',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.05)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.03)',
        pointerEvents: 'none',
      }} />

      {/* 顶部 Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '0.02em'
        }}>
          <CategoryIcon size={12} />
          {category?.toUpperCase() || 'ARTICLE'}
        </span>
        {siteName && (
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: '500' }}>
            {siteName}
          </span>
        )}
      </div>

      {/* 底部文字印记 */}
      <div style={{
        fontSize: '13px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: '1.4',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        zIndex: 1,
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {title}
      </div>
    </div>
  );
}

export default function HomeFeedView() {
  const { setSelectedDoc } = useApp();
  const [activeTab, setActiveTabState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('readerq_home_feed_active_tab') || 'latest';
    }
    return 'latest';
  });

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('readerq_home_feed_active_tab', tab);
    }
  }, []);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [failedImages, setFailedImages] = useState(new Set());
  const [loadedCovers, setLoadedCovers] = useState(new Set());
  const containerRef = useRef(null);

  // 首页瀑布流显示开关设置
  const [settings, setSettings] = useState({
    showCover: true,
    showAuthor: true,
    showDate: true,
    showReadingTime: true,
    showSummary: true,
    showTags: true,
    showHighlightCount: true,
    summaryMaxLines: 3,
    gridColumnCount: 0,
  });
  const [filterTags, setFilterTags] = useState(['readerq']);

  // 加载用户瀑布流设置
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.home_feed_settings) {
          try { setSettings(JSON.parse(data.home_feed_settings)); } catch (e) {}
        }
        if (data.home_feed_filter_tags) {
          try { setFilterTags(JSON.parse(data.home_feed_filter_tags)); } catch (e) {}
        } else if (data.home_feed_filter_tag) {
          setFilterTags([data.home_feed_filter_tag]);
        }
      })
      .catch(() => {});
  }, []);

  // 加载特定页面的文档列表数据
  const fetchDocuments = useCallback(async (pageNum, isReset = false) => {
    if (isReset) {
      setIsLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      const limit = 24;
      let url = `/api/readwise/documents?page=${pageNum}&limit=${limit}`;
      if (activeTab === 'tag' && filterTags.length > 0) {
        url += `&tags=${encodeURIComponent(filterTags.join(','))}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.documents) {
        if (isReset) {
          setDocuments(data.documents);
        } else {
          setDocuments(prev => {
            const existingIds = new Set(prev.map(d => d.id));
            const newDocs = data.documents.filter(d => !existingIds.has(d.id));
            return [...prev, ...newDocs];
          });
        }
        setHasMore(data.documents.length >= limit);
      }
    } catch (err) {
      console.error('加载瀑布流文档列表失败:', err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [activeTab, filterTags]);

  // 重置分页并加载第一页
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchDocuments(1, true);
  }, [activeTab, filterTags, fetchDocuments]);

  // 页码变化时加载下一页
  useEffect(() => {
    if (page > 1) {
      fetchDocuments(page, false);
    }
  }, [page, fetchDocuments]);

  // 监听无限滚动触底
  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollHeight - (scrollTop + clientHeight) < 350) {
      if (hasMore && !isFetchingMore && !isLoading) {
        setPage(prev => prev + 1);
      }
    }
  };

  // 预检 URL 是否为明显的图标、favicon 或极小尺寸缩略图
  const isUrlTooSmall = useCallback((url) => {
    if (!url) return true;
    const lower = url.toLowerCase();
    if (lower.includes('favicon') || lower.includes('apple-touch-icon')) return true;
    if (lower.includes('16x16') || lower.includes('32x32') || lower.includes('48x48') || lower.includes('64x64') || lower.includes('100x100') || lower.includes('128x128')) return true;
    return false;
  }, []);

  const handleImageError = useCallback((docId) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.add(docId);
      return next;
    });
  }, []);

  // 校验图片加载后的真实宽高尺寸
  const handleImageLoad = useCallback((docId, e) => {
    const img = e.target;
    if (img) {
      const { naturalWidth, naturalHeight } = img;
      // 判定条件：宽度 < 300px 或 高度 < 150px 或 像素乘积 < 48000（过小图片放置于瀑布流卡片封面不好看，替换为内置精美图）
      const isTooSmall = (naturalWidth > 0 && naturalWidth < 300) ||
                         (naturalHeight > 0 && naturalHeight < 150) ||
                         (naturalWidth * naturalHeight < 48000);
      if (isTooSmall) {
        setFailedImages(prev => {
          const next = new Set(prev);
          next.add(docId);
          return next;
        });
      } else {
        setLoadedCovers(prev => {
          const next = new Set(prev);
          next.add(docId);
          return next;
        });
      }
    }
  }, []);

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 30) return `${diffDays} 天前`;
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // 计算估算阅读时长
  const formatReadingTime = (doc) => {
    if (doc.reading_time) return doc.reading_time;
    if (doc.word_count) {
      const mins = Math.max(1, Math.ceil(doc.word_count / 300));
      return `${mins} 分钟`;
    }
    return '3 分钟';
  };

  // 计算摘要 Clamp 样式
  const summaryClampStyle = useMemo(() => {
    const maxLines = settings.summaryMaxLines !== undefined ? settings.summaryMaxLines : 3;
    if (maxLines === 0) return {};
    return {
      display: '-webkit-box',
      WebkitLineClamp: maxLines,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    };
  }, [settings.summaryMaxLines]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="home-feed-container"
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--color-bg-primary)',
        padding: 'var(--space-6) var(--space-8)',
        boxSizing: 'border-box'
      }}
    >
      {/* 顶部 Header & 双 Tab 控件 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        borderBottom: '1px solid var(--color-border-light)',
        paddingBottom: 'var(--space-4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'var(--color-accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-accent)'
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.4rem', fontWeight: '700',
              color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: 0
            }}>
              首页灵感瀑布流
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              探索最新加入的正文卡片与精选标签流
            </div>
          </div>
        </div>

        {/* 2 种瀑布流内容切换 Tab */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--color-bg-secondary)',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)'
        }}>
          <button
            onClick={() => setActiveTab('latest')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: activeTab === 'latest' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'latest' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === 'latest' ? '600' : '400',
              cursor: 'pointer',
              boxShadow: activeTab === 'latest' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} />
            最新加入
          </button>

          <button
            onClick={() => setActiveTab('tag')}
            title={filterTags.length > 0 ? `当前筛选标签 (${filterTags.length}个):\n${filterTags.join(', ')}` : '精选标签'}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: activeTab === 'tag' ? 'var(--color-bg-card)' : 'transparent',
              color: activeTab === 'tag' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === 'tag' ? '600' : '400',
              cursor: 'pointer',
              boxShadow: activeTab === 'tag' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '220px',
              overflow: 'hidden'
            }}
          >
            <Tag size={14} style={{ flexShrink: 0 }} />
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block',
              maxWidth: '170px'
            }}>
              {filterTags.length > 0 ? `标签: ${filterTags.join(', ')}` : '精选标签'}
            </span>
          </button>
        </div>
      </div>

      {/* 瀑布流 Loading 状态 */}
      {isLoading ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '300px', color: 'var(--color-text-tertiary)'
        }}>
          <div className="loading-spinner" style={{ width: '28px', height: '28px', marginBottom: '12px' }} />
          <span>正在搜寻最新文章...</span>
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '300px', color: 'var(--color-text-tertiary)', textAlign: 'center'
        }}>
          <Layers size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            {activeTab === 'tag' ? `暂无包含当前设定标签的文章` : '暂无文章数据'}
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '360px' }}>
            {activeTab === 'tag' ? '可以在设置页面中更新 Tab 2 的筛选标签规则。' : '可以在右上角点击加号添加或同步 Readwise 文章。'}
          </p>
        </div>
      ) : (
        /* Masonry 瀑布流容器 */
        <>
          <div className="home-masonry-grid">
            <style dangerouslySetInnerHTML={{ __html: `
              .home-masonry-grid {
                column-count: ${settings.gridColumnCount > 0 ? settings.gridColumnCount : 4};
                column-gap: 24px;
                width: 100%;
              }
              ${settings.gridColumnCount > 0 ? `
                @media (max-width: 1400px) {
                  .home-masonry-grid { column-count: ${Math.min(settings.gridColumnCount, 3)}; }
                }
                @media (max-width: 1000px) {
                  .home-masonry-grid { column-count: 2; }
                }
                @media (max-width: 650px) {
                  .home-masonry-grid { column-count: 1; }
                }
              ` : `
                @media (min-width: 2200px) {
                  .home-masonry-grid { column-count: 6; }
                }
                @media (min-width: 1750px) and (max-width: 2199px) {
                  .home-masonry-grid { column-count: 5; }
                }
                @media (min-width: 1350px) and (max-width: 1749px) {
                  .home-masonry-grid { column-count: 4; }
                }
                @media (min-width: 950px) and (max-width: 1349px) {
                  .home-masonry-grid { column-count: 3; }
                }
                @media (min-width: 650px) and (max-width: 949px) {
                  .home-masonry-grid { column-count: 2; }
                }
                @media (max-width: 649px) {
                  .home-masonry-grid { column-count: 1; }
                }
              `}
              .masonry-card {
                break-inside: avoid;
                margin-bottom: 24px;
                background: var(--color-bg-card);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-lg);
                overflow: hidden;
                cursor: pointer;
                transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.22s ease;
              }
              .masonry-card:hover {
                transform: translateY(-4px);
                box-shadow: var(--shadow-lg);
                border-color: var(--color-accent);
              }
            ` }} />

            {documents.map(doc => {
              const hasCover = settings.showCover !== false && doc.image_url && !failedImages.has(doc.id) && !isUrlTooSmall(doc.image_url);
              const tagsList = doc.tags ? Object.keys(doc.tags) : [];

              return (
                <div
                  key={doc.id}
                  className="masonry-card"
                  onClick={() => {
                    setSelectedDoc(doc);
                  }}
                >
                  {/* 封面图片 / 备用艺术图案 */}
                  {settings.showCover !== false && (
                    hasCover ? (
                      <div style={{
                        width: '100%',
                        height: '180px',
                        overflow: 'hidden',
                        position: 'relative',
                        background: 'var(--color-bg-secondary)',
                        borderTopLeftRadius: 'var(--radius-lg)',
                        borderTopRightRadius: 'var(--radius-lg)'
                      }}>
                        {/* 加载完成前以艺术封面垫底作平滑过渡 */}
                        {!loadedCovers.has(doc.id) && (
                          <FallbackCover
                            title={doc.title}
                            category={doc.category}
                            siteName={doc.site_name || doc.source}
                          />
                        )}
                        <img
                          src={doc.image_url}
                          alt={doc.title}
                          onError={() => handleImageError(doc.id)}
                          onLoad={(e) => handleImageLoad(doc.id, e)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            opacity: loadedCovers.has(doc.id) ? 1 : 0,
                            transition: 'opacity 0.25s ease'
                          }}
                        />
                      </div>
                    ) : (
                      <FallbackCover
                        title={doc.title}
                        category={doc.category}
                        siteName={doc.site_name || doc.source}
                      />
                    )
                  )}

                  {/* 卡片正文主体 */}
                  <div style={{ padding: 'var(--space-4)' }}>
                    {/* 作者与来源信息 */}
                    {settings.showAuthor !== false && (doc.author || doc.site_name || doc.source) && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', color: 'var(--color-text-tertiary)',
                        marginBottom: '8px', fontWeight: '500'
                      }}>
                        <User size={13} style={{ opacity: 0.7 }} />
                        <span style={{
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {doc.author || doc.site_name || doc.source}
                        </span>
                      </div>
                    )}

                    {/* 文章标题 */}
                    <h2 style={{
                      fontSize: '1.05rem',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      lineHeight: '1.45',
                      marginBottom: '10px',
                      wordBreak: 'break-word'
                    }}>
                      {doc.title || '无标题文档'}
                    </h2>

                    {/* 摘要 preview（支持行数自定义） */}
                    {settings.showSummary !== false && doc.summary && (
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--color-text-secondary)',
                        lineHeight: '1.6',
                        marginBottom: '14px',
                        wordBreak: 'break-word',
                        ...summaryClampStyle
                      }}>
                        {doc.summary}
                      </p>
                    )}

                    {/* 底部元数据条：时间、阅读时长、划线数 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--color-border-light)',
                      fontSize: '11px',
                      color: 'var(--color-text-tertiary)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* 加入时间 */}
                        {settings.showDate !== false && (doc.created_at || doc.saved_at) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} />
                            {formatDate(doc.created_at || doc.saved_at)}
                          </span>
                        )}

                        {/* 预计阅读时间 */}
                        {settings.showReadingTime !== false && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {formatReadingTime(doc)}
                          </span>
                        )}
                      </div>

                      {/* 划线高亮数 */}
                      {settings.showHighlightCount !== false && doc.highlights_count > 0 && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          background: 'var(--color-accent-light)',
                          color: 'var(--color-accent)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: '600',
                          fontSize: '10px'
                        }}>
                          <Highlighter size={11} />
                          {doc.highlights_count}
                        </span>
                      )}
                    </div>

                    {/* 标签列表：展示全量所有标签 */}
                    {settings.showTags !== false && tagsList.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                        {tagsList.map(t => (
                          <span key={t} style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-tertiary)',
                            border: '1px solid var(--color-border-light)'
                          }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 无限滚动底部加载提示 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'var(--space-6) 0',
            color: 'var(--color-text-tertiary)',
            fontSize: '13px'
          }}>
            {isFetchingMore ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
                正在加载更多文章...
              </div>
            ) : !hasMore ? (
              <span>已加载全部文章</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
