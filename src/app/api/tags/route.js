import { NextResponse } from 'next/server';
import { getCachedTags, getDetailedTagsStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDetailed = searchParams.get('detailed') === 'true';

    const tags = isDetailed ? getDetailedTagsStats() : getCachedTags();
    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('获取标签失败:', error);
    return NextResponse.json(
      { error: error.message || '获取标签失败' },
      { status: 500 }
    );
  }
}
