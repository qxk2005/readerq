import { YoutubeTranscript } from 'youtube-transcript';
import { mergeSubtitlesSmartly, formatTimestamp } from './subtitleParser.js';
import { getSetting } from './db.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * 从 URL 中提取 YouTube 视频 ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * 检查 URL 是否为支持自动抓取字幕的视频链接
 */
export function isSupportedVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('bilibili.com');
}

/**
 * 毫秒/秒数转换为 SRT 时间戳格式 (00:00:00,000)
 */
export function formatSrtTimestamp(seconds) {
  const totalMs = Math.round(seconds * 1000);
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(ms).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * 将 SubtitleSegment 数组格式化为标准 SRT 字符串
 */
export function convertSegmentsToSrt(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';

  return segments.map((seg, idx) => {
    const startTime = typeof seg.time === 'number' ? seg.time : (seg.start || seg.startTime || 0);
    const duration = seg.duration || 3;
    const startStr = formatSrtTimestamp(startTime);
    const endStr = formatSrtTimestamp(startTime + duration);
    const text = (seg.text || seg.content || '').trim();

    return `${idx + 1}\n${startStr} --> ${endStr}\n${text}\n`;
  }).join('\n');
}

/**
 * 解析 SRT 字符串为 segments 数组
 */
function parseSrtToSegments(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') return [];

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const segments = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // 解析时间行: 00:00:01,790 --> 00:00:03,670
    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!timeMatch) continue;

    const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const endSec = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    const text = lines.slice(2).join(' ').trim();

    if (text.length > 0) {
      segments.push({
        time: startSec,
        timeStr: formatTimestamp(startSec),
        duration: endSec - startSec,
        text,
      });
    }
  }

  return segments;
}

/**
 * 使用 yt-dlp 自动解密主 Chrome Keychain Cookie 并提取 YouTube 字幕 (终极可靠后备方案)
 * @param {string} videoUrl YouTube 视频 URL
 * @param {Function} [onRetryStatus] 状态回调
 * @returns {Promise<{ srtContent: string, segments: Array, language: string } | null>}
 */
