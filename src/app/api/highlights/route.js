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
    const body = await request.json();
    const highlight = body.highlight || body;

    if (!highlight.id || !highlight.document_id || !highlight.text) {
      return NextResponse.json(
        { error: '缺少必要字段 (id, document_id, text)' },
        { status: 400 }
      );
    }

    if (!highlight.created_at) {
      highlight.created_at = new Date().toISOString();
    }

    upsertHighlight(highlight);

    // 同步到 Readwise (除非明确指定不同步)
    let syncedToReadwise = false;
    let syncError = null;
    if (body.syncToReadwise !== false) {
      try {
        const client = getServerReadwiseClient();
        // 获取文档信息用于同步
        const { getCachedDocument } = await import('@/lib/db');
        const doc = getCachedDocument(highlight.document_id);
        if (doc) {
          const result = await client.createReadwiseHighlight({
            ...highlight,
            title: doc.title,
            source_url: doc.source_url || doc.url,
          });
          syncedToReadwise = true;
          
          // 保存 Readwise 返回的高亮 ID，用于后续的删除/更新同步
          let readwiseHighlightId = null;
          if (Array.isArray(result) && result.length > 0) {
            if (result[0].modified_highlights && result[0].modified_highlights.length > 0) {
              readwiseHighlightId = String(result[0].modified_highlights[0]);
            }
          }
          if (readwiseHighlightId) {
            highlight.readwise_highlight_id = readwiseHighlightId;
            upsertHighlight(highlight);
          }
        } else {
          syncError = '本地未找到关联文档，无法同步';
          console.warn(`[高亮同步] 文档 ${highlight.document_id} 未在本地缓存中找到`);
        }
      } catch (err) {
        syncError = err.message;
        console.error('同步高亮到 Readwise 失败:', err.message);
      }
    } else {
      syncedToReadwise = false;
      syncError = '推迟同步';
    }

    return NextResponse.json({ success: true, highlight, synced_to_readwise: syncedToReadwise, sync_error: syncError });
  } catch (error) {
    console.error('创建高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '创建高亮失败' },
      { status: 500 }
    );
  }
}
