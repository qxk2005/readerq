/**
 * OpenAI 兼容 API 封装
 * 支持用户自定义的 OpenAI 兼容服务器
 */

import OpenAI from 'openai';
import { getSetting } from './db.js';

/**
 * 从数据库读取设置（回退）
 */
function getDbSetting(key) {
  try {
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
    throw new Error('未配置 OpenAI API Key。请在设置中填入你的 API Key。');
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
 * 视频字幕转博客文章 (流式响应)
 * 将带时间戳的字幕文本转译为 InfoQ 风格的技术博客
 * @param {string} transcript - 带时间戳的完整字幕文本
 * @param {string} title - 视频标题
 * @param {string} [customPrompt] - 用户自定义的系统提示词（可选）
 */
export async function* convertToBlogStream(transcript, title, customPrompt) {
  const client = createAIClient();
  const model = getModelName();

  // 默认的博客转译系统提示词
  const defaultPrompt = `你是一位资深的技术博客编辑，专门为 InfoQ 等技术媒体撰写高质量的博客文章。

你的任务是将一段视频字幕（含时间戳）转译为一篇结构清晰、内容丰富的博客文章。

## 要求：
1. **输出语言**：必须使用简体中文撰写，无论原始字幕是何种语言，都必须翻译为简体中文
2. **文章结构**：使用 Markdown 格式，包含标题（使用 ## 和 ###）、段落、要点列表、表格等
3. **时间线对齐（非常重要）**：
   - 在每一个 Markdown 章节标题（如 ## 或 ###）的结尾，必须标注对应视频的时间戳标记 \`[MM:SS]\` 或 \`[HH:MM:SS]\`，例如 \`## 一、背景介绍 [01:25]\` 或 \`### 1.1 自动化流程 [04:30]\`。
   - 在正文中的核心观点或要点段落开头，也可附带对应的时间戳标记如 \`[08:15]\`，方便读者点击跳转观看原视频重点。
4. **内容质量**：保留原视频的核心观点和论述逻辑，重新组织为适合阅读的文章形式
5. **语言风格**：专业但易读，类似 InfoQ、少数派、36Kr 等技术媒体的行文风格
6. **去除口语化**：将口语化的表达转换为书面语，去除语气词、重复内容和离题闲聊
7. **保留关键信息**：确保原视频中的数据、案例、技术细节等关键信息不丢失

## 输出格式：
直接输出简体中文 Markdown 格式的博客文章，不需要额外的说明或注释。`;

  // 优先使用用户自定义提示词，否则使用默认提示词
  const dbPrompt = getDbSetting('video_blog_prompt');
  const systemPrompt = customPrompt || dbPrompt || defaultPrompt;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请将以下视频字幕转译为一篇简体中文博客文章。无论原始字幕是什么语言，输出必须全部使用简体中文，并在每个章节标题结尾必须带上对应的时间戳 [MM:SS]。\n\n视频标题：${title}\n\n字幕内容：\n${transcript}`,
      }
    ],
    temperature: 0.4,
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

/**
 * 将字幕段落 AI 翻译为中英文双语对照结构
 * @param {Array<{time: number, timeStr: string, text: string}>} segments
 * @returns {Promise<Array<{time: number, timeStr: string, text: string, zh: string, en: string}>>}
 */
export async function translateSubtitlesToBilingual(segments) {
  if (!segments || segments.length === 0) return [];
  const client = createAIClient();
  const model = getModelName();

  const formattedInput = segments.map((s, idx) => ({
    id: idx,
    text: s.text,
  }));

  const prompt = `你是一位资深的高精中英双语字幕翻译大师。
你的核心任务是将传入的视频字幕段落列表翻译为流畅、准确、通顺的简体中文。

输出格式要求：
请必须返回 JSON 格式，结构为：
{
  "subtitles": [
    { "id": 0, "zh": "准确的简体中文翻译" }
  ]
}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(formattedInput) }
      ],
      temperature: 0.2,
    });

    const choice = response.choices[0];
    const content = extractAIResponse(choice);
    let parsed = [];
    try {
      const data = JSON.parse(content);
      parsed = Array.isArray(data) ? data : (data.subtitles || data.items || data.results || []);
    } catch {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    const resultMap = new Map((parsed || []).map(item => [item.id, item]));

    return segments.map((seg, idx) => {
      const item = resultMap.get(idx);
      const rawEnglishText = (seg.text || '').trim();
      const zhTranslation = item?.zh ? item.zh.trim() : rawEnglishText;

      return {
        ...seg,
        zh: zhTranslation,
        en: rawEnglishText, // 🎯 关键：死死锁定原视频英文原文顺序，严禁篡改或倒装单词！
      };
    });
  } catch (err) {
    console.error('AI 字幕双语翻译出错:', err);
    throw new Error(`AI 翻译服务异常 (${err.status || err.message || '未知错误'}): ${err.message}`);
  }
}

/**
 * 检查系统是否已配置 OpenAI 兼容服务
 */
export function isAIConfigured() {
  try {
    const apiKey = getDbSetting('openai_api_key') || process.env.OPENAI_API_KEY;
    return !!(apiKey && apiKey.trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * 将视频字幕大纲转化并深度生成为精选“字幕博客文章” (HTML/Markdown 格式)
 * @param {Array<{start: number, text: string, zh?: string}>} segments 
 * @param {string} title 
 * @returns {Promise<string>} 生成的博客富文本 HTML
 */
export async function convertSubtitlesToBlog(segments, title = '视频整理') {
  if (!segments || segments.length === 0) return '';
  if (!isAIConfigured()) return '';

  const client = createAIClient();
  const model = getModelName();

  const fullText = segments.map(s => {
    const timeTag = s.timeStr ? `[${s.timeStr}]` : (typeof s.time === 'number' ? `[${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}]` : '');
    const content = s.zh ? `${s.zh} (${s.text})` : s.text;
    return `${timeTag} ${content}`;
  }).join('\n');

  const prompt = `你是一位顶尖的技术博客主编与知识博主。
请将下面传入的视频字幕整理生成一篇优雅、结构化、条理清晰的【视频精选博客文章】(Markdown 格式)。

**核心关键要求（极其重要）**：
1. 必须在所有章节标题 (## / ###) 末尾或开头附带该主题在视频中对应的起始时间戳，例如 \`## 初见倾心：为“护照”形态上瘾 [0:58]\`；
2. 必须在正文论述关键看点、核心功能演示、试用体会或结论时，显式保留或插入对应的视频时间戳节点标记（例如：\`在 [1:45] 处，展示了单手折叠的惊艳感受\` 或 \`[2:30] 的屏幕悬停功能堪称创新\`）；
3. 时间戳格式必须严格为 \`[mm:ss]\` 或 \`[hh:mm:ss]\` 格式（如 \`[0:58]\`），以便读者在阅读时可以直接点击时间戳跳播到对应的视频画面帧！
4. 包含【核心摘要与金句速览】；
5. 将文字整理为流畅自然的博文表达，修饰口语化词汇；
6. 输出干净漂亮的 Markdown 结构化内容。`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `视频标题: ${title}\n\n完整带时间戳字幕内容:\n${fullText.slice(0, 18000)}` }
      ],
      temperature: 0.5,
    });

    const choice = response.choices[0];
    return extractAIResponse(choice);
  } catch (err) {
    console.error('AI 字幕生成博客文章失败:', err);
    return '';
  }
}

