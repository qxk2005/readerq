'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function AddUrlModal() {
  const { showAddUrl, setShowAddUrl, saveDocument } = useApp();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await saveDocument(url.trim());
      setUrl('');
      setShowAddUrl(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!showAddUrl) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowAddUrl(false)}>
      <div className="modal" style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">➕ 添加文章</h2>
          <button className="btn-icon" onClick={() => setShowAddUrl(false)}>✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">文章 URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                required
              />
              <div className="form-hint">
                输入文章网址，将自动保存到你的 Readwise Reader
              </div>
            </div>

            {error && (
              <div style={{
                padding: 'var(--space-3)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !url.trim()}
              style={{ width: '100%' }}
            >
              {isLoading ? '保存中...' : '保存到 Reader'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
