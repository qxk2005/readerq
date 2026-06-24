import { NextResponse } from 'next/server';
import { deleteHighlight, getHighlight, upsertHighlight } from '@/lib/db';
import { getServerReadwiseClient } from '@/lib/readwise';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const existing = getHighlight(id);
    if (!existing) {
      return NextResponse.json({ error: '高亮不存在' }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...body
    };

    upsertHighlight(updated);

    // Readwise v2 don't have a simple PUT for highlight update, 
    // but if syncToReadwise is true, we might re-post it or just warn user.
    // For now, we update local db. Inline tagging would re-sync if we re-created it,
    // but readwise api doesn't dedupe perfectly. We will just update locally.
    
    return NextResponse.json({ success: true, highlight: updated });
  } catch (error) {
    console.error('更新高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '更新高亮失败' },
      { status: 500 }
    );
  }
}

// 前端 ReadingPane 使用 PUT 方法调用，这里同时导出 PUT 以保持兼容
export { PATCH as PUT };

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    deleteHighlight(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除高亮失败:', error);
    return NextResponse.json(
      { error: error.message || '删除高亮失败' },
      { status: 500 }
    );
  }
}
