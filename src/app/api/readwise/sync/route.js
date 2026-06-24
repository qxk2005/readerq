/**
 * Readwise 同步 API 路由
 * POST: 触发全量或增量同步
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { upsertDocuments, upsertTags, setSyncState, getSyncState } from '@/lib/db';

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

    // 获取文档
    const documents = await client.fetchAllDocuments({
      updatedAfter: lastSyncedAt,
    });

    // 缓存文档
    if (documents.length > 0) {
      upsertDocuments(documents);
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
      synced: documents.length,
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
