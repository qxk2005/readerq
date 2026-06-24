'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [contentWidth, setContentWidth] = useState(720);
  const [fontFamily, setFontFamily] = useState('serif'); // serif | sans

  useEffect(() => {
    // 从 localStorage 读取主题设置
    const saved = localStorage.getItem('readerq-theme');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.theme) setThemeState(settings.theme);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.lineHeight) setLineHeight(settings.lineHeight);
        if (settings.contentWidth) setContentWidth(settings.contentWidth);
        if (settings.fontFamily) setFontFamily(settings.fontFamily);
      } catch { /* 忽略解析错误 */ }
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('readerq-theme', JSON.stringify({
      theme, fontSize, lineHeight, contentWidth, fontFamily,
    }));
  }, [theme, fontSize, lineHeight, contentWidth, fontFamily]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
  }, []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    fontSize,
    setFontSize,
    lineHeight,
    setLineHeight,
    contentWidth,
    setContentWidth,
    fontFamily,
    setFontFamily,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 中使用');
  }
  return context;
}
