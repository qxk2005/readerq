/**
 * OSS 图片上传 API 路由
 * POST: 下载远程图片并上传到阿里云 OSS
 */

import { NextResponse } from 'next/server';
import { uploadImageToOss } from '@/lib/oss';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { imageUrl, documentId } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: '缺少 imageUrl 参数' }, { status: 400 });
    }
    if (!documentId) {
      return NextResponse.json({ error: '缺少 documentId 参数' }, { status: 400 });
    }

    const result = await uploadImageToOss(imageUrl, documentId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ossUrl: result.ossUrl,
      objectKey: result.objectKey,
    });
  } catch (error) {
    console.error('OSS 上传 API 错误:', error);
    return NextResponse.json(
      { error: error.message || 'OSS 上传失败' },
      { status: 500 }
    );
  }
}
