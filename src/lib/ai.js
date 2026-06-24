/**
 * OpenAI 兼容 API 封装
 * 支持用户自定义的 OpenAI 兼容服务器
 */

import OpenAI from 'openai';

/**
 * 创建 OpenAI 客户端
 */
export function createAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('未配置 OPENAI_API_KEY 环境变量');
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * 获取配置的模型名称
 */
export function getModelName() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * 文档摘要
 */
export async function summarizeDocument(title, content) {
  const client = createAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的文档摘要助手。请用简体中文提供简洁、准确的摘要。摘要应包含文档的核心要点，长度控制在 200-400 字之间。'
      },
      {
        role: 'user',
        content: `请为以下文档生成摘要：\n\n标题：${title}\n\n内容：${content.substring(0, 8000)}`
      }
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return response.choices[0]?.message?.content || '无法生成摘要';
}

/**
 * 词义/概念查询
 */
export async function defineText(text, context) {
  const client = createAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: '你是一个知识渊博的百科助手。请用简体中文解释所给的词语或概念。如果提供了上下文，请结合上下文进行解释。回答应简洁、准确、有教育意义。'
      },
      {
        role: 'user',
        content: context
          ? `请解释"${text}"在以下上下文中的含义：\n\n${context.substring(0, 2000)}`
          : `请解释"${text}"的含义。`
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || '无法生成定义';
}

/**
 * 文本翻译
 */
export async function translateText(text, targetLang = '简体中文') {
  const client = createAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `你是一个专业的翻译助手。请将给定的文本翻译成${targetLang}。翻译应自然流畅，保持原文的风格和语气。只输出翻译结果，不要添加任何解释。`
      },
      {
        role: 'user',
        content: text
      }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || '无法翻译';
}

/**
 * 文本简化
 */
export async function simplifyText(text) {
  const client = createAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: '你是一个文本简化助手。请用简体中文将复杂的文本改写成简单易懂的语言，保持核心含义不变。使用日常用语，避免专业术语。'
      },
      {
        role: 'user',
        content: `请简化以下文本：\n\n${text}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || '无法简化';
}

/**
 * AI 对话 (流式响应)
 */
export async function* chatStream(messages, documentContext) {
  const client = createAIClient();
  const model = getModelName();

  const systemMessage = documentContext
    ? `你是 ReaderQ 阅读助手（代号 GhostReader）。你的任务是帮助用户理解和分析他们正在阅读的文档。请用简体中文回答。\n\n当前文档内容：\n${documentContext.substring(0, 6000)}`
    : '你是 ReaderQ 阅读助手（代号 GhostReader）。你的任务是帮助用户理解和分析他们正在阅读的文档。请用简体中文回答。';

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      ...messages
    ],
    temperature: 0.5,
    max_tokens: 2000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * AI 对话 (非流式)
 */
export async function chat(messages, documentContext) {
  const client = createAIClient();
  const model = getModelName();

  const systemMessage = documentContext
    ? `你是 ReaderQ 阅读助手（代号 GhostReader）。你的任务是帮助用户理解和分析他们正在阅读的文档。请用简体中文回答。\n\n当前文档内容：\n${documentContext.substring(0, 6000)}`
    : '你是 ReaderQ 阅读助手（代号 GhostReader）。你的任务是帮助用户理解和分析他们正在阅读的文档。请用简体中文回答。';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemMessage },
      ...messages
    ],
    temperature: 0.5,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || '无法生成回复';
}
