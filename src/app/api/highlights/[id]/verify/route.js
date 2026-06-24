import { NextResponse } from 'next/server';
import { getHighlight } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const hl = getHighlight(id);
    if (!hl) {
      return NextResponse.json({ error: '本地未找到该高亮' }, { status: 404 });
    }

    const client = getServerReadwiseClient();
    
    // 从 Readwise V2 API 获取最近的高亮
    const response = await fetch('https://readwise.io/api/v2/highlights/?page_size=50', {
      headers: client.headers,
    });
    
    if (!response.ok) {
      throw new Error(`Readwise API 返回错误: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 寻找匹配文本的高亮 (考虑到可能有微小空格差异，使用 trim)
    const normalizedTarget = hl.text.trim().substring(0, 50); // 部分匹配前50个字符即可，避免太长导致匹配不到
    const match = data.results && data.results.find(remote => 
      remote.text && remote.text.includes(normalizedTarget)
    );

    if (match) {
      return NextResponse.json({
        success: true,
        synced: true,
        remote_highlight: {
          id: match.id,
          text: match.text,
          note: match.note,
          tags: match.tags.map(t => t.name),
          url: match.url,
          book_id: match.book_id
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        synced: false,
        message: '在最近的 Readwise 云端记录中未找到此高亮'
      });
    }

  } catch (error) {
    console.error('验证高亮同步状态失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
