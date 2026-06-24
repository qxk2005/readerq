/**
 * AI 对话 API 路由 (流式响应)
 */

import { chatStream } from '@/lib/ai';

export async function POST(request) {
  try {
    const { messages, documentContext } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: '缺少消息参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const generator = chatStream(messages, documentContext);

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          console.error('流式对话生成出错:', err);
          // 在流中输出友好的错误并关闭
          controller.enqueue(encoder.encode(`\n\n[对话中途出错: ${err.message || '网络连接或 API 返回异常'}]`));
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
    console.error('AI 对话初始化错误:', error);
    return new Response(JSON.stringify({ error: error.message || 'AI 对话初始化失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
