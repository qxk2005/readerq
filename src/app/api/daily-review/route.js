import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getReviewStatsData, recordReviewAction, getFallbackDailyReviewHighlights, getSetting } from '@/lib/db';

/**
 * GET /api/daily-review
 * 获取今日每日回顾高亮卡片与打卡统计
 */
export async function GET() {
  try {
    const statsData = getReviewStatsData();
    let userTarget = getSetting('daily_review_target') || 'auto';
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

    // 2. 如果官方 API 未返回或未配置 Token，从本地数据库智能抽取指定数量 (默认 15 条)
    const targetLimit = userTarget === 'auto' ? 15 : (parseInt(userTarget, 10) || 15);
    if (!highlights || highlights.length === 0) {
      highlights = getFallbackDailyReviewHighlights(targetLimit);
    }

    // 3. 动态将 statsData.targetCount 与实际回顾条数完全对齐 (优先使用配置的目标数 15)
    statsData.targetCount = targetLimit;

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
    const { highlightId, action, reviewDate, targetCount } = body;

    if (!highlightId) {
      return NextResponse.json({ error: '缺少 highlightId' }, { status: 400 });
    }

    const todayDate = reviewDate || new Date().toISOString().split('T')[0];
    const act = action || 'reviewed';

    // 1. 记录到本地数据库并更新打卡与 Streak
    const statResult = recordReviewAction(todayDate, highlightId, act, targetCount);

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

      // 3. 如果今日回顾已全部完成，向 Readwise 官方服务器发送 Complete 打卡标记！
      if (statResult.isCompleted || statResult.reviewedCount >= (targetCount || 15)) {
        await client.markDailyReviewComplete();
        console.log('[DailyReview Sync] 成功向 Readwise 官方 API 成功标记今日 Daily Review 已全部打卡完成！');
      }
    } catch (syncErr) {
      console.warn('[DailyReview Sync] 发送 Readwise 官方 Action / Complete 失败 (本地已记录):', syncErr.message);
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
