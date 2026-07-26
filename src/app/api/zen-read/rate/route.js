import { NextResponse } from 'next/server';
import { saveZenReadRating, getZenReadExportData } from '@/lib/db';
import { uploadZenReadProfileToOss } from '@/lib/oss';

export async function POST(request) {
  try {
    const body = await request.json();
    const { documentId, rating, comment = '', feedbackTags = [] } = body;

    if (!documentId) {
      return NextResponse.json({ success: false, error: '缺少 documentId' }, { status: 400 });
    }

    // 1. 本地保存打分记录
    const result = saveZenReadRating({
      documentId,
      rating: rating || 5, // 1~5 星或 5(赞) / 1(踩)
      comment,
      feedbackTags
    });

    // 2. 异步同步偏好文件至阿里云 OSS
    try {
      const exportData = getZenReadExportData();
      uploadZenReadProfileToOss(exportData).catch(err => {
        console.warn('禅阅读评价后台上传 OSS 异常 (无碍本地操作):', err.message);
      });
    } catch (e) {
      /* ignore OSS error */
    }

    return NextResponse.json({
      success: true,
      message: '评分与评价已记录，AI 已吸收偏好并同步至云端',
      result
    });
  } catch (error) {
    console.error('保存禅阅读评分失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
