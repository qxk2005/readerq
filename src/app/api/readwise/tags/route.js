/**
 * Readwise 标签 API 路由
 */

import { NextResponse } from 'next/server';
import { getCachedTags } from '@/lib/db';

export async function GET() {
  try {
    const tags = getCachedTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('获取标签错误:', error);
    return NextResponse.json(
      { error: error.message || '获取标签失败' },
      { status: 500 }
    );
  }
}
