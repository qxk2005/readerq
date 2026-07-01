import { NextResponse } from 'next/server';
import { getHighlight, getCachedDocument } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const hl = getHighlight(id);
    if (!hl) {
      return NextResponse.json({ error: '本地未找到该高亮' }, { status: 404 });
    }

    const client = getServerReadwiseClient();
    
    // 策略: 先通过 V2 Export API 按 source_url 查找对应的 book，再在其高亮中精确匹配
    // 这比只查"最近 50 条"更准确
    const doc = getCachedDocument(hl.document_id);
    const sourceUrl = doc?.source_url || doc?.url || '';
    
    // 用 V2 Export API，按 updatedAfter 不传即返回全部，但我们只需要这一本
    // 直接用 V2 books API 按 source_url 搜索更高效
    let found = false;
    let remoteHighlight = null;

    // 方法1: 通过 V2 highlights API 搜索（按 book source_url 过滤）
    try {
      const booksRes = await fetch(
        `https://readwise.io/api/v2/books/?source_url=${encodeURIComponent(sourceUrl)}&page_size=5`,
        { headers: client.headers, signal: AbortSignal.timeout(10000) }
      );
      
      if (booksRes.ok) {
        const booksData = await booksRes.json();
        
        // 遍历匹配的 books，查找高亮
        for (const book of (booksData.results || [])) {
          const hlRes = await fetch(
            `https://readwise.io/api/v2/highlights/?book_id=${book.id}&page_size=100`,
            { headers: client.headers, signal: AbortSignal.timeout(10000) }
          );
          
          if (hlRes.ok) {
            const hlData = await hlRes.json();
            // 精确匹配: 文本前100字符比对
            const normalizedTarget = hl.text.trim().substring(0, 100);
            const match = (hlData.results || []).find(remote => {
              const remoteText = (remote.text || '').trim();
              // 双向包含检查
              return remoteText.includes(normalizedTarget) || normalizedTarget.includes(remoteText.substring(0, 100));
            });
            
            if (match) {
              found = true;
              remoteHighlight = {
                id: match.id,
                text: match.text,
                note: match.note,
                tags: (match.tags || []).map(t => t.name),
                url: match.url,
                book_id: match.book_id,
              };
              break;
            }
          }
        }
      }
    } catch (searchErr) {
      console.warn('通过 source_url 搜索失败，降级为最近高亮匹配:', searchErr.message);
    }

    // 方法2 (降级): 如果 source_url 搜索未命中，查最近 200 条高亮
    if (!found) {
      try {
        const response = await fetch('https://readwise.io/api/v2/highlights/?page_size=200', {
          headers: client.headers,
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok) {
          const data = await response.json();
          const normalizedTarget = hl.text.trim().substring(0, 100);
          const match = (data.results || []).find(remote => {
            const remoteText = (remote.text || '').trim();
            return remoteText.includes(normalizedTarget) || normalizedTarget.includes(remoteText.substring(0, 100));
          });
          
          if (match) {
            found = true;
            remoteHighlight = {
              id: match.id,
              text: match.text,
              note: match.note,
              tags: (match.tags || []).map(t => t.name),
              url: match.url,
              book_id: match.book_id,
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('降级搜索也失败:', fallbackErr.message);
      }
    }

    if (found) {
      return NextResponse.json({
        success: true,
        synced: true,
        remote_highlight: remoteHighlight,
      });
    } else {
      return NextResponse.json({
        success: true,
        synced: false,
        message: '在 Readwise 云端未找到此高亮，可能同步失败',
      });
    }

  } catch (error) {
    console.error('验证高亮同步状态失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
