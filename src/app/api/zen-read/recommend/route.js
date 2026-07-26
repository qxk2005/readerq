import { NextResponse } from 'next/server';
import { getCachedDocuments, getZenReadRatings, saveZenReadHistory } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { answers = {}, questions = [] } = body;

    // 1. 获取全量候选文档
    const allDocs = getCachedDocuments({ limit: 300 });
    const ratings = getZenReadRatings();

    // 构建文章打分映射 (like = +2, dislike = -5)
    const ratingScoreMap = {};
    ratings.forEach(r => {
      if (r.document_id) {
        ratingScoreMap[r.document_id] = (r.rating >= 4 ? 2 : r.rating <= 2 ? -5 : 0);
      }
    });

    // 解析回答中的 focusTag 与 exploreMode
    let exploreMode = 'balanced'; // 默认'balanced'(温故知新)，可选 'unread'(全新探索), 'read'(经典温习)
    const selectedFocusTags = [];

    Object.values(answers).forEach(ans => {
      if (ans.exploreMode) {
        exploreMode = ans.exploreMode;
      }
      if (ans.focusTag && ans.focusTag !== 'random') {
        selectedFocusTags.push(ans.focusTag.toLowerCase());
      }
    });

    // 分离未读文档与已读文档
    const isDocUnread = (doc) => (doc.location === 'new' && (!doc.reading_progress || doc.reading_progress < 0.1));
    const isDocRead = (doc) => (doc.reading_progress >= 0.1 || doc.location === 'archive' || doc.highlights_count > 0);

    // 2. 为候选文档打分
    const scoreDoc = (doc) => {
      let score = 50; // 基础契合分

      // 如果有历史点踩记录，直接大幅降权
      if (ratingScoreMap[doc.id] < 0) {
        score -= 40;
      } else if (ratingScoreMap[doc.id] > 0) {
        score += 15;
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

      // 摘要丰富度与内容质量加分
      if (doc.summary && doc.summary.length > 50) score += 8;
      if (doc.image_url) score += 5;

      // 随机扰动量，保证每次抽卡都有变化
      score += Math.floor(Math.random() * 15);

      return { doc, score };
    };

    const unreadScored = allDocs.filter(isDocUnread).map(scoreDoc).sort((a, b) => b.score - a.score);
    const readScored = allDocs.filter(isDocRead).map(scoreDoc).sort((a, b) => b.score - a.score);
    const fallbackScored = allDocs.map(scoreDoc).sort((a, b) => b.score - a.score);

    // 3. 根据 exploreMode 进行精准配比选拔 (共选出 4~5 篇)
    let selectedCandidates = [];

    if (exploreMode === 'unread') {
      // 纯全新探索模式：100% 优先选择未读文章
      selectedCandidates = unreadScored.slice(0, 5);
      if (selectedCandidates.length < 3) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    } else if (exploreMode === 'read') {
      // 纯经典重温模式：100% 优先已读/高亮文章
      selectedCandidates = readScored.slice(0, 5);
      if (selectedCandidates.length < 3) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    } else {
      // 温故知新平衡模式 (3篇未读 + 2篇已读)
      const topUnread = unreadScored.slice(0, 3);
      const topRead = readScored.slice(0, 2);
      selectedCandidates = [...topUnread, ...topRead];
      if (selectedCandidates.length < 4) {
        selectedCandidates = fallbackScored.slice(0, 5);
      }
    }

    // 4. 构建 3D 抽卡卡牌 (Gacha Cards) 对象，生成 AI 深度定制推荐理由
    const cards = selectedCandidates.map((item, index) => {
      const { doc, score } = item;
      const rarity = index === 0 ? 'SSR' : index <= 2 ? 'SR' : 'R';
      const matchPercentage = Math.min(99, Math.max(83, Math.round(score)));

      const unreadFlag = isDocUnread(doc);
      const mainTag = doc.tags ? Object.keys(doc.tags)[0] : null;
      const focusText = selectedFocusTags[0] ? `「${selectedFocusTags[0]}」` : '当下心境';

      // 动态拼接生成深入详细的 AI 推荐理由
      let reasonTitle = unreadFlag ? '🚀 全新探索宝藏' : '🧠 经典重温复盘';
      let detailedReason = '';

      if (unreadFlag) {
        detailedReason = `这是一篇存放在收件箱中尚未阅读的全新文章。AI 分析了你对 ${focusText} 的求知诉求${mainTag ? `，以及关于「${mainTag}」的内容主题` : ''}，预估本文将为你提供全新维度的解构与启发。`;
      } else {
        detailedReason = `你此前曾探索过此文章${doc.highlights_count > 0 ? `并记录了 ${doc.highlights_count} 处高亮笔记` : ''}。结合你当下在问卷中选择的思维波段，此时重新温习将帮助你连结新旧认知，形成更深刻的理解。`;
      }

      return {
        cardId: `card_${doc.id}_${index}`,
        documentId: doc.id,
        rarity, // SSR, SR, R
        isUnread: unreadFlag,
        matchPercentage: `${matchPercentage}%`,
        reasonTitle,
        detailedReason,
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
    });

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
