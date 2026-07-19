import { NextResponse } from 'next/server';
import { getCachedDocument, upsertDocument } from '@/lib/db';
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
 * GET /api/documents/[id]/blog
 * 获取指定视频文档的 AI 博客文章
 * 优先从本地数据库获取；如本地无数据且 OSS 已配置，则从 OSS 尝试下载并写入本地缓存
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // 1. 优先从本地数据库获取
    const doc = getCachedDocument(id);
    if (doc && doc.blog_content) {
      return NextResponse.json({
        exists: true,
        blogContent: doc.blog_content,
        source: 'local',
      });
    }

    // 2. 本地无数据，尝试从 OSS 获取
    if (isOssAvailable()) {
      const ossResult = await downloadBlogFromOss(id);
      if (ossResult.success && ossResult.blogContent) {
        // 从 OSS 成功拉取博客，写入本地数据库
        if (doc) {
          doc.blog_content = ossResult.blogContent;
          upsertDocument(doc);
        }
        return NextResponse.json({
          exists: true,
          blogContent: ossResult.blogContent,
          source: 'oss',
        });
      }
    }

    return NextResponse.json({ exists: false, blogContent: '' });
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
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { blogContent } = body;

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
