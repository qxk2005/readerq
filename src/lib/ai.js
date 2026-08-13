/**
 * OpenAI 兼容 API 封装
 * 支持用户自定义的 OpenAI 兼容服务器
 */

import OpenAI from 'openai';
import { getSetting } from './db.js';
import { cleanBlogMarkdownText } from './textSanitizer.js';
export { cleanBlogMarkdownText };

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
 * 文章/字幕转博客文章 (流式响应)
 * 支持视频字幕（带时间戳 [MM:SS]）及通用文章/PDF/EPUB（带语义引用锚点 [原文](#quote-...)）
 * @param {string} contentText - 文本或字幕内容
 * @param {string} title - 文章标题
 * @param {string} [customPrompt] - 用户自定义系统提示词
 * @param {boolean} [isVideo=false] - 是否为视频文章
 */
export async function* convertToBlogStream(contentText, title, customPrompt, isVideo = false) {
  const client = createAIClient();
  const model = getModelName();

  // 默认视频博客提示词
  const defaultVideoPrompt = `你是一位资深的技术博客编辑，专门为 InfoQ 等技术媒体撰写高质量的博客文章。

你的任务是将一段视频字幕（含时间戳）转译为一篇结构清晰、内容丰富的博客文章。

## 要求：
1. **输出语言**：必须使用简体中文撰写，无论原始字幕是何种语言，都必须翻译为简体中文
2. **文章结构**：使用 Markdown 格式，包含标题（使用 ## 和 ###）、段落、要点列表、表格等
3. **章节标题时间戳对齐（极度重要）**：
   - 必须且仅在每一个 Markdown 章节标题（如 ## 或 ###）的结尾，标注对应视频的时间戳标记 \`[MM:SS]\` 或 \`[HH:MM:SS]\`，例如 \`## 一、背景介绍 [01:25]\` 或 \`### 1.1 自动化流程 [04:30]\`。
   - **严禁在任何正文段落内、要点列表内、引用或句末插入 \`[xx:xx]\` 时间戳标记**！保持正文阅读体验纯粹顺畅。
4. **内容质量**：保留原视频的核心观点和论述逻辑，重新组织为适合阅读的文章形式
5. **语言风格**：专业但易读，类似 InfoQ、少数派、36Kr 等技术媒体的行文风格
6. **去除口语化**：将口语化的表达转换为书面语，去除语气词、重复内容和离题闲聊
7. **保留关键信息**：确保原视频中的数据、案例、技术细节等关键信息不丢失
8. **输出纯净性（极度重要）**：严禁在文章中包含任何 <|begin_of_sentence|>、<|begin_of_text|> 等 AI 内部 Tag 标记，严禁包含 #include 等伪代码指令！

## 输出格式：
直接输出简体中文 Markdown 格式的博客文章，不需要额外的说明或注释。`;

  // 默认通用文章博客提示词
  const defaultGeneralPrompt = `你是一位资深的高级读书笔记与文章分析专家，专门将长文、报告、书籍章节转译为结构化的精品博客导读文章。

你的任务是将一篇给定的文章转译为一篇逻辑缜密、要点突出、极具阅读价值的简体中文博客导读。

## 要求：
1. **输出语言**：必须完全使用简体中文撰写，无论原文是英文、中文或其他语言。
2. **文章结构**：使用 Markdown 格式，包含导读摘要、核心章节拆解（使用 ## 和 ### 标题）、关键事实/要点列表。
3. **原文语义引用锚点（极度重要）**：
   - 在每一个 Markdown 章节标题末尾，以及关键要点/数据结论末尾，附带一个针对原文对应短语或句子的语义引用链接，格式严格为 \`[原文](#quote-原文中的关键短语或标题句)\`。
   - 例如：\`## 架构设计原理 [原文](#quote-架构设计的首要原则)\` 或 \`- 吞吐量提升了40% [原文](#quote-性能测试显示吞吐量提升40%)\`。
   - \`#quote-\` 后面的文字必须取自原文中能代表该段落/要点特征的连续文本片段（10-25个字），以便阅读器通过文本模糊查找定位到原文对应段落。
4. **内容质量**：高度提炼核心思想，去除修饰性废话，保持极高的信息密度。
5. **输出纯净性**：严禁包含任何 <|begin_of_sentence|> 等模型 Tag 或伪代码指令。

## 输出格式：
直接输出简体中文 Markdown 格式的博客文章，不要包含额外的自我介绍或说明。`;

  const defaultPrompt = isVideo ? defaultVideoPrompt : defaultGeneralPrompt;
  const dbPrompt = getDbSetting(isVideo ? 'video_blog_prompt' : 'article_blog_prompt');
  const systemPrompt = customPrompt || dbPrompt || defaultPrompt;

  const userPrompt = isVideo
    ? `请将以下视频字幕转译为一篇简体中文博客文章。无论原始字幕是什么语言，输出必须全部使用简体中文，并在每个章节标题结尾必须带上对应的时间戳 [MM:SS]，严禁在正文段落内出现 [xx:xx] 时间戳。严禁输出任何 <|begin_of_sentence|> 等模型标记或 #include 等伪指令。\n\n视频标题：${title}\n\n字幕内容：\n${contentText}`
    : `请将以下文章转译为一篇结构精炼的简体中文博客导读文章。无论原文是何种语言，输出必须全部使用简体中文。在各个章节标题及关键事实要点结尾必须包含针对原文的引用链接格式 [原文](#quote-原文关键片段)。严禁输出任何 <|begin_of_sentence|> 等模型标记或伪代码。\n\n文章标题：${title}\n\n文章内容：\n${contentText.substring(0, 15000)}`;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.4,
    max_tokens: Math.max(getMaxTokens(), 8192),
    stream: true,
  });

  // 实时过滤 Special Tokens 的正则
  const specialTokenPattern = /<\|?\s*(?:begin_of_sentence|end_of_sentence|begin_of_text|end_of_text|im_start|im_end|endoftext|fim_prefix|fim_suffix|fim_middle)\s*\|?>/gi;

  for await (const chunk of stream) {
    let content = chunk.choices[0]?.delta?.content;
    if (content) {
      content = content.replace(specialTokenPattern, '');
      if (content) {
        yield content;
      }
    }
  }
}

