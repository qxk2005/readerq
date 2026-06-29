'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { Settings, Key, Palette, Keyboard, Info, RefreshCw, Lightbulb, Save, Zap, CheckCircle2, XCircle, Wrench, PartyPopper, Sun, Moon } from 'lucide-react';

export default function SettingsModal() {
  const { showSettings, setShowSettings, syncData, isSyncing, syncStatus: globalSyncStatus, syncProgress, syncCounts, syncError, cancelSync } = useApp();
  const { theme, setTheme, fontSize, setFontSize, lineHeight, setLineHeight, contentWidth, setContentWidth, fontFamily, setFontFamily } = useTheme();
  
  // Local status for UI feedback not covered by global status
  const [localSyncStatus, setLocalSyncStatus] = useState(null);

  // API 配置表单状态
  const [readwiseToken, setReadwiseToken] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [envInfo, setEnvInfo] = useState({});
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testStages, setTestStages] = useState(null);
  const [openaiMaxTokens, setOpenaiMaxTokens] = useState('');

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
      setOpenaiMaxTokens(data.openai_max_tokens || '');
      setEnvInfo({
        readwiseFromEnv: data.env_readwise_token,
        openaiFromEnv: data.env_openai_api_key,
        envBaseUrl: data.env_openai_base_url,
        envModel: data.env_openai_model,
        envMaxTokens: data.env_openai_max_tokens,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showSettings) {
      loadSettings();
      setConfigSaved(false);
      setConfigError(null);
      setTestResult(null);
      setTestStages(null);
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
          openai_max_tokens: openaiMaxTokens,
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

  const handleTestError = (errorMessage) => {
    setTestStages(prev => {
      if (!prev) return null;
      let updated = false;
      return prev.map(stage => {
        if (!updated && (stage.status === 'running' || stage.status === 'pending')) {
          updated = true;
          return { ...stage, status: 'failed', message: errorMessage };
        }
        return stage;
      });
    });
    setTestResult({ success: false, error: errorMessage });
  };

  // 测试 AI 配置
  const testConfig = async () => {
    setTestLoading(true);
    setTestResult(null);
    setConfigError(null);
    setTestStages([
      { id: 'validate', name: '配置参数校验', status: 'pending', message: '等待开始...' },
      { id: 'connect', name: '服务器连通性测试', status: 'pending', message: '等待开始...' },
      { id: 'chat', name: '对话模型可用性测试', status: 'pending', message: '等待开始...' },
    ]);

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: openaiApiKey,
          openai_base_url: openaiBaseUrl,
          openai_model: openaiModel,
          openai_max_tokens: openaiMaxTokens,
        }),
      });

      if (!res.ok) {
        throw new Error(`请求失败 (状态码: ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一个不完整行

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'stage') {
              setTestStages(prev => prev ? prev.map(stage => 
                stage.id === data.id ? { ...stage, status: data.status, message: data.message } : stage
              ) : null);
            } else if (data.type === 'done') {
              setTestResult({
                success: data.success,
                duration: data.duration,
                reply: data.reply,
              });
            } else if (data.type === 'error') {
              handleTestError(data.error);
            }
          } catch (e) {
            console.error('解析流数据失败:', line, e);
          }
        }
      }
    } catch (err) {
      handleTestError(err.message || '网络请求失败，请检查本地网络连接与地址配置。');
    } finally {
      setTestLoading(false);
    }
  };



  if (!showSettings) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div className="modal" style={{ width: '560px', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={24} /> 设置</h2>
          <button className="btn-icon" onClick={() => setShowSettings(false)}>✕</button>
        </div>

        <div className="modal-body">
          {/* ===== API 配置 ===== */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={18} /> API 配置</span>
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
            <div className="help-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <Lightbulb size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>在此处配置的值会保存到本地数据库并优先使用。如果你在此处留空，系统将自动回退使用 <code style={{ background: 'var(--color-bg-hover)', padding: '1px 4px', borderRadius: '3px' }}>.env.local</code> 或环境变量配置。</span>
            </div>
          </div>

          {/* Readwise Token */}
          <div className="form-group">
            <label className="form-label">
              Readwise API Token
              {envInfo.readwiseFromEnv && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginLeft: 'var(--space-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> 环境变量已设置</span>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> 环境变量已设置</span>
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

          {/* OpenAI Max Tokens */}
          <div className="form-group">
            <label className="form-label">
              最大回答 Token 限制 (max_tokens)
              {envInfo.envMaxTokens && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-2)' }}>
                  环境变量: {envInfo.envMaxTokens}
                </span>
              )}
            </label>
            <input
              type="number"
              min="1"
              className="form-input"
              placeholder="4096"
              value={openaiMaxTokens}
              onChange={(e) => setOpenaiMaxTokens(e.target.value)}
            />
            <div className="form-hint">
              AI 接口单次生成（含思考过程）的最大 Token 限制。对于 DeepSeek 等推理模型，建议设置为 4096 或更大。
            </div>
          </div>

          {/* 保存与测试按钮组 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button
              className="btn btn-primary"
              onClick={saveConfig}
              disabled={configLoading || testLoading}
              style={{ minWidth: '120px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Save size={16} />
                {configLoading ? '保存中...' : '保存配置'}
              </span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={testConfig}
              disabled={configLoading || testLoading}
              style={{ minWidth: '120px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                <Zap size={16} />
                {testLoading ? '测试中...' : '测试连接'}
              </span>
            </button>
            {configSaved && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', animation: 'fadeIn 0.3s ease' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> 配置已保存</span>
              </span>
            )}
            {configError && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><XCircle size={14} /> 保存失败: {configError}</span>
              </span>
            )}
          </div>

          {/* 测试连接结果显示 */}
          {(testStages || testResult) && (
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-xs)',
              marginBottom: 'var(--space-4)',
              lineHeight: '1.6',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                <Zap size={16} color="var(--color-accent)" /> 连接测试诊断详情
                {testLoading && (
                  <span className="loading-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-loading 1s linear infinite' }} />
                )}
              </div>
              
              {/* 步骤时间轴 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative', paddingLeft: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                {/* 时间轴左侧竖线 */}
                <div style={{
                  position: 'absolute',
                  left: '6px',
                  top: '8px',
                  bottom: '8px',
                  width: '2px',
                  background: 'var(--color-border)',
                  zIndex: 0
                }} />

                {testStages && testStages.map((stage) => {
                  let icon = '';
                  let iconColor = 'var(--color-text-tertiary)';
                  let textColor = 'var(--color-text-secondary)';
                  let isCurrent = false;

                  if (stage.status === 'running') {
                    icon = '';
                    iconColor = 'var(--color-accent)';
                    textColor = 'var(--color-text-primary)';
                    isCurrent = true;
                  } else if (stage.status === 'success') {
                    icon = <Check size={10} />;
                    iconColor = 'var(--color-success)';
                    textColor = 'var(--color-text-secondary)';
                  } else if (stage.status === 'failed') {
                    icon = <X size={10} />;
                    iconColor = 'var(--color-danger)';
                    textColor = 'var(--color-danger)';
                  }

                  return (
                    <div key={stage.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', position: 'relative', zIndex: 1 }}>
                      {/* 节点圆形背景图标 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: stage.status === 'running' ? 'var(--color-accent-light)' : 'var(--color-bg-secondary)',
                        border: `1px solid ${iconColor}`,
                        color: iconColor,
                        fontSize: '10px',
                        fontWeight: 'bold',
                        marginLeft: '-14px',
                        animation: isCurrent ? 'spin-loading 2s linear infinite' : 'none'
                      }}>
                        {icon}
                      </div>
                      
                      <div style={{ flex: 1, marginLeft: 'var(--space-1)' }}>
                        <div style={{ fontWeight: '600', color: textColor, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{stage.name}</span>
                          {stage.status === 'running' && (
                            <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 'normal' }}>进行中...</span>
                          )}
                          {stage.status === 'success' && (
                            <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 'normal' }}>已完成</span>
                          )}
                          {stage.status === 'failed' && (
                            <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 'normal' }}>失败</span>
                          )}
                        </div>
                        <div style={{ color: stage.status === 'failed' ? 'var(--color-danger)' : 'var(--color-text-tertiary)', fontSize: '11px', marginTop: '2px' }}>
                          {stage.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 最终结果卡片 */}
              {testResult && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border-light)',
                }}>
                  {testResult.success ? (
                    <div style={{
                      padding: 'var(--space-3)',
                      background: 'rgba(34, 197, 94, 0.06)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                    }}>
                      <div style={{ color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><PartyPopper size={14} /> 测试连接成功！(总耗时: {testResult.duration}ms)</span>
                      </div>
                      <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)', padding: 'var(--space-2)', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-light)' }}>
                        <strong style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '2px' }}>AI 响应内容:</strong>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>"{testResult.reply}"</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: 'var(--space-3)',
                      background: 'rgba(239, 68, 68, 0.06)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}>
                      <div style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> 测试连接失败</span>
                      </div>
                      <div style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', background: 'var(--color-bg-primary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-light)' }}>
                        {testResult.error}
                      </div>
                      
                      {/* 智能排障建议 */}
                      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}><Wrench size={12} /> 排障小贴士：</div>
                        <ul style={{ paddingLeft: 'var(--space-4)', margin: 0, color: 'var(--color-text-secondary)', fontSize: '11px', lineHeight: '1.6' }}>
                          <li>检查 API Key 是否完整，确保开头没有多余空格。</li>
                          <li>如果使用的是国内代理或第三方 API，请确保服务器地址包含协议头（<code>http://</code> 或 <code>https://</code>）并以 <code>/v1</code> 结尾（如 <code>https://api.yourproxy.com/v1</code>）。</li>
                          <li>对于 Ollama，本地默认地址通常是 <code>http://127.0.0.1:11434/v1</code>，请确认 Ollama 已启动。</li>
                          <li>请确认<b>模型名称</b>与您服务器上配置的完全一致（如 <code>gpt-4o-mini</code> 或 <code>deepseek-chat</code>）。</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* ===== 外观设置 ===== */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Palette size={18} /> 外观</span>
          </h3>

          <div className="form-group">
            <label className="form-label">主题</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('light')}
              >
                <Sun size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> 浅色
              </button>
              <button
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> 深色
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={18} /> 数据同步</span>
          </h3>

          <div className="form-group">
            {/* Sync Status Display */}
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>上次同步</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {syncCounts?.lastSync ? new Date(syncCounts.lastSync).toLocaleString() : '从未同步'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>本地文档总数</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {syncCounts?.local || 0} 篇
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>云端记录总数</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>
                  {syncCounts?.remote ? `${syncCounts.remote} 篇` : '未知'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>当前状态</span>
                <span style={{ 
                  color: globalSyncStatus === 'error' ? 'var(--color-danger)' : 
                         globalSyncStatus === 'syncing' ? 'var(--color-accent)' : 
                         'var(--color-text-primary)', 
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {globalSyncStatus === 'syncing' && <span className="loading-spinner" style={{ width: '10px', height: '10px' }} />}
                  {globalSyncStatus === 'syncing' ? '同步中...' :
                   globalSyncStatus === 'canceling' ? '正在取消...' :
                   globalSyncStatus === 'error' ? '同步失败' :
                   globalSyncStatus === 'canceled' ? '已取消' : '空闲'}
                </span>
              </div>

              {/* Progress Display */}
              {isSyncing && syncProgress && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    <span>
                      {syncProgress.phase === 'documents' ? '拉取文档中...' :
                       syncProgress.phase === 'tags' ? '拉取标签中...' :
                       syncProgress.phase === 'done' ? '处理完成' : '准备中...'}
                    </span>
                    <span>
                      {syncProgress.total > 0 ? `${syncProgress.fetched} / ${syncProgress.total}` : `${syncProgress.fetched}`}
                    </span>
                  </div>
                  {syncProgress.total > 0 && (
                    <div style={{ width: '100%', height: '4px', background: 'var(--color-bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min(100, Math.round((syncProgress.fetched / syncProgress.total) * 100))}%`, 
                        background: 'var(--color-accent)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {syncError && (
              <div style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> {syncError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {!isSyncing ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      setLocalSyncStatus(null);
                      await syncData(false); // 增量同步
                    }}
                    style={{ flex: 2 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><Zap size={14} /> 增量同步更新</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      if (confirm('全量覆盖同步将从头开始拉取所有文档和标签，可能需要较长时间，确认继续吗？')) {
                        setLocalSyncStatus(null);
                        await syncData(true); // 全量同步
                      }
                    }}
                    style={{ flex: 1, fontSize: '11px' }}
                  >
                    📥 全量覆盖同步
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={cancelSync}
                  disabled={globalSyncStatus === 'canceling'}
                  style={{ flex: 1, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                >
                  {globalSyncStatus === 'canceling' ? '取消中...' : '⏹ 终止同步'}
                </button>
              )}
            </div>
            
            <div className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
              从 Readwise 同步所有文档和标签到本地缓存。进度显示取决于云端数据量。
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-6) 0' }} />

          {/* ===== 快捷键 ===== */}
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Keyboard size={18} /> 快捷键</span>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={18} /> 关于</span>
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
