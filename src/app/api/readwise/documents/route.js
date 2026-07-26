import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocuments, upsertDocuments, getDocumentStats, getCachedDocument } from '@/lib/db';

/**
 * 原生网页 HTML 动态抓取与清洗算子
 */
async function fetchAndParseArticleHtml(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('http')) return '';
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!res.ok) return '';
    const htmlText = await res.text();
    if (!htmlText) return '';

    // 简单高效提取 Body 或 Article 内部的段落、图片与标题
    let bodyMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    htmlText.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                    htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    
    const contentHtml = bodyMatch ? bodyMatch[1] : htmlText;

    // 过滤无用的 script, style, iframe, nav, header, footer
    const cleanHtml = contentHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // 提取所有的 p, h1~h6, img, blockquote, ul, ol, li, pre, code 标签内容
    const blockMatches = cleanHtml.match(/<(p|h[1-6]|img|blockquote|ul|ol|pre|code)[^>]*>[\s\S]*?<\/\1>|<img[^>]*\/?>/gi);
    
    if (blockMatches && blockMatches.length > 0) {
      return blockMatches.join('\n');
    }
    return '';
  } catch (e) {
    console.warn('动态抓取网页原正文失败:', targetUrl, e.message);
    return '';
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const prioritizeInbox = searchParams.get('prioritize_inbox') === 'true';
    const forceSync = searchParams.get('sync') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const id = searchParams.get('id');

    // 如果请求单个文档
    if (id) {
      let targetDoc = null;
      try {
        const client = getServerReadwiseClient();
        const data = await client.listDocuments({ id, withHtmlContent: true });
        targetDoc = data.results && data.results.find(d => d.id === id);
        if (targetDoc && targetDoc.content) {
          targetDoc.html_content = targetDoc.content;
        }
      } catch (err) {
        console.warn('从 Readwise 官方 API 同步单篇文档失败，切入缓存:', err.message);
      }

      if (!targetDoc) {
        targetDoc = getCachedDocument(id);
      }

      if (targetDoc) {
        // 如果 html_content 为空，尝试动态抓取补全网页 HTML
        if (!targetDoc.html_content || targetDoc.html_content.trim().length < 50) {
          const targetUrl = targetDoc.source_url || targetDoc.url;
          if (targetUrl) {
            const parsedHtml = await fetchAndParseArticleHtml(targetUrl);
            if (parsedHtml) {
              targetDoc.html_content = parsedHtml;
            }
          }
        }
        upsertDocuments([targetDoc]);
        return NextResponse.json(targetDoc);
      }

      return NextResponse.json({ error: '文档未找到' }, { status: 404 });
    }

    // 强制同步或首次加载
    if (forceSync) {
      try {
        const { getLatestDocumentDate } = await import('@/lib/db');
        const updatedAfter = getLatestDocumentDate({ location, category, tag });
        
        const client = getServerReadwiseClient();
        const documents = await client.fetchAllDocuments({ location, category, tag, updatedAfter });
        upsertDocuments(documents);
      } catch (err) {
        console.error('同步失败:', err.message);
      }
    }

    const offset = (page - 1) * limit;

    const documents = getCachedDocuments({
      location,
      category,
      tag,
      tags,
      search,
      prioritizeInbox,
      limit,
      offset
    });

    const stats = getDocumentStats();

    return NextResponse.json({
      documents,
      total: stats.total || documents.length,
      page,
      limit,
      stats
    });
  } catch (error) {
    console.error('获取文档列表错误:', error);
    return NextResponse.json(
      { error: error.message || '获取文档列表失败' },
      { status: 500 }
    );
  }
}
