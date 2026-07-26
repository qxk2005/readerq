/**
 * ReaderQ 图片防爬虫/防盗链代理 API
 * 用于处理带特殊后缀 (!ys)、防盗链或 Referer 限制的图片
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
  }

  try {
    let finalUrl = targetUrl.trim();
    if (finalUrl.startsWith('//')) {
      finalUrl = `https:${finalUrl}`;
    }

    const parsedUrl = new URL(finalUrl);
    const domain = parsedUrl.hostname;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    // 针对常见防盗链域名进行 Referer 伪造
    if (domain.includes('aixq.cc') || domain.includes('tu.aixq')) {
      headers['Referer'] = 'https://www.aixq.cc/';
    } else if (domain.includes('qpic.cn') || domain.includes('weixin')) {
      headers['Referer'] = 'https://mp.weixin.qq.com/';
    } else if (domain.includes('zhimg.com')) {
      headers['Referer'] = 'https://www.zhihu.com/';
    } else {
      headers['Referer'] = `${parsedUrl.origin}/`;
    }

    let response = await fetch(finalUrl, { headers, signal: AbortSignal.timeout(15000) });

    // 如果带 !ys 等后缀的 URL 返回 404 或 403，自动剥离 !... 后缀重试原图
    if (!response.ok && /![a-zA-Z0-9_-]+$/.test(finalUrl)) {
      const cleanUrl = finalUrl.replace(/![a-zA-Z0-9_-]+$/, '');
      const retryResp = await fetch(cleanUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (retryResp.ok) {
        response = retryResp;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `图片抓取失败 (HTTP ${response.status})` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || '代理拉取图片异常' }, { status: 500 });
  }
}
