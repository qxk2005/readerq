import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocument, upsertDocument } from '@/lib/db';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { tags } = body;

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json({ error: '无效的标签格式' }, { status: 400 });
    }

    const client = getServerReadwiseClient();

    // 更新 Readwise
    await client.updateDocumentTags(id, tags);

    // 更新本地数据库
    const doc = getCachedDocument(id);
    if (doc) {
      const tagsObj = {};
      tags.forEach(tag => {
        tagsObj[tag] = 1; 
      });
      doc.tags = tagsObj;
      upsertDocument(doc);
    }

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('更新文档标签失败:', error);
    return NextResponse.json(
      { error: error.message || '更新标签失败' },
      { status: 500 }
    );
  }
}
