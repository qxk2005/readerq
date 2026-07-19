import { NextResponse } from 'next/server';
import { saveSubtitle, getSubtitle, deleteSubtitle } from '@/lib/db';
import { parseSRT } from '@/lib/subtitleParser';

/**
 * GET /api/documents/[id]/subtitles
 * 获取指定文档的用户上传字幕
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const subtitle = getSubtitle(id);

    if (!subtitle) {
      return NextResponse.json({ exists: false, subtitles: [] });
    }

    // 解析 SRT 内容为结构化的字幕段落
    const segments = parseSRT(subtitle.srt_content);

    return NextResponse.json({
      exists: true,
      subtitles: segments,
      createdAt: subtitle.created_at,
    });
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
    const segments = parseSRT(srtContent);
    if (segments.length === 0) {
      return NextResponse.json({ error: '无法解析出有效的 SRT 字幕，请检查文件格式是否正确' }, { status: 400 });
    }

    // 保存到数据库
    saveSubtitle(id, srtContent);

    return NextResponse.json({
      success: true,
      count: segments.length,
      subtitles: segments,
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
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    deleteSubtitle(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除字幕失败:', error);
    return NextResponse.json(
      { error: error.message || '删除字幕失败' },
      { status: 500 }
    );
  }
}
