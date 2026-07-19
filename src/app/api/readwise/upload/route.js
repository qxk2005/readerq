import { NextResponse } from 'next/server';
import { getServerReadwiseClient } from '@/lib/readwise';
import { getOssConfig, validateOssConfig, uploadFileToOss } from '@/lib/oss';

/**
 * 将文本内容转换为基本 HTML 格式，以便 Readwise 能够准确解析出段落和标题
 */
function convertTextToHtml(text, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'html' || ext === 'htm') {
    return text;
  }

  // 针对 Markdown 做一个极简且安全的结构化 HTML 映射
  if (ext === 'md' || ext === 'markdown') {
    return text
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('# ')) return `<h1>${trimmed.slice(2)}</h1>`;
        if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
        if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return `<li>${trimmed.slice(2)}</li>`;
        return `<p>${trimmed}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  }

  // 纯文本 (.txt) 直接按行包裹段落
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      return trimmed ? `<p>${trimmed}</p>` : '';
    })
    .filter(Boolean)
    .join('\n');
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: '没有接收到文件' }, { status: 400 });
    }

    const filename = file.name;
    const fileType = file.type || '';
    const ext = filename.split('.').pop().toLowerCase();

    const title = formData.get('title') || filename.substring(0, filename.lastIndexOf('.')) || filename;
    const author = formData.get('author') || '';
    const notes = formData.get('notes') || '';
    const tagsJson = formData.get('tags') || '[]';
    let tags = [];
    try {
      tags = JSON.parse(tagsJson);
    } catch {
      tags = [];
    }

    const client = getServerReadwiseClient();

    // 1. 对于文本类型 (.txt, .md, .html)，可以直接读取文本并转换为 HTML 段落传递给 Readwise Save API
    if (['txt', 'md', 'markdown', 'html', 'htm'].includes(ext)) {
      const text = await file.text();
      const htmlContent = convertTextToHtml(text, filename);
      
      // 生成唯一的本地虚拟识别 URL，Readwise 官方推荐此类文件的 URL 使用唯一的虚拟 ID 形式
      const virtualUrl = `file:///local-doc-${Date.now()}-${encodeURIComponent(filename)}`;

      const result = await client.saveDocument({
        url: virtualUrl,
        html: htmlContent,
        title: title,
        author: author,
        notes: notes,
        tags: tags,
        category: 'article',
        shouldCleanHtml: false // 已经是精简的 HTML 片段，无需 Readwise 再次清洗
      });

      return NextResponse.json({ success: true, result });
    }

    // 2. 对于二进制类型 (.pdf, .epub)，检测并使用 OSS 中转
    if (['pdf', 'epub'].includes(ext)) {
      const ossConfig = getOssConfig();
      const ossValidation = validateOssConfig(ossConfig);

      if (!ossValidation.valid) {
        return NextResponse.json({ 
          error: '未配置阿里云 OSS 存储。当前 Readwise 限制直接上传二进制 PDF/EPUB 文件，您需要配置图床用作临时中转，或者直接拖拽上传到 Readwise 网页端 (read.readwise.io)。',
          needOssConfig: true
        }, { status: 400 });
      }

      // 读取文件 ArrayBuffer 并转为 Buffer 用于上传
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 上传到 OSS
      const uploadResult = await uploadFileToOss(buffer, filename, fileType, ossConfig);
      if (!uploadResult.success) {
        return NextResponse.json({ error: `上传文件到阿里云 OSS 失败: ${uploadResult.error}` }, { status: 500 });
      }

      // 将 OSS 公开访问 URL 提交给 Readwise 抓取
      const result = await client.saveDocument({
        url: uploadResult.ossUrl,
        title: title,
        author: author,
        notes: notes,
        tags: tags,
        category: ext === 'pdf' ? 'pdf' : 'epub'
      });

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: `不支持的文件格式: .${ext}。目前支持上传 .txt, .md, .html, .pdf, .epub 格式文件。` }, { status: 400 });

  } catch (error) {
    console.error('上传并保存文档错误:', error);
    return NextResponse.json(
      { error: error.message || '上传并保存文档失败' },
      { status: 500 }
    );
  }
}
