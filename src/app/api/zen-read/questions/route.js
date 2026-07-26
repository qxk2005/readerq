import { NextResponse } from 'next/server';
import { getCachedDocuments, getZenReadRatings, getSetting } from '@/lib/db';
import OpenAI from 'openai';

export async function GET() {
  try {
    // 1. 获取最近 30 篇文档及统计信息
    const recentDocs = getCachedDocuments({ limit: 30 });
    const ratings = getZenReadRatings();

    // 收集高频标签与兴趣方向
    const tagCount = {};
    const categories = new Set();
    recentDocs.forEach(doc => {
      if (doc.category) categories.add(doc.category);
      if (doc.tags) {
        Object.keys(doc.tags).forEach(t => {
          tagCount[t] = (tagCount[t] || 0) + 1;
        });
      }
    });

    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    // 2. 默认智能提问库 (4 个层层递进问题，含【已读/未读探索范围权衡】)
    const primaryTag = topTags[0] || 'AI智能';
    const secondaryTag = topTags[1] || '架构思考';

    const questions = [
      {
        id: 'q1',
        question: '此时此刻，你的心境更倾向于哪种吸收状态？',
        subtitle: '调频你的阅读波段',
        options: [
          { id: 'q1_o1', label: '🔥 深度沉浸，探索硬核技术与底层原理', focusTag: primaryTag },
          { id: 'q1_o2', label: '💡 灵感启发，吸收宏观趋势与前沿观点', focusTag: secondaryTag },
          { id: 'q1_o3', label: '☕ 轻松惬意，快速浏览精选干货卡片', focusTag: '短阅读' }
        ]
      },
      {
        id: 'q2',
        question: `根据你最近对「${primaryTag}」的关注，今天想聚焦于？`,
        subtitle: '精准收敛你的思考视线',
        options: [
          { id: 'q2_o1', label: `🎯 巩固并深化「${primaryTag}」主题精粹`, focusTag: primaryTag },
          { id: 'q2_o2', label: `🔀 跨界碰撞，拓展「${secondaryTag}」等新视角`, focusTag: secondaryTag },
          { id: 'q2_o3', label: '🌱 随机邂逅，抽出一张意想不到的灵感牌', focusTag: 'random' }
        ]
      },
      {
        id: 'q3',
        question: '你计划为接下来的禅阅读分配多长时间？',
        subtitle: '设定你的禅定时间轴',
        options: [
          { id: 'q3_o1', label: '⏱️ 3~5 分钟，高效吸收极简干货', maxTime: '5' },
          { id: 'q3_o2', label: '⏳ 10~15 分钟，深度品味长文脉络', maxTime: '15' },
          { id: 'q3_o3', label: '🌌 自由探索，不设时间限制', maxTime: '99' }
        ]
      },
      {
        id: 'q4',
        question: '在推荐文章的探索范围与已读配比上，你更倾向于？',
        subtitle: '权衡全新未知新知与经典已读温习的比例',
        options: [
          { id: 'q4_o1', label: '🚀 全新探索：100% 优先推荐收件箱中的未读新文章', exploreMode: 'unread' },
          { id: 'q4_o2', label: '⚖️ 温故知新：平衡推荐全新文章与经典已读 (推荐)', exploreMode: 'balanced' },
          { id: 'q4_o3', label: '🧠 经典温味：优先精选带划线笔记的已读文章重温', exploreMode: 'read' }
        ]
      }
    ];

    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error('获取禅阅读提问失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
