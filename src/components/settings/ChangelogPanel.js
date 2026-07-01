'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, CheckCircle2, Download, ExternalLink, Clock, Tag, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Package } from 'lucide-react';

/**
 * 简单的语义版本比较
 * 返回: 1 (a > b), -1 (a < b), 0 (a === b)
 */
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化日期为相对时间
 */
function formatRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

/**
 * 简单的 Markdown 到文本渲染
 * 将常见 Markdown 格式转为带样式的 HTML
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} style={{
          margin: '4px 0 8px 0',
          paddingLeft: '18px',
          listStyle: 'disc',
          color: 'var(--color-text-secondary)',
          fontSize: '12px',
          lineHeight: '1.7',
        }}>
          {listItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // 标题
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <div key={`h3-${i}`} style={{
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--color-text-primary)',
          marginTop: '8px',
          marginBottom: '4px',
        }}>
          {trimmed.slice(4)}
        </div>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={`h2-${i}`} style={{
          fontSize: '13px',
          fontWeight: '600',
          color: 'var(--color-text-primary)',
          marginTop: '10px',
          marginBottom: '4px',
        }}>
          {trimmed.slice(3)}
        </div>
      );
      continue;
    }

    // 列表项
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // 处理加粗
      let content = trimmed.slice(2);
      content = content.replace(/\*\*(.*?)\*\*/g, '⟨$1⟩'); // 简易加粗标记
      listItems.push(content);
      continue;
    }

    // 普通段落
    flushList();
    elements.push(
      <p key={`p-${i}`} style={{
        margin: '4px 0',
        color: 'var(--color-text-secondary)',
        fontSize: '12px',
        lineHeight: '1.6',
      }}>
        {trimmed}
      </p>
    );
  }

  flushList();
  return elements;
}


