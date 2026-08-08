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

  return mergeSubtitlesBySentence(segments);
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
/**
 * HTML/XML 转义字符还原
 */
export function unescapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * 按完整句子语义与优雅时间窗合并字幕卡片 (Sentence-level Subtitle Merging)
 * 1. 优先在遇到完整句号 . ! ? 或 句尾终止符时进行自然切分；
 * 2. 控制单卡片最佳时长在 3.5 ~ 8.0 秒之间，字符数在 50 ~ 140 字符之间；
 * 3. 100% 锁定首句的精确 start time，彻底消除腰斩切割与阅读割裂。
 */
export function mergeSubtitlesBySentence(segments, targetMaxDuration = 8.0, targetMinDuration = 3.5) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const merged = [];
  let currentGroup = [];
  let groupStartTime = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (currentGroup.length === 0) {
      currentGroup.push(seg);
      groupStartTime = seg.time;
    } else {
      const durationSpan = (seg.time + (seg.duration || 2.5)) - groupStartTime;
      const lastText = currentGroup[currentGroup.length - 1].text.trim();
      const sentenceEnded = /[.!?]$/.test(lastText);
      const groupChars = currentGroup.map(s => s.text).join(' ').length;

      // 条件 A: 遇到了句尾标点 且 累积时间 >= 3.5 秒 (或 字符数 >= 50)
      // 条件 B: 累积时间超过上限 8.0 秒 (或 字符数 >= 140)
      if ((sentenceEnded && (durationSpan >= targetMinDuration || groupChars >= 50)) || durationSpan >= targetMaxDuration || groupChars >= 140) {
        merged.push({
          time: currentGroup[0].time,
          timeStr: currentGroup[0].timeStr,
          text: currentGroup.map(s => s.text.trim()).join(' '),
          duration: durationSpan
        });
        currentGroup = [seg];
        groupStartTime = seg.time;
      } else {
        currentGroup.push(seg);
      }
    }
  }

  if (currentGroup.length > 0) {
    merged.push({
      time: currentGroup[0].time,
      timeStr: currentGroup[0].timeStr,
      text: currentGroup.map(s => s.text.trim()).join(' '),
      duration: Math.max(3.0, (currentGroup[currentGroup.length - 1].time || 0) - currentGroup[0].time + 2.5)
    });
  }

  return merged;
}

/**
 * 从 YouTube 原生 srv1 / ttml XML 内容中解析出零重复、100% 毫秒精准的纯正字幕段落
 */
export function parseSrv1ToSegments(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') return [];
  const regex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?>(.*?)<\/text>/gi;
  const segments = [];
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    const startSec = parseFloat(match[1]);
    const durSec = match[2] ? parseFloat(match[2]) : 3.0;
    const text = unescapeXml(match[3]);
    if (text) {
      segments.push({
        time: startSec,
        timeStr: formatTimestamp(startSec),
        duration: durSec,
        text
      });
    }
  }
  
  // 🎯 按完整句子表达进行优雅打包，彻底解决腰斩断句
  return mergeSubtitlesBySentence(segments);
}
export function cleanRollingSrtSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  // 1. 丢弃极快重叠/包含的前缀帧 (Same timestamp & substring duplicate filter)
  const clean = [];
  for (let i = 0; i < segments.length; i++) {
    const curr = segments[i];
    const next = segments[i + 1];
    if (next) {
      const cText = (curr.text || '').trim().toLowerCase();
      const nText = (next.text || '').trim().toLowerCase();
      // 如果起始时间相差小于 1.2 秒，且 next 文本包含了 curr 文本的大部分内容，说明 curr 纯属未显示完整的临时过渡帧
      if (cText.length > 0 && Math.abs((next.time || 0) - (curr.time || 0)) < 1.2 && nText.includes(cText)) {
        continue;
      }
    }
    clean.push(curr);
  }

  // 2. 二次精剪尾巴重叠短语
  const finalResult = [];
  let prevRawText = '';

  for (const seg of clean) {
    const currText = (seg.text || '').trim();
    if (!currText) continue;

    let pureText = currText;
    if (prevRawText) {
      const p = prevRawText.toLowerCase();
      const c = currText.toLowerCase();
      let maxOverlap = 0;
      const minLen = Math.min(p.length, c.length);

      for (let len = 4; len <= minLen; len++) {
        const subC = c.substring(0, len);
        if (p.endsWith(subC)) {
          maxOverlap = len;
        }
      }

      if (maxOverlap > 0) {
        pureText = currText.substring(maxOverlap).trim();
      }
    }

    if (pureText.length > 0) {
      finalResult.push({
        ...seg,
        text: pureText
      });
      prevRawText = currText;
    }
  }

  return finalResult;
}

/**
 * 智能分离可能混杂在同一字符串里的英文/外文原文与中文译文
 * @param {string} str - 待分离的文本
 * @returns {{ text: string, zh?: string }} 分离后的对象
 */
