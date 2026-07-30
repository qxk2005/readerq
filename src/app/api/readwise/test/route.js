import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/readwise/test
 * 测试 Readwise Access Token 的连通性与有效性
 */
export async function POST(request) {
  try {
    let { token } = await request.json().catch(() => ({}));

    // 如果未传或传入脱敏 token (含 ••••)，从数据库或环境变量读取
    if (!token || token.includes('••••')) {
      token = getSetting('readwise_token') || process.env.READWISE_API_TOKEN;
    }

    if (!token || typeof token !== 'string' || token.trim() === '') {
      return NextResponse.json({
        success: false,
        error: '未配置 Readwise Access Token。请填写您的 Readwise API 令牌。'
      }, { status: 200 });
    }

    const cleanToken = token.trim();

    // 向 Readwise 官方 AUTH / API v3 接口发送轻量鉴权测试
    const response = await fetch('https://readwise.io/api/v2/auth/', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${cleanToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000), // 8 秒超时
    });

    if (response.ok || response.status === 204) {
      return NextResponse.json({
        success: true,
        message: 'Readwise API Token 验证成功！连通性正常。'
      });
    }

    if (response.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'Readwise 验证失败 (401 未授权): Access Token 无效或已过期，请检查 Token 是否复制完整。'
      }, { status: 200 });
    }

    const errorText = await response.text().catch(() => '');
    return NextResponse.json({
      success: false,
      error: `Readwise 服务器响应异常 (HTTP ${response.status}): ${errorText || '网络请求未通过'}`
    }, { status: 200 });

  } catch (error) {
    console.error('Readwise 测试异常:', error);
    let errorMsg = error.message || '网络连接失败';
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      errorMsg = '连接 Readwise 超时，请检查本地网络或网络代理设置。';
    }
    return NextResponse.json({
      success: false,
      error: errorMsg
    }, { status: 200 });
  }
}
