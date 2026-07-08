/**
 * 工具函数集
 */

/**
 * 从 URL 提取域名
 */
export function extractDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 格式化日期为中文友好格式
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 估算阅读时间
 */
export function estimateReadingTime(wordCount) {
  if (!wordCount) return '';
  const minutes = Math.ceil(wordCount / 200);
  if (minutes < 1) return '不到 1 分钟';
  return `${minutes} 分钟`;
}

/**
 * 阅读进度百分比
 */
export function formatProgress(progress) {
  if (!progress && progress !== 0) return '0%';
  return `${Math.round(progress * 100)}%`;
}

/**
 * 文档类别的中文标签
 */
export const CATEGORY_LABELS = {
  article: '文章',
  email: '邮件',
  rss: 'RSS',
  highlight: '高亮',
  note: '笔记',
  pdf: 'PDF',
  epub: '电子书',
  tweet: '推文',
  video: '视频',
};

/**
 * 文档位置的中文标签
 */
export const LOCATION_LABELS = {
  new: '收件箱',
  later: '稍后阅读',
  shortlist: '短列表',
  archive: '归档',
  feed: '订阅源',
  trash: '垃圾箱',
};

/**
 * 文档类别的图标
 */
export const CATEGORY_ICONS = {
  article: '📄',
  email: '📧',
  rss: '📡',
  highlight: '🖍️',
  note: '📝',
  pdf: '📑',
  epub: '📚',
  tweet: '🐦',
  video: '🎬',
};

/**
 * 导航项的图标
 */
export const LOCATION_ICONS = {
  new: '📥',
  later: '🕐',
  shortlist: '⭐',
  archive: '📦',
  feed: '📡',
  trash: '🗑️',
};

/**
 * 截断文本
 */
export function truncateText(text, maxLength = 150) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * 从 HTML 提取纯文本
 */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 生成随机 ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * 防抖函数
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * 高亮颜色选项
 */
export const HIGHLIGHT_COLORS = [
  { name: '黄色', value: '#fef08a', key: 'yellow' },
  { name: '绿色', value: '#bbf7d0', key: 'green' },
  { name: '蓝色', value: '#bfdbfe', key: 'blue' },
  { name: '紫色', value: '#ddd6fe', key: 'purple' },
  { name: '红色', value: '#fecaca', key: 'red' },
];
