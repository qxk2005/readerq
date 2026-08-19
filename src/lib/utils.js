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
    let domain = u.hostname.replace(/^www\./, '');
    if (domain.length > 24) {
      const parts = domain.split('.');
      if (parts.length >= 2) {
        const ext = parts.pop();
        const main = parts.join('.');
        if (main.length > 18) {
          domain = `${main.substring(0, 10)}...${main.slice(-4)}.${ext}`;
        }
      }
    }
    return domain;
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
 * 预处理 Markdown 原文引用锚点：超强容错清洗与 URI 编码
 * 解决嵌套括号 (如 (eKB))、空格、冒号变体等导致 Markdown 解析为 plain text 的问题
 */
export function sanitizeMarkdownQuotes(markdown) {
  if (!markdown) return '';

  let result = '';
  let i = 0;
  const len = markdown.length;

  while (i < len) {
    if (markdown[i] === '[') {
      // 查找闭合 ]
      let closeBracket = -1;
      for (let j = i + 1; j < len; j++) {
        if (markdown[j] === '\n') break;
        if (markdown[j] === ']') {
          closeBracket = j;
          break;
        }
      }

      if (closeBracket !== -1) {
        // 查找可能带空白的 (
        let parenStart = -1;
        let k = closeBracket + 1;
        while (k < len && (markdown[k] === ' ' || markdown[k] === '\t')) k++;
        if (k < len && markdown[k] === '(') {
          parenStart = k;
        }

        if (parenStart !== -1) {
          // 查找匹配的闭合 )，支持内部嵌套括号 (如 (eKB))
          let parenDepth = 1;
          let parenEnd = -1;
          for (let m = parenStart + 1; m < len; m++) {
            if (markdown[m] === '\n') break;
            if (markdown[m] === '(') {
              parenDepth++;
            } else if (markdown[m] === ')') {
              parenDepth--;
              if (parenDepth === 0) {
                parenEnd = m;
                break;
              }
            }
          }

          if (parenEnd !== -1) {
            const rawLabel = markdown.slice(i + 1, closeBracket);
            const insideParen = markdown.slice(parenStart + 1, parenEnd).trim();

            // 检查是否为 quote 引用链接变体
            const quotePrefixMatch = insideParen.match(/^(?:#quote-|#quote:|quote:|#quote\s+)(.*)$/s);
            if (quotePrefixMatch) {
              const rawQuote = quotePrefixMatch[1];
              const cleanQuote = rawQuote.trim().replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();
              let cleanLabel = rawLabel.trim().replace(/^🔗\s*/, '');
              if (!cleanLabel || cleanLabel === '原文' || cleanLabel === 'quote' || cleanLabel === '来源' || cleanLabel === '查看原文' || cleanLabel === '引用') {
                cleanLabel = '原文';
              }

              let encodedQuote = cleanQuote;
              try {
                const decoded = decodeURIComponent(cleanQuote);
                encodedQuote = encodeURIComponent(decoded);
              } catch {
                encodedQuote = encodeURIComponent(cleanQuote);
              }

              result += `[${cleanLabel}](#quote-${encodedQuote})`;
              i = parenEnd + 1;
              continue;
            }
          }
        }
      }
    }

    result += markdown[i];
    i++;
  }

  return result;
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

