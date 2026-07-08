import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { batchUpdateLocation } from '@/lib/db';

export async function POST(request) {
  try {
    const { ids, location } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !location) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    if (!['new', 'later', 'archive', 'trash'].includes(location)) {
      return NextResponse.json({ error: '无效的 location 值' }, { status: 400 });
    }

    // 1. 本地数据库乐观批量更新
    batchUpdateLocation(ids, location);

    // 2. 异步发起对 Readwise 官方 API 的并发请求
    const client = getServerReadwiseClient();
    const promises = ids.map(id => {
      if (location === 'trash') {
        return client.deleteDocument(id);
      } else {
        return client.updateDocument(id, { location });
      }
    });
    
    // 我们等待所有请求结束，不阻塞个别失败，也不因为个别失败抛出 500
    await Promise.allSettled(promises);

    return NextResponse.json({ success: true, count: ids.length, location });
  } catch (error) {
    console.error('批量移动文档失败:', error);
    return NextResponse.json({ error: error.message || '批量移动失败' }, { status: 500 });
  }
}
