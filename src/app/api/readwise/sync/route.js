/**
 * Readwise 同步 API 路由
 * POST: 触发全量或增量同步
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { upsertDocuments, upsertTags, upsertHighlights, convertReadwiseDocToHighlight, setSyncState, getSyncState, getDocumentCount, clearAllData, findDocumentIdBySourceUrl, findDocumentIdByTitle } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fullSync = body.full === true;
    const location = body.location;

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
    
    // 统一使用全局游标，多设备增量同步绝不限制特定 location，保证跨目录归档/移动变动能全量同步
    const stateKey = 'lastDocumentSync';
    const rawLastSyncedAt = fullSync ? null : getSyncState(stateKey);
    
    // 给 updatedAfter 增加 60 秒的安全缓冲区，防多设备间系统时钟偏差或服务器时间不一致
    let lastSyncedAt = null;
    if (rawLastSyncedAt) {
      const d = new Date(rawLastSyncedAt);
      d.setSeconds(d.getSeconds() - 60);
      lastSyncedAt = d.toISOString();
    }

    // 定义检查取消的函数
    const checkCancel = () => {
      return getSyncState('sync_cancel_requested') === 'true';
    };

    // 阶段 1: 获取 V3 文档（不限制 location，拉取所有目录变更）
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

    // 阶段 2: 从 V2 Export API 拉取高亮
    const v2StateKey = 'lastV2HighlightSync';
    const rawLastV2SyncedAt = fullSync ? null : getSyncState(v2StateKey);
    let lastV2SyncedAt = null;
    if (rawLastV2SyncedAt) {
      const d = new Date(rawLastV2SyncedAt);
      d.setSeconds(d.getSeconds() - 60);
      lastV2SyncedAt = d.toISOString();
    }

    setSyncState('sync_progress', JSON.stringify({ phase: 'highlights', fetched: 0, total: 0 }));
    
    let v2HighlightsCount = 0;
    try {
      await client.fetchAllV2Highlights(
        { updatedAfter: lastV2SyncedAt },
        (progress) => {
          setSyncState('sync_progress', JSON.stringify({ phase: 'highlights', fetched: progress.fetched, total: progress.total }));
        },
        checkCancel,
        async (batchItems) => {
          for (const item of batchItems) {
            let documentId = findDocumentIdBySourceUrl(item.source_url);
            if (!documentId) {
              documentId = findDocumentIdByTitle(item.title);
            }
            if (!documentId) {
              continue;
            }

            const highlightsToInsert = item.highlights.map(h => ({
              ...h,
              document_id: documentId,
              location_start: h.location,
              location_end: null,
              readwise_highlight_id: h.readwise_highlight_id,
            }));

            if (highlightsToInsert.length > 0) {
              upsertHighlights(highlightsToInsert);
              v2HighlightsCount += highlightsToInsert.length;
            }
          }
        }
      );
    } catch (v2Err) {
      console.warn('V2 高亮同步失败 (非致命):', v2Err.message);
    }

    localHighlightsCount += v2HighlightsCount;

    if (checkCancel()) throw new Error('Sync cancelled by user');

    // 阶段 3: 同步标签
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

    // 更新统一的全局最后同步时间
    const now = new Date().toISOString();
    setSyncState('lastDocumentSync', now);
    setSyncState('lastV2HighlightSync', now);
    
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

