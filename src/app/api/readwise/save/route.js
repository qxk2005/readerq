/**
 * Readwise 保存文档 API 路由
 */

import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { isSupportedVideoUrl, autoFetchVideoSubtitles } from '@/lib/videoSubtitleFetcher';
import { translateSubtitlesToBilingual, convertSubtitlesToBlog, isAIConfigured } from '@/lib/ai';
import { saveSubtitle, updateDocumentBlog, upsertDocument, setSetting } from '@/lib/db';
import { uploadSubtitleToOss, uploadBlogToOss, validateOssConfig, getOssConfig } from '@/lib/oss';

function isOssAvailable() {
  try {
    const config = getOssConfig();
    return validateOssConfig(config).valid;
  } catch {
    return false;
  }
}

/**
 * 通过 YouTube oEmbed API 快速获取视频真实标题、作者和缩略图
 * oEmbed 是公开接口，无需 API Key，响应极快（<200ms）
 */
async function fetchYouTubeMetadata(videoUrl) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || null,
      author: data.author_name || null,
      thumbnail: data.thumbnail_url || null,
    };
  } catch (e) {
    console.warn('[oEmbed] YouTube 元数据获取失败:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.url) {
      return NextResponse.json({ error: '缺少 URL 参数' }, { status: 400 });
    }

    const client = getServerReadwiseClient();
    const result = await client.saveDocument(body);

    const docId = result?.id;
    const isVideo = isSupportedVideoUrl(body.url);

    // 🎬 对视频 URL 通过 oEmbed API 快速获取真实标题/作者/缩略图
    let videoMeta = null;
    if (isVideo) {
      videoMeta = await fetchYouTubeMetadata(body.url);
    }

    // 构造最终的标题与作者（优先级：oEmbed 真实标题 > Readwise 返回 > 用户输入 > 占位符）
    const finalTitle = result.title || videoMeta?.title || body.title || (isVideo ? '视频文章' : '新增文章');
    const finalAuthor = body.author || result.author || videoMeta?.author || '';
    const finalImage = result.image_url || videoMeta?.thumbnail || '';

    // 💡 关键修正：立即将新保存的文档写入本地数据库，防止前端跳转请求单篇文档时报"文档未找到"错误
    if (docId) {
      upsertDocument({
        id: docId,
        url: body.url,
        source_url: body.url,
        title: finalTitle,
        author: finalAuthor,
        category: isVideo ? 'video' : 'article',
        location: 'new',
        image_url: finalImage,
        saved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_content: '',
        blog_content: '',
      });
    }

    // 将真实标题注入到返回结果中，确保前端和后续 pipeline 使用正确标题
    if (!result.title && finalTitle) {
      result.title = finalTitle;
    }
    if (!result.author && finalAuthor) {
      result.author = finalAuthor;
    }


    let pipelineStatus = {
      isVideo,
      autoSubtitlesFetched: false,
      aiBilingualTranslated: false,
      aiBlogGenerated: false,
      ossSynced: false,
    };

    // 🎥 针对视频 URL 的全自动化 Pipeline 处理
    if (isVideo && docId) {
      try {
        // 1. 免 Cookie 自动下载配套的带时间戳 SRT 字幕
        const subtitleFetchResult = await autoFetchVideoSubtitles(body.url);
        if (subtitleFetchResult && subtitleFetchResult.srtContent) {
          const { srtContent, segments } = subtitleFetchResult;
          pipelineStatus.autoSubtitlesFetched = true;

          let finalSegments = segments;

          // 2. 如果配置了 OpenAI 兼容服务器，自动调用进行中英双语对照翻译与字幕博客生成
          if (isAIConfigured()) {
            try {
              // 2.1 双语字幕对照翻译
              const translated = await translateSubtitlesToBilingual(segments);
              if (translated && translated.length > 0) {
                finalSegments = translated;
                pipelineStatus.aiBilingualTranslated = true;
              }
            } catch (aiErr) {
              console.warn('[视频Pipeline] AI 双语翻译跳过或失败:', aiErr.message);
            }

            let generatedBlogHtml = null;
            try {
              // 2.2 字幕精选博客文章自动生成
              const blogHtml = await convertSubtitlesToBlog(finalSegments, result.title || '视频精选博客');
              if (blogHtml) {
                generatedBlogHtml = blogHtml;
                pipelineStatus.aiBlogGenerated = true;
                // 💡 写回数据库 blog_content 字段与版本时间戳
                updateDocumentBlog(docId, blogHtml);
                setSetting(`blog_updated_at_${docId}`, new Date().toISOString());
              }
            } catch (blogErr) {
              console.warn('[视频Pipeline] AI 博客生成跳过或失败:', blogErr.message);
            }
          }

          // 3. 保存字幕与双语 JSON 到本地数据库
          saveSubtitle(docId, srtContent, finalSegments);

          // 4. 同步上传字幕与博客产物至阿里云 OSS
          if (isOssAvailable()) {
            try {
              const contentToUpload = (Array.isArray(finalSegments) && finalSegments.some(s => s.zh))
                ? JSON.stringify(finalSegments)
                : srtContent;
              const ossRes = await uploadSubtitleToOss(docId, contentToUpload);
              if (ossRes.success) {
                pipelineStatus.ossSynced = true;
              }
              // 如果生成了博客文章，同步保存到 OSS
              if (generatedBlogHtml) {
                await uploadBlogToOss(docId, generatedBlogHtml);
              }
            } catch (ossErr) {
              console.warn('[视频Pipeline] OSS 同步异常:', ossErr.message);
            }
          }
        }
      } catch (videoPipelineErr) {
        console.warn('[视频Pipeline] 免 Cookie 字幕抓取或处理跳过:', videoPipelineErr.message);
      }
    }

    return NextResponse.json({
      ...result,
      pipelineStatus,
    }, { status: 201 });
  } catch (error) {
    console.error('保存文档错误:', error);
    return NextResponse.json(
      { error: error.message || '保存文档失败' },
      { status: 500 }
    );
  }
}
