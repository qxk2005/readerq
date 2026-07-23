import { NextResponse } from 'next/server';
import { updateHighlightAndTags } from '@/lib/db';

/**
 * POST /api/daily-review/update-highlight
 * 更新单条划线高亮 Markdown 正文、笔记与标签，并同步更新 SQLite
 */
export async function POST(req) {
  try {
    const { highlightId, text, note, tags } = await req.json();

    if (!highlightId) {
      return NextResponse.json({ success: false, error: '缺少 highlightId 参数' }, { status: 400 });
    }

    const updated = updateHighlightAndTags(highlightId, text || '', note || '', tags || []);

    return NextResponse.json({
      success: true,
      updated,
      highlight: { id: highlightId, text, note, tags }
    });
  } catch (error) {
    console.error('[UpdateHighlight API] 异常:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
