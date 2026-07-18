'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [contentWidth, setContentWidth] = useState(720);
  const [fontFamily, setFontFamily] = useState('serif'); // serif | sans
  const [chineseFont, setChineseFont] = useState('default');
  const [englishFont, setEnglishFont] = useState('default');
  const [paddingX, setPaddingX] = useState(24);
  const [paragraphSpacing, setParagraphSpacing] = useState(1.5);
  const [docListElements, setDocListElements] = useState({
    author: true,
    readingTime: true,
    createdAt: true,
    readingProgress: true,
    summary: true,
  });
  const [videoSettings, setVideoSettings] = useState({
    subtitleLang: 'auto',
    autoScroll: true,
    playerSize: 'medium',
    blogPrompt: '',
  });

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
        if (settings.chineseFont) setChineseFont(settings.chineseFont);
        if (settings.englishFont) setEnglishFont(settings.englishFont);
        if (settings.paddingX !== undefined) setPaddingX(settings.paddingX);
        if (settings.paragraphSpacing !== undefined) setParagraphSpacing(settings.paragraphSpacing);
        if (settings.docListElements !== undefined) setDocListElements(settings.docListElements);
        if (settings.videoSettings !== undefined) setVideoSettings(settings.videoSettings);
      } catch { /* 忽略解析错误 */ }
    }

    // 写入平台标识，以便在 CSS 中做跨平台 UI 适配
    if (typeof window !== 'undefined') {
      const isMac = navigator.userAgent.indexOf('Mac') !== -1;
      if (isMac) {
        document.documentElement.classList.add('platform-darwin');
      } else {
        document.documentElement.classList.add('platform-windows');
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('readerq-theme', JSON.stringify({
      theme, fontSize, lineHeight, contentWidth, fontFamily,
      chineseFont, englishFont, paddingX, paragraphSpacing,
      docListElements, videoSettings,
    }));
  }, [theme, fontSize, lineHeight, contentWidth, fontFamily, chineseFont, englishFont, paddingX, paragraphSpacing, docListElements, videoSettings]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
  }, []);

  const resetAppearance = useCallback(() => {
    setThemeState('dark');
    setFontSize(17);
    setLineHeight(1.8);
    setContentWidth(720);
    setFontFamily('serif');
    setChineseFont('default');
    setEnglishFont('default');
    setPaddingX(24);
    setParagraphSpacing(1.5);
    setDocListElements({
      author: true,
      readingTime: true,
      createdAt: true,
      readingProgress: true,
      summary: true,
    });
    setVideoSettings({
      subtitleLang: 'auto',
      autoScroll: true,
      playerSize: 'medium',
      blogPrompt: '',
    });
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
    chineseFont,
    setChineseFont,
    englishFont,
    setEnglishFont,
    paddingX,
    setPaddingX,
    paragraphSpacing,
    setParagraphSpacing,
    resetAppearance,
    docListElements,
    setDocListElements,
    videoSettings,
    setVideoSettings,
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