async function fetchSubtitlesViaYtDlp(videoUrl, onRetryStatus = null) {
  const tmpDir = os.tmpdir();
  const uniqueId = `readerq_sub_${Date.now()}`;
  const outTemplate = path.join(tmpDir, uniqueId);

  try {
    if (onRetryStatus) {
      onRetryStatus(0, 0, '🔑 使用本机 Chrome 已登录会话自动解密提取字幕中...');
    }

    const cmd = `yt-dlp --cookies-from-browser chrome --write-auto-sub --sub-lang en --convert-subs srt --skip-download -o "${outTemplate}" "${videoUrl}" 2>&1`;

    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    const output = stdout + (stderr || '');

    // 查找生成的 SRT 文件
    const srtPath = `${outTemplate}.en.srt`;
    if (fs.existsSync(srtPath)) {
      const srtContent = fs.readFileSync(srtPath, 'utf-8');
      // 清理临时文件
      try { fs.unlinkSync(srtPath); } catch (e) {}

      if (srtContent && srtContent.trim().length > 50) {
        const rawSegments = parseSrtToSegments(srtContent);
        if (rawSegments.length > 0) {
          const mergedSegments = mergeSubtitlesSmartly(rawSegments, 10);
          const cleanSrt = convertSegmentsToSrt(mergedSegments);
          return {
            srtContent: cleanSrt,
            segments: mergedSegments,
            language: 'en',
          };
        }
      }
    }

    // 尝试其他语言
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(uniqueId) && f.endsWith('.srt'));
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      const srtContent = fs.readFileSync(filePath, 'utf-8');
      try { fs.unlinkSync(filePath); } catch (e) {}

      if (srtContent && srtContent.trim().length > 50) {
        const rawSegments = parseSrtToSegments(srtContent);
        if (rawSegments.length > 0) {
          const mergedSegments = mergeSubtitlesSmartly(rawSegments, 10);
          const cleanSrt = convertSegmentsToSrt(mergedSegments);
          const langMatch = file.match(/\.(\w{2,5})\.srt$/);
          return {
            srtContent: cleanSrt,
            segments: mergedSegments,
            language: langMatch ? langMatch[1] : 'auto',
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[yt-dlp 字幕提取失败]:', err.message);
    // 清理临时文件
    try {
      const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(uniqueId));
      for (const file of files) {
        try { fs.unlinkSync(path.join(tmpDir, file)); } catch (e) {}
      }
    } catch (e) {}
    return null;
  }
}

/**
 * 免 Cookie 抓取 YouTube 官方/自动生成字幕 (带 3 次指数退避重试与语言备选轨)
 * 当 youtube-transcript 库失败时，自动回退到 yt-dlp + 主 Chrome Cookie 解密方案
 * @param {string} videoIdOrUrl 
 * @param {Function} [onRetryStatus] 状态回调 (attempt, maxAttempts, msg) => void
 * @returns {Promise<{ srtContent: string, segments: Array, language: string }>}
 */
export async function fetchYouTubeSubtitles(videoIdOrUrl, onRetryStatus = null) {
  if (!videoIdOrUrl) throw new Error('无效的 YouTube 视频 ID 或 URL');

  const maxAttempts = 2;
  let lastError = null;
  const userCookie = getSetting('youtube_cookie', '');

  const tryFetch = async (config) => {
    const fetchOptions = { ...config };
    if (userCookie && typeof userCookie === 'string' && userCookie.trim().length > 0) {
      fetchOptions.headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': userCookie.trim(),
        ...(config?.headers || {})
      };
    }

    const rawItems = await YoutubeTranscript.fetchTranscript(videoIdOrUrl, fetchOptions);
    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      const rawSegments = rawItems.map(item => {
        const startSec = (item.offset || 0) / 1000;
        const durSec = (item.duration || 2500) / 1000;
        return {
          time: startSec,
          timeStr: formatTimestamp(startSec),
          duration: durSec > 0 ? durSec : 2.5,
          text: (item.text || '').replace(/\n/g, ' ').trim()
        };
      }).filter(s => s.text.length > 0);

      if (rawSegments.length > 0) {
        const mergedSegments = mergeSubtitlesSmartly(rawSegments, 10);
        const srtContent = convertSegmentsToSrt(mergedSegments);
        return {
          srtContent,
          segments: mergedSegments,
          language: rawItems[0]?.lang || config?.lang || 'auto'
        };
      }
    }
    return null;
  };

  // ===== 第 1 阶段：通过 youtube-transcript 库直接提取 (快速、免依赖) =====
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (onRetryStatus) {
        onRetryStatus(attempt, maxAttempts + 1, `正在尝试直接抓取公开字幕轨 (第 ${attempt}/${maxAttempts + 1} 次尝试)...`);
      }

      if (attempt === 1) {
        const result = await tryFetch();
        if (result) return result;
      }

      if (attempt === 2) {
        for (const lang of ['en', 'zh', 'zh-Hans', 'ja', 'auto']) {
          try {
            const resLang = await tryFetch({ lang });
            if (resLang) return resLang;
          } catch (langErr) {
            // 忽略单个语言轨查找失败
          }
        }
      }
    } catch (err) {
      console.warn(`[YouTube 字幕直接抓取第 ${attempt} 次失败]:`, err.message);
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // ===== 第 2 阶段：回退到 yt-dlp + 主 Chrome Cookie 自动解密 (终极可靠) =====
  if (onRetryStatus) {
    onRetryStatus(maxAttempts + 1, maxAttempts + 1, '🔑 直接提取失败，正在使用本机 Chrome 已登录会话自动解密提取字幕...');
  }

  const videoUrl = videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')
    ? videoIdOrUrl
    : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;

  const ytdlpResult = await fetchSubtitlesViaYtDlp(videoUrl, onRetryStatus);
  if (ytdlpResult) {
    return ytdlpResult;
  }

  // ===== 两个方案全部失败 =====
  const detailMsg = lastError ? lastError.message : '无可用公开字幕轨';
  throw new Error(`未能提取到该视频的字幕 (${detailMsg})。您可以点击【上传字幕】提供本地 .srt 文件`);
}

/**
 * 自动识别视频平台并提取带时间线的 SRT 字幕
 */
export async function autoFetchVideoSubtitles(url, onRetryStatus = null) {
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return await fetchYouTubeSubtitles(url, onRetryStatus);
  }
  
  throw new Error('目前支持从 YouTube 自动提取字幕');
}
