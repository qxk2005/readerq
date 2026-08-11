import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getCachedDocument, upsertDocument } from '@/lib/db';
import { fetchYouTubeMetadata } from '@/lib/videoSubtitleFetcher';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { tags, notes, reading_progress, title, author, image_url, source_url, url } = body;

    const updates = {};
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: '无效的标签格式，必须为数组' }, { status: 400 });
      }
      updates.tags = tags;
    }
    
    if (notes !== undefined) {
      updates.notes = notes;
    }

    const hasReadingProgress = reading_progress !== undefined && typeof reading_progress === 'number';
    const hasMetaUpdates = title !== undefined || author !== undefined || image_url !== undefined || source_url !== undefined || url !== undefined;

    if (Object.keys(updates).length === 0 && !hasReadingProgress && !hasMetaUpdates) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // 获取本地文档信息
    let doc = getCachedDocument(id) || { id, category: 'video', location: 'new' };

    // 如果提供了 video URL 且标题/封面为空，自动发起 oEmbed 元数据补全
    const targetUrl = source_url || url || doc.source_url || doc.url;
    let fetchedMeta = null;
    if (targetUrl && (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be'))) {
      fetchedMeta = await fetchYouTubeMetadata(targetUrl);
    }

    // 组合新字段
    const finalTitle = title || fetchedMeta?.title || doc.title;
    const finalAuthor = author || fetchedMeta?.author || doc.author;
    const finalImageUrl = image_url || fetchedMeta?.thumbnail || doc.image_url;
    const finalSourceUrl = source_url || url || doc.source_url || doc.url;

    // 如果有需要同步到 Readwise 的字段（tags、notes 等），且 Readwise 已配置，尝试发起远程更新
    if (Object.keys(updates).length > 0) {
      try {
        const client = getServerReadwiseClient();
        const readwiseUrl = finalSourceUrl || doc?.source_url || doc?.url;
        await client.updateDocument(id, updates, readwiseUrl);
      } catch (e) {
        console.warn('Readwise 远程更新提示:', e.message);
      }
    }

    // 更新本地数据库
    if (doc) {
      if (tags !== undefined) {
        const tagsObj = {};
        tags.forEach(tag => {
          tagsObj[tag] = 1; 
        });
        doc.tags = tagsObj;
      }
      if (notes !== undefined) doc.notes = notes;
      if (hasReadingProgress) doc.reading_progress = Math.max(doc.reading_progress || 0, reading_progress);
      if (finalTitle) doc.title = finalTitle;
      if (finalAuthor) doc.author = finalAuthor;
      if (finalImageUrl) doc.image_url = finalImageUrl;
      if (finalSourceUrl) {
        doc.source_url = finalSourceUrl;
        doc.url = finalSourceUrl;
      }
      if (finalSourceUrl && (finalSourceUrl.includes('youtube.com') || finalSourceUrl.includes('youtu.be') || finalSourceUrl.includes('bilibili.com'))) {
        doc.category = 'video';
      }

      upsertDocument(doc);
    }

    const updatedDoc = getCachedDocument(id);
    return NextResponse.json({ success: true, doc: updatedDoc });
  } catch (error) {
    console.error('更新文档元数据失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}
