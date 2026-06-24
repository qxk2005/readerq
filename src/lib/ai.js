/**
 * OpenAI 兼容 API 封装
 * 支持用户自定义的 OpenAI 兼容服务器
 */

import OpenAI from 'openai';

/**
 * 从数据库读取设置（回退）
 */
function getDbSetting(key) {
  try {
    const { getSetting } = require('@/lib/db');
    return getSetting(key);
  } catch { return null; }
}

/**
 * 创建 OpenAI 客户端
 * 优先使用数据库中用户设置的值，回退到环境变量配置
 */
export function createAIClient() {
  let apiKey = getDbSetting('openai_api_key') || process.env.OPENAI_API_KEY;
  let baseURL = getDbSetting('openai_base_url') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (apiKey) apiKey = apiKey.trim();
  if (baseURL) baseURL = baseURL.trim();

  if (!apiKey) {
    throw new Error('未配置 OpenAI API Key。请在设置中填入你的 API Key，或在 .env.local 中配置 OPENAI_API_KEY');
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * 获取配置的模型名称
 */
export function getModelName() {
  const model = getDbSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return model ? model.trim() : 'gpt-4o-mini';
}

/**
 * 获取配置的最大 Token 限制
 */
export function getMaxTokens() {
  const val = getDbSetting('openai_max_tokens') || process.env.OPENAI_MAX_TOKENS;
  if (val) {
    const valStr = String(val).trim();
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 4096; // 默认值
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
    max_tokens: getMaxTokens(),
  });

  return extractAIResponse(response.choices[0]) || '无法生成摘要';
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
    max_tokens: getMaxTokens(),
  });

  return extractAIResponse(response.choices[0]) || '无法生成定义';
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
    max_tokens: getMaxTokens(),
  });

  return extractAIResponse(response.choices[0]) || '无法翻译';
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
    max_tokens: getMaxTokens(),
  });

  return extractAIResponse(response.choices[0]) || '无法简化';
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
    max_tokens: getMaxTokens(),
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
    max_tokens: getMaxTokens(),
  });

  return extractAIResponse(response.choices[0]) || '无法生成回复';
}

/**
 * 安全提取 AI 响应正文
 * 兼容带有推理思考链（Reasoning）的兼容模型在被截断时的回退处理
 */
function extractAIResponse(choice) {
  if (!choice || !choice.message) return '';
  
  const content = choice.message.content;
  if (content && content.trim()) {
    return content.trim();
  }
  
  // 回退提取推理过程，防止在被截断时返回空内容
  const reasoning = choice.message.reasoning_content || choice.message.reasoning;
  if (reasoning && reasoning.trim()) {
    return `[模型推理被截断，输出思考过程]:\n${reasoning.trim()}`;
  }
  
  return '';
}
