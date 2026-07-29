import { NextResponse } from 'next/server';
import { saveSubtitle, getSubtitle, deleteSubtitle, getCachedDocument, updateDocumentBlog, setSetting } from '@/lib/db';
import { parseSRT, mergeSubtitlesSmartly } from '@/lib/subtitleParser';
import { translateSubtitlesToBilingual, convertSubtitlesToBlog } from '@/lib/ai';
import { uploadSubtitleToOss, downloadSubtitleFromOss, deleteSubtitleFromOss, uploadBlogToOss, validateOssConfig, getOssConfig } from '@/lib/oss';

/**
 * 检查 OSS 是否已配置
 */
function isOssAvailable() {
  try {
    const config = getOssConfig();
    return validateOssConfig(config).valid;
  } catch {
    return false;
  }
}

/**
 * 格式化 ISO 日期为人类可读的本地时间
 */
function formatVersionTime(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * GET /api/documents/[id]/subtitles
 * 获取指定文档的用户上传字幕
 * 优先从本地数据库获取；如本地无数据且 OSS 已配置，尝试从 OSS 回退获取
 * 使用时间戳对比（而非纯内容对比）判断是否有更新版本
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // 1. 读取本地数据库的字幕
    const localSubtitle = getSubtitle(id);
    let localSegments = [];
    if (localSubtitle) {
      if (localSubtitle.bilingual_json) {
        try {
          localSegments = JSON.parse(localSubtitle.bilingual_json);
        } catch { /* ignore */ }
      }
      if (!localSegments || localSegments.length === 0) {
        const rawSegments = parseSRT(localSubtitle.srt_content);
        localSegments = mergeSubtitlesSmartly(rawSegments, 10);
      }
    }

    // 本地版本时间：优先 updated_at，回退到 created_at
    const localUpdatedAt = localSubtitle?.updated_at || localSubtitle?.created_at || null;

    // 2. 如果配置了 OSS，探索云端 OSS 是否包含最新上传/替换的字幕
    if (isOssAvailable()) {
      try {
        const ossResult = await downloadSubtitleFromOss(id);
        if (ossResult.success && ossResult.srtContent) {
          const ossSrt = ossResult.srtContent;
          const ossUpdatedAt = ossResult.lastModified || null;

          if (!localSubtitle) {
            // 本地无数据，云端有：自动同步入库（使用云端时间戳作为 updated_at）
            let segments = [];
            if (ossSrt.trim().startsWith('[')) {
              try { segments = JSON.parse(ossSrt); } catch { /* ignore */ }
            }
            if (!segments || segments.length === 0) {
              const rawSegments = parseSRT(ossSrt);
              segments = mergeSubtitlesSmartly(rawSegments, 10);
            }
            saveSubtitle(id, ossSrt, segments, ossUpdatedAt);
            return NextResponse.json({
              exists: true,
              subtitles: segments,
              source: 'oss',
              hasNewerVersion: false,
              localUpdatedAt: formatVersionTime(ossUpdatedAt),
              ossUpdatedAt: formatVersionTime(ossUpdatedAt),
            });
          } else {
            // 本地有数据，通过时间戳判断云端是否更新
            // 策略：如果 OSS 有时间戳且 > 本地时间戳 → 有新版本
            //       如果 OSS 无时间戳 → 回退到内容对比
            let hasNewer = false;
            if (ossUpdatedAt && localUpdatedAt) {
              const ossTime = new Date(ossUpdatedAt).getTime();
              const localTime = new Date(localUpdatedAt).getTime();
              // 云端时间比本地晚 2 秒以上才算有新版本（避免时间精度误差）
              hasNewer = ossTime > localTime + 2000;
            } else {
              // 回退：时间戳缺失时用内容对比
              const localHasZh = Array.isArray(localSegments) && localSegments.some(s => s.zh);
              const ossHasZh = ossSrt.includes('"zh"') || ossSrt.includes('zh:');
              hasNewer = (localSubtitle.srt_content || '').trim() !== ossSrt.trim() || (!localHasZh && ossHasZh);
            }

            if (hasNewer) {
              return NextResponse.json({
                exists: true,
                subtitles: localSegments,
                createdAt: localSubtitle.created_at,
                source: 'local',
                hasNewerVersion: true,
                newerSrtContent: ossSrt,
                localUpdatedAt: formatVersionTime(localUpdatedAt),
                ossUpdatedAt: formatVersionTime(ossUpdatedAt),
              });
            }
          }
        }
      } catch (ossErr) {
        console.warn('[字幕版本比对] 拉取 OSS 失败:', ossErr.message);
      }
    }

    if (localSubtitle) {
      return NextResponse.json({
        exists: true,
        subtitles: localSegments,
        createdAt: localSubtitle.created_at,
        source: 'local',
        hasNewerVersion: false,
        localUpdatedAt: formatVersionTime(localUpdatedAt),
        ossUpdatedAt: null,
      });
    }

    return NextResponse.json({ exists: false, subtitles: [], hasNewerVersion: false });
  } catch (error) {
    console.error('获取字幕失败:', error);
    return NextResponse.json(
      { error: error.message || '获取字幕失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/subtitles
 * 上传 SRT 字幕文件内容
 * 保存到本地数据库，进行 ≤10s 智能分段合并与 AI 中英文双语翻译，并在 OSS 可用时同步到 OSS 实现跨客户端共享
 * 
 * 支持额外参数：
 * - ossTimestamp: 当从云端切换最新字幕时，传入 OSS 版本时间戳作为 updated_at，
 *   确保本地时间戳 >= 云端时间戳，消除版本差异
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const contentType = request.headers.get('content-type') || '';

    let srtContent;
    let ossTimestamp = null;

    if (contentType.includes('multipart/form-data')) {
      // 处理文件上传
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) {
        return NextResponse.json({ error: '没有接收到文件' }, { status: 400 });
      }
      srtContent = await file.text();
    } else {
      // 处理 JSON body
      const body = await request.json();
      srtContent = body.srtContent;
      ossTimestamp = body.ossTimestamp || null;
    }

    if (!srtContent || typeof srtContent !== 'string' || srtContent.trim().length === 0) {
      return NextResponse.json({ error: '字幕内容不能为空' }, { status: 400 });
    }

    // 检测内容格式：JSON 双语结构 vs SRT 原始字幕
    const trimmedContent = srtContent.trim();
    const isJsonBilingual = trimmedContent.startsWith('[');

    let bilingualSegments;

    if (isJsonBilingual) {
      // ✅ 来自 OSS 的 JSON 双语结构（切换最新字幕场景）
      // 直接解析使用，无需 parseSRT 和 AI 翻译
      try {
        bilingualSegments = JSON.parse(trimmedContent);
        if (!Array.isArray(bilingualSegments) || bilingualSegments.length === 0) {
          return NextResponse.json({ error: '无法解析双语字幕 JSON 数据' }, { status: 400 });
        }
      } catch (parseErr) {
        return NextResponse.json({ error: '字幕 JSON 格式错误: ' + parseErr.message }, { status: 400 });
      }

      // 直接保存到本地数据库（使用 ossTimestamp 作为 updated_at）
      saveSubtitle(id, srtContent, bilingualSegments, ossTimestamp);

    } else {
      // 原始 SRT 格式（用户上传场景）
      const rawSegments = parseSRT(srtContent);
      if (rawSegments.length === 0) {
        return NextResponse.json({ error: '无法解析出有效的 SRT 字幕，请检查文件格式是否正确' }, { status: 400 });
      }

      // 1. 智能分段合并 (约束单段时长 ≤ 10 秒)
      const mergedSegments = mergeSubtitlesSmartly(rawSegments, 10);

      // 2. 调用 AI 大模型生成中英文双语对照 (上面中文，下面英文)
      bilingualSegments = mergedSegments;
      try {
        bilingualSegments = await translateSubtitlesToBilingual(mergedSegments);
      } catch (err) {
        console.warn('[字幕双语化] AI 翻译失败，保留合并单语字幕:', err.message);
      }

      // 3. 全自动触发精选博客文章转换
      try {
        const doc = getCachedDocument(id);
        const blogHtml = await convertSubtitlesToBlog(bilingualSegments, doc?.title || '视频精选博客');
        if (blogHtml) {
          updateDocumentBlog(id, blogHtml);
          setSetting(`blog_updated_at_${id}`, new Date().toISOString());
          if (isOssAvailable()) {
            await uploadBlogToOss(id, blogHtml);
          }
        }
      } catch (blogErr) {
        console.warn('[字幕博客自动转换] 转换失败:', blogErr.message);
      }

      // 保存到本地数据库
      saveSubtitle(id, srtContent, bilingualSegments, ossTimestamp);
    }

    // 同步到 OSS（后台执行，不阻塞响应）
    // 注意：如果是从 OSS 切换过来的，不需要重复上传回 OSS
    let ossSynced = false;
    if (isOssAvailable() && !ossTimestamp) {
      try {
        // 💡 优先将包含中英文双语的 JSON 结构同步保存到 OSS，让 Android / 移动端拉取时能直接获得双语
        const contentToUpload = (Array.isArray(bilingualSegments) && bilingualSegments.some(s => s.zh))
          ? JSON.stringify(bilingualSegments)
          : srtContent;

        const ossResult = await uploadSubtitleToOss(id, contentToUpload);
        ossSynced = ossResult.success;
        if (!ossResult.success) {
          console.warn('[字幕OSS同步] 上传失败:', ossResult.error);
        }
      } catch (err) {
        console.warn('[字幕OSS同步] 上传异常:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      count: bilingualSegments.length,
      subtitles: bilingualSegments,
      ossSynced,
    });
  } catch (error) {
    console.error('上传字幕失败:', error);
    return NextResponse.json(
      { error: error.message || '上传字幕失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]/subtitles
 * 删除指定文档的用户上传字幕
 * 同时删除本地数据库和 OSS 上的字幕文件
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // 删除本地数据库记录
    deleteSubtitle(id);

    // 同时删除 OSS 上的文件
    if (isOssAvailable()) {
      try {
        await deleteSubtitleFromOss(id);
      } catch (err) {
        console.warn('[字幕OSS同步] 删除异常:', err.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除字幕失败:', error);
    return NextResponse.json(
      { error: error.message || '删除字幕失败' },
      { status: 500 }
    );
  }
}
