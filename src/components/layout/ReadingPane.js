'use client';

import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { formatDate, extractDomain, CATEGORY_LABELS } from '@/lib/utils';

export default function ReadingPane() {
  const { selectedDoc, setShowAiPanel, showAiPanel } = useApp();
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
          {selectedDoc.html_content ? (
            <div
              className="reading-article-body"
              dangerouslySetInnerHTML={{ __html: selectedDoc.html_content }}
            />
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
