import './globals.css';

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
