/**
 * 高亮重新同步 API
 * POST /api/highlights/resync
 * 接收高亮 ID，重新将高亮同步到 Readwise
 */

import { NextResponse } from 'next/server';
import { getHighlight, getCachedDocument } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { highlightId } = await request.json();

    if (!highlightId) {
      return NextResponse.json({ error: '缺少 highlightId 参数' }, { status: 400 });
    }

    const hl = getHighlight(highlightId);
    if (!hl) {
      return NextResponse.json({ error: '高亮不存在' }, { status: 404 });
    }

    const doc = getCachedDocument(hl.document_id);
    if (!doc) {
      return NextResponse.json({
        error: `未找到关联文档 (${hl.document_id})，请先同步文档列表`,
      }, { status: 404 });
    }

    const client = getServerReadwiseClient();
    const result = await client.createReadwiseHighlight({
      ...hl,
      tags: JSON.parse(hl.tags_json || '{}'),
      title: doc.title,
      source_url: doc.source_url || doc.url,
    });

    return NextResponse.json({
      success: true,
      synced_to_readwise: true,
      result,
    });
  } catch (error) {
    console.error('重新同步高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '重新同步失败' },
      { status: 500 }
    );
  }
}
