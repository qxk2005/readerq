/**
 * Readwise 同步 API 路由
 * POST: 触发全量或增量同步
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { upsertDocuments, upsertTags, upsertHighlights, convertReadwiseDocToHighlight, setSyncState, getSyncState, getDocumentCount, clearAllData } from '@/lib/db';

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

    // 重置状态
    setSyncState('sync_status', 'syncing');
    setSyncState('sync_error', '');
    setSyncState('sync_cancel_requested', 'false');
    setSyncState('sync_progress', JSON.stringify({ phase: 'starting', fetched: 0, total: 0 }));

    // 启动后台任务 (不 await)
    runSync(client, fullSync).catch(err => {
      console.error('后台同步异常:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'started'
    });
  } catch (error) {
    console.error('启动同步错误:', error);
    return NextResponse.json(
      { error: error.message || '同步启动失败' },
      { status: 500 }
    );
  }
}

async function runSync(client, fullSync) {
  try {
    if (fullSync) {
      clearAllData();
    }
    const lastSyncedAt = fullSync ? null : getSyncState('lastDocumentSync');

    // 定义检查取消的函数
    const checkCancel = () => {
      return getSyncState('sync_cancel_requested') === 'true';
    };

    // 获取文档
    setSyncState('sync_progress', JSON.stringify({ phase: 'documents', fetched: 0, total: 0 }));
    
    let localHighlightsCount = 0;
    
    const { fetchedCount: totalFetchedDocs, totalCount: remoteDocCount } = await client.fetchAllDocuments(
      { updatedAfter: lastSyncedAt },
      (progress) => {
        setSyncState('sync_progress', JSON.stringify({ phase: 'documents', fetched: progress.fetched, total: progress.total }));
      },
      checkCancel,
      async (batchResults) => {
        // 批处理逻辑
        const regularDocs = [];
        const highlightDocs = [];

        for (const doc of batchResults) {
          if (doc.content) {
            doc.html_content = doc.content;
          }
          if (doc.category === 'highlight') {
            highlightDocs.push(doc);
          } else {
            regularDocs.push(doc);
          }
        }

        if (regularDocs.length > 0) upsertDocuments(regularDocs);
        
        if (highlightDocs.length > 0) {
          const highlights = highlightDocs.map(convertReadwiseDocToHighlight);
          upsertHighlights(highlights);
          localHighlightsCount += highlightDocs.length;
        }
      }
    );

    if (checkCancel()) throw new Error('Sync cancelled by user');

    // 同步标签
    setSyncState('sync_progress', JSON.stringify({ phase: 'tags', fetched: 0, total: 0 }));
    const { fetchedCount: totalFetchedTags, totalCount: remoteTagCount } = await client.fetchAllTags(
      (progress) => {
        setSyncState('sync_progress', JSON.stringify({ phase: 'tags', fetched: progress.fetched, total: progress.total }));
      },
      checkCancel,
      async (batchTags) => {
        if (batchTags.length > 0) {
          upsertTags(batchTags);
        }
      }
    );

    // 更新最后同步时间
    const now = new Date().toISOString();
    setSyncState('lastDocumentSync', now);
    
    // 更新云端总数记录
    if (fullSync) {
      setSyncState('remote_doc_count', remoteDocCount.toString());
    }

    setSyncState('sync_status', 'idle');
    setSyncState('sync_error', '');
    setSyncState('sync_progress', JSON.stringify({ phase: 'done', fetched: totalFetchedDocs, total: remoteDocCount, highlights: localHighlightsCount }));
  } catch (err) {
    console.error('同步过程错误:', err);
    if (err.message === 'Sync cancelled by user') {
      setSyncState('sync_status', 'canceled');
    } else {
      setSyncState('sync_status', 'error');
      setSyncState('sync_error', err.message);
    }
  }
}

