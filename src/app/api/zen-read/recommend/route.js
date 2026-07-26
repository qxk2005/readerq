import { NextResponse } from 'next/server';
import { getCachedDocuments, getZenReadRatings, saveZenReadHistory, getSetting } from '@/lib/db';
import OpenAI from 'openai';

/**
 * 判断文本是否以外文/英文为主
 */
function isEnglishOrForeign(text) {
  if (!text) return false;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const latinWords = text.match(/[a-zA-Z]{3,}/g) || [];
  return latinWords.length > 5 && (chineseChars.length / (text.length || 1)) < 0.25;
}

/**
 * 提炼符合“禅阅读”波段的极简核心摘要与金句要点 (多行列表格式化，100% 简体中文)
 */
async function buildZenSummaryAndBullets(doc, detailedReason) {
  const rawText = doc.summary || doc.title || '';
  let cleanText = rawText.replace(/\r\n/g, '\n').trim();
  const isForeign = isEnglishOrForeign(cleanText);

  // 如果是外文文章且配置了 AI 密钥，调用 LLM 翻译提炼为 100% 简体中文
  const apiKey = getSetting('openai_api_key') || process.env.OPENAI_API_KEY;
  const baseUrl = getSetting('openai_base_url') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = getSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (isForeign && apiKey) {
    try {
      const client = new OpenAI({ apiKey: apiKey.trim(), baseURL: baseUrl.trim() });
      const prompt = `你是一个文章极简提炼导师。请将以下外文文章的内容，用 100% 纯正流利的【简体中文】提炼为 120 字以内的极简核心摘要，并输出 2~3 个简体中文干货金句要点。
文章标题: ${doc.title}
文章内容/摘要: ${cleanText.slice(0, 800)}

请严格返回 JSON 格式:
{
  "zenSummary": "简体中文核心摘要",
  "bullets": ["金句1", "金句2", "金句3"]
}`;

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const resText = completion.choices[0]?.message?.content;
      if (resText) {
        const parsed = JSON.parse(resText);
        if (parsed.zenSummary) {
          return {
            zenSummary: parsed.zenSummary,
            zenBullets: (parsed.bullets || []).map(b => `🔑 ${b}`)
          };
        }
      }
    } catch (e) {
      console.warn('外文极简中文翻译失败，使用规则降级:', e.message);
    }
  }

  // 规则降级提炼 (外文文章)
  if (isForeign) {
    const zhTitle = doc.title || '前沿外文资讯';
    return {
      zenSummary: `💡 本文为外文前沿资讯《${zhTitle}》。文章聚焦于该主题的最新演进与核心特性，拆解了其在实际场景中的应用突破与关键更新。`,
      zenBullets: [
        `🔑 核心主题: ${zhTitle}`,
        `💡 前沿视角: 探讨了该领域的最新更新与突破要点`
      ]
    };
  }

  // 1. 列表切分匹配：如果包含列表点号 ('·' / '•') 或显式换行符，拆分为多行 Bullets！
  let rawListItems = [];
  if (cleanText.includes('·') || cleanText.includes('•')) {
    rawListItems = cleanText.split(/[·•]/).map(s => s.trim()).filter(s => s.length > 5);
  } else if (cleanText.includes('\n')) {
    rawListItems = cleanText.split(/\n+/).map(s => s.trim()).filter(s => s.length > 5);
  }

  if (rawListItems.length >= 2) {
    const zenBullets = rawListItems.slice(0, 4).map(item => {
      let text = item.replace(/^[0-9一二三四五六七八九十[\]（）()、.:\s]+/, '').trim();
      if (text.length > 45) text = text.slice(0, 43) + '...';
      return `🔑 ${text}`;
    });

    return {
      zenSummary: `💡 本文包含 ${rawListItems.length} 项核心动态与干货要点。AI 已为您提炼出前 ${zenBullets.length} 项突破性要点列表如下：`,
      zenBullets
    };
  }

  // 2. 纯中文普通文章提取前 2~3 句核心结论
  const sentences = cleanText.split(/(?<=[。！？\?!])\s*/).filter(s => s.length > 5);
  let condensedSummary = sentences.slice(0, 3).join('');
  if (!condensedSummary || condensedSummary.length < 20) {
    condensedSummary = cleanText.slice(0, 140);
  } else if (condensedSummary.length > 150) {
    condensedSummary = condensedSummary.slice(0, 145) + '...';
  }

  let zenBullets = [];
  if (sentences.length >= 2) {
    zenBullets = sentences.slice(0, 3).map((s) => {
      let text = s.replace(/^[0-9一二三四五六七八九十[\]（）()、.:\s]+/, '').trim();
      if (text.length > 40) text = text.slice(0, 38) + '...';
      return `🔑 ${text}`;
    });
  } else {
    zenBullets = [
      `🔑 核心立意: ${doc.title}`,
      `💡 探究视角: ${detailedReason ? detailedReason.slice(0, 35) : '基于当下心境的启发式解读'}`
    ];
  }

  return {
    zenSummary: condensedSummary,
    zenBullets: zenBullets.slice(0, 4)
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { answers = {}, questions = [] } = body;

    // 1. 获取全量候选文档 (500 篇)
    const allDocs = getCachedDocuments({ limit: 500 });
    const ratings = getZenReadRatings();

    // 构建文章打分映射 (like = +2, dislike = -5)
    const ratingScoreMap = {};
    ratings.forEach(r => {
      if (r.document_id) {
        ratingScoreMap[r.document_id] = (r.rating >= 4 ? 2 : r.rating <= 2 ? -5 : 0);
      }
    });

    // 解析回答中的 focusTag 与 exploreMode
    let exploreMode = 'balanced';
    const selectedFocusTags = [];

    Object.values(answers).forEach(ans => {
      if (ans.exploreMode) {
        exploreMode = ans.exploreMode;
      }
      if (ans.focusTag && ans.focusTag !== 'random') {
        selectedFocusTags.push(ans.focusTag.toLowerCase());
      }
    });

    // 真实未读与已读解封判定
    const isDocUnread = (doc) => (
      doc.location !== 'trash' &&
      (!doc.reading_progress || doc.reading_progress < 0.1) &&
      (!doc.highlights_count || doc.highlights_count === 0)
    );

    const isDocRead = (doc) => (
      doc.location !== 'trash' &&
      ((doc.reading_progress && doc.reading_progress >= 0.1) || doc.location === 'archive' || (doc.highlights_count && doc.highlights_count > 0))
    );

    // 2. 为候选文档打分
    const scoreDoc = (doc) => {
      let score = 50;

      // 如果有历史点踩记录，直接大幅降权
      if (ratingScoreMap[doc.id] < 0) {
        score -= 40;
      } else if (ratingScoreMap[doc.id] > 0) {
        score += 15;
      }

      // 收件箱 (Inbox: location === 'new') 文章赋予 +35 分大幅加权优先
      if (doc.location === 'new') {
        score += 35;
      }

      // 标签匹配度加分
      if (doc.tags && selectedFocusTags.length > 0) {
        const docTags = Object.keys(doc.tags).map(t => t.toLowerCase());
        selectedFocusTags.forEach(ft => {
          if (docTags.some(t => t.includes(ft) || ft.includes(t))) {
            score += 25;
          }
        });
      }

      if (doc.summary && doc.summary.length > 50) score += 8;
      if (doc.image_url) score += 5;

      score += Math.floor(Math.random() * 15);

      return { doc, score };
    };

    const unreadScored = allDocs.filter(isDocUnread).map(scoreDoc).sort((a, b) => b.score - a.score);
    const readScored = allDocs.filter(isDocRead).map(scoreDoc).sort((a, b) => b.score - a.score);
    const fallbackScored = allDocs.map(scoreDoc).sort((a, b) => b.score - a.score);

    // 3. 根据 exploreMode 精准选拔 (保底确保收件箱 Inbox 文章进入候选)
    const inboxUnread = unreadScored.filter(item => item.doc.location === 'new');
    const nonInboxUnread = unreadScored.filter(item => item.doc.location !== 'new');

    let selectedCandidates = [];

    if (exploreMode === 'unread') {
      const topInbox = inboxUnread.slice(0, 2);
      const topOther = nonInboxUnread.slice(0, 5 - topInbox.length);
      selectedCandidates = [...topInbox, ...topOther];
      if (selectedCandidates.length < 3) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    } else if (exploreMode === 'read') {
      selectedCandidates = readScored.slice(0, 5);
      if (selectedCandidates.length < 3) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    } else {
      // 温故知新平衡模式 (1~2篇收件箱 + 1~2篇其他未读 + 1~2篇经典已读)
      const topInbox = inboxUnread.slice(0, 2);
      const topOtherUnread = nonInboxUnread.slice(0, 3 - topInbox.length);
      const topRead = readScored.slice(0, 2);
      selectedCandidates = [...topInbox, ...topOtherUnread, ...topRead];
      if (selectedCandidates.length < 4) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    }

    // 4. 构建 3D 抽卡卡牌 (Gacha Cards) 对象
    const cards = await Promise.all(selectedCandidates.map(async (item, index) => {
      const { doc, score } = item;
      const rarity = index === 0 ? 'SSR' : index <= 2 ? 'SR' : 'R';
      const matchPercentage = Math.min(99, Math.max(83, Math.round(score)));

      const unreadFlag = isDocUnread(doc);
      const isInbox = doc.location === 'new';
      const mainTag = doc.tags ? Object.keys(doc.tags)[0] : null;
      const focusText = selectedFocusTags[0] ? `「${selectedFocusTags[0]}」` : '当下心境';

      let reasonTitle = isInbox ? '📥 收件箱精选宝藏' : unreadFlag ? '🚀 全新探索宝藏' : '🧠 经典重温复盘';
      let detailedReason = '';

      if (isInbox) {
        detailedReason = `这是一篇专属于你【收件箱 (Inbox)】中尚未阅读的精选文章。AI 结合你对 ${focusText} 的求知关注${mainTag ? `及「${mainTag}」标签` : ''}优先为您解封。`;
      } else if (unreadFlag) {
        detailedReason = `这是一篇来自全库及 RSS 订阅源中尚未阅读的全新文章。AI 分析了你对 ${focusText} 的求知诉求${mainTag ? `，以及关于「${mainTag}」的内容主题` : ''}，预估本文将为你提供全新维度的解构与启发。`;
      } else {
        detailedReason = `你此前曾探索过此文章${doc.highlights_count > 0 ? `并记录了 ${doc.highlights_count} 处高亮笔记` : ''}。结合你当下在问卷中选择的思维波段，此时重新温习将帮助你连结新旧认知，形成更深刻的理解。`;
      }

      // 生成多行列表格式化、100% 简体中文的极简核心摘要与突破金句
      const { zenSummary, zenBullets } = await buildZenSummaryAndBullets(doc, detailedReason);

      return {
        cardId: `card_${doc.id}_${index}`,
        documentId: doc.id,
        rarity,
        isUnread: unreadFlag,
        isInbox,
        matchPercentage: `${matchPercentage}%`,
        reasonTitle,
        detailedReason,
        zenSummary,
        zenBullets,
        document: {
          id: doc.id,
          title: doc.title || '无标题文章',
          author: doc.author || doc.site_name || doc.source || '精选推荐',
          summary: doc.summary || '暂无摘要描述',
          image_url: doc.image_url || null,
          category: doc.category || 'article',
          location: doc.location || 'new',
          word_count: doc.word_count || 1200,
          reading_time: doc.reading_time || '3 分钟',
          tags: doc.tags ? Object.keys(doc.tags) : [],
          created_at: doc.created_at || doc.saved_at
        }
      };
    }));

    // 5. 保存推荐会话记录
    const sessionId = `zen_session_${Date.now()}`;
    saveZenReadHistory({
      sessionId,
      questions,
      answers,
      cards
    });

    return NextResponse.json({
      success: true,
      sessionId,
      exploreMode,
      cards
    });
  } catch (error) {
    console.error('生成禅阅读抽卡推荐失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
