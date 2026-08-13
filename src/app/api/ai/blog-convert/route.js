/**
 * AI 博客转译 API 路由 (流式响应)
 * 将视频字幕转译为 InfoQ 风格的博客文章
 */

import { convertToBlogStream } from '@/lib/ai';

export async function POST(request) {
  try {
    const { transcript, content, articleContent, title, customPrompt, isVideo, category } = await request.json();
    const rawText = transcript || content || articleContent;
    if (!rawText || !rawText.trim()) {
      return new Response(JSON.stringify({ error: '缺少文章或字幕内容' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isVideoDoc = isVideo !== undefined ? Boolean(isVideo) : (category === 'video');
    const generator = convertToBlogStream(rawText, title || '未知文档', customPrompt, isVideoDoc);

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error('博客转译流式生成出错:', err);
          controller.enqueue(encoder.encode(`\n\n[博客转译出错: ${err.message || '网络连接或 API 返回异常'}]`));
          controller.close();
        }
      }
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('博客转译初始化错误:', error);
    return new Response(JSON.stringify({ error: error.message || '博客转译初始化失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
