'use client';

import { useMemo } from 'react';
import { BookOpen, Video, Rss, Mail, FileText } from 'lucide-react';
import { extractDomain } from '@/lib/utils';

// 12 款经过专业对比度与饱和度微调的高阶艺术渐变色板
const PALETTE = [
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e1b4b 100%)', // Deep Sapphire
  'linear-gradient(135deg, #6366f1 0%, #4338ca 50%, #311042 100%)', // Violet Twilight
  'linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)', // Emerald Forest
  'linear-gradient(135deg, #d97706 0%, #b45309 50%, #78350f 100%)', // Amber Sunset
  'linear-gradient(135deg, #e11d48 0%, #be123c 50%, #881337 100%)', // Crimson Rose
  'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #0f172a 100%)', // Oceanic Cyan
  'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)', // Royal Purple
  'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #134e4a 100%)', // Nordic Teal
  'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)', // Charcoal Slate
  'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #7c2d12 100%)', // Warm Ember
  'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #db2777 100%)', // Aurora Borealis
  'linear-gradient(135deg, #15803d 0%, #047857 50%, #0f172a 100%)', // Deep Moss
];

// 根据字符串生成稳定一致的 Hash 索引
function stringHash(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// 提取域名/来源的首字母 Monogram (如 github.com -> GH, sspai.com -> SS, 36kr.com -> 36)
function getDomainMonogram(domainStr = '') {
  if (!domainStr) return null;
  const clean = domainStr.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (clean.includes('github')) return 'GH';
  if (clean.includes('sspai')) return 'SS';
  if (clean.includes('36kr')) return '36';
  if (clean.includes('weixin') || clean.includes('mp.qq')) return 'WX';
  if (clean.includes('zhihu')) return 'ZH';
  if (clean.includes('bilibili')) return 'BILI';
  if (clean.includes('v2ex')) return 'V2';
  if (clean.includes('medium')) return 'MD';
  if (clean.includes('substack')) return 'SB';
  if (clean.includes('wikipedia')) return 'WIKI';
  if (clean.includes('nytimes')) return 'NYT';
  if (clean.includes('wsj')) return 'WSJ';
  
  const parts = clean.split('.')[0];
  if (!parts) return null;
  if (parts.length <= 3) return parts.toUpperCase();
  return parts.substring(0, 2).toUpperCase();
}

export default function ArticleCoverPlaceholder({
  doc = {},
  mode = 'thumb', // 'thumb' (56x56) | 'card' (160px+ 卡片)
  width,
  height,
  style = {},
  className = '',
}) {
  const title = doc.title || 'Untitled Article';
  const category = doc.category || 'article';
  const domain = extractDomain(doc.source_url || doc.url);
  const monogram = useMemo(() => getDomainMonogram(domain), [domain]);

  // 根据 title 和 id 获取专属匹配渐变
  const gradient = useMemo(() => {
    const key = `${doc.id || ''}_${title}_${domain}`;
    const hash = stringHash(key);
    return PALETTE[hash % PALETTE.length];
  }, [doc.id, title, domain]);

  // 分类图标
  const CategoryIcon = useMemo(() => {
    switch (category) {
      case 'video': return Video;
      case 'rss': return Rss;
      case 'email': return Mail;
      case 'pdf': return FileText;
      default: return BookOpen;
    }
  }, [category]);

  // --- 模式 1：文章列表 56x56 缩略图模式 ---
  if (mode === 'thumb') {
    return (
      <div
        className={`doc-card-cover-placeholder ${className}`}
        style={{
          width: width || '56px',
          height: height || '56px',
          background: gradient,
          borderRadius: 'var(--radius-md, 10px)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 2px 8px rgba(0, 0, 0, 0.15)',
          userSelect: 'none',
          ...style,
        }}
      >
        {/* 背景微透光斑装饰 */}
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            right: '-30%',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {monogram ? (
          <div
            style={{
              fontSize: monogram.length > 2 ? '11px' : '13px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '0.05em',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            {monogram}
          </div>
        ) : (
          <CategoryIcon size={20} style={{ color: 'rgba(255, 255, 255, 0.92)', zIndex: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
        )}

        {/* 底部微小分类 Indicator 点/Icon */}
        <div
          style={{
            position: 'absolute',
            bottom: '3px',
            right: '3px',
            background: 'rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            borderRadius: '50%',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <CategoryIcon size={9} />
        </div>
      </div>
    );
  }

  // --- 模式 2：首页瀑布流 / 卡片 160px+ 大封面模式 ---
  return (
    <div
      className={`doc-card-cover-placeholder-card ${className}`}
      style={{
        width: width || '100%',
        height: height || '160px',
        background: gradient,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px 16px',
        boxSizing: 'border-box',
        borderTopLeftRadius: 'var(--radius-lg, 14px)',
        borderTopRightRadius: 'var(--radius-lg, 14px)',
        userSelect: 'none',
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15)',
        ...style,
      }}
    >
      {/* 双层高阶半透明发光球体装饰 */}
      <div
        style={{
          position: 'absolute',
          top: '-25%',
          right: '-15%',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-35%',
          left: '-15%',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 顶部 Badge 区域 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.03em',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}
        >
          <CategoryIcon size={12} />
          {category?.toUpperCase() || 'ARTICLE'}
        </span>
        {domain && (
          <span
            style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '600',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              background: 'rgba(0,0,0,0.2)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            {domain}
          </span>
        )}
      </div>

      {/* 底部艺术标题印记 (Watermark Monogram) */}
      <div style={{ zIndex: 1, marginTop: 'auto' }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#ffffff',
            lineHeight: '1.35',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
