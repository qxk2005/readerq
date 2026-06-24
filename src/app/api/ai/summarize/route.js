/**
 * AI 摘要 API 路由
 */

import { NextResponse } from 'next/server';
import { summarizeDocument } from '@/lib/ai';

export async function POST(request) {
  try {
    const { title, content } = await request.json();
    if (!content) {
      return NextResponse.json({ error: '缺少内容参数' }, { status: 400 });
    }

    const summary = await summarizeDocument(title || '无标题', content);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('AI 摘要错误:', error);
    return NextResponse.json(
      { error: error.message || 'AI 摘要生成失败' },
      { status: 500 }
    );
  }
}