export function separateBilingualText(str) {
  if (!str || typeof str !== 'string') return { text: '', zh: undefined };
  const trimmed = str.trim();
  if (!trimmed) return { text: '', zh: undefined };

  const hasChinese = /[\u4e00-\u9fa5]/.test(trimmed);
  const hasLatin = /[a-zA-Z]/.test(trimmed);

  if (hasChinese && hasLatin) {
    // 模式 1: 英文在前面，中文在后面 (如 "In this video... 在本期视频中...")
    const matchEnFirst = trimmed.match(/^([a-zA-Z0-9\s\p{P}]+?)\s*([\u4e00-\u9fa5][\s\S]*)$/u);
    if (matchEnFirst && matchEnFirst[1].trim() && matchEnFirst[2].trim()) {
      return {
        text: matchEnFirst[1].trim(),
        zh: matchEnFirst[2].trim()
      };
    }

    // 模式 2: 中文在前面，英文在后面 (如 "在本期视频中... In this video...")
    const matchZhFirst = trimmed.match(/^([\u4e00-\u9fa5\s\p{P}]+?)\s*([a-zA-Z][\s\S]*)$/u);
    if (matchZhFirst && matchZhFirst[1].trim() && matchZhFirst[2].trim()) {
      return {
        text: matchZhFirst[2].trim(),
        zh: matchZhFirst[1].trim()
      };
    }
  }

  // 只有中文
  if (hasChinese && !hasLatin) {
    return { text: trimmed, zh: trimmed };
  }

  // 只有英文
  return { text: trimmed, zh: undefined };
}

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
    const rawLines = lines.slice(timeLineIndex + 1)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (rawLines.length === 0) continue;

    let segmentText = '';
    let segmentZh = undefined;

    if (rawLines.length === 1) {
      const sep = separateBilingualText(rawLines[0]);
      segmentText = sep.text;
      segmentZh = sep.zh;
    } else {
      const zhLines = [];
      const nonZhLines = [];

      for (const l of rawLines) {
        if (/[\u4e00-\u9fa5]/.test(l)) {
          zhLines.push(l);
        } else {
          nonZhLines.push(l);
        }
      }

      if (zhLines.length > 0 && nonZhLines.length > 0) {
        segmentText = nonZhLines.join(' ');
        segmentZh = zhLines.join(' ');
      } else {
        const joined = rawLines.join(' ');
        const sep = separateBilingualText(joined);
        segmentText = sep.text;
        segmentZh = sep.zh;
      }
    }

    if (segmentText || segmentZh) {
      segments.push({
        time: startSeconds,
        timeStr: formatTimestamp(startSeconds),
        text: segmentText || segmentZh || '',
        zh: segmentZh,
      });
    }
  }

  return segments;
}

/**
 * 智能合并字幕段落
 */
export function deduplicateRollingText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned.replace(/(\b[\w\s',.-]{5,80}\b)\s+\1/gi, '$1');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * 智能合并字幕段落
 */
export function mergeSubtitlesSmartly(segments, maxDuration = 10) {
  if (!segments || segments.length === 0) return [];

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

      if (durationSpan >= maxDuration || (sentenceEnded && durationSpan >= 5)) {
        const rawTexts = currentGroup.map(s => (s.text || '').trim()).filter(Boolean);
        const rawZhs = currentGroup.map(s => (s.zh || '').trim()).filter(Boolean);
        
        const combinedText = deduplicateRollingText(rawTexts.join(' '));
        const combinedZh = rawZhs.join(' ').trim();

        let finalText = combinedText;
        let finalZh = combinedZh || undefined;

        if (!finalZh && /[\u4e00-\u9fa5]/.test(finalText) && /[a-zA-Z]/.test(finalText)) {
          const sep = separateBilingualText(finalText);
          finalText = sep.text;
          finalZh = sep.zh;
        }

        merged.push({
          time: currentGroup[0].time,
          timeStr: currentGroup[0].timeStr || formatTimestamp(currentGroup[0].time),
          text: finalText,
          zh: finalZh,
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
    const rawText = currentGroup.map(s => s.text.trim()).join(' ');
    merged.push({
      time: currentGroup[0].time,
      timeStr: currentGroup[0].timeStr || formatTimestamp(currentGroup[0].time),
      text: deduplicateRollingText(rawText),
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
 * 支持标准格式: "00:01:23,456" / "00:01:23.456"
 * 支持简写格式: "01:23,456" / "01:23" / "0:03"
 * @param {string} timeStr - SRT 时间戳
 * @returns {number} 秒数
 */
export function parseSRTTimestamp(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const normalized = timeStr.trim().replace(',', '.');

  // 1. 模式 A: HH:MM:SS.mmm 或 H:MM:SS (包含两个冒号)
  let match = normalized.match(/(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const ms = match[4] ? parseInt(match[4].padEnd(3, '0').substring(0, 3), 10) : 0;
    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
  }

  // 2. 模式 B: MM:SS.mmm 或 M:SS (包含一个冒号，如 0:03 或 12:34)
  match = normalized.match(/(\d{1,2}):(\d{2})(?:\.(\d+))?/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0').substring(0, 3), 10) : 0;
    return minutes * 60 + seconds + ms / 1000;
  }

  // 3. 模式 C: 纯数字秒数
  const secNum = parseFloat(normalized);
  if (!isNaN(secNum)) return secNum;

  return 0;
}

