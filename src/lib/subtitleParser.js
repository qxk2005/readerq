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

/**
 * 解析标准 SRT 字幕文件内容
 * SRT 格式示例:
 * ```
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * Hello World
 *
 * 2
 * 00:00:05,000 --> 00:00:08,000
 * This is a subtitle
 * ```
 * 
 * @param {string} srtContent - 原始 SRT 文件文本
 * @returns {Array<{time: number, timeStr: string, text: string}>} 字幕段落数组
 */
export function parseSRT(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') return [];

  const segments = [];

  // 按空行分割各个字幕块
  const blocks = srtContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // 查找时间轴行 (包含 -->)
    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex < 0) continue;

    // 解析开始时间 "00:01:23,456 --> 00:01:27,890"
    const timeParts = lines[timeLineIndex].split('-->');
    if (timeParts.length < 2) continue;

    const startTimeStr = timeParts[0].trim();
    const startSeconds = parseSRTTimestamp(startTimeStr);

    // 提取文本内容 (时间轴行之后的所有行)
    const textLines = lines.slice(timeLineIndex + 1);
    const text = textLines
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join(' ');

    if (text) {
      segments.push({
        time: startSeconds,
        timeStr: formatTimestamp(startSeconds),
        text: text,
      });
    }
  }

  // 🎯 智能合并分段：确保段落阅读流畅，且单段时长严格不超过 10 秒
  return mergeSubtitlesSmartly(segments, 10);
}

/**
 * 智能合并字幕段落
 * 规则：
 * 1. 单个合并段落的时长不超过 maxDuration (默认 10 秒)
 * 2. 保留第一条句子的精准起始时间 time 和 timeStr
 * 3. 避免单句过于碎片化，提高阅读体验
 * 
 * @param {Array<{time: number, timeStr: string, text: string, duration?: number}>} segments - 原始字幕段落
 * @param {number} [maxDuration=10] - 单个段落的最大秒数限制
 * @returns {Array<{time: number, timeStr: string, text: string, duration?: number}>} 合并后的字幕段落
 */
export function mergeSubtitlesSmartly(segments, maxDuration = 10) {
  if (!segments || segments.length === 0) return [];

  // 🎯 核心排序保障：先按时间戳升序严格排序，防止原始数据倒序或错乱
  const sortedInput = [...segments].sort((a, b) => (a.time || 0) - (b.time || 0));
  
  const merged = [];
  let currentGroup = [];
  let groupStartTime = null;

  for (let i = 0; i < sortedInput.length; i++) {
    const seg = sortedInput[i];
    const segTime = typeof seg.time === 'number' ? seg.time : parseTimestamp(seg.timeStr);
    
    if (currentGroup.length === 0) {
      currentGroup.push(seg);
      groupStartTime = segTime;
    } else {
      const durationSpan = segTime - groupStartTime;
      const lastSegInGroup = currentGroup[currentGroup.length - 1];
      const lastText = lastSegInGroup.text.trim();
      const sentenceEnded = /[。！？.!?]$/.test(lastText);

      // 如果加进当前句后时长超过 10 秒，或者前一句已经是完整句子且当前组合已包含足够内容，则封包当前组
      if (durationSpan >= maxDuration || (sentenceEnded && durationSpan >= 5)) {
        merged.push({
          time: currentGroup[0].time,
          timeStr: currentGroup[0].timeStr || formatTimestamp(currentGroup[0].time),
          text: currentGroup.map(s => s.text.trim()).join(' '),
          zh: currentGroup.map(s => s.zh || '').filter(Boolean).join(' ') || undefined,
          en: currentGroup.map(s => s.en || '').filter(Boolean).join(' ') || undefined,
          duration: segTime - currentGroup[0].time
        });
        currentGroup = [seg];
        groupStartTime = segTime;
      } else {
        currentGroup.push(seg);
      }
    }
  }

  if (currentGroup.length > 0) {
    merged.push({
      time: currentGroup[0].time,
      timeStr: currentGroup[0].timeStr || formatTimestamp(currentGroup[0].time),
      text: currentGroup.map(s => s.text.trim()).join(' '),
      zh: currentGroup.map(s => s.zh || '').filter(Boolean).join(' ') || undefined,
      en: currentGroup.map(s => s.en || '').filter(Boolean).join(' ') || undefined,
      duration: Math.max(2, (currentGroup[currentGroup.length - 1].time || 0) - currentGroup[0].time + 3)
    });
  }

  // 🎯 强制二次拆分：如果某段文字超过 120 个字符，二次切分为易读小段
  return splitLongSegments(merged, 120);
}

/**
 * 将超长段落按标点符号或字符长度 (上限 120 字符) 进行安全二次拆分
 * 避免大段文本挤在一个卡片中，并确保拆分后前半段绝对锁定初始时间戳 seg.time
 */
export function splitLongSegments(segments, maxChars = 120) {
  if (!segments || segments.length === 0) return [];
  const result = [];

  for (const seg of segments) {
    const text = (seg.text || '').trim();
    if (text.length <= maxChars) {
      result.push(seg);
      continue;
    }

    // 超过 maxChars 时按标点符号 (。！？.!?\n) 拆分
    const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
    let currentChunk = '';
    let chunkStartTime = typeof seg.time === 'number' ? seg.time : parseTimestamp(seg.timeStr);
    let totalTextLen = text.length;
    let processedLen = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
        // 保存前半段 chunk (时间绝对保持 chunkStartTime)
        result.push({
          ...seg,
          time: chunkStartTime,
          timeStr: formatTimestamp(chunkStartTime),
          text: currentChunk.trim(),
        });

        // 推进已处理文本长度，并为下一段计算准确递增的时间戳
        processedLen += currentChunk.length;
        const ratio = processedLen / totalTextLen;
        const timeOffset = (seg.duration || 10) * ratio;
        chunkStartTime = Math.round(((seg.time || 0) + timeOffset) * 10) / 10;

        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      result.push({
        ...seg,
        time: chunkStartTime,
        timeStr: formatTimestamp(chunkStartTime),
        text: currentChunk.trim(),
      });
    }
  }

  result.sort((a, b) => (a.time || 0) - (b.time || 0));
  return result;
}

/**
 * 解析 SRT 时间戳为秒数
 * 支持格式: "00:01:23,456" 或 "00:01:23.456"
 * @param {string} timeStr - SRT 时间戳
 * @returns {number} 秒数
 */
function parseSRTTimestamp(timeStr) {
  if (!timeStr) return 0;
  // 将逗号替换为点号以统一处理毫秒
  const normalized = timeStr.replace(',', '.');
  const match = normalized.match(/(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!match) return 0;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, '0').substring(0, 3), 10) : 0;

  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

