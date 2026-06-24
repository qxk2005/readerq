/**
 * AI 翻译 API 路由
 */

import { NextResponse } from 'next/server';
import { translateText } from '@/lib/ai';

export async function POST(request) {
  try {
    const { text, targetLang } = await request.json();
    if (!text) {
      return NextResponse.json({ error: '缺少文本参数' }, { status: 400 });
    }

    const result = await translateText(text, targetLang);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('AI 翻译错误:', error);
    return NextResponse.json(
      { error: error.message || '翻译失败' },
      { status: 500 }
    );
  }
}
