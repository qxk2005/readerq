import { NextResponse } from 'next/server';
import { setSyncState } from '@/lib/db';

export async function POST() {
  try {
    setSyncState('sync_cancel_requested', 'true');
    setSyncState('sync_status', 'canceling');

    return NextResponse.json({
      success: true,
      message: '已发送取消指令，等待后台任务中止'
    });
  } catch (error) {
    console.error('取消同步错误:', error);
    return NextResponse.json(
      { error: error.message || '发送取消指令失败' },
      { status: 500 }
    );
  }
}
