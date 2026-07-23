import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';

/**
 * POST /api/daily-review/complete
 * 显式向 Readwise 官方 API 发送 POST https://readwise.io/api/v2/review/complete/ 打卡完成指令
 */
export async function POST() {
  try {
    const client = getServerReadwiseClient();
    const result = await client.markDailyReviewComplete();

    return NextResponse.json({
      success: true,
      message: '已成功向 Readwise 官方同步今日 Daily Review 完成状态！',
      result
    });
  } catch (error) {
    console.error('[DailyReview Complete API] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '同步 Readwise 官方打卡完成状态失败'
    }, { status: 500 });
  }
}