/**
 * 安全提取 AI 响应正文
 * 仅提取 message.content，绝不回退到 reasoning_content（推理链含 Special Tokens 和乱码）
 */
function extractAIResponse(choice) {
  if (!choice || !choice.message) return '';
  
  const content = choice.message.content;
  if (content && content.trim()) {
    return content.trim();
  }
  
  // 如果 content 为空（模型被截断），返回空字符串
  // 绝不将推理思考链（reasoning_content）作为正文内容输出
  console.warn('[extractAIResponse] AI 返回的 content 为空（可能被截断），不回退 reasoning 内容');
  return '';
}

// 常见字幕标记/拟声词本地映射
const COMMON_SUBTITLE_TAGS = {
  '[laughter]': '[笑声]',
  '(laughter)': '(笑声)',
  '[music]': '[音乐]',
  '(music)': '(音乐)',
  '[applause]': '[掌声]',
  '(applause)': '(掌声)',
  '[cheering]': '[欢呼声]',
  '(cheering)': '(欢呼声)',
  '[sigh]': '[叹气]',
  '(sigh)': '(叹气)',
  '[gasp]': '[喘息]',
  '(gasp)': '(喘息)',
};

function containsChineseText(str) {
  if (!str) return false;
  return /[\u4e00-\u9fa5]/.test(str);
}

function isNeedsChineseTranslation(enText, zhText) {
  if (!enText) return false;
  const rawText = enText.trim();
  // 如果不含英文字母（如纯数字或纯标点），不需要中文汉字翻译
  if (!/[a-zA-Z]/.test(rawText)) return false;

  const rawLower = rawText.toLowerCase();
  if (COMMON_SUBTITLE_TAGS[rawLower]) return false;

  const zh = (zhText || '').trim();
  if (!zh) return true;
  if (zh === rawText) return true;
  if (!containsChineseText(zh)) return true;

  return false;
}