export default function ChangelogPanel({ onClose }) {
  const [releases, setReleases] = useState([]);
  const [currentVersion, setCurrentVersion] = useState('unknown');
  const [latestVersion, setLatestVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedVersions, setExpandedVersions] = useState(new Set());

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/releases');
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setReleases(data.releases || []);
      setCurrentVersion(data.currentVersion || 'unknown');

      // 找出最新的非预发布版本
      const latest = (data.releases || []).find(r => !r.prerelease);
      if (latest) {
        setLatestVersion(latest.tag_name);
        // 自动展开最新版本
        setExpandedVersions(new Set([latest.tag_name]));
      }
    } catch (err) {
      console.error('获取版本信息失败:', err);
      setError(err.message || '获取版本信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const currentVersionTag = currentVersion !== 'unknown' ? `v${currentVersion}` : null;
  const hasUpdate = currentVersionTag && latestVersion && compareVersions(latestVersion, currentVersionTag) > 0;
  const isLatest = currentVersionTag && latestVersion && compareVersions(latestVersion, currentVersionTag) <= 0;

  const toggleExpand = (tagName) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: '520px',
        maxHeight: '80vh',
        background: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-xl, 16px)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Package size={20} />
            更新历史
          </h2>
          <button
            className="btn-icon"
            onClick={onClose}
            style={{ fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px 24px',
        }}>

          {/* 版本对比卡片 */}
          {!loading && !error && (
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '20px',
              border: '1px solid',
              borderColor: hasUpdate ? 'rgba(99, 102, 241, 0.3)' : 'rgba(34, 197, 94, 0.3)',
              background: hasUpdate ? 'rgba(99, 102, 241, 0.05)' : 'rgba(34, 197, 94, 0.05)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: hasUpdate ? '12px' : '0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasUpdate ? (
                    <ArrowUpCircle size={20} style={{ color: 'var(--color-accent)' }} />
                  ) : (
                    <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
                  )}
                  <span style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    color: hasUpdate ? 'var(--color-accent)' : 'var(--color-success)',
                  }}>
                    {hasUpdate ? '有新版本可用！' : '已是最新版本'}
                  </span>
                </div>
                {!hasUpdate && currentVersionTag && (
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-bg-tertiary)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}>
                    {currentVersionTag}
                  </span>
                )}
              </div>

              {hasUpdate && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                  }}>
                    <span style={{
                      background: 'var(--color-bg-tertiary)',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                    }}>
                      当前 {currentVersionTag}
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                    <span style={{
                      background: 'var(--color-accent)',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      最新 {latestVersion}
                    </span>
                  </div>

                  {/* 找到最新版的下载链接 */}
                  {(() => {
                    const latest = releases.find(r => r.tag_name === latestVersion);
                    if (latest && latest.html_url) {
                      return (
                        <a
                          href={latest.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: 'var(--color-accent)',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          <Download size={14} />
                          前往下载
                        </a>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              gap: '12px',
              color: 'var(--color-text-tertiary)',
            }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>正在获取版本信息...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '16px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-danger)',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '8px',
              }}>
                <AlertCircle size={16} />
                获取版本信息失败
              </div>
              <p style={{
                margin: '0 0 12px',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
              }}>
                {error}
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchReleases}
                style={{ fontSize: '12px' }}
              >
                <RefreshCw size={12} style={{ marginRight: '4px' }} />
                重试
              </button>
            </div>
          )}

          {/* Version Timeline */}
          {!loading && !error && releases.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* 时间线左侧竖线 */}
              <div style={{
                position: 'absolute',
                left: '8px',
                top: '16px',
                bottom: '16px',
                width: '2px',
                background: 'var(--color-border)',
                zIndex: 0,
              }} />

              {releases.map((release, index) => {
                const isExpanded = expandedVersions.has(release.tag_name);
                const isCurrent = currentVersionTag === release.tag_name;
                const isLatestRelease = index === 0 && !release.prerelease;

                return (
                  <div key={release.tag_name} style={{
                    position: 'relative',
                    paddingLeft: '28px',
                    marginBottom: '4px',
                  }}>
                    {/* 时间线节点 */}
                    <div style={{
                      position: 'absolute',
                      left: '2px',
                      top: '14px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: isCurrent
                        ? 'var(--color-accent)'
                        : isLatestRelease
                        ? 'var(--color-success)'
                        : 'var(--color-bg-primary)',
                      border: `2px solid ${isCurrent ? 'var(--color-accent)' : isLatestRelease ? 'var(--color-success)' : 'var(--color-border)'}`,
                      zIndex: 1,
                    }} />

                    {/* 版本卡片 */}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid',
                      borderColor: isCurrent ? 'rgba(99, 102, 241, 0.2)' : 'var(--color-border-light)',
                      background: isCurrent ? 'rgba(99, 102, 241, 0.03)' : 'var(--color-bg-secondary)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                      onClick={() => toggleExpand(release.tag_name)}
                      onMouseEnter={e => {
                        if (!isCurrent) e.currentTarget.style.background = 'var(--color-bg-hover)';
                      }}
                      onMouseLeave={e => {
                        if (!isCurrent) e.currentTarget.style.background = 'var(--color-bg-secondary)';
                      }}
                    >
                      {/* 标题行 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: 1,
                          minWidth: 0,
                        }}>
                          <span style={{
                            fontWeight: '600',
                            fontSize: '13px',
                            color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-primary)',
                            whiteSpace: 'nowrap',
                          }}>
                            {release.tag_name}
                          </span>

                          {isCurrent && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              background: 'var(--color-accent)',
                              color: '#fff',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}>
                              当前
                            </span>
                          )}

                          {release.prerelease && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'rgb(217, 119, 6)',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}>
                              预发布
                            </span>
                          )}

                          {release.name && release.name !== release.tag_name && (
                            <span style={{
                              fontSize: '12px',
                              color: 'var(--color-text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {release.name}
                            </span>
                          )}
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexShrink: 0,
                        }}>
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}>
                            <Clock size={11} />
                            {formatRelativeDate(release.published_at)}
                          </span>
                          {isExpanded ? <ChevronUp size={14} color="var(--color-text-tertiary)" /> : <ChevronDown size={14} color="var(--color-text-tertiary)" />}
                        </div>
                      </div>

                      {/* 展开内容 */}
                      {isExpanded && (
                        <div style={{ marginTop: '10px' }}>
                          {/* 变更说明 */}
                          {release.body ? (
                            <div style={{
                              padding: '10px 12px',
                              background: 'var(--color-bg-primary)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-light)',
                              marginBottom: release.assets.length > 0 ? '10px' : '0',
                            }}>
                              {renderMarkdown(release.body)}
                            </div>
                          ) : (
                            <p style={{
                              margin: '0 0 8px',
                              color: 'var(--color-text-tertiary)',
                              fontSize: '12px',
                              fontStyle: 'italic',
                            }}>
                              暂无变更说明
                            </p>
                          )}

                          {/* 下载资源 */}
                          {release.assets.length > 0 && (
                            <div>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: 'var(--color-text-secondary)',
                                marginBottom: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                <Download size={11} />
                                下载
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {release.assets.map(asset => (
                                  <a
                                    key={asset.name}
                                    href={asset.download_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'var(--color-bg-primary)',
                                      border: '1px solid var(--color-border-light)',
                                      textDecoration: 'none',
                                      fontSize: '12px',
                                      color: 'var(--color-text-link)',
                                      transition: 'border-color 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-light)'}
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Package size={12} />
                                      {asset.name}
                                    </span>
                                    <span style={{
                                      color: 'var(--color-text-tertiary)',
                                      fontSize: '11px',
                                    }}>
                                      {formatFileSize(asset.size)}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* GitHub 链接 */}
                          <div style={{ marginTop: '8px', textAlign: 'right' }}>
                            <a
                              href={release.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-text-tertiary)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-link)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                            >
                              在 GitHub 上查看
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && releases.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--color-text-tertiary)',
            }}>
              <Tag size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px', margin: 0 }}>暂无发布版本</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
