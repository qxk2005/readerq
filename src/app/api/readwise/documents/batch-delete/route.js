import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { deleteDocuments } from '@/lib/db';
import { deleteSubtitleFromOss, deleteBlogFromOss, validateOssConfig, getOssConfig } from '@/lib/oss';

function isOssAvailable() {
  try {
    const config = getOssConfig();
    return validateOssConfig(config).valid;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = body.ids;

    const idList = Array.isArray(ids) ? ids : (typeof ids === 'string' && ids.trim() ? [ids.trim()] : []);

    if (idList.length === 0) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    // 1. 本地 SQLite 数据库强制物理彻底删除
    deleteDocuments(idList);

    // 2. 异步向 Readwise 官方 API 发起并发删除请求 (忽略 404 等远端已消亡的异常)
    try {
      const client = getServerReadwiseClient();
      const promises = idList.map(id => client.deleteDocument(id).catch(err => {
        console.warn(`[Readwise API] 物理删除文档 ${id} 返回 warning:`, err.message);
        return null;
      }));
      await Promise.allSettled(promises);
    } catch (apiErr) {
      console.warn('[Readwise API] 并发删除远端请求异常，忽略以保障本地已物理清除:', apiErr.message);
    }

    // 3. 联动删除 OSS 上的字幕与博客文件（后台执行，不阻塞响应）
    if (isOssAvailable()) {
      const ossPromises = idList.flatMap(id => [
        deleteSubtitleFromOss(id).catch(err => {
          console.warn(`[OSS] 删除字幕文件 ${id} 失败:`, err.message);
        }),
        deleteBlogFromOss(id).catch(err => {
          console.warn(`[OSS] 删除博客文件 ${id} 失败:`, err.message);
        }),
      ]);
      await Promise.allSettled(ossPromises);
    }

    return NextResponse.json({ success: true, count: idList.length });
  } catch (error) {
    console.error('批量删除文档失败:', error);
    return NextResponse.json({ error: error.message || '批量删除失败' }, { status: 500 });
  }
}
