/**
 * Readwise 保存文档 API 路由
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.url) {
      return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 });
    }

    const client = getServerReadwiseClient();
    const result = await client.saveDocument(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('保存文档错误:', error);
    return NextResponse.json(
      { error: error.message || '保存文档失败' },
      { status: 500 }
    );
  }
}
