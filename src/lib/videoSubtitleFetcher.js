import { YoutubeTranscript } from 'youtube-transcript';
import { mergeSubtitlesSmartly, formatTimestamp, parseSrv1ToSegments } from './subtitleParser.js';
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
 * 通过 YouTube oEmbed API 快速获取视频真实标题、作者和缩略图
 * oEmbed 是公开接口，无需 API Key，响应极控（<200ms）
 */
export async function fetchYouTubeMetadata(videoUrl) {
  if (!videoUrl) return null;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || null,
      author: data.author_name || null,
      thumbnail: data.thumbnail_url || null,
    };
  } catch (e) {
    console.warn('[oEmbed] YouTube 元数据获取失败:', e.message);
    return null;
  }
}

/**
 * 检查 URL 是否为支持自动抓算字幕的视频链接
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
 * 使用 yt-dlp 自动提取 YouTube 人工及自动生成字幕轨 (全语言支持与多维匹配)
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
      onRetryStatus(0, 0, '🔑 使用后端 yt-dlp 提取高清字幕轨中...');
    }

    const userCookie = getSetting('youtube_cookie', '');
    let cookieHeader = '';
    if (userCookie && typeof userCookie === 'string' && userCookie.trim().length > 0) {
      cookieHeader = `--add-header "Cookie: ${userCookie.trim().replace(/"/g, '\\"')}"`;
    }

    // 动态探测全局与常见 bin 路径的 yt-dlp
    let ytdlpBin = 'yt-dlp';
    const possiblePaths = ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', 'yt-dlp'];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        ytdlpBin = p;
        break;
      }
    }

    // 优先按原生 srv1 / srv2 / ttml 原生格式抓取，杜绝 VTT 滚屏转码带来的重复
    const subLangs = "en,en-orig,en-US,en-GB,zh-Hans,zh-Hant,zh,ja,es,fr,de";
    const cmd = `${ytdlpBin} ${cookieHeader} --write-sub --write-auto-sub --sub-lang "${subLangs}" --sub-format "srv1/srv2/srv3/ttml/srt/best" --skip-download -o "${outTemplate}.%(ext)s" "${videoUrl}" 2>&1`;

    const { stdout, stderr } = await execAsync(cmd, { timeout: 35000 });
    const output = stdout + (stderr || '');
    console.log('[yt-dlp 提取结果]:', output.substring(0, 500));

    // 全量扫描当前 uniqueId 产生的所有字幕产物 (.srv1, .ttml, .srt, .xml)
    const generatedFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith(uniqueId) && (f.endsWith('.srv1') || f.endsWith('.ttml') || f.endsWith('.srt') || f.endsWith('.xml')));
    
    // 优先排位：英文原生 (en, en-orig, en-US) -> 中文 (zh, zh-Hans) -> 其他语言
    const sortedFiles = generatedFiles.sort((a, b) => {
      const isAEn = a.includes('.en') || a.includes('.en-orig');
      const isBEn = b.includes('.en') || b.includes('.en-orig');
      if (isAEn && !isBEn) return -1;
      if (!isAEn && isBEn) return 1;
      return 0;
    });

    for (const file of sortedFiles) {
      const filePath = path.join(tmpDir, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        try { fs.unlinkSync(filePath); } catch (e) {}

        if (fileContent && fileContent.trim().length > 30) {
          let segments = [];
          if (file.endsWith('.srv1') || file.endsWith('.ttml') || file.endsWith('.xml') || fileContent.includes('<text ')) {
            segments = parseSrv1ToSegments(fileContent);
          } else {
            segments = parseSrtToSegments(fileContent);
          }

          if (segments.length > 0) {
            const cleanSrt = convertSegmentsToSrt(segments);
            const langMatch = file.match(/\.([a-zA-Z0-9_-]+)\.(srv1|ttml|srt|xml)$/);
            return {
              srtContent: cleanSrt,
              segments,
              language: langMatch ? langMatch[1] : 'en',
            };
          }
        }
      } catch (fileErr) {
        console.warn(`读取字幕产物文件 ${file} 异常:`, fileErr.message);
      }
    }

    return null;
  } catch (err) {
    console.warn('[yt-dlp 字幕提取失败]:', err.message);
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

  // ===== 第 1 阶段：通过 youtube-transcript 库按语言优先级精准抓取 (优先英文/中文，防止抓到乱码小语种) =====
  const langPriority = ['en', 'en-US', 'en-GB', 'zh-Hans', 'zh-Hant', 'zh', 'ja'];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (onRetryStatus) {
        onRetryStatus(attempt, maxAttempts + 1, `正在尝试直接抓取公开字幕轨 (第 ${attempt}/${maxAttempts + 1} 次尝试)...`);
      }

      // 优先尝试标准语言队列
      for (const lang of langPriority) {
        try {
          const resLang = await tryFetch({ lang });
          if (resLang) {
            console.log(`[YouTube 字幕成功命中语言轨: ${lang}]`);
            return resLang;
          }
        } catch (langErr) {
          // 忽略单个语言轨无结果
        }
      }

      // 最后的退避回退：无参数抓取
      const defaultResult = await tryFetch();
      if (defaultResult) return defaultResult;
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
