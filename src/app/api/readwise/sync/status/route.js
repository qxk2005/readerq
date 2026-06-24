import { NextResponse } from 'next/server';
import { getSyncState, getDocumentCount } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = getSyncState('sync_status') || 'idle';
    const rawProgress = getSyncState('sync_progress');
    const error = getSyncState('sync_error') || null;
    const lastSyncTime = getSyncState('lastDocumentSync') || null;
    
    // 获取本地与云端文档总数比对
    const localCount = getDocumentCount();
    const remoteCount = getSyncState('remote_doc_count') || 0;

    let progress = null;
    if (rawProgress) {
      try {
        progress = JSON.parse(rawProgress);
      } catch (e) {
        // ignore JSON parse error
      }
    }

    return NextResponse.json({
      success: true,
      status,
      progress,
      error,
      lastSyncTime,
      localCount,
      remoteCount: parseInt(remoteCount, 10) || 0,
    });
  } catch (error) {
    console.error('获取同步状态错误:', error);
    return NextResponse.json(
      { error: error.message || '获取状态失败' },
      { status: 500 }
    );
  }
}
