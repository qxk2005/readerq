import { NextResponse } from 'next/server';
import { autoFetchVideoSubtitles } from '@/lib/videoSubtitleFetcher';
import { translateSubtitlesToBilingual, convertSubtitlesToBlog, isAIConfigured } from '@/lib/ai';
import { saveSubtitle, updateDocumentBlog, setSetting, upsertDocuments } from '@/lib/db';
import { uploadSubtitleToOss, uploadBlogToOss, validateOssConfig, getOssConfig } from '@/lib/oss';
import { getServerReadwiseClient } from '@/lib/readwise';

function isOssAvailable() {
  try {
    const config = getOssConfig();
    return validateOssConfig(config).valid;
  } catch {
    return false;
  }
}

/**
 * POST /api/video-pipeline/process
 * 细粒度流式 (Event-Stream) 视频处理 API
 * 包含：免 Cookie 字幕抓取 -> AI 双语翻译 -> AI 字幕博客生成 -> OSS 上传
 */
export async function POST(request) {
  try {
    const { docId, url, title } = await request.json();

    if (!docId || !url) {
      return NextResponse.json({ error: '缺少 docId 或 url 参数' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (type, message, extra = {}) => {
          try {
            const data = JSON.stringify({ type, message, ...extra });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (e) {
            console.error('发送 SSE 数据出错:', e);
          }
        };

        try {
          // 1. 抓取字幕阶段 (具备 3 次自动重试与备用轨)
          sendProgress('progress', '⌛ [1/4 抓取字幕] 正在尝试从 YouTube 免 Cookie 提取公开字幕轨...');
          
          let subtitleFetchResult;
          try {
            subtitleFetchResult = await autoFetchVideoSubtitles(url, (attempt, max, msg) => {
              sendProgress('progress', `⌛ [1/4 抓取字幕] ${msg}`);
            });
          } catch (fetchErr) {
            sendProgress('error', `❌ ${fetchErr.message}`);
          }

          if (!subtitleFetchResult || !subtitleFetchResult.srtContent) {
            sendProgress('complete', '⚠️ 未找到该视频的公开字幕轨。您可以点击【上传字幕】选择本地 .srt 文件');
            controller.close();
            return;
          }

          const { srtContent, segments } = subtitleFetchResult;
          sendProgress('progress', `⌛ [1/4 抓取字幕] 成功提取 ${segments.length} 条带时间戳字幕卡片`);

          let finalSegments = segments;
          let generatedBlogHtml = null;

          // 2. AI 处理阶段 (翻译 + 博客)
          if (isAIConfigured()) {
            // 2.1 双语翻译
            sendProgress('progress', `⌛ [2/4 双语翻译] 正在调用 AI 进行中英对照翻译 (共 ${segments.length} 句)...`);
            try {
              const translated = await translateSubtitlesToBilingual(segments);
              if (translated && translated.length > 0) {
                finalSegments = translated;
                const translatedCount = translated.filter(s => s.zh).length;
                sendProgress('progress', `✅ [2/4 双语翻译] 已成功生成 ${translatedCount} 句中英双语对照`);
              }
            } catch (aiErr) {
              sendProgress('progress', `⚠️ [2/4 双语翻译] AI 翻译跳过: ${aiErr.message}`);
            }

            // 2.2 字幕博客生成
            sendProgress('progress', '⌛ [3/4 博客转换] 正在调用大模型生成带 [mm:ss] 跳播节点的 Markdown 视频博客...');
            try {
              const blogHtml = await convertSubtitlesToBlog(finalSegments, title || '视频精选博客');
              if (blogHtml) {
                generatedBlogHtml = blogHtml;
                updateDocumentBlog(docId, blogHtml);
                setSetting(`blog_updated_at_${docId}`, new Date().toISOString());
                sendProgress('progress', `✅ [3/4 博客转换] 已成功生成 ${blogHtml.length} 字精选结构化博客文章`);
              }
            } catch (blogErr) {
              sendProgress('progress', `⚠️ [3/4 博客转换] 博客生成跳过: ${blogErr.message}`);
            }
          } else {
            sendProgress('progress', 'ℹ️ 未配置 OpenAI 服务器，跳过 AI 双语翻译与博客生成');
          }

          // 3. 本地与 OSS 存库阶段
          saveSubtitle(docId, srtContent, finalSegments);
          sendProgress('progress', '💾 字幕与数据已保存到本地 SQLite 数据库');

          if (isOssAvailable()) {
            sendProgress('progress', '☁️ [4/4 OSS 同步] 正在上传字幕 JSON 与博客至阿里云 OSS...');
            try {
              const contentToUpload = (Array.isArray(finalSegments) && finalSegments.some(s => s.zh))
                ? JSON.stringify(finalSegments)
                : srtContent;
              const ossRes = await uploadSubtitleToOss(docId, contentToUpload);
              if (generatedBlogHtml) {
                await uploadBlogToOss(docId, generatedBlogHtml);
              }
              if (ossRes.success) {
                sendProgress('progress', '☁️ [4/4 OSS 同步] 字幕与博客已无缝同步至阿里云 OSS');
              }
            } catch (ossErr) {
              sendProgress('progress', `⚠️ [4/4 OSS 同步] OSS 同步跳过: ${ossErr.message}`);
            }
          }

          // 4. 从 Readwise 云端重新同步文档最新元数据（标题、封面等）
          try {
            const client = getServerReadwiseClient();
            const docData = await client.listDocuments({ id: docId });
            const latestDoc = docData?.results?.find(d => d.id === docId);
            if (latestDoc) {
              upsertDocuments([latestDoc]);
              // 通过 SSE 将更新后的文档元数据推送给前端
              sendProgress('doc_updated', '📋 文档元数据已同步更新', {
                doc: {
                  id: latestDoc.id,
                  title: latestDoc.title,
                  author: latestDoc.author,
                  image_url: latestDoc.image_url,
                  site_name: latestDoc.site_name,
                  reading_progress: latestDoc.reading_progress,
                },
              });
            }
          } catch (syncErr) {
            console.warn('[视频Pipeline] 同步文档元数据失败 (不影响主流程):', syncErr.message);
          }

          // 5. 全流程完成
          sendProgress('complete', '✅ [完成] 视频解析、双语翻译与博客生成全流程处理成功！');
          controller.close();
        } catch (err) {
          console.error('视频 Pipeline 执行出错:', err);
          sendProgress('error', `❌ 处理流程出错: ${err.message}`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('视频 Pipeline 接口初始化错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
