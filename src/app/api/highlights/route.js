/**
 * 高亮 API 路由
 * GET: 获取文档高亮（支持按需从 Readwise 同步）
 * POST: 创建新高亮
 */

import { NextResponse } from 'next/server';
import { getDocumentHighlights, upsertHighlight, upsertHighlights } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少 documentId 参数' }, { status: 400 });
    }

    // 先从本地数据库获取
    let highlights = getDocumentHighlights(documentId);

    // 如果本地无高亮，尝试从 Readwise v2 Export API 按需拉取
    if (highlights.length === 0) {
      try {
        const client = getServerReadwiseClient();
        const remoteHighlights = await client.fetchDocumentHighlightsV2(documentId);

        if (remoteHighlights.length > 0) {
          // 转换为本地格式并写入数据库
          const hlsToSave = remoteHighlights.map(h => ({
            id: h.id,
            document_id: documentId,
            text: h.text,
            note: h.note,
            color: h.color || 'yellow',
            location_start: null,
            location_end: null,
            created_at: h.created_at,
            tags: h.tags,
          }));

          upsertHighlights(hlsToSave);

          // 重新从数据库获取（确保格式一致）
          highlights = getDocumentHighlights(documentId);
        }
      } catch (err) {
        console.error('从 Readwise 按需拉取高亮失败:', err.message);
        // 不影响返回本地数据
      }
    }

    return NextResponse.json({ highlights });
  } catch (error) {
    console.error('获取高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '获取高亮失败' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const highlight = await request.json();

    if (!highlight.id || !highlight.document_id || !highlight.text) {
      return NextResponse.json(
        { error: '缺少必要字段 (id, document_id, text)' },
        { status: 400 }
      );
    }

    upsertHighlight(highlight);

    // 同步到 Readwise
    try {
      const client = getServerReadwiseClient();
      // 获取文档信息用于同步
      const { getCachedDocument } = await import('@/lib/db');
      const doc = getCachedDocument(highlight.document_id);
      if (doc) {
        await client.createReadwiseHighlight({
          ...highlight,
          title: doc.title,
          source_url: doc.source_url || doc.url,
        });
      }
    } catch (syncError) {
      console.error('同步高亮到 Readwise 失败:', syncError.message);
      // 本地保存成功即可，不影响用户操作
    }

    return NextResponse.json({ success: true, highlight });
  } catch (error) {
    console.error('创建高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '创建高亮失败' },
      { status: 500 }
    );
  }
}
