/**
 * 字幕解析工具
 * 从 Readwise 同步的 html_content 中提取带时间戳的字幕段落
 */

/**
 * 将时间戳字符串解析为秒数
 * 支持格式: "0:00", "00:00", "1:23:45", "01:23:45"
 * @param {string} timeStr - 时间戳字符串
 * @returns {number} 秒数
 */
export function parseTimestamp(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * 将秒数格式化为可读的时间戳
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间戳 (mm:ss 或 hh:mm:ss)
 */
export function formatTimestamp(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(sec)}`;
  }
  return `${m}:${pad(sec)}`;
}

/**
 * 从 HTML 内容中提取字幕段落
 * Readwise Reader 对 YouTube 视频的 html_content 通常包含带有时间戳的转录文本
 * 
 * 支持的格式：
 * 1. 纯文本中嵌入的时间戳标记，如 "0:00 前言介绍 0:49 AI Agent是什么"
 * 2. HTML 中带 data-timestamp 属性的元素
 * 3. 段落前缀时间戳，如 "<p>0:00 前言介绍</p>"
 * 
 * @param {string} htmlContent - 原始 HTML 内容
 * @returns {Array<{time: number, timeStr: string, text: string}>} 字幕段落数组
 */
export function parseSubtitles(htmlContent) {
  if (!htmlContent) return [];

  // 先去除 HTML 标签，获取纯文本
  const textContent = stripHtml(htmlContent);

  // 尝试按时间戳分割文本
  // 匹配 "0:00", "00:00", "1:23:45" 等格式的时间戳
  const timestampRegex = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)\s/g;
  const segments = [];
  let lastIndex = 0;
  let lastTime = null;
  let lastTimeStr = null;
  let match;

  // 收集所有时间戳的位置
  const timestamps = [];
  while ((match = timestampRegex.exec(textContent)) !== null) {
    timestamps.push({
      time: parseTimestamp(match[1]),
      timeStr: match[1],
      index: match.index,
      fullMatchLength: match[0].length,
      valueStart: match.index + match[0].indexOf(match[1]),
    });
  }

  if (timestamps.length === 0) {
    // 没有找到时间戳，尝试按段落分割
    return parseByParagraphs(htmlContent);
  }

  // 按时间戳分割文本
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const nextTs = timestamps[i + 1];
    const textStart = ts.valueStart + ts.timeStr.length;
    const textEnd = nextTs ? nextTs.index : textContent.length;
    const text = textContent.substring(textStart, textEnd).trim();

    if (text) {
      segments.push({
        time: ts.time,
        timeStr: ts.timeStr,
        text: text,
      });
    }
  }

  return segments;
}

/**
 * 当没有时间戳时，按段落分割内容
 * @param {string} htmlContent - HTML 内容
 * @returns {Array<{time: number, timeStr: string, text: string}>}
 */
function parseByParagraphs(htmlContent) {
  // 按 <p>, <br>, <div> 等标签分割
  const blocks = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map(s => decodeHtmlEntities(s.trim()))
    .filter(s => s.length > 0);

  // 没有时间戳，为每个段落分配递增的伪时间戳
  return blocks.map((text, index) => ({
    time: index * 30, // 每段假设 30 秒
    timeStr: formatTimestamp(index * 30),
    text,
    estimated: true, // 标记为估算时间
  }));
}

/**
 * 去除 HTML 标签，保留纯文本
 */
function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|div|h[1-6]|li)>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  );
}

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => entities[m] || m);
}

/**
 * 从 URL 中提取 YouTube 视频 ID
 * 支持多种 YouTube URL 格式
 * @param {string} url - YouTube URL
 * @returns {string|null} 视频 ID 或 null
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  
  // 支持的格式:
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/v/VIDEO_ID
  // https://m.youtube.com/watch?v=VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * 将字幕段落格式化为可传递给 AI 的纯文本（含时间戳）
 * @param {Array} segments - parseSubtitles 的返回值
 * @returns {string} 格式化的字幕文本
 */
export function formatSubtitlesForAI(segments) {
  if (!segments || segments.length === 0) return '';
  return segments
    .map(seg => `[${seg.timeStr}] ${seg.text}`)
    .join('\n\n');
}
