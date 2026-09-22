import './globals.css';

import Script from 'next/script';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata = {
  title: 'ReaderQ - 智能阅读助手',
  description: 'Readwise Reader 开源复刻版 - 集中管理、标注和消化你的数字阅读内容',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer-when-downgrade" />
        {/* MathJax 3 全局离线预配置 */}
        <Script
          id="mathjax-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$']],
                  displayMath: [['$$', '$$']],
                  processEscapes: true,
                  processEnvironments: true
                },
                chtml: { fontURL: '/libs/mathjax/output/chtml/fonts/woff-v2' },
                options: {
                  skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml']
                },
                startup: { typeset: false }
              };
            `
          }}
        />
        <Script
          id="mathjax-script"
          src="/libs/mathjax/tex-chtml.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <ThemeProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
