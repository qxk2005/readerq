import { NextResponse } from 'next/server';
import { getCachedTags } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tags = getCachedTags();
    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('获取标签失败:', error);
    return NextResponse.json(
      { error: error.message || '获取标签失败' },
      { status: 500 }
    );
  }
}
