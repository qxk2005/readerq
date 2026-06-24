'use client';

import { useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

export default function GhostReader() {
  const { showAiPanel, setShowAiPanel, selectedDoc } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDocumentContext = () => {
    if (!selectedDoc) return null;
    return [
      selectedDoc.title && `标题: ${selectedDoc.title}`,
      selectedDoc.author && `作者: ${selectedDoc.author}`,
      selectedDoc.summary && `摘要: ${selectedDoc.summary}`,
      selectedDoc.html_content && `正文: ${selectedDoc.html_content.substring(0, 4000)}`,
    ].filter(Boolean).join('\n\n');
  };

  // AI 快速操作
  const runAction = useCallback(async (action) => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setActiveAction(action);
    setActionResult(null);

    try {
      let endpoint, body;
      switch (action) {
        case 'summarize':
          endpoint = '/api/ai/summarize';
          body = { title: selectedDoc.title, content: selectedDoc.summary || selectedDoc.title };
          break;
        case 'translate':
          endpoint = '/api/ai/translate';
          body = { text: selectedDoc.summary || selectedDoc.title };
          break;
        case 'simplify':
          endpoint = '/api/ai/simplify';
          body = { text: selectedDoc.summary || selectedDoc.title };
          break;
        case 'define':
          endpoint = '/api/ai/define';
          body = { text: selectedDoc.title, context: selectedDoc.summary };
          break;
        default:
          return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setActionResult(data.summary || data.result || data.error || '无结果');
    } catch (err) {
      setActionResult(`错误: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDoc]);

  // 聊天功能
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setActiveAction('chat');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          documentContext: getDocumentContext(),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.error }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${err.message}` }]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [input, messages, isLoading, selectedDoc]);

  if (!showAiPanel) return null;

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span>🤖</span>
          <span>GhostReader AI 助手</span>
        </div>
        <button className="btn-icon" onClick={() => setShowAiPanel(false)}>✕</button>
      </div>

      <div className="ai-panel-content">
        {/* 快速操作 */}
        <div className="ai-actions">
          <button
            className="ai-action-btn"
            onClick={() => runAction('summarize')}
            disabled={!selectedDoc || isLoading}
          >
            <span className="ai-action-icon">📋</span>
            <span>生成摘要</span>
          </button>
          <button
            className="ai-action-btn"
            onClick={() => runAction('translate')}
            disabled={!selectedDoc || isLoading}
          >
            <span className="ai-action-icon">🌐</span>
            <span>翻译</span>
          </button>
          <button
            className="ai-action-btn"
            onClick={() => runAction('simplify')}
            disabled={!selectedDoc || isLoading}
          >
            <span className="ai-action-icon">✨</span>
            <span>简化</span>
          </button>
          <button
            className="ai-action-btn"
            onClick={() => runAction('define')}
            disabled={!selectedDoc || isLoading}
          >
            <span className="ai-action-icon">📖</span>
            <span>解释</span>
          </button>
        </div>

        {/* 操作结果 */}
        {actionResult && activeAction !== 'chat' && (
          <div className="chat-message assistant" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: '600', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {activeAction === 'summarize' && '📋 摘要'}
              {activeAction === 'translate' && '🌐 翻译'}
              {activeAction === 'simplify' && '✨ 简化'}
              {activeAction === 'define' && '📖 解释'}
            </div>
            {actionResult}
          </div>
        )}

        {/* 聊天消息 */}
        <div className="chat-messages">
          {messages.length === 0 && !actionResult && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', padding: 'var(--space-8) 0' }}>
              {selectedDoc
                ? '选择上方操作或在下方输入问题，开始与 AI 对话'
                : '请先选择一篇文章以启用 AI 功能'
              }
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {isLoading && activeAction === 'chat' && (
            <div className="chat-message assistant">
              <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="ai-panel-footer">
        <div className="chat-input-area">
          <input
            type="text"
            placeholder={selectedDoc ? '向 AI 提问...' : '请先选择文章'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={!selectedDoc || isLoading}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={sendMessage}
            disabled={!selectedDoc || !input.trim() || isLoading}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
