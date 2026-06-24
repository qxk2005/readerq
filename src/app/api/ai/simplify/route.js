/**
 * AI 简化 API 路由
 */

import { NextResponse } from 'next/server';
import { simplifyText } from '@/lib/ai';

export async function POST(request) {
  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: '缺少文本参数' }, { status: 400 });
    }

    const result = await simplifyText(text);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('AI 简化错误:', error);
    return NextResponse.json(
      { error: error.message || '文本简化失败' },
      { status: 500 }
    );
  }
}
