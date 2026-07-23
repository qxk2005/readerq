import { NextResponse } from 'next/server';
import { getArticleHighlightsByTitle } from '@/lib/db';

/**
 * GET /api/daily-review/article-highlights?title=xxx
 * 获取指定文章所属的所有划线高亮列表
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');

    if (!title) {
      return NextResponse.json({ success: false, highlights: [] });
    }

    const highlights = getArticleHighlightsByTitle(title);

    return NextResponse.json({
      success: true,
      title,
      highlights
    });
  } catch (error) {
    console.error('[ArticleHighlights API] 异常:', error);
    return NextResponse.json({ success: false, highlights: [], error: error.message }, { status: 500 });
  }
}
