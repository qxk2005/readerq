'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';

export default function SettingsModal() {
  const { showSettings, setShowSettings, syncData, isSyncing } = useApp();
  const { theme, setTheme, fontSize, setFontSize, lineHeight, setLineHeight, contentWidth, setContentWidth, fontFamily, setFontFamily } = useTheme();
  const [syncStatus, setSyncStatus] = useState(null);

  // API 配置表单状态
  const [readwiseToken, setReadwiseToken] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [envInfo, setEnvInfo] = useState({});

  // 加载当前配置
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.error) return;

      setReadwiseToken(data.readwise_token || '');
      setOpenaiApiKey(data.openai_api_key || '');
      setOpenaiBaseUrl(data.openai_base_url || '');
      setOpenaiModel(data.openai_model || '');
      setEnvInfo({
        readwiseFromEnv: data.env_readwise_token,
        openaiFromEnv: data.env_openai_api_key,
        envBaseUrl: data.env_openai_base_url,
        envModel: data.env_openai_model,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showSettings) {
      loadSettings();
      setConfigSaved(false);
      setConfigError(null);
    }
  }, [showSettings, loadSettings]);

  // 保存配置
  const saveConfig = async () => {
    setConfigLoading(true);
    setConfigError(null);
    setConfigSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readwise_token: readwiseToken,
          openai_api_key: openaiApiKey,
          openai_base_url: openaiBaseUrl,
          openai_model: openaiModel,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setConfigSaved(true);
      // 重新加载以获取脱敏值
      await loadSettings();
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      setConfigError(err.message);
    } finally {
      setConfigLoading(false);
    }
  };

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
      <div className="modal" style={{ width: '560px', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙️ 设置</h2>
          <button className="btn-icon" onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div className="modal-body">
          {/* ===== API 配置 ===== */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            🔑 API 配置
          </h3>

          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--space-4)',
            lineHeight: '1.6',
          }}>
            💡 在此处配置的值会保存到本地数据库。如果你已在 <code style={{ background: 'var(--color-bg-hover)', padding: '1px 4px', borderRadius: '3px' }}>.env.local</code> 文件中设置了环境变量，则环境变量优先。
          </div>

          {/* Readwise Token */}
          <div className="form-group">
            <label className="form-label">
              Readwise API Token
              {envInfo.readwiseFromEnv && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginLeft: 'var(--space-2)' }}>
                  ✓ 环境变量已设置
                </span>
              )}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="粘贴你的 Readwise Token..."
              value={readwiseToken}
              onChange={(e) => setReadwiseToken(e.target.value)}
              autoComplete="off"
            />
            <div className="form-hint">
              从 <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-link)' }}>readwise.io/access_token</a> 获取
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="form-group">
            <label className="form-label">
              OpenAI API Key
              {envInfo.openaiFromEnv && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginLeft: 'var(--space-2)' }}>
                  ✓ 环境变量已设置
                </span>
              )}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="sk-..."
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* OpenAI Base URL */}
          <div className="form-group">
            <label className="form-label">
              OpenAI 兼容服务器地址
              {envInfo.envBaseUrl && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>
                  环境变量: {envInfo.envBaseUrl}
                </span>
              )}
            </label>
            <input
              type="url"
              className="form-input"
              placeholder="https://api.openai.com/v1"
              value={openaiBaseUrl}
              onChange={(e) => setOpenaiBaseUrl(e.target.value)}
            />
            <div className="form-hint">
              支持任何 OpenAI 兼容的 API 服务器（如 vLLM、Ollama、Azure 等）
            </div>
          </div>

          {/* OpenAI Model */}
          <div className="form-group">
            <label className="form-label">
              AI 模型名称
              {envInfo.envModel && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>
                  环境变量: {envInfo.envModel}
                </span>
              )}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="gpt-4o-mini"
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
            />
            <div className="form-hint">
              填入你的 AI 服务器支持的模型名称
            </div>
          </div>

          {/* 保存按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button
              className="btn btn-primary"
              onClick={saveConfig}
              disabled={configLoading}
              style={{ minWidth: '120px' }}
            >
              {configLoading ? '保存中...' : '💾 保存配置'}
            </button>
            {configSaved && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', animation: 'fadeIn 0.3s ease' }}>
                ✅ 配置已保存
              </span>
            )}
            {configError && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                ❌ {configError}
              </span>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* ===== 外观设置 ===== */}
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

          {/* ===== 数据同步 ===== */}
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

          {/* ===== 快捷键 ===== */}
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

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* ===== 关于 ===== */}
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