function safeParseSubtitleJSON(content) {
  if (!content || typeof content !== 'string') return [];

  let clean = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\[模型推理被截断[^\]]*\]:?/g, '')
    .trim();

  const codeMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeMatch && codeMatch[1]) {
    clean = codeMatch[1].trim();
  }

  try {
    const data = JSON.parse(clean);
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const arr = data.subtitles || data.items || data.results || data.data;
      if (Array.isArray(arr)) return arr;
    }
  } catch {}

  const objMatch = clean.match(/\{[\s\S]*"subtitles"[\s\S]*\}/) || clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const data = JSON.parse(objMatch[0]);
      const arr = Array.isArray(data) ? data : (data.subtitles || data.items || data.results || data.data);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }

  const arrMatch = clean.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrMatch) {
    try {
      const data = JSON.parse(arrMatch[0]);
      if (Array.isArray(data)) return data;
    } catch {}
  }

  return [];
}

/**
 * 将字幕段落 AI 翻译为中英文双语对照结构（支持 4倍并发加速与 onProgress 增量回调）
 * @param {Array<{time: number, timeStr: string, text: string}>} segments
 * @param {Function} [onProgress] - 进度回调 (completedCount, totalCount, currentSegments) => void
 * @returns {Promise<Array<{time: number, timeStr: string, text: string, zh: string, en: string}>>}
 */
