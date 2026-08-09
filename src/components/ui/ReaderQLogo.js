'use client';

import React from 'react';

/**
 * 极简高端品牌 Vector Logo 符号（匹配选中 App Icon 造型：方中带圆 Q 字母 + 打开书本）
 */
export const ReaderQLogoSymbol = ({ size = 28, className = "", style = {} }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`readerq-logo-symbol ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        borderRadius: '7px',
        overflow: 'hidden',
        transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease',
        filter: 'drop-shadow(0 2px 8px rgba(124, 58, 237, 0.3))',
        ...style
      }}
    >
      <defs>
        <linearGradient id="rqSymbolBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7E22CE" />
          <stop offset="50%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {/* 方中带圆的 Q 字母圆角底座 */}
      <rect width="100" height="100" rx="22" fill="url(#rqSymbolBgGrad)" />

      {/* 内嵌立体的书本翻页图案 */}
      <path
        d="M20 40 C32 32 46 37 50 41 C54 37 68 32 80 40 L80 68 C68 60 54 65 50 69 C46 65 32 60 20 68 Z"
        fill="#FFFFFF"
      />
      <path
        d="M50 41 L50 69"
        stroke="#9333EA"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default ReaderQLogoSymbol;
