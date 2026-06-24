/**
 * AI 定义/查询 API 路由
 */

import { NextResponse } from 'next/server';
import { defineText } from '@/lib/ai';

export async function POST(request) {
  try {
    const { text, context } = await request.json();
    if (!text) {
      return NextResponse.json({ error: '缺少文本参数' }, { status: 400 });
    }

    const result = await defineText(text, context);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('AI 定义错误:', error);
    return NextResponse.json(
      { error: error.message || '定义查询失败' },
      { status: 500 }
    );
  }
}