export async function translateSubtitlesToBilingual(segments, onProgress = null) {
  if (!segments || segments.length === 0) return [];
  const client = createAIClient();
  const model = getModelName();

  // 初始化结果结构
  const resultSegments = segments.map((seg) => {
    const rawEnglishText = (seg.text || '').trim();
    const rawLower = rawEnglishText.toLowerCase();
    let initialZh = seg.zh ? seg.zh.trim() : '';
    if (!initialZh && COMMON_SUBTITLE_TAGS[rawLower]) {
      initialZh = COMMON_SUBTITLE_TAGS[rawLower];
    }
    return {
      ...seg,
      zh: initialZh,
      en: rawEnglishText,
    };
  });

  const totalCount = resultSegments.length;
  const batchSize = 25;
  const batches = [];
  for (let i = 0; i < totalCount; i += batchSize) {
    batches.push({
      startIdx: i,
      chunk: resultSegments.slice(i, i + batchSize)
    });
  }

  const notifyProgress = () => {
    if (!onProgress) return;
    const completedCount = resultSegments.filter(s => s.zh && s.zh.trim() && s.zh !== s.en && containsChineseText(s.zh)).length;
    try {
      onProgress(completedCount, totalCount, resultSegments);
    } catch {}
  };

  notifyProgress();

  // 🎯 步骤 1：Pass 1 并发线程池 (Concurrency = 4)
  const concurrencyLimit = 4;
  let batchIndex = 0;

  async function worker() {
    while (batchIndex < batches.length) {
      const currentBatch = batches[batchIndex++];
      if (!currentBatch) break;
      const { startIdx, chunk } = currentBatch;

      const formattedInput = chunk.map((s, idx) => ({
        id: idx,
        text: s.en,
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
        const parsed = safeParseSubtitleJSON(content);

        for (const item of (parsed || [])) {
          if (!item || item.id === undefined) continue;
          const localId = parseInt(item.id, 10);
          if (!isNaN(localId) && localId >= 0 && localId < chunk.length) {
            const globalIdx = startIdx + localId;
            const zhText = (item.zh || item.translation || item.text_zh || item.cn || item.chinese || '').trim();
            if (zhText) {
              resultSegments[globalIdx].zh = zhText;
            }
          }
        }
      } catch (err) {
        console.error(`[translateSubtitlesToBilingual] Batch 异常:`, err.message);
      }

      notifyProgress();
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrencyLimit, batches.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // 🎯 步骤 2：Pass 2 & 3 多轮精准补漏重试 (并发限制)
  const maxRetries = 3;
  for (let retry = 1; retry <= maxRetries; retry++) {
    const missingIndices = [];
    resultSegments.forEach((seg, idx) => {
      if (isNeedsChineseTranslation(seg.en, seg.zh)) {
        missingIndices.push(idx);
      }
    });

    if (missingIndices.length === 0) {
      console.log(`[translateSubtitlesToBilingual] 所有 ${totalCount} 段字幕均已 100% 成功完成中文双语翻译 (Pass ${retry})`);
      break;
    }

    console.warn(`[translateSubtitlesToBilingual] 发现 ${missingIndices.length}/${totalCount} 段字幕未正确翻译成中文，发起第 ${retry}/${maxRetries} 轮定向补译重试...`);

    const retryBatchSize = 20;
    const retryBatches = [];
    for (let rIdx = 0; rIdx < missingIndices.length; rIdx += retryBatchSize) {
      retryBatches.push(missingIndices.slice(rIdx, rIdx + retryBatchSize));
    }

    let rBatchIdx = 0;
    async function retryWorker() {
      while (rBatchIdx < retryBatches.length) {
        const currentBatchIndices = retryBatches[rBatchIdx++];
        if (!currentBatchIndices) break;
        const retryInput = currentBatchIndices.map((globalIdx, localId) => ({
          id: localId,
          text: resultSegments[globalIdx].en,
        }));

        const retryPrompt = `你是一位高精字幕补译专家。注意：以下段落是上一轮漏掉或未成功翻译为中文的英文字幕。
请必须为每一个 id 都提供准确流畅的简体中文翻译 "zh"！

输出格式要求：
请必须返回 JSON 格式：
{
  "subtitles": [
    { "id": 0, "zh": "准确的简体中文翻译" }
  ]
}`;

        try {
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: retryPrompt },
              { role: 'user', content: JSON.stringify(retryInput) }
            ],
            temperature: 0.1,
          });

          const choice = response.choices[0];
          const content = extractAIResponse(choice);
          const parsed = safeParseSubtitleJSON(content);

          for (const item of (parsed || [])) {
            if (!item || item.id === undefined) continue;
            const localId = parseInt(item.id, 10);
            if (!isNaN(localId) && localId >= 0 && localId < currentBatchIndices.length) {
              const globalIdx = currentBatchIndices[localId];
              const zhText = (item.zh || item.translation || item.text_zh || item.cn || item.chinese || '').trim();
              if (zhText) {
                resultSegments[globalIdx].zh = zhText;
              }
            }
          }
        } catch (retryErr) {
          console.error(`[translateSubtitlesToBilingual] 重试轮次 ${retry} Batch 异常:`, retryErr.message);
        }

        notifyProgress();
      }
    }

    const rWorkers = [];
    for (let w = 0; w < Math.min(concurrencyLimit, retryBatches.length); w++) {
      rWorkers.push(retryWorker());
    }
    await Promise.all(rWorkers);
  }

  // 🎯 步骤 3：终极保底与极简兜底
  resultSegments.forEach((seg) => {
    const rawLower = (seg.en || '').toLowerCase().trim();
    if (COMMON_SUBTITLE_TAGS[rawLower]) {
      seg.zh = COMMON_SUBTITLE_TAGS[rawLower];
    }
  });

  notifyProgress();
  return resultSegments;
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
6. 输出干净漂亮的 Markdown 结构化内容；
7. 严禁在文章中包含任何 <|begin_of_sentence|>、<|begin_of_text|> 等 AI 内部 Tag 标记，严禁包含 #include 等伪代码指令！`;

  try {
    // 博客文章需要较大的输出 token 限制，避免长视频内容被截断
    const blogMaxTokens = Math.max(getMaxTokens(), 8192);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `视频标题: ${title}\n\n完整带时间戳字幕内容:\n${fullText.slice(0, 18000)}` }
      ],
      temperature: 0.5,
      max_tokens: blogMaxTokens,
    });

    const choice = response.choices[0];
    const rawMarkdown = extractAIResponse(choice);
    return cleanBlogMarkdownText(rawMarkdown);
  } catch (err) {
    console.error('AI 字幕生成博客文章失败:', err);
    return '';
  }
}

