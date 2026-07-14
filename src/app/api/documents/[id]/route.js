import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocument, upsertDocument } from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { tags, notes, reading_progress } = body;

    const updates = {};
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: '无效的标签格式，必须为数组' }, { status: 400 });
      }
      updates.tags = tags;
    }
    
    if (notes !== undefined) {
      // Readwise Reader V3 update API uses notes
      updates.notes = notes;
    }

    // reading_progress 仅本地持久化：Readwise V3 API 的 update 端点不支持此字段写入
    // 同步拉取时 db.js 的 upsertDocument 会取本地与远端的 MAX 值，避免进度被覆盖
    const hasReadingProgress = reading_progress !== undefined && typeof reading_progress === 'number';

    if (Object.keys(updates).length === 0 && !hasReadingProgress) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // 获取本地文档信息
    const doc = getCachedDocument(id);

    // 如果有需要同步到 Readwise 的字段（tags、notes 等），则发起远程更新
    if (Object.keys(updates).length > 0) {
      const client = getServerReadwiseClient();
      const sourceUrl = doc?.source_url || doc?.url;
      await client.updateDocument(id, updates, sourceUrl);
    }

    // 更新本地数据库
    if (doc) {
      if (tags !== undefined) {
        const tagsObj = {};
        tags.forEach(tag => {
          tagsObj[tag] = 1; 
        });
        doc.tags = tagsObj;
      }
      if (notes !== undefined) {
        doc.notes = notes;
      }
      if (hasReadingProgress) {
        doc.reading_progress = Math.max(doc.reading_progress || 0, reading_progress);
      }
      upsertDocument(doc);
    }

    return NextResponse.json({ success: true, doc });
  } catch (error) {
    console.error('更新文档元数据失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}
