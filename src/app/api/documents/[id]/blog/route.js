import { NextResponse } from 'next/server';
import { getCachedDocument, upsertDocument, setSetting, getSetting } from '@/lib/db';
import { uploadBlogToOss, downloadBlogFromOss, validateOssConfig, getOssConfig } from '@/lib/oss';

/**
 * 检查 OSS 是否已配置
 */
function isOssAvailable() {
  try {
    const config = getOssConfig();
    return validateOssConfig(config).valid;
  } catch {
    return false;
  }
}

/**
 * 格式化 ISO 日期
 */
function formatVersionTime(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * GET /api/documents/[id]/blog
 * 获取指定视频文档的 AI 博客文章
 * 优先从本地数据库获取；如本地无数据且 OSS 已配置，则从 OSS 尝试下载并写入本地缓存
 * 使用时间戳对比（而非纯内容对比）判断是否有更新版本
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // 1. 读取本地数据库的博客内容
    const doc = getCachedDocument(id);
    const localBlogContent = doc?.blog_content || null;
    // 本地博客的版本时间：从 settings 表读取
    const localUpdatedAt = getSetting(`blog_updated_at_${id}`, null);

    // 2. 如果配置了 OSS，尝试拉取云端 OSS 最新博客进行版本对比
    if (isOssAvailable()) {
      try {
        const ossResult = await downloadBlogFromOss(id);
        if (ossResult.success && ossResult.blogContent) {
          const ossBlogContent = ossResult.blogContent;
          const ossUpdatedAt = ossResult.lastModified || null;

          if (!localBlogContent) {
            // 本地无数据但云端有：自动同步入库
            if (doc) {
              doc.blog_content = ossBlogContent;
              upsertDocument(doc);
            }
            // 保存版本时间戳
            const effectiveTime = ossUpdatedAt || new Date().toISOString();
            setSetting(`blog_updated_at_${id}`, effectiveTime);

            return NextResponse.json({
              exists: true,
              blogContent: ossBlogContent,
              source: 'oss',
              hasNewerVersion: false,
              localUpdatedAt: formatVersionTime(effectiveTime),
              ossUpdatedAt: formatVersionTime(ossUpdatedAt),
            });
          } else {
            // 本地有数据，通过时间戳判断云端是否更新
            let hasNewer = false;
            if (ossUpdatedAt && localUpdatedAt) {
              const ossTime = new Date(ossUpdatedAt).getTime();
              const localTime = new Date(localUpdatedAt).getTime();
              // 云端时间比本地晚 2 秒以上才算有新版本
              hasNewer = ossTime > localTime + 2000;
            } else {
              // 回退：时间戳缺失时用内容对比
              hasNewer = localBlogContent.trim() !== ossBlogContent.trim();
            }

            if (hasNewer) {
              return NextResponse.json({
                exists: true,
                blogContent: localBlogContent,
                source: 'local',
                hasNewerVersion: true,
                newerBlogContent: ossBlogContent,
                localUpdatedAt: formatVersionTime(localUpdatedAt),
                ossUpdatedAt: formatVersionTime(ossUpdatedAt),
              });
            }
          }
        }
      } catch (ossErr) {
        console.warn('[博客版本比对] 拉取 OSS 失败:', ossErr.message);
      }
    }

    if (localBlogContent) {
      return NextResponse.json({
        exists: true,
        blogContent: localBlogContent,
        source: 'local',
        hasNewerVersion: false,
        localUpdatedAt: formatVersionTime(localUpdatedAt),
        ossUpdatedAt: null,
      });
    }

    return NextResponse.json({ exists: false, blogContent: '', hasNewerVersion: false });
  } catch (error) {
    console.error('获取博客文章失败:', error);
    return NextResponse.json(
      { error: error.message || '获取博客文章失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/blog
 * 保存视频博客文章到本地，并同步至 OSS
 * 
 * 支持额外参数：
 * - ossTimestamp: 当从云端切换最新博客时，传入 OSS 版本时间戳作为 blog_updated_at
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { blogContent, ossTimestamp } = body;

    if (!blogContent || typeof blogContent !== 'string' || blogContent.trim().length === 0) {
      return NextResponse.json({ error: '博客内容不能为空' }, { status: 400 });
    }

    // 1. 获取并更新本地文档
    const doc = getCachedDocument(id);
    if (doc) {
      doc.blog_content = blogContent;
      upsertDocument(doc);
    } else {
      return NextResponse.json({ error: '未找到该文档' }, { status: 404 });
    }

    // 保存版本时间戳到 settings 表
    const effectiveTime = ossTimestamp || new Date().toISOString();
    setSetting(`blog_updated_at_${id}`, effectiveTime);

    // 2. 同步到 OSS（后台执行，不阻塞接口响应）
    let ossSynced = false;
    if (isOssAvailable()) {
      try {
        const ossResult = await uploadBlogToOss(id, blogContent);
        ossSynced = ossResult.success;
        if (!ossResult.success) {
          console.warn('[博客OSS同步] 上传失败:', ossResult.error);
        }
      } catch (err) {
        console.warn('[博客OSS同步] 上传异常:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      blogContent,
      ossSynced,
    });
  } catch (error) {
    console.error('保存博客文章失败:', error);
    return NextResponse.json(
      { error: error.message || '保存博客文章失败' },
      { status: 500 }
    );
  }
}
