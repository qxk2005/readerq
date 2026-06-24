import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocument, upsertDocument } from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { tags, notes } = body;

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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    const client = getServerReadwiseClient();

    // 更新 Readwise
    await client.updateDocument(id, updates);

    // 更新本地数据库
    const doc = getCachedDocument(id);
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
