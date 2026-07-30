'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, CheckCircle2, AlertCircle, ExternalLink, ArrowRight, ArrowLeft,
  BookOpen, Bot, Cloud, Check, Loader2, ShieldCheck, Key, Globe, Server, RefreshCw, Zap
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

/**
 * 首次使用 ReaderQ 精美配置向导 (Onboarding Wizard)
 * 引导用户配置 Readwise、OpenAI / AI 引擎、阿里云 OSS 等必要第三方凭证
 */
export default function OnboardingWizardModal({ isOpen, onClose, isReopening = false }) {
  const { fetchDocuments, showToast } = useApp();

  const [step, setStep] = useState(1); // 1: Welcome, 2: Readwise, 3: AI Engine, 4: OSS, 5: Finish
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // 表单参数 State
  const [formData, setFormData] = useState({
    readwise_token: '',
    openai_base_url: 'https://api.openai.com/v1',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    oss_region: '',
    oss_bucket: '',
    oss_access_key_id: '',
    oss_access_key_secret: '',
    oss_custom_domain: '',
  });

  // 各组件连接测试状态
  const [readwiseTest, setReadwiseTest] = useState({ loading: false, success: false, msg: '', err: '' });
  const [aiTest, setAiTest] = useState({ loading: false, success: false, msg: '', err: '' });
  const [ossTest, setOssTest] = useState({ loading: false, success: false, msg: '', err: '' });

  const [isSaving, setIsSaving] = useState(false);

  // 加载已有配置
  const loadExistingSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok && data) {
        setFormData(prev => ({
          readwise_token: data.readwise_token || '',
          openai_base_url: data.openai_base_url || 'https://api.openai.com/v1',
          openai_api_key: data.openai_api_key || '',
          openai_model: data.openai_model || 'gpt-4o-mini',
          oss_region: data.oss_region || '',
          oss_bucket: data.oss_bucket || '',
          oss_access_key_id: data.oss_access_key_id || '',
          oss_access_key_secret: data.oss_access_key_secret || '',
          oss_custom_domain: data.oss_custom_domain || '',
        }));

        // 如果已有 token，自动标记为已具备设置
        if (data.readwise_token_set) {
          setReadwiseTest({ loading: false, success: true, msg: '已存在已配置的 Token', err: '' });
        }
        if (data.openai_api_key_set) {
          setAiTest({ loading: false, success: true, msg: '已存在已配置的 API Key', err: '' });
        }
        if (data.oss_access_key_id_set) {
          setOssTest({ loading: false, success: true, msg: '已存在已配置的 OSS 密钥', err: '' });
        }
      }
    } catch (e) {
      console.warn('读取现有配置异常:', e);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      loadExistingSettings();
    }
  }, [isOpen, loadExistingSettings]);

  // 修改表单字段
  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // 测试 Readwise Token
  const testReadwise = async () => {
    setReadwiseTest({ loading: true, success: false, msg: '', err: '' });
    try {
      const res = await fetch('/api/readwise/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.readwise_token }),
      });
      const data = await res.json();
      if (data.success) {
        setReadwiseTest({ loading: false, success: true, msg: data.message || '验证成功！', err: '' });
      } else {
        setReadwiseTest({ loading: false, success: false, msg: '', err: data.error || '验证失败' });
      }
    } catch (e) {
      setReadwiseTest({ loading: false, success: false, msg: '', err: e.message || '网络连接异常' });
    }
  };

  // 测试 AI Engine
  const testAI = async () => {
    setAiTest({ loading: true, success: false, msg: '正在建立 AI 连接...', err: '' });
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: formData.openai_api_key,
          openai_base_url: formData.openai_base_url,
          openai_model: formData.openai_model,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'stage') {
              setAiTest(prev => ({ ...prev, msg: data.message }));
            } else if (data.type === 'done' && data.success) {
              setAiTest({ loading: false, success: true, msg: `测试成功！AI 回复: "${data.reply}"`, err: '' });
            } else if (data.type === 'error') {
              setAiTest({ loading: false, success: false, msg: '', err: data.error });
            }
          } catch { /* ignore parse error */ }
        }
      }
    } catch (e) {
      setAiTest({ loading: false, success: false, msg: '', err: e.message || '网络测试失败' });
    }
  };

  // 测试 OSS
  const testOSS = async () => {
    setOssTest({ loading: true, success: false, msg: '', err: '' });
    try {
      const res = await fetch('/api/oss/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oss_region: formData.oss_region,
          oss_bucket: formData.oss_bucket,
          oss_access_key_id: formData.oss_access_key_id,
          oss_access_key_secret: formData.oss_access_key_secret,
          oss_custom_domain: formData.oss_custom_domain,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOssTest({ loading: false, success: true, msg: 'OSS 读写连通性测试通过！', err: '' });
      } else {
        setOssTest({ loading: false, success: false, msg: '', err: data.error || 'OSS 连通测试失败' });
      }
    } catch (e) {
      setOssTest({ loading: false, success: false, msg: '', err: e.message || '测试网络异常' });
    }
  };

  // 保存并完成向导
  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        onboarding_completed: 'true',
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('🎉 ReaderQ 初始化配置保存成功！', 'success');
        fetchDocuments({ page: 1, sync: true });
        onClose?.();
      } else {
        showToast(data.error || '保存配置失败', 'error');
      }
    } catch (e) {
      showToast(e.message || '保存配置异常', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="onboarding-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="onboarding-modal-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          backgroundColor: 'var(--color-bg-primary, #1c1c1e)',
          color: 'var(--color-text-primary, #ffffff)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--color-border, rgba(255, 255, 255, 0.15))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 顶栏 Header */}
        <div
          style={{
            padding: '20px 28px 16px',
            borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-secondary, #2c2c2e)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #007aff, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              Q
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                ReaderQ 初始化配置向导
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                首次使用引导与第三方服务连接验证
              </div>
            </div>
          </div>

          {/* 如果是重开场景，允许点 X 关闭 */}
          {isReopening && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 步进指示器 (Stepper Indicator) */}
        <div
          style={{
            padding: '12px 28px',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.05))',
          }}
        >
          {[
            { num: 1, label: '欢迎' },
            { num: 2, label: 'Readwise' },
            { num: 3, label: 'AI 引擎' },
            { num: 4, label: '云端同步' },
            { num: 5, label: '完成' },
          ].map(s => {
            const isDone = s.num < step;
            const isCurrent = s.num === step;
            return (
              <div
                key={s.num}
                onClick={() => isDone && setStep(s.num)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isDone ? 'pointer' : 'default',
                  opacity: isCurrent ? 1 : isDone ? 0.85 : 0.4,
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: isCurrent
                      ? 'var(--color-accent, #007aff)'
                      : isDone
                      ? '#30d158'
                      : 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                  }}
                >
                  {isDone ? <Check size={12} /> : s.num}
                </div>
                <span style={{ fontSize: '12px', fontWeight: isCurrent ? '600' : 'normal' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* 内容区域 (Scrollable Body) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        >
          {isLoadingSettings ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)', marginBottom: '12px' }} />
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>正在加载配置选项...</div>
            </div>
          ) : (
            <>
              {/* STEP 1: 欢迎组件介绍 */}
              {step === 1 && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div style={{ textAlign: 'center', padding: '20px 10px 30px' }}>
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #007aff, #a78bfa)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: '#fff',
                        boxShadow: '0 10px 25px rgba(0, 122, 255, 0.3)',
                      }}
                    >
                      <Sparkles size={32} />
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
                      欢迎使用 ReaderQ 智能阅读助手
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto', fontSize: '13px' }}>
                      ReaderQ 专为高阶阅读者与视频博客爱好者打造。只需简单 3 分钟配置第三方凭证，即可解锁全文深度同步、AI 视频中英双语翻译及多端同步。
                    </p>
                  </div>

                  {/* 特性矩阵 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <BookOpen size={20} style={{ color: '#007aff', marginBottom: '8px' }} />
                      <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>Readwise 同步</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
                        实时无缝同步 Readwise Reader 标注与剪藏文章正文。
                      </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Bot size={20} style={{ color: '#ffd700', marginBottom: '8px' }} />
                      <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>AI 视频转译</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
                        自动将 YouTube 视频解析为精致精选博客与电影字幕。
                      </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Cloud size={20} style={{ color: '#30d158', marginBottom: '8px' }} />
                      <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>多端云同步</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
                        Android、桌面版与 Web 端跨设备即时共享数据。
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(0, 122, 255, 0.08)', border: '1px solid rgba(0, 122, 255, 0.2)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    💡 提示：本向导填入的 API Key 和凭证均安全离线保存在本地数据库中，绝不向第三方发送。
                  </div>
                </div>
              )}

              {/* STEP 2: Readwise 配置 */}
              {step === 2 && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={20} style={{ color: 'var(--color-accent)' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>配置 Readwise Access Token</h3>
                  </div>

                  {/* 新手图文获取教程卡片 */}
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '14px',
                      background: 'rgba(0, 122, 255, 0.08)',
                      border: '1px solid rgba(0, 122, 255, 0.2)',
                      marginBottom: '20px',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: 'var(--color-accent)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={14} />
                      如何获取 Readwise Access Token？
                    </div>
                    <ol style={{ paddingLeft: '18px', margin: '4px 0 8px 0', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                      <li>打开浏览器登录 Readwise 官方账号。</li>
                      <li>
                        访问 Readwise API Token 页面：
                        <a
                          href="https://readwise.io/access_token"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: 'var(--color-accent)',
                            fontWeight: '600',
                            marginLeft: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          https://readwise.io/access_token <ExternalLink size={11} />
                        </a>
                      </li>
                      <li>点击 <b>"Get API Access Token"</b> 复制框中的一长串 Token 字符串。</li>
                    </ol>
                  </div>

                  {/* 输入表单 */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                      Readwise Access Token *
                    </label>
                    <input
                      type="password"
                      placeholder="例如: token_live_xxxxxxxxxxxxxxxx"
                      value={formData.readwise_token}
                      onChange={(e) => handleChange('readwise_token', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--color-bg-secondary, #2c2c2e)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  {/* 测试连接按钮与反馈 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={testReadwise}
                      disabled={readwiseTest.loading || !formData.readwise_token}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: 'var(--color-accent)',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {readwiseTest.loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      测试 Readwise 连接
                    </button>

                    {readwiseTest.success && (
                      <span style={{ fontSize: '12px', color: '#30d158', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <CheckCircle2 size={14} /> {readwiseTest.msg}
                      </span>
                    )}
                    {readwiseTest.err && (
                      <span style={{ fontSize: '12px', color: 'var(--color-danger, #ff453a)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} /> {readwiseTest.err}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: AI Engine 配置 */}
              {step === 3 && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={20} style={{ color: '#ffd700' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>配置 AI 大模型引擎 (OpenAI / DeepSeek / 代理)</h3>
                  </div>

                  {/* 获取指南 */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '14px',
                      background: 'rgba(255, 215, 0, 0.08)',
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                      marginBottom: '16px',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#ffd700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={14} />
                      服务提供商获取地址与一键预设：
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                      支持官方 OpenAI (`https://platform.openai.com/api-keys`)、DeepSeek (`https://platform.deepseek.com`) 或任意 OneAPI 镜像代理。
                    </div>

                    {/* 快捷预设按钮 */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { name: 'OpenAI 官方', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
                        { name: 'DeepSeek 官方', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
                        { name: '硅基流动 SiliconFlow', url: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
                        { name: 'Ollama 本地大模型', url: 'http://localhost:11434/v1', model: 'llama3.2' },
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => {
                            handleChange('openai_base_url', preset.url);
                            handleChange('openai_model', preset.model);
                          }}
                          style={{
                            padding: '3px 9px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#fff',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 表单输入 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                        API 服务器地址 (Base URL) *
                      </label>
                      <input
                        type="text"
                        placeholder="例如: https://api.openai.com/v1"
                        value={formData.openai_base_url}
                        onChange={(e) => handleChange('openai_base_url', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'var(--color-bg-secondary, #2c2c2e)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                        API Key 密钥 *
                      </label>
                      <input
                        type="password"
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={formData.openai_api_key}
                        onChange={(e) => handleChange('openai_api_key', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'var(--color-bg-secondary, #2c2c2e)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
                        模型名称 (Model) *
                      </label>
                      <input
                        type="text"
                        placeholder="如: gpt-4o-mini 或 deepseek-chat"
                        value={formData.openai_model}
                        onChange={(e) => handleChange('openai_model', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'var(--color-bg-secondary, #2c2c2e)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>

                  {/* 测试连接按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={testAI}
                      disabled={aiTest.loading || !formData.openai_api_key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: '#ffd700',
                        color: '#000',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      {aiTest.loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      测试 AI 引擎连接
                    </button>

                    {aiTest.loading && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                        {aiTest.msg}
                      </span>
                    )}
                    {aiTest.success && (
                      <span style={{ fontSize: '12px', color: '#30d158', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <CheckCircle2 size={14} /> {aiTest.msg}
                      </span>
                    )}
                    {aiTest.err && (
                      <span style={{ fontSize: '12px', color: 'var(--color-danger, #ff453a)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} /> {aiTest.err}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: 阿里云 OSS 配置 (可选) */}
              {step === 4 && (
                <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cloud size={20} style={{ color: '#30d158' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: '700' }}>配置阿里云 OSS 云端同步 (推荐/可选)</h3>
                  </div>

                  {/* 获取指南 */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '14px',
                      background: 'rgba(48, 209, 88, 0.08)',
                      border: '1px solid rgba(48, 209, 88, 0.2)',
                      marginBottom: '16px',
                      fontSize: '12px',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#30d158', marginBottom: '4px' }}>
                      ☁️ 为什么推荐配置 OSS 云端同步？
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      配置阿里云 OSS 后，多设备 (Android / 桌面版 / Web) 之间的字幕与 AI 视频博客文件将实现毫秒级自动云端同步，防止本地数据丢失。
                      可前往阿里云 RAM 控制台控制：
                      <a href="https://ram.console.aliyun.com" target="_blank" rel="noreferrer" style={{ color: '#30d158', fontWeight: '600', marginLeft: '4px' }}>
                        https://ram.console.aliyun.com <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* 表单输入 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: 'var(--color-text-secondary)' }}>Region 区域 (如: oss-cn-hangzhou)</label>
                      <input
                        type="text"
                        placeholder="oss-cn-hangzhou"
                        value={formData.oss_region}
                        onChange={(e) => handleChange('oss_region', e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'var(--color-bg-secondary, #2c2c2e)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: 'var(--color-text-secondary)' }}>Bucket 名称</label>
                      <input
                        type="text"
                        placeholder="my-readerq-bucket"
                        value={formData.oss_bucket}
                        onChange={(e) => handleChange('oss_bucket', e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'var(--color-bg-secondary, #2c2c2e)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: 'var(--color-text-secondary)' }}>AccessKey ID</label>
                      <input
                        type="password"
                        placeholder="LTAI5txxxxxxxx"
                        value={formData.oss_access_key_id}
                        onChange={(e) => handleChange('oss_access_key_id', e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'var(--color-bg-secondary, #2c2c2e)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: 'var(--color-text-secondary)' }}>AccessKey Secret</label>
                      <input
                        type="password"
                        placeholder="Secret字符串"
                        value={formData.oss_access_key_secret}
                        onChange={(e) => handleChange('oss_access_key_secret', e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', background: 'var(--color-bg-secondary, #2c2c2e)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  {/* 测试连接按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={testOSS}
                      disabled={ossTest.loading || !formData.oss_access_key_id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: '#30d158',
                        color: '#000',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      {ossTest.loading ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
                      测试 OSS 连通性
                    </button>

                    {ossTest.success && (
                      <span style={{ fontSize: '12px', color: '#30d158', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <CheckCircle2 size={14} /> {ossTest.msg}
                      </span>
                    )}
                    {ossTest.err && (
                      <span style={{ fontSize: '12px', color: 'var(--color-danger, #ff453a)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} /> {ossTest.err}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: 完成配置 */}
              {step === 5 && (
                <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'center', padding: '10px 0' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(48, 209, 88, 0.15)',
                      color: '#30d158',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                    配置准备就绪！
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                    您已成功设置必要的凭证。点击下方按钮即可保存并开始体验 ReaderQ。
                  </p>

                  {/* 状态总览 */}
                  <div style={{ maxWidth: '440px', margin: '0 auto 24px', textAlign: 'left', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '14px 18px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={14} style={{ color: '#007aff' }} /> Readwise 同步</span>
                      <span style={{ color: formData.readwise_token ? '#30d158' : 'var(--color-text-tertiary)', fontWeight: '600' }}>
                        {formData.readwise_token ? '已设置' : '未设置'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Bot size={14} style={{ color: '#ffd700' }} /> AI 引擎 ({formData.openai_model})</span>
                      <span style={{ color: formData.openai_api_key ? '#30d158' : 'var(--color-text-tertiary)', fontWeight: '600' }}>
                        {formData.openai_api_key ? '已设置' : '未设置'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cloud size={14} style={{ color: '#30d158' }} /> 阿里云 OSS</span>
                      <span style={{ color: formData.oss_access_key_id ? '#30d158' : 'var(--color-text-tertiary)', fontWeight: '600' }}>
                        {formData.oss_access_key_id ? '已设置' : '未设置 (可选)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底栏按钮 Navigation Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-secondary, #2c2c2e)',
          }}
        >
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '500',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--color-text-primary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> 上一步
            </button>
          ) : <div />}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: 'var(--color-accent, #007aff)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              下一步 <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                backgroundColor: '#30d158',
                color: '#000000',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(48, 209, 88, 0.3)',
              }}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              保存并进入 ReaderQ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
