import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';

export default function GhostReader() {
  const { showAiPanel, setShowAiPanel, selectedDoc, updateDocumentLocally } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [actionStage, setActionStage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const messagesEndRef = useRef(null);

  // 快速操作的计时器
  useEffect(() => {
    let interval;
    if (isLoading && activeAction !== 'chat') {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isLoading, activeAction]);

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

  const handleAddToNote = async () => {
    if (!selectedDoc || !actionResult || typeof actionResult !== 'string') return;
    setIsSavingNote(true);
    try {
      const existingNote = selectedDoc.notes || '';
      let newNote;
      if (existingNote.trim() === '') {
        newNote = actionResult;
      } else {
        newNote = `${existingNote.trim()}\n\n---\n\n${actionResult}`;
      }
      
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNote })
      });
      
      if (!res.ok) throw new Error('网络请求失败');
      
      updateDocumentLocally(selectedDoc.id, { notes: newNote });
      
      const originalResult = actionResult;
      setActionResult('✅ 成功添加到文章备注！');
      setTimeout(() => setActionResult(originalResult), 1500);
    } catch (err) {
      alert('添加备注失败: ' + err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  // AI 快速操作
  const runAction = useCallback(async (action) => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setActiveAction(action);
    setActionResult(null);
    setActionStage('extract');

    try {
      let endpoint, body;
      switch (action) {
        case 'summarize':
          endpoint = '/api/ai/summarize';
          const contentText = selectedDoc.html_content 
            ? selectedDoc.html_content.replace(/<[^>]+>/g, ' ').substring(0, 8000)
            : (selectedDoc.summary || selectedDoc.title);
          body = { title: selectedDoc.title, content: contentText };
          break;
        case 'translate':
          endpoint = '/api/ai/translate';
          const translateText = selectedDoc.html_content 
            ? selectedDoc.html_content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 4000)
            : (selectedDoc.summary || selectedDoc.title);
          body = { text: translateText || selectedDoc.title };
          break;
        case 'simplify':
          endpoint = '/api/ai/simplify';
          const simplifyText = selectedDoc.html_content 
            ? selectedDoc.html_content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 4000)
            : (selectedDoc.summary || selectedDoc.title);
          body = { text: simplifyText || selectedDoc.title };
          break;
        case 'define':
          endpoint = '/api/ai/define';
          body = { text: selectedDoc.title, context: selectedDoc.summary };
          break;
        default:
          return;
      }

      // 阶段二: 向 AI 接口发送请求
      setTimeout(() => setActionStage('request'), 500);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // 阶段三: AI 正在撰写结果
      setActionStage('writing');

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `服务器响应错误 (状态码: ${res.status})`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setActionResult(data.summary || data.result || '无返回结果');
    } catch (err) {
      setActionResult({ error: err.message || '未知错误' });
    } finally {
      setIsLoading(false);
      setActionStage('');
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

    // 预先放置一个空的助手消息用于接收流式响应
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          documentContext: getDocumentContext(),
        }),
      });

      if (!res.ok) {
        throw new Error(`服务器返回错误 (状态码: ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;

        // 实时更新最新那条助手回复的内容
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = assistantText;
          }
          return updated;
        });
        setTimeout(scrollToBottom, 50);
      }

      // 流式结束，去除 isStreaming 标记
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isStreaming = false;
        }
        return updated;
      });

    } catch (err) {
      console.error('AI 对话流处理失败:', err);
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = `错误: ${err.message || '获取回复失败，请检查网络或 AI 接口设置'}`;
          lastMsg.isStreaming = false;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [input, messages, isLoading, selectedDoc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
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
            
            {actionResult.error ? (
              <div style={{
                padding: 'var(--space-3)',
                background: 'rgba(239, 68, 68, 0.06)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-xs)',
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>❌ 执行失败</div>
                <div style={{ marginBottom: 'var(--space-2)', lineHeight: '1.5' }}>{actionResult.error}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', padding: 'var(--space-2)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  💡 <b>排障建议:</b> 请检查您的网络连接或代理设置。如需调整 AI 配置，可点击右上角<b>设置 ⚙️</b>，重新填写 API Key、Base URL 并测试连接。
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {actionResult}
                </div>
                {typeof actionResult === 'string' && !actionResult.startsWith('✅') && (
                  <button 
                    onClick={handleAddToNote}
                    disabled={isSavingNote}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: isSavingNote ? 'not-allowed' : 'pointer',
                      opacity: isSavingNote ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { if (!isSavingNote) { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.borderColor = 'var(--color-text-tertiary)'; } }}
                    onMouseOut={(e) => { if (!isSavingNote) { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border)'; } }}
                  >
                    <span>{isSavingNote ? '⏳' : '📝'}</span>
                    {isSavingNote ? '添加中...' : '添加到文章备注'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 正在进行快速操作的阶段性 Loading 卡片 */}
        {isLoading && activeAction !== 'chat' && (
          <div className="chat-message assistant" style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-accent)' }}>
            <div style={{ fontWeight: '600', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>
              {activeAction === 'summarize' && '📋 正在生成摘要...'}
              {activeAction === 'translate' && '🌐 正在翻译中...'}
              {activeAction === 'simplify' && '✨ 正在简化文本...'}
              {activeAction === 'define' && '📖 正在查询解释...'}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: actionStage === 'extract' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                {actionStage === 'extract' ? (
                  <span className="loading-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-loading 1s linear infinite' }} />
                ) : '✓'}
                <span>阶段一: 📄 正在提取并格式化文章内容...</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: actionStage === 'request' ? 'var(--color-text-primary)' : (actionStage === 'extract' ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)') }}>
                {actionStage === 'request' ? (
                  <span className="loading-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-loading 1s linear infinite' }} />
                ) : (actionStage === 'extract' ? '⚪' : '✓')}
                <span>阶段二: 📡 正在向 AI 模型发送请求...</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: actionStage === 'writing' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                {actionStage === 'writing' ? (
                  <span className="loading-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-loading 1s linear infinite' }} />
                ) : '⚪'}
                <span>阶段三: ✍️ AI 正在撰写结果...</span>
              </div>
              
              <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                已耗时: {elapsedTime} 秒
              </div>
            </div>
          </div>
        )}

        {/* 聊天消息 */}
        <div className="chat-messages">
          {/* 微动画 CSS 注入 */}
          <style>{`
            @keyframes spin-loading {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse-think {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>

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
              {msg.role === 'assistant' && msg.content === '' && msg.isStreaming ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', animation: 'pulse-think 1.5s infinite ease-in-out' }}>
                  <span className="loading-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-loading 1s linear infinite' }} />
                  <span>🤖 GhostReader 正在思考...</span>
                </div>
              ) : (
                msg.content
              )}
            </div>
          ))}
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
