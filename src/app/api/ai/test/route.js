import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSetting } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    let { openai_api_key, openai_base_url, openai_model, openai_max_tokens } = body;

    // 如果前端传过来的是脱敏的 key（包含星号），说明没改动，需要从数据库或环境变量获取真实值
    if (openai_api_key && openai_api_key.includes('••••')) {
      openai_api_key = getSetting('openai_api_key') || process.env.OPENAI_API_KEY;
    } else if (!openai_api_key) {
      openai_api_key = process.env.OPENAI_API_KEY || getSetting('openai_api_key');
    }

    if (!openai_base_url) {
      openai_base_url = process.env.OPENAI_BASE_URL || getSetting('openai_base_url') || 'https://api.openai.com/v1';
    }

    if (!openai_model) {
      openai_model = process.env.OPENAI_MODEL || getSetting('openai_model') || 'gpt-4o-mini';
    }

    if (openai_api_key) openai_api_key = openai_api_key.trim();
    if (openai_base_url) openai_base_url = openai_base_url.trim();
    if (openai_model) openai_model = openai_model.trim();

    if (openai_max_tokens !== undefined && openai_max_tokens !== null && String(openai_max_tokens).trim() !== '') {
      const parsed = parseInt(openai_max_tokens, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({
          success: false,
          error: '配置错误: 最大 Token 限制必须是一个大于 0 的正整数。'
        });
      }
    }

    if (!openai_api_key) {
      return NextResponse.json({
        success: false,
        error: '未配置 OpenAI API Key。请在输入框中填入你的 API Key，或在环境变量中配置'
      });
    }

    // 创建测试用的 OpenAI 客户端
    const client = new OpenAI({
      apiKey: openai_api_key,
      baseURL: openai_base_url,
    });

    const startTime = Date.now();
    
    // 发起极简的 Chat Completion 测试连接
    const response = await client.chat.completions.create({
      model: openai_model,
      messages: [
        { role: 'user', content: 'Say "Connection successful" in Chinese in 6 words or less.' }
      ],
      max_tokens: 20,
      temperature: 0.1,
    });

    const duration = Date.now() - startTime;
    const reply = response.choices[0]?.message?.content?.trim() || '无返回内容';

    return NextResponse.json({
      success: true,
      duration,
      reply
    });
  } catch (error) {
    console.error('AI 连接测试失败:', error);
    
    let errorMessage = error.message || '未知错误';
    
    // 对一些常见 HTTP 状态码或错误代码进行友好提示
    if (error.message.includes('Invalid URL') || error.message.includes('baseURL') || error.message.includes('relative URL')) {
      errorMessage = '配置错误: 无效的服务器地址 (Base URL)，请确保它是一个包含协议头的完整 URL (例如以 http:// 或 https:// 开头)。';
    } else if (error.status === 401) {
      errorMessage = '未授权 (401): API Key 无效或已过期，请检查你的 API Key。';
    } else if (error.status === 404) {
      errorMessage = `未找到 (404): 可能是模型名称 "${openai_model}" 不存在，或者 Base URL 不正确。`;
      if (openai_base_url && !openai_base_url.endsWith('/v1') && !openai_base_url.endsWith('/v1/')) {
        errorMessage += ' 提示：许多 OpenAI 兼容服务器（如 Ollama、vLLM 等）的地址需要以 "/v1" 结尾（例如 "http://localhost:11434/v1"）。';
      }
    } else if (error.code === 'ENOTFOUND' || error.message.includes('fetch failed') || error.message.includes('Connection error')) {
      errorMessage = '网络错误: 无法解析或连接到服务器地址，请检查你的服务器地址是否正确，以及网络连接是否正常。';
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    });
  }
}
