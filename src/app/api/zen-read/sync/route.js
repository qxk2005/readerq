import { NextResponse } from 'next/server';
import { getZenReadExportData, importZenReadData } from '@/lib/db';
import { uploadZenReadProfileToOss, downloadZenReadProfileFromOss } from '@/lib/oss';

export async function GET() {
  try {
    const res = await downloadZenReadProfileFromOss();
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error });
    }
    if (res.data) {
      importZenReadData(res.data);
    }
    return NextResponse.json({ success: true, synced: !!res.data, data: res.data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const exportData = getZenReadExportData();
    const res = await uploadZenReadProfileToOss(exportData);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error });
    }
    return NextResponse.json({ success: true, uploadedAt: exportData.exportedAt });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
