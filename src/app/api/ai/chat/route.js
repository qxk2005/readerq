/**
 * AI 对话 API 路由 (流式响应)
 */

import { chat } from '@/lib/ai';

export async function POST(request) {
  try {
    const { messages, documentContext } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: '缺少消息参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await chat(messages, documentContext);
    return new Response(JSON.stringify({ response }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI 对话错误:', error);
    return new Response(JSON.stringify({ error: error.message || 'AI 对话失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
