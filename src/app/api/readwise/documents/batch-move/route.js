import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { batchUpdateLocation } from '@/lib/db';

export async function POST(request) {
  try {
    const { ids, location } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !location) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    if (!['new', 'later', 'archive'].includes(location)) {
      return NextResponse.json({ error: '无效的 location 值' }, { status: 400 });
    }

    // 1. 本地数据库乐观批量更新
    batchUpdateLocation(ids, location);

    // 2. 异步发起对 Readwise 官方 API 的并发请求
    // 注意：Next.js App Router 可以在响应后继续执行背景任务（但在 Serverless 环境可能被杀死）
    // 为了可靠性，我们选择 await Promise.allSettled 等待它们发出，
    // 由于是批量处理且使用 fetch，速度通常能够接受。如果数量特别巨大可以分批次。
    const client = getServerReadwiseClient();
    const promises = ids.map(id => client.updateDocument(id, { location }));
    
    // 我们等待所有请求结束，不阻塞个别失败，也不因为个别失败抛出 500
    await Promise.allSettled(promises);

    return NextResponse.json({ success: true, count: ids.length, location });
  } catch (error) {
    console.error('批量移动文档失败:', error);
    return NextResponse.json({ error: error.message || '批量移动失败' }, { status: 500 });
  }
}
