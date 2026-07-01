import { NextResponse } from 'next/server';
import { deleteHighlight, getHighlight, upsertHighlight } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const existing = getHighlight(id);
    if (!existing) {
      return NextResponse.json({ error: '高亮不存在' }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...body
    };

    upsertHighlight(updated);

    // 同步更新到 Readwise
    let syncedToReadwise = false;
    let syncError = null;
    try {
      const client = getServerReadwiseClient();
      
      if (updated.readwise_highlight_id) {
        // 已有 Readwise ID → 使用 PATCH 更新已有条目（不会创建重复）
        const patchData = {};
        if (body.note !== undefined) patchData.note = body.note || '';
        if (body.text !== undefined) patchData.text = body.text;
        if (body.color !== undefined) patchData.color = body.color;
        
        if (Object.keys(patchData).length > 0) {
          const response = await fetch(
            `https://readwise.io/api/v2/highlights/${updated.readwise_highlight_id}`,
            {
              method: 'PATCH',
              headers: client.headers,
              body: JSON.stringify(patchData),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Readwise PATCH 失败 (${response.status}): ${errorText}`);
          }
        }
        
        // 如果更新了标签，需要通过 tags 端点单独处理
        if (body.tags) {
          const tagNames = Object.keys(body.tags);
          for (const tagName of tagNames) {
            try {
              await fetch(
                `https://readwise.io/api/v2/highlights/${updated.readwise_highlight_id}/tags/`,
                {
                  method: 'POST',
                  headers: client.headers,
                  body: JSON.stringify({ name: tagName }),
                  signal: AbortSignal.timeout(10000),
                }
              );
            } catch (tagErr) {
              console.warn(`为高亮添加标签 "${tagName}" 异常:`, tagErr.message);
            }
          }
        }
        
        syncedToReadwise = true;
      } else {
        // 没有 Readwise ID → 首次同步，使用 POST 创建并保存返回的 ID
        const { getCachedDocument } = await import('@/lib/db');
        const doc = getCachedDocument(updated.document_id);
        if (doc) {
          const result = await client.createReadwiseHighlight({
            ...updated,
            title: doc.title,
            source_url: doc.source_url || doc.url,
          });
          syncedToReadwise = true;
          
          // 保存 Readwise 高亮 ID
          let readwiseHighlightId = null;
          if (Array.isArray(result) && result.length > 0) {
            if (result[0].modified_highlights && result[0].modified_highlights.length > 0) {
              readwiseHighlightId = String(result[0].modified_highlights[0]);
            }
          }
          if (readwiseHighlightId) {
            updated.readwise_highlight_id = readwiseHighlightId;
            upsertHighlight(updated);
          }
        } else {
          syncError = '本地未找到关联文档，无法同步';
        }
      }
    } catch (err) {
      syncError = err.message;
      console.error('同步更新到 Readwise 失败:', err.message);
    }
    
    return NextResponse.json({ success: true, highlight: updated, synced_to_readwise: syncedToReadwise, sync_error: syncError });
  } catch (error) {
    console.error('更新高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '更新高亮失败' },
      { status: 500 }
    );
  }
}

// 前端 ReadingPane 使用 PUT 方法调用，这里同时导出 PUT 以保持兼容
export { PATCH as PUT };

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // 先获取高亮信息以得到 readwise_highlight_id
    const existing = getHighlight(id);
    
    // 先删除本地记录
    deleteHighlight(id);
    
    // 同步删除到 Readwise
    if (existing?.readwise_highlight_id) {
      try {
        const client = getServerReadwiseClient();
        await client.deleteReadwiseHighlight(existing.readwise_highlight_id);
      } catch (err) {
        console.error('同步删除到 Readwise 失败:', err.message);
        // 本地已删除，远程删除失败不阻塞
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '删除高亮失败' },
      { status: 500 }
    );
  }
}
