'use client';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { formatDate, extractDomain, CATEGORY_LABELS } from '@/lib/utils';

export default function ReadingPane() {
  const { selectedDoc, setShowAiPanel, showAiPanel, isContentLoading, contentError, fetchDocumentDetails } = useApp();
  const { fontSize, lineHeight, contentWidth, fontFamily } = useTheme();

  if (!selectedDoc) {
    return (
      <div className="reading-panel">
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-title">选择一篇文章开始阅读</div>
          <div className="empty-state-description">
            从左侧列表中选择一篇文章，或使用 Cmd+K 打开命令面板
          </div>
        </div>
      </div>
    );
  }

  const articleFont = fontFamily === 'serif' ? 'var(--font-reading)' : 'var(--font-ui)';

  return (
    <div className="reading-panel">
      {/* 动态注入微动画 */}
      <style>{`
        @keyframes pulse-loading {
          0%, 100% { opacity: 0.5; background-color: var(--color-bg-tertiary); }
          50% { opacity: 0.9; background-color: var(--color-bg-hover); }
        }
        @keyframes spin-loading {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse-banner {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
      `}</style>
      {/* 阅读头部 */}
      <div className="reading-header">
        <div className="reading-header-left">
          {selectedDoc.source_url && (
            <a
              href={selectedDoc.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 'var(--text-xs)' }}
            >
              🔗 {extractDomain(selectedDoc.source_url)}
            </a>
          )}
          {selectedDoc.category && (
            <span className="tag-pill">
              {CATEGORY_LABELS[selectedDoc.category] || selectedDoc.category}
            </span>
          )}
          {selectedDoc.reading_progress > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              已读 {Math.round(selectedDoc.reading_progress * 100)}%
            </span>
          )}
        </div>
        <div className="reading-header-right">
          <button
            className="btn-icon"
            onClick={() => setShowAiPanel(!showAiPanel)}
            data-tooltip={showAiPanel ? '关闭 AI 助手' : '打开 AI 助手'}
            style={showAiPanel ? { color: 'var(--color-accent)' } : {}}
          >
            🤖
          </button>
        </div>
      </div>

      {/* 阅读内容 */}
      <div className="reading-content">
        <article
          className="reading-article"
          style={{
            maxWidth: `${contentWidth}px`,
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            fontFamily: articleFont,
          }}
        >
          <h1 className="reading-article-title">{selectedDoc.title || '无标题'}</h1>

          <div className="reading-article-meta">
            {selectedDoc.author && (
              <span className="reading-article-author">{selectedDoc.author}</span>
            )}
            {selectedDoc.published_date && (
              <span>{formatDate(selectedDoc.published_date)}</span>
            )}
            {selectedDoc.word_count && (
              <span>{selectedDoc.word_count} 字</span>
            )}
            {selectedDoc.reading_time && (
              <span>{selectedDoc.reading_time}</span>
            )}
          </div>

          {/* 摘要 */}
          {selectedDoc.summary && (
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-6)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.7',
              borderLeft: '3px solid var(--color-accent)',
            }}>
              <div style={{ fontWeight: '600', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                📋 摘要
              </div>
              {selectedDoc.summary}
            </div>
          )}

          {/* 文章正文 */}
          {selectedDoc.html_content !== null ? (
            selectedDoc.html_content ? (
              <div
                className="reading-article-body"
                dangerouslySetInnerHTML={{ __html: selectedDoc.html_content }}
              />
            ) : (
              <div className="reading-article-body">
                <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                  此文章未提供正文内容，或无法解析 HTML。您可以通过上方链接在原始网站阅读。
                </p>
                {selectedDoc.notes && (
                  <div style={{ marginTop: 'var(--space-6)' }}>
                    <h3>📝 笔记</h3>
                    <p>{selectedDoc.notes}</p>
                  </div>
                )}
              </div>
            )
          ) : isContentLoading ? (
            <div className="reading-article-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', margin: 'var(--space-6) 0' }}>
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-accent-light)',
                  borderLeft: '4px solid var(--color-accent)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  animation: 'pulse-banner 2s infinite ease-in-out'
                }}>
                  <span style={{ fontSize: 'var(--text-lg)', animation: 'spin-loading 2s linear infinite', display: 'inline-block' }}>🌀</span>
                  <span>正在同步并排版文章正文...</span>
                </div>
                <div style={{ height: '1.2em', width: '90%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out' }} />
                <div style={{ height: '1.2em', width: '100%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.2s' }} />
                <div style={{ height: '1.2em', width: '85%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.4s' }} />
                <div style={{ height: '1.2em', width: '95%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.6s' }} />
                <div style={{ height: '1.2em', width: '70%', borderRadius: '4px', animation: 'pulse-loading 1.5s infinite ease-in-out 0.8s' }} />
              </div>
            </div>
          ) : contentError ? (
            <div className="reading-article-body" style={{ margin: 'var(--space-6) 0' }}>
              <div style={{
                padding: 'var(--space-4)',
                background: 'rgba(239, 68, 68, 0.08)',
                borderLeft: '4px solid var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)'
              }}>
                <div style={{ fontWeight: '600', color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>⚠️ 获取正文内容失败</div>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>{contentError}</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => fetchDocumentDetails(selectedDoc.id)}
                style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-4)' }}
              >
                🔄 重新同步正文
              </button>
            </div>
          ) : (
            <div className="reading-article-body">
              <p style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                文章正文暂未加载。请先同步完整内容，或点击上方链接在原始网站阅读。
              </p>
              {selectedDoc.notes && (
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <h3>📝 笔记</h3>
                  <p>{selectedDoc.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 标签 */}
          {selectedDoc.tags && Object.keys(selectedDoc.tags).length > 0 && (
            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              marginTop: 'var(--space-8)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border-light)',
            }}>
              {Object.keys(selectedDoc.tags).map(tag => (
                <span key={tag} className="tag-pill">🏷️ {tag}</span>
              ))}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
