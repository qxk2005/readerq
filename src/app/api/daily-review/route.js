import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getReviewStatsData, recordReviewAction, getFallbackDailyReviewHighlights } from '@/lib/db';

/**
 * GET /api/daily-review
 * 获取今日每日回顾高亮卡片与打卡统计
 */
export async function GET() {
  try {
    const statsData = getReviewStatsData();
    let highlights = [];

    // 1. 尝试从 Readwise 官方 API 获取 Daily Review 推荐
    try {
      const client = getServerReadwiseClient();
      const readwiseData = await client.getDailyReview();

      if (readwiseData && (readwiseData.review_items || readwiseData.results)) {
        const items = readwiseData.review_items || readwiseData.results || [];
        highlights = items.map(item => {
          const hl = item.highlight || item;
          return {
            id: String(hl.id || item.id),
            text: hl.text || '',
            note: hl.note || '',
            color: hl.color || 'yellow',
            title: item.title || item.book_title || hl.title || 'Readwise Review',
            author: item.author || item.book_author || hl.author || '',
            source_url: item.source_url || hl.source_url || '',
            image_url: item.image_url || item.cover_image_url || '',
            category: item.category || 'article',
            tags: item.tags ? (Array.isArray(item.tags) ? item.tags.map(t => t.name || t) : Object.keys(item.tags)) : [],
          };
        });
      }
    } catch (apiErr) {
      console.warn('[DailyReview API] 调取 Readwise 官方 Review 接口失败，使用本地数据库智能抽样备用:', apiErr.message);
    }

    // 2. 如果官方 API 未返回或未配置 Token，从本地抽取 5 条作为 Fallback
    if (!highlights || highlights.length === 0) {
      highlights = getFallbackDailyReviewHighlights();
    }

    return NextResponse.json({
      success: true,
      highlights,
      stats: statsData,
    });
  } catch (error) {
    console.error('[DailyReview GET] 异常:', error);
    return NextResponse.json(
      { error: error.message || '获取每日回顾失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-review
 * 提交单条回顾操作 (reviewed / favorite / discard)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { highlightId, action, reviewDate } = body;

    if (!highlightId) {
      return NextResponse.json({ error: '缺少 highlightId' }, { status: 400 });
    }

    const todayDate = reviewDate || new Date().toISOString().split('T')[0];
    const act = action || 'reviewed';

    // 1. 记录到本地数据库并更新打卡与 Streak
    const statResult = recordReviewAction(todayDate, highlightId, act);

    // 2. 尝试将回顾结果异步发给 Readwise 官方 API
    let syncedToReadwise = false;
    try {
      const client = getServerReadwiseClient();
      let readwiseAction = 'keep';
      if (act === 'favorite') readwiseAction = 'favorite';
      if (act === 'discard') readwiseAction = 'discard';

      await client.submitReviewAction({
        highlight_id: parseInt(highlightId, 10) || highlightId,
        action: readwiseAction,
      });
      syncedToReadwise = true;
    } catch (syncErr) {
      console.warn('[DailyReview Sync] 发送 Readwise 官方 Action 失败 (本地已记录):', syncErr.message);
    }

    return NextResponse.json({
      success: true,
      syncedToReadwise,
      statResult,
    });
  } catch (error) {
    console.error('[DailyReview POST] 异常:', error);
    return NextResponse.json(
      { error: error.message || '提交回顾操作失败' },
      { status: 500 }
    );
  }
}
