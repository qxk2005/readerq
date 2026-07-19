import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSetting } from '@/lib/db';

export async function POST(request) {
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    async start(controller) {
      const sendChunk = (data) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      try {
        // 阶段 1: 配置参数校验
        sendChunk({ type: 'stage', id: 'validate', status: 'running', message: '正在解析并校验本地配置参数...' });
        
        let body;
        try {
          body = await request.json();
        } catch (e) {
          throw new Error('请求数据格式错误');
        }

        let { openai_api_key, openai_base_url, openai_model, openai_max_tokens } = body;

        // 如果前端传过来的是脱敏的 key（包含星号），说明没改动，需要从数据库或环境变量获取真实值
        if (openai_api_key && openai_api_key.includes('••••')) {
          openai_api_key = getSetting('openai_api_key') || process.env.OPENAI_API_KEY;
        } else if (!openai_api_key) {
          openai_api_key = getSetting('openai_api_key') || process.env.OPENAI_API_KEY;
        }

        if (!openai_base_url) {
          openai_base_url = getSetting('openai_base_url') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        }

        if (!openai_model) {
          openai_model = getSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
        }

        if (openai_api_key) openai_api_key = openai_api_key.trim();
        if (openai_base_url) openai_base_url = openai_base_url.trim();
        if (openai_model) openai_model = openai_model.trim();

        if (openai_max_tokens !== undefined && openai_max_tokens !== null && String(openai_max_tokens).trim() !== '') {
          const parsed = parseInt(openai_max_tokens, 10);
          if (isNaN(parsed) || parsed <= 0) {
            throw new Error('配置错误: 最大 Token 限制必须是一个大于 0 的正整数。');
          }
        }

        if (!openai_api_key) {
          throw new Error('未配置 OpenAI API Key。请在设置页面中填入你的 API Key。');
        }

        sendChunk({ type: 'stage', id: 'validate', status: 'success', message: '配置参数校验通过' });

        // 阶段 2: 服务器连通性测试
        sendChunk({ type: 'stage', id: 'connect', status: 'running', message: `正在尝试连接 AI 服务器: ${openai_base_url} ...` });
        const startConnectTime = Date.now();
        
        // 我们尝试请求 base_url 来检测网络连通性。使用 6 秒超时。
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 6000);
        
        try {
          // 只做简单请求测试服务器响应
          // 注意：许多 API 网关在 GET 根路径时可能会返回 404 或 401，这依然说明网络可达且服务在线。
          await fetch(openai_base_url, {
            method: 'GET',
            signal: abortController.signal,
          }).catch(err => {
            // fetch 失败（如网络错误，如果是 404 等 http 报错会被 catch 吗？fetch 的 promise 只有网络错误才会 reject）
            if (err.name === 'AbortError') throw err;
            throw new Error(`无法连接到该地址: ${err.message}`);
          });
        } catch (netErr) {
          if (netErr.name === 'AbortError') {
            throw new Error(`连接超时: 无法在 6 秒内连接到服务器 ${openai_base_url}。请检查您的网络连接或代理设置。`);
          }
          let msg = netErr.message || '网络连接失败';
          if (msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
            msg = '域名解析失败或网络未连接。请检查服务器地址是否正确，或本地网络是否可达。';
          }
          throw new Error(msg);
        } finally {
          clearTimeout(timeoutId);
        }

        const connectDuration = Date.now() - startConnectTime;
        sendChunk({ type: 'stage', id: 'connect', status: 'success', message: `服务器连接成功 (响应时间: ${connectDuration}ms)` });

        // 阶段 3: 对话模型可用性测试
        sendChunk({ type: 'stage', id: 'chat', status: 'running', message: `正在向模型 ${openai_model} 发送测试对话请求...` });
        const startChatTime = Date.now();

        const client = new OpenAI({
          apiKey: openai_api_key,
          baseURL: openai_base_url,
        });

        const response = await client.chat.completions.create({
          model: openai_model,
          messages: [
            { role: 'user', content: 'Say "Connection successful" in Chinese in 6 words or less.' }
          ],
          max_tokens: 20,
          temperature: 0.1,
        });

        const chatDuration = Date.now() - startChatTime;
        const reply = response.choices[0]?.message?.content?.trim() || '无返回内容';

        sendChunk({ type: 'stage', id: 'chat', status: 'success', message: '模型对话测试成功！' });
        
        // 测试完成
        sendChunk({
          type: 'done',
          success: true,
          duration: connectDuration + chatDuration,
          reply
        });
        
        controller.close();
      } catch (error) {
        console.error('AI 连接测试失败:', error);
        
        let errorMessage = error.message || '未知错误';
        
        // 针对常见错误进行友好包装
        if (error.message.includes('Invalid URL') || error.message.includes('baseURL') || error.message.includes('relative URL')) {
          errorMessage = '配置错误: 无效的服务器地址 (Base URL)，请确保它是一个包含协议头的完整 URL (例如以 http:// 或 https:// 开头)。';
        } else if (error.status === 401) {
          errorMessage = '未授权 (401): API Key 无效或已过期，请检查你的 API Key。';
        } else if (error.status === 404) {
          errorMessage = `未找到 (404): 可能是模型名称 "${openai_model}" 不存在，或者 Base URL 不正确。`;
          if (openai_base_url && !openai_base_url.endsWith('/v1') && !openai_base_url.endsWith('/v1/')) {
            errorMessage += '\n提示：许多 OpenAI 兼容服务器（如 Ollama、vLLM 等）的地址需要以 "/v1" 结尾（例如 "http://localhost:11434/v1"）。';
          }
        } else if (error.code === 'ENOTFOUND' || error.message.includes('fetch failed') || error.message.includes('Connection error')) {
          errorMessage = '网络错误: 无法解析或连接到服务器地址，请检查你的服务器地址是否正确，以及网络连接是否正常。';
        }

        // 发送错误状态
        sendChunk({
          type: 'error',
          error: errorMessage
        });
        controller.close();
      }
    }
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
