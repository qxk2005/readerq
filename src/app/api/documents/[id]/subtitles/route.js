import { NextResponse } from 'next/server';
import { saveSubtitle, getSubtitle, deleteSubtitle } from '@/lib/db';
import { parseSRT, mergeSubtitlesSmartly } from '@/lib/subtitleParser';
import { translateSubtitlesToBilingual } from '@/lib/ai';
import { uploadSubtitleToOss, downloadSubtitleFromOss, deleteSubtitleFromOss, validateOssConfig, getOssConfig } from '@/lib/oss';

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
 * GET /api/documents/[id]/subtitles
 * 获取指定文档的用户上传字幕
 * 优先从本地数据库获取；如本地无数据且 OSS 已配置，尝试从 OSS 回退获取
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // 1. 优先从本地数据库获取
    const localSubtitle = getSubtitle(id);
    if (localSubtitle) {
      let segments = [];
      if (localSubtitle.bilingual_json) {
        try {
          segments = JSON.parse(localSubtitle.bilingual_json);
        } catch { /* ignore */ }
      }
      if (!segments || segments.length === 0) {
        const rawSegments = parseSRT(localSubtitle.srt_content);
        segments = mergeSubtitlesSmartly(rawSegments, 10);
      }
      return NextResponse.json({
        exists: true,
        subtitles: segments,
        createdAt: localSubtitle.created_at,
        source: 'local',
      });
    }

    // 2. 本地无数据，尝试从 OSS 回退
    if (isOssAvailable()) {
      const ossResult = await downloadSubtitleFromOss(id);
      if (ossResult.success && ossResult.srtContent) {
        // 从 OSS 获取成功，缓存到本地数据库
        const rawSegments = parseSRT(ossResult.srtContent);
        const segments = mergeSubtitlesSmartly(rawSegments, 10);
        saveSubtitle(id, ossResult.srtContent, segments);
        return NextResponse.json({
          exists: true,
          subtitles: segments,
          source: 'oss',
        });
      }
    }

    return NextResponse.json({ exists: false, subtitles: [] });
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
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const contentType = request.headers.get('content-type') || '';

    let srtContent;

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
    }

    if (!srtContent || typeof srtContent !== 'string' || srtContent.trim().length === 0) {
      return NextResponse.json({ error: '字幕内容不能为空' }, { status: 400 });
    }

    // 验证是否为有效的 SRT 内容（至少能解析出 1 条字幕）
    const rawSegments = parseSRT(srtContent);
    if (rawSegments.length === 0) {
      return NextResponse.json({ error: '无法解析出有效的 SRT 字幕，请检查文件格式是否正确' }, { status: 400 });
    }

    // 1. 智能分段合并 (约束单段时长 ≤ 10 秒)
    const mergedSegments = mergeSubtitlesSmartly(rawSegments, 10);

    // 2. 调用 AI 大模型生成中英文双语对照 (上面中文，下面英文)
    let bilingualSegments = mergedSegments;
    try {
      bilingualSegments = await translateSubtitlesToBilingual(mergedSegments);
    } catch (err) {
      console.warn('[字幕双语化] AI 翻译失败，保留合并单语字幕:', err.message);
    }

    // 保存到本地数据库 (传入完整的双语结构)
    saveSubtitle(id, srtContent, bilingualSegments);

    // 同步到 OSS（后台执行，不阻塞响应）
    let ossSynced = false;
    if (isOssAvailable()) {
      try {
        const ossResult = await uploadSubtitleToOss(id, srtContent);
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
