import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { upsertHighlights, convertReadwiseDocToHighlight, getDocumentHighlights } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/highlights/sync?documentId=xxx
 * 按需从 Readwise 同步某篇文档的高亮
 * 
 * Readwise Reader API v3 中，highlights 是独立的文档（category='highlight'），
 * 通过 parent_id 关联到父文档。此端点拉取所有 highlight 文档并过滤出指定文档的高亮。
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少 documentId 参数' }, { status: 400 });
    }

    const client = getServerReadwiseClient();

    // 从 Readwise 拉取 highlight 类型的文档
    // 注意: v3 API 没有按 parent_id 筛选的参数,
    // 我们拉取所有 highlight 文档后在客户端过滤
    const allHighlightDocs = await client.fetchAllDocuments({ category: 'highlight' });
    
    // 过滤出属于目标文档的高亮
    const docHighlightDocs = allHighlightDocs.filter(d => d.parent_id === documentId);

    // 转换并写入 highlights 表
    if (docHighlightDocs.length > 0) {
      const highlights = docHighlightDocs.map(convertReadwiseDocToHighlight);
      upsertHighlights(highlights);
    }

    // 返回该文档的所有高亮（包括本地创建的和刚同步的）
    const allHighlights = getDocumentHighlights(documentId);

    return NextResponse.json({
      success: true,
      synced: docHighlightDocs.length,
      highlights: allHighlights,
    });
  } catch (error) {
    console.error('同步高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '同步高亮失败' },
      { status: 500 }
    );
  }
}
