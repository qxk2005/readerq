'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Link, 
  Upload, 
  FileText, 
  AlertTriangle, 
  Check, 
  Globe, 
  User, 
  Tag, 
  StickyNote, 
  File, 
  Loader2,
  X
} from 'lucide-react';

export default function AddUrlModal() {
  const { showAddUrl, setShowAddUrl, saveDocument, fetchDocuments, setShowSettings } = useApp();
  const [activeTab, setActiveTab] = useState('url'); // 'url' | 'file' | 'text'
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // 1. URL 字段
  const [url, setUrl] = useState('');
  
  // 2. 文件上传字段
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // 3. 手动文本输入字段
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // 4. 公共可选字段
  const [author, setAuthor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  // 5. OSS 检测状态
  const [isOssConfigured, setIsOssConfigured] = useState(false);

  // 重置状态
  const resetForm = () => {
    setUrl('');
    setFile(null);
    setTextTitle('');
    setTextContent('');
    setAuthor('');
    setTagsInput('');
    setNotes('');
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  };

  // 监听显示状态
  useEffect(() => {
    if (showAddUrl) {
      resetForm();
      // 获取当前 OSS 配置状态
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
          setIsOssConfigured(!!data.oss_access_key_id_set);
        })
        .catch(err => console.error('获取 OSS 设置状态失败', err));
    }
  }, [showAddUrl]);

  if (!showAddUrl) return null;

  // 检查文件是否需要 OSS 中转但未配置
  const isEbook = (fileName) => {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return ['pdf', 'epub'].includes(ext);
  };

  const showOssWarning = file && isEbook(file.name) && !isOssConfigured;

  // 处理拖拽
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const allowed = ['txt', 'md', 'markdown', 'html', 'htm', 'pdf', 'epub'];
    if (!allowed.includes(ext)) {
      setError(`不支持的文件格式: .${ext}。目前支持上传 .txt, .md, .html, .pdf, .epub 格式文件。`);
      setFile(null);
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  // 统一提交逻辑
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 解析标签
    const tags = tagsInput
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      if (activeTab === 'url') {
        if (!url.trim()) return;
        // 使用原有的保存端点或直接携带更多参数
        const res = await fetch('/api/readwise/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: url.trim(),
            author: author.trim(),
            notes: notes.trim(),
            tags: tags
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

      } else if (activeTab === 'file') {
        if (!file) {
          throw new Error('请先选择或拖入一个文件');
        }
        if (isEbook(file.name) && !isOssConfigured) {
          throw new Error('未配置阿里云 OSS 存储，无法上传二进制电子书。');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.substring(0, file.name.lastIndexOf('.')));
        formData.append('author', author.trim());
        formData.append('notes', notes.trim());
        formData.append('tags', JSON.stringify(tags));

        const res = await fetch('/api/readwise/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || '上传文件失败');
        }

      } else if (activeTab === 'text') {
        if (!textTitle.trim()) {
          throw new Error('请输入文章标题');
        }
        if (!textContent.trim()) {
          throw new Error('请输入文章内容');
        }

        // 把文本包装成一个虚拟文件的 FormData 提交给 /upload
        const textBlob = new Blob([textContent], { type: 'text/markdown' });
        const virtualFile = new File([textBlob], `${textTitle}.md`, { type: 'text/markdown' });

        const formData = new FormData();
        formData.append('file', virtualFile);
        formData.append('title', textTitle.trim());
        formData.append('author', author.trim());
        formData.append('notes', notes.trim());
        formData.append('tags', JSON.stringify(tags));

        const res = await fetch('/api/readwise/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || '保存文本失败');
        }
      }

      setSuccess(true);
      await fetchDocuments(); // 刷新文档列表
      setTimeout(() => {
        setShowAddUrl(false);
      }, 1200);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSettings = () => {
    setShowAddUrl(false);
    setShowSettings(true);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowAddUrl(false)}>
      <div className="modal" style={{ width: '560px', maxWidth: '90vw', borderRadius: '16px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        
        {/* 头部 */}
        <div className="modal-header" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-lg)' }}>
            <span>➕ 添加文章或文档</span>
          </h2>
          <button className="btn-icon" onClick={() => setShowAddUrl(false)} style={{ borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* 选项卡 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-light)',
          background: 'var(--color-bg-secondary)',
          padding: '0 var(--space-4)',
        }}>
          {[
            { id: 'url', label: '网页链接', icon: <Link size={14} /> },
            { id: 'file', label: '上传文件', icon: <Upload size={14} /> },
            { id: 'text', label: '手动输入', icon: <FileText size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 'var(--space-3) var(--space-4)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="modal-body" style={{ padding: 'var(--space-4)', maxHeight: '70vh', overflowY: 'auto' }}>
          {success ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6) 0',
              textAlign: 'center',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
                marginBottom: 'var(--space-4)',
                animation: 'scaleIn 0.3s ease'
              }}>
                <Check size={28} />
              </div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '600', marginBottom: 'var(--space-2)' }}>保存成功</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>文章已成功发送至你的 ReaderQ</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              {/* Tab 1: URL */}
              {activeTab === 'url' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500' }}>文章网址 (URL)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-tertiary)' }}>
                      <Globe size={16} />
                    </span>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/article"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      style={{ paddingLeft: '38px', borderRadius: '8px' }}
                      autoFocus
                      required
                    />
                  </div>
                  <div className="form-hint" style={{ marginTop: '6px' }}>
                    输入支持抓取的文章链接，Readwise 会在后台解析其正文内容。
                  </div>
                </div>
              )}

              {/* Tab 2: File */}
              {activeTab === 'file' && (
                <div>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDragOver ? '2px dashed var(--color-accent)' : '2px dashed var(--color-border)',
                      borderRadius: '12px',
                      padding: 'var(--space-5) var(--space-4)',
                      textAlign: 'center',
                      background: isDragOver ? 'var(--color-accent-light)' : 'var(--color-bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".txt,.md,.markdown,.html,.htm,.pdf,.epub"
                      style={{ display: 'none' }}
                    />
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'var(--color-bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-secondary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>
                      <Upload size={20} />
                    </div>
                    {file ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '100%' }}>
                        <File size={16} style={{ color: 'var(--color-accent)' }} />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: '500' }}>拖拽文件到这里，或点击选择</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                          支持 TXT, MD, HTML (直接上传) 或 PDF, EPUB (使用 OSS 中转)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OSS 警示横幅 */}
                  {showOssWarning && (
                    <div style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px'
                    }}>
                      <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                        检测到您上传了电子书，但尚未配置阿里云 OSS 存储。
                        由于 Readwise API 限制，二进制文件需先托管到您的云存储。
                        请先前往设置开启配置，或通过 Readwise 网页端上传该文件。
                        <button
                          type="button"
                          onClick={handleGoToSettings}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0',
                            color: 'var(--color-accent)',
                            fontWeight: '600',
                            marginLeft: '4px',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          立即配置
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Text */}
              {activeTab === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '500' }}>标题</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="文章标题"
                      value={textTitle}
                      onChange={(e) => setTextTitle(e.target.value)}
                      style={{ borderRadius: '8px' }}
                      required={activeTab === 'text'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '500' }}>正文内容 (支持 Markdown / 纯文本)</label>
                    <textarea
                      className="form-input"
                      placeholder="在此粘贴或输入你想要保存的文章内容..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      style={{
                        minHeight: '160px',
                        borderRadius: '8px',
                        resize: 'vertical',
                        fontFamily: 'var(--font-ui)',
                        padding: '10px 12px'
                      }}
                      required={activeTab === 'text'}
                    />
                  </div>
                </div>
              )}

              {/* 可选字段折叠/默认显示（更加专业） */}
              <div style={{
                borderTop: '1px solid var(--color-border-light)',
                paddingTop: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}>
                      <User size={12} />
                      <span>作者 (可选)</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="例如: 陆奇"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      style={{ height: '34px', borderRadius: '6px', fontSize: 'var(--text-xs)' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}>
                      <Tag size={12} />
                      <span>标签 (可选，逗号/空格分隔)</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="例如: AI, 创业"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      style={{ height: '34px', borderRadius: '6px', fontSize: 'var(--text-xs)' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)' }}>
                    <StickyNote size={12} />
                    <span>备注/笔记 (可选)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入个人批注或保存说明..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', fontSize: 'var(--text-xs)' }}
                  />
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div style={{
                  padding: 'var(--space-3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '8px',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* 动作按钮 */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || (activeTab === 'file' && !file) || (activeTab === 'file' && isEbook(file?.name) && !isOssConfigured)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>正在保存到 ReaderQ...</span>
                  </>
                ) : (
                  <span>保存到 ReaderQ</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      <style jsx global>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
