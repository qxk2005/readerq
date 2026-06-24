/**
 * Readwise 同步 API 路由
 * POST: 触发全量或增量同步
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { upsertDocuments, upsertTags, upsertHighlights, convertReadwiseDocToHighlight, setSyncState, getSyncState } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fullSync = body.full === true;

    const client = getServerReadwiseClient();

    // 验证 Token
    const valid = await client.validateToken();
    if (!valid) {
      return NextResponse.json(
        { error: 'Readwise API Token 无效' },
        { status: 401 }
      );
    }

    // 获取上次同步时间
    const lastSyncedAt = fullSync ? null : getSyncState('lastDocumentSync');

    // 获取文档（包含 highlights 和 notes 类型的子文档）
    const allDocuments = await client.fetchAllDocuments({
      updatedAfter: lastSyncedAt,
    });

    // 分离普通文档和 highlight 类型子文档
    const regularDocs = [];
    const highlightDocs = [];

    for (const doc of allDocuments) {
      if (doc.parent_id && doc.category === 'highlight') {
        highlightDocs.push(doc);
      } else if (!doc.parent_id) {
        regularDocs.push(doc);
      }
      // note 类型的子文档暂不处理
    }

    // 缓存普通文档
    if (regularDocs.length > 0) {
      upsertDocuments(regularDocs);
    }

    // 将 highlight 类型文档转换并写入 highlights 表
    if (highlightDocs.length > 0) {
      const highlights = highlightDocs.map(convertReadwiseDocToHighlight);
      upsertHighlights(highlights);
    }

    // 同步标签
    const tags = await client.fetchAllTags();
    if (tags.length > 0) {
      upsertTags(tags);
    }

    // 更新同步时间
    setSyncState('lastDocumentSync', new Date().toISOString());

    return NextResponse.json({
      success: true,
      synced: regularDocs.length,
      highlights: highlightDocs.length,
      tags: tags.length,
      fullSync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('同步错误:', error);
    return NextResponse.json(
      { error: error.message || '同步失败' },
      { status: 500 }
    );
  }
}

