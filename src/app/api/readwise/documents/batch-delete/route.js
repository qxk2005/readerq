import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { deleteDocuments } from '@/lib/db';

export async function POST(request) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    // 1. 本地数据库物理删除
    deleteDocuments(ids);

    // 2. 异步发起对 Readwise 官方 API 的并发删除请求
    const client = getServerReadwiseClient();
    const promises = ids.map(id => client.deleteDocument(id));
    await Promise.allSettled(promises);

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('批量删除文档失败:', error);
    return NextResponse.json({ error: error.message || '批量删除失败' }, { status: 500 });
  }
}
