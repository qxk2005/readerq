/**
 * Readwise 文档 API 路由
 * GET: 获取文档列表
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocuments, upsertDocuments, getDocumentStats } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');
    const forceSync = searchParams.get('sync') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const id = searchParams.get('id');

    // 如果请求单个文档
    if (id) {
      try {
        const client = getServerReadwiseClient();
        const data = await client.listDocuments({ id, withHtmlContent: true });
        const doc = data.results && data.results.find(d => d.id === id);
        if (doc) {
          if (doc.html_content === undefined || doc.html_content === null) {
            doc.html_content = '';
          }
          upsertDocuments([doc]);
          return NextResponse.json(doc);
        }
      } catch (err) {
        console.error('从 Readwise 同步单篇文档失败:', err);
        // 从缓存获取
      }
      const { getCachedDocument } = await import('@/lib/db');
      const cached = getCachedDocument(id);
      if (cached) return NextResponse.json(cached);
      return NextResponse.json({ error: '文档未找到' }, { status: 404 });
    }

    // 强制同步或首次加载
    if (forceSync) {
      try {
        const client = getServerReadwiseClient();
        const documents = await client.fetchAllDocuments({ location, category, tag });
        upsertDocuments(documents);
      } catch (err) {
        console.error('同步失败:', err.message);
      }
    }

    // 从缓存获取
    const offset = (page - 1) * limit;
    const documents = getCachedDocuments({ location, category, tag, search, limit, offset });
    const stats = getDocumentStats();

    return NextResponse.json({
      documents,
      stats,
      page,
      limit,
    });
  } catch (error) {
    console.error('获取文档错误:', error);
    return NextResponse.json(
      { error: error.message || '获取文档失败' },
      { status: 500 }
    );
  }
}

