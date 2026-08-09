/**
 * 内部 API：获取完整的（未脱敏的）YouTube Cookie
 * 专供 Electron 主进程使用，用于注入到 Electron session 中
 * 使播放器 iframe 能携带用户的 Google 登录凭证
 * 
 * GET /api/settings/youtube-cookie-raw
 */

import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export async function GET() {
  try {
    const cookie = getSetting('youtube_cookie') || '';
    return NextResponse.json({ youtube_cookie: cookie });
  } catch (error) {
    console.error('获取 YouTube Cookie 失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
