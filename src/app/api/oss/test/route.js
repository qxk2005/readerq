/**
 * OSS 配置测试 API 路由
 * POST: 测试 OSS 配置是否正确
 */

import { NextResponse } from 'next/server';
import { testOssUpload } from '@/lib/oss';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const config = {
      region: body.oss_region,
      bucket: body.oss_bucket,
      accessKeyId: body.oss_access_key_id,
      accessKeySecret: body.oss_access_key_secret,
      customDomain: body.oss_custom_domain,
      pathPrefix: body.oss_path_prefix || 'readerq',
    };

    const result = await testOssUpload(config);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      ossUrl: result.ossUrl,
      warning: result.warning || null,
    });
  } catch (error) {
    console.error('OSS 测试 API 错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'OSS 测试失败' },
      { status: 200 }
    );
  }
}
