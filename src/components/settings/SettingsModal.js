'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';

export default function SettingsModal() {
  const { showSettings, setShowSettings, syncData, isSyncing } = useApp();
  const { theme, setTheme, fontSize, setFontSize, lineHeight, setLineHeight, contentWidth, setContentWidth, fontFamily, setFontFamily } = useTheme();
  const [syncStatus, setSyncStatus] = useState(null);

  const handleFullSync = async () => {
    try {
      const result = await syncData(true);
      setSyncStatus(`全量同步完成：同步了 ${result.synced} 篇文档和 ${result.tags} 个标签`);
    } catch (err) {
      setSyncStatus(`同步失败：${err.message}`);
    }
  };

  if (!showSettings) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙️ 设置</h2>
          <button className="btn-icon" onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div className="modal-body">
          {/* 外观设置 */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            🎨 外观
          </h3>

          <div className="form-group">
            <label className="form-label">主题</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('light')}
              >
                ☀️ 浅色
              </button>
              <button
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('dark')}
              >
                🌙 深色
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">阅读字体</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`btn ${fontFamily === 'serif' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setFontFamily('serif')}
              >
                衬线体
              </button>
              <button
                className={`btn ${fontFamily === 'sans' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setFontFamily('sans')}
              >
                无衬线
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">字号: {fontSize}px</label>
            <input
              type="range"
              min="14"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">行高: {lineHeight}</label>
            <input
              type="range"
              min="1.4"
              max="2.4"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">内容宽度: {contentWidth}px</label>
            <input
              type="range"
              min="500"
              max="1000"
              step="20"
              value={contentWidth}
              onChange={(e) => setContentWidth(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* 数据同步 */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            🔄 数据同步
          </h3>

          <div className="form-group">
            <button
              className="btn btn-primary"
              onClick={handleFullSync}
              disabled={isSyncing}
              style={{ width: '100%' }}
            >
              {isSyncing ? '同步中...' : '📥 全量同步 Readwise 数据'}
            </button>
            <div className="form-hint">
              从 Readwise 同步所有文档和标签到本地缓存
            </div>
            {syncStatus && (
              <div style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
              }}>
                {syncStatus}
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* 关于 */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            ℹ️ 关于
          </h3>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: '1.8' }}>
            <p><strong>ReaderQ</strong> v1.0.0</p>
            <p>Readwise Reader 开源复刻版本</p>
            <p>使用 Next.js + SQLite + OpenAI 兼容 API 构建</p>
            <p style={{ marginTop: 'var(--space-2)' }}>
              <a href="https://github.com/qxk2005/readerq" target="_blank" rel="noopener noreferrer">
                GitHub 仓库
              </a>
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* 快捷键 */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            ⌨️ 快捷键
          </h3>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['⌘/Ctrl + K', '命令面板'],
                  ['⌘/Ctrl + N', '添加文章'],
                  ['⌘/Ctrl + Shift + A', 'AI 助手'],
                  ['⌘/Ctrl + Shift + S', '同步数据'],
                  ['⌘/Ctrl + Shift + L', '切换主题'],
                  ['[', '收起左侧栏'],
                  [']', '打开 AI 面板'],
                  ['Esc', '关闭弹窗'],
                ].map(([key, label]) => (
                  <tr key={key} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)' }}>
                      <kbd style={{ background: 'var(--color-bg-tertiary)', padding: '1px 6px', borderRadius: '3px', border: '1px solid var(--color-border)' }}>
                        {key}
                      </kbd>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
