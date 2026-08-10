import { NextResponse } from 'next/server';
import { getCachedDocuments } from '@/lib/db';
import { createAIClient, getModelName } from '@/lib/ai';

export async function POST(request) {
  try {
    const { topic, exclude_history = true, history_ids = [] } = await request.json();

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: '请提供有效的主题关键字' }, { status: 400 });
    }

    const cleanTopic = topic.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    const keywords = cleanTopic.toLowerCase().split(/[\s,，/\-_]+/).filter(Boolean);

    // 获取所有缓存文档
    const allDocs = getCachedDocuments() || [];

    // 筛选非归档、非垃圾箱的未读/RSS 相关文章
    const rssCandidates = allDocs.filter(doc => {
      const loc = (doc.location || '').toLowerCase();
      const cat = (doc.category || '').toLowerCase();
      return loc !== 'archive' && loc !== 'trash' &&
        (cat.includes('rss') || doc.site_name || loc === 'feed' || loc === 'new');
    });

    if (rssCandidates.length === 0) {
      return NextResponse.json({ error: '当前库中暂无符合条件的 RSS 未读文章' }, { status: 400 });
    }

    // Stage 1: 两阶段 RAG 粗筛 (关键词权重打分 + 匹配排序)
    const scored = rssCandidates.map(doc => {
      let score = 0;
      const titleLower = (doc.title || '').toLowerCase();
      const summaryLower = (doc.summary || '').toLowerCase();
      const sourceLower = (doc.site_name || doc.category || '').toLowerCase();

      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += 5;
        if (summaryLower.includes(kw)) score += 2;
        if (sourceLower.includes(kw)) score += 3;
      }
      return { doc, score };
    });

    const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    const unmatched = scored.filter(s => s.score === 0).map(s => s.doc);

    let stage1Candidates = matched.length > 0
      ? [...matched.map(m => m.doc), ...unmatched]
      : rssCandidates;

    // 历史排除
    if (exclude_history && Array.isArray(history_ids) && history_ids.length > 0) {
      const historySet = new Set(history_ids);
      const fresh = stage1Candidates.filter(d => !historySet.has(d.id));
      if (fresh.length >= 5) {
        stage1Candidates = fresh;
      }
    }

    // 选取前 40 篇送入 Stage 2 LLM
    const promptCandidates = stage1Candidates.slice(0, 40);

    const systemPrompt = `
你是一个高效专业的 AI 知识推荐助手。
请根据用户给出的【主题关键字】，从以下候选 RSS 未读文章列表中挑选 5 到 10 篇最符合该主题的高质量文章。
你必须且只能输出合法的 JSON 格式，严禁包含任何 markdown 块或多余解释。
JSON 格式要求如下：
{
  "recommendations": [
    {
      "doc_id": "文章的对应ID",
      "reason": "推荐理由（15-40字，精准说明为什么推荐本文）"
    }
  ]
}
`.trim();

    const candidateText = promptCandidates.map((doc, idx) => {
      const categoryName = doc.site_name || doc.category || 'RSS';
      const snippet = (doc.summary || '').slice(0, 120).replace(/\n/g, ' ') || '无摘要';
      return `${idx + 1}. ID: ${doc.id}\n   标题: ${doc.title}\n   分类/来源: ${categoryName}\n   摘要: ${snippet}`;
    }).join('\n');

    const userMessage = `【主题关键字】：${cleanTopic}\n\n候选文章列表：\n${candidateText}`;

    const client = createAIClient();
    const model = getModelName();

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3
    });

    const rawContent = completion.choices?.[0]?.message?.content || '';
    const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const recs = parsed.recommendations || [];
    const docMap = new Map(allDocs.map(d => [d.id, d]));

    const results = [];
    for (const item of recs) {
      if (!item.doc_id) continue;
      const doc = docMap.get(item.doc_id);
      if (doc) {
        results.push({
          doc,
          reason: item.reason || '智能精选推荐'
        });
      }
    }

    return NextResponse.json({
      success: true,
      topic: cleanTopic,
      recommendations: results
    });
  } catch (error) {
    console.error('RSS AI 主题推荐失败:', error);
    return NextResponse.json(
      { error: error.message || 'AI 主题推荐生成失败，请检查 OpenAI API 配置' },
      { status: 500 }
    );
  }
}
