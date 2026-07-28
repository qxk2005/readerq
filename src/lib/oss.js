/**
 * 阿里云 OSS 图床工具模块
 * 使用 REST API 进行签名上传，无需额外 SDK 依赖
 */

import crypto from 'crypto';
import path from 'path';
import { getSetting } from '@/lib/db';

/**
 * 判断字符串是否包含掩码字符 (如 •••••• 或 *****)
 */
export function isMaskedValue(val) {
  if (!val || typeof val !== 'string') return true;
  return val.includes('•') || val.includes('\u2022') || /^[*•\s]+$/.test(val);
}

/**
 * 获取 OSS 配置 (支持合并前端测试用的 overrideConfig)
 */
export function getOssConfig(overrideConfig = null) {
  const dbRegion = getSetting('oss_region');
  const dbBucket = getSetting('oss_bucket');
  const dbAccessKeyId = getSetting('oss_access_key_id');
  const dbAccessKeySecret = getSetting('oss_access_key_secret');
  const dbCustomDomain = getSetting('oss_custom_domain');
  const dbPathPrefix = getSetting('oss_path_prefix') || 'readerq';

  if (!overrideConfig) {
    return {
      region: dbRegion,
      bucket: dbBucket,
      accessKeyId: dbAccessKeyId,
      accessKeySecret: dbAccessKeySecret,
      customDomain: dbCustomDomain,
      pathPrefix: dbPathPrefix,
    };
  }

  const region = (overrideConfig.region && overrideConfig.region.trim()) ? overrideConfig.region.trim() : dbRegion;
  const bucket = (overrideConfig.bucket && overrideConfig.bucket.trim()) ? overrideConfig.bucket.trim() : dbBucket;

  const accessKeyId = (overrideConfig.accessKeyId && !isMaskedValue(overrideConfig.accessKeyId))
    ? overrideConfig.accessKeyId.trim()
    : dbAccessKeyId;

  const accessKeySecret = (overrideConfig.accessKeySecret && !isMaskedValue(overrideConfig.accessKeySecret))
    ? overrideConfig.accessKeySecret.trim()
    : dbAccessKeySecret;

  const customDomain = overrideConfig.customDomain !== undefined ? overrideConfig.customDomain : dbCustomDomain;
  const pathPrefix = overrideConfig.pathPrefix || dbPathPrefix;

  return { region, bucket, accessKeyId, accessKeySecret, customDomain, pathPrefix };
}

/**
 * 校验 OSS 配置是否完整与合法
 */
export function validateOssConfig(config) {
  const { region, bucket, accessKeyId, accessKeySecret } = config || {};
  const missing = [];
  if (!region) missing.push('Region');
  if (!bucket) missing.push('Bucket');
  if (!accessKeyId) missing.push('AccessKey ID');
  if (!accessKeySecret) missing.push('AccessKey Secret');

  if (missing.length > 0) {
    return { valid: false, message: `缺少配置项: ${missing.join(', ')}` };
  }

  if (isMaskedValue(accessKeyId) || isMaskedValue(accessKeySecret)) {
    return { valid: false, message: 'AccessKey 包含未替换的掩码字符(•)，请在输入框中填入完整的真实 AccessKey ID 与 Secret' };
  }

  // 检查非 ASCII 字符 (防止 Node fetch 抛出 ByteString Header 异常)
  for (let i = 0; i < accessKeyId.length; i++) {
    if (accessKeyId.charCodeAt(i) > 255) {
      return { valid: false, message: `AccessKey ID 包含非 ASCII 异常字符: "${accessKeyId[i]}"` };
    }
  }
  for (let i = 0; i < accessKeySecret.length; i++) {
    if (accessKeySecret.charCodeAt(i) > 255) {
      return { valid: false, message: `AccessKey Secret 包含非 ASCII 异常字符: "${accessKeySecret[i]}"` };
    }
  }

  return { valid: true };
}

/**
 * 生成 OSS 签名 (V1 / Authorization Header)
 * 参考: https://help.aliyun.com/document_detail/31951.html
 */
function signOssRequest({ method, contentType, date, resource, accessKeyId, accessKeySecret }) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64');
  return `OSS ${accessKeyId}:${signature}`;
}

/**
 * 根据 URL 或原始文件名推断 Content-Type
 */
function guessContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.avif': 'image/avif',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * 从 URL 中提取文件扩展名，如果无法提取则根据 Content-Type 推断
 */
function getExtension(url, contentType) {
  // 尝试从 URL 路径中提取
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext)) {
      return ext;
    }
  } catch { /* ignore */ }

  // 从 Content-Type 推断
  const ctMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
  };
  return ctMap[contentType] || '.jpg';
}

/**
 * 生成唯一的 OSS 对象路径
 * 格式: {pathPrefix}/{documentId}/{timestamp}-{random}{ext}
 */
function generateObjectKey(pathPrefix, documentId, ext) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${pathPrefix}/${documentId}/${timestamp}-${random}${ext}`;
}

/**
 * 构建图片的公开访问 URL
 */
function buildPublicUrl(config, objectKey) {
  if (config.customDomain) {
    // 使用自定义域名
    const domain = config.customDomain.replace(/\/+$/, '');
    const protocol = domain.startsWith('http') ? '' : 'https://';
    return `${protocol}${domain}/${objectKey}`;
  }
  // 使用默认的 OSS 域名
  return `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;
}

/**
 * 下载远程图片或解析 Data URL 并上传到阿里云 OSS
 * 
 * @param {string} imageUrl - 源图片 URL 或 Data URL
 * @param {string} documentId - 关联的文档 ID，用于组织路径
 * @param {object} [ossConfig] - 可选的 OSS 配置，为空时从数据库读取
 * @param {string} [sourceUrl] - 源页面 URL，用于补全相对路径及防盗链 Referer
 * @returns {Promise<{success: boolean, ossUrl?: string, error?: string}>}
 */
export async function uploadImageToOss(imageUrl, documentId, ossConfig = null, sourceUrl = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    let imageBuffer;
    let contentType;
    let ext = '.jpg';

    // 1. 如果是 Data URL (Base64 图片)
    if (imageUrl.startsWith('data:')) {
      try {
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          contentType = matches[1];
          imageBuffer = Buffer.from(matches[2], 'base64');
          ext = getExtension('', contentType);
        } else {
          return { success: false, error: 'Data URL 格式无效' };
        }
      } catch (e) {
        return { success: false, error: `解析 Base64 图片失败: ${e.message}` };
      }
    } else {
      // 2. 规范化远程图片 URL (处理 // 或相对路径)
      let finalUrl = imageUrl.trim();
      if (finalUrl.startsWith('//')) {
        finalUrl = `https:${finalUrl}`;
      } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        if (sourceUrl) {
          try {
            const baseUrl = new URL(sourceUrl);
            finalUrl = new URL(finalUrl, baseUrl.origin).toString();
          } catch {
            return { success: false, error: `无效的图片相对路径: ${imageUrl}` };
          }
        } else {
          return { success: false, error: `图片 URL 缺少 http/https 协议前缀: ${imageUrl}` };
        }
      }

      // 3. 下载源图片 (支持防盗链 Referer 及常用 Headers)
      const downloadHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      };
      if (sourceUrl) {
        downloadHeaders['Referer'] = sourceUrl;
      }

      let imageResponse;
      try {
        imageResponse = await fetch(finalUrl, {
          headers: downloadHeaders,
          signal: AbortSignal.timeout(30000), // 30秒超时
        });
      } catch (fetchErr) {
        return { success: false, error: `下载源图片网络失败 (${fetchErr.message}): ${finalUrl.slice(0, 80)}...` };
      }

      if (!imageResponse.ok) {
        return { success: false, error: `下载源图片失败 (HTTP ${imageResponse.status})` };
      }

      const responseContentType = imageResponse.headers.get('content-type') || '';
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      if (imageBuffer.length === 0) {
        return { success: false, error: '下载的图片内容为空' };
      }

      ext = getExtension(finalUrl, responseContentType);
      contentType = guessContentType(`file${ext}`);
    }

    // 4. 生成 OSS 对象路径
    const objectKey = generateObjectKey(config.pathPrefix, documentId, ext);

    // 5. 构造 PUT 请求上传到 OSS
    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'PUT',
      contentType,
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    let uploadResponse;
    try {
      uploadResponse = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': authorization,
          'Content-Type': contentType,
          'Date': date,
          'Content-Length': String(imageBuffer.length),
        },
        body: imageBuffer,
        signal: AbortSignal.timeout(60000), // 60秒超时
      });
    } catch (uploadErr) {
      return { success: false, error: `上传至 OSS 网络失败 (${uploadErr.message})，请检查 OSS 配置` };
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `OSS 保存拒绝 (HTTP ${uploadResponse.status}): ${errorText}` };
    }

    // 6. 构建公开访问 URL
    const ossUrl = buildPublicUrl(config, objectKey);

    return { success: true, ossUrl, objectKey };
  } catch (err) {
    return { success: false, error: `图片处理异常: ${err.message}` };
  }
}

/**
 * 上传测试图片以验证 OSS 配置是否正确
 * 会生成一个 1x1 像素的 PNG 图片上传并尝试访问
 */
export async function testOssUpload(ossConfig) {
  const validation = validateOssConfig(ossConfig);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    // 生成一个最小的 1x1 像素 PNG
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
    const imageBuffer = Buffer.from(pngBase64, 'base64');
    const contentType = 'image/png';
    const objectKey = `${ossConfig.pathPrefix || 'readerq'}/_test/connection-test.png`;

    const date = new Date().toUTCString();
    const resource = `/${ossConfig.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'PUT',
      contentType,
      date,
      resource,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
    });

    const endpoint = `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${objectKey}`;

    const uploadResponse = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Date': date,
        'Content-Length': String(imageBuffer.length),
      },
      body: imageBuffer,
      signal: AbortSignal.timeout(15000),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `上传测试失败 (HTTP ${uploadResponse.status}): ${errorText}` };
    }

    // 构建访问 URL 并验证可访问性
    const publicUrl = buildPublicUrl(ossConfig, objectKey);

    try {
      const verifyResponse = await fetch(publicUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      if (!verifyResponse.ok) {
        return {
          success: true,
          ossUrl: publicUrl,
          warning: `上传成功，但验证访问返回 HTTP ${verifyResponse.status}。请检查 Bucket 是否开启了公共读权限或自定义域名是否正确。`
        };
      }
    } catch {
      return {
        success: true,
        ossUrl: publicUrl,
        warning: '上传成功，但无法验证公开访问。请确认 Bucket 权限设置为公共读。'
      };
    }

    return { success: true, ossUrl: publicUrl };
  } catch (err) {
    return { success: false, error: `测试异常: ${err.message}` };
  }
}

/**
 * 上传任意 Buffer 形式的文件到阿里云 OSS
 * 
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @param {string} fileName - 原始文件名
 * @param {string} contentType - Mime Type
 * @param {object} [ossConfig] - 可选的 OSS 配置
 * @returns {Promise<{success: boolean, ossUrl?: string, objectKey?: string, error?: string}>}
 */
export async function uploadFileToOss(fileBuffer, fileName, contentType, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const ext = path.extname(fileName).toLowerCase();
    // 放入独立文件夹 uploads 以区分普通高亮图片
    const objectKey = generateObjectKey(config.pathPrefix, 'uploads', ext);

    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'PUT',
      contentType,
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const uploadResponse = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Date': date,
        'Content-Length': String(fileBuffer.length),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(120000), // 120秒超时
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `OSS 上传失败 (HTTP ${uploadResponse.status}): ${errorText}` };
    }

    const ossUrl = buildPublicUrl(config, objectKey);
    return { success: true, ossUrl, objectKey };
  } catch (err) {
    return { success: false, error: `文件上传 OSS 异常: ${err.message}` };
  }
}

/**
 * 构建字幕文件在 OSS 上的确定性路径
 * 使用固定路径使得所有客户端能共享同一份字幕
 * @param {string} pathPrefix - OSS 路径前缀
 * @param {string} documentId - 文档 ID
 * @returns {string} OSS 对象键
 */
function getSubtitleObjectKey(pathPrefix, documentId) {
  return `${pathPrefix}/subtitles/${documentId}.srt`;
}

/**
 * 上传 SRT 字幕到 OSS（用于跨客户端同步）
 * 
 * @param {string} documentId - 文档 ID
 * @param {string} srtContent - SRT 字幕文本内容
 * @param {object} [ossConfig] - 可选的 OSS 配置
 * @returns {Promise<{success: boolean, ossUrl?: string, error?: string}>}
 */
export async function uploadSubtitleToOss(documentId, srtContent, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const contentType = 'text/plain; charset=utf-8';
    const objectKey = getSubtitleObjectKey(config.pathPrefix, documentId);
    const fileBuffer = Buffer.from(srtContent, 'utf-8');

    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'PUT',
      contentType,
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const uploadResponse = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Date': date,
        'Content-Length': String(fileBuffer.length),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(30000),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `OSS 上传字幕失败 (HTTP ${uploadResponse.status}): ${errorText}` };
    }

    const ossUrl = buildPublicUrl(config, objectKey);
    return { success: true, ossUrl, objectKey };
  } catch (err) {
    return { success: false, error: `字幕上传 OSS 异常: ${err.message}` };
  }
}

/**
 * 从 OSS 下载字幕文件（用于跨客户端同步回退）
 * 
 * @param {string} documentId - 文档 ID
 * @param {object} [ossConfig] - 可选的 OSS 配置
 * @returns {Promise<{success: boolean, srtContent?: string, error?: string}>}
 */
export async function downloadSubtitleFromOss(documentId, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const objectKey = getSubtitleObjectKey(config.pathPrefix, documentId);
    const ossUrl = buildPublicUrl(config, objectKey);

    const response = await fetch(ossUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404 || response.status === 403) {
      // 文件不存在
      return { success: false, notFound: true };
    }

    if (!response.ok) {
      return { success: false, error: `OSS 下载字幕失败 (HTTP ${response.status})` };
    }

    const srtContent = await response.text();
    if (!srtContent || srtContent.trim().length === 0) {
      return { success: false, notFound: true };
    }

    // 提取 Last-Modified 时间戳作为云端版本时间
    const lastModifiedHeader = response.headers.get('Last-Modified') || response.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader).toISOString() : null;

    return { success: true, srtContent, lastModified };
  } catch (err) {
    return { success: false, error: `字幕下载 OSS 异常: ${err.message}` };
  }
}

/**
 * 从 OSS 删除字幕文件
 * 
 * @param {string} documentId - 文档 ID
 * @param {object} [ossConfig] - 可选的 OSS 配置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteSubtitleFromOss(documentId, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const objectKey = getSubtitleObjectKey(config.pathPrefix, documentId);

    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'DELETE',
      contentType: '',
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const deleteResponse = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
        'Date': date,
      },
      signal: AbortSignal.timeout(15000),
    });

    // OSS DELETE 对不存在的对象也会返回 204，所以只需检查异常
    if (!deleteResponse.ok && deleteResponse.status !== 204 && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      return { success: false, error: `OSS 删除字幕失败 (HTTP ${deleteResponse.status}): ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `字幕删除 OSS 异常: ${err.message}` };
  }
}

/**
 * 构建博客文件在 OSS 上的确定性路径
 * @param {string} pathPrefix - OSS 路径前缀
 * @param {string} documentId - 文档 ID
 * @returns {string} OSS 对象键
 */
function getBlogObjectKey(pathPrefix, documentId) {
  return `${pathPrefix}/blogs/${documentId}.md`;
}

/**
 * 上传博客 Markdown 到 OSS（用于跨客户端同步）
 * 
 * @param {string} documentId - 文档 ID
 * @param {string} blogContent - 博客正文（Markdown 格式）
 * @param {object} [ossConfig] - 可选 of OSS 配置
 * @returns {Promise<{success: boolean, ossUrl?: string, error?: string}>}
 */
export async function uploadBlogToOss(documentId, blogContent, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const contentType = 'text/markdown; charset=utf-8';
    const objectKey = getBlogObjectKey(config.pathPrefix, documentId);
    const fileBuffer = Buffer.from(blogContent, 'utf-8');

    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'PUT',
      contentType,
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const uploadResponse = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Date': date,
        'Content-Length': String(fileBuffer.length),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(30000),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `OSS 上传博客失败 (HTTP ${uploadResponse.status}): ${errorText}` };
    }

    const ossUrl = buildPublicUrl(config, objectKey);
    return { success: true, ossUrl, objectKey };
  } catch (err) {
    return { success: false, error: `博客上传 OSS 异常: ${err.message}` };
  }
}

/**
 * 从 OSS 下载博客 Markdown 文件
 * 
 * @param {string} documentId - 文档 ID
 * @param {object} [ossConfig] - 可选 of OSS 配置
 * @returns {Promise<{success: boolean, blogContent?: string, error?: string, notFound?: boolean}>}
 */
export async function downloadBlogFromOss(documentId, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const objectKey = getBlogObjectKey(config.pathPrefix, documentId);
    const ossUrl = buildPublicUrl(config, objectKey);

    const response = await fetch(ossUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404 || response.status === 403) {
      return { success: false, notFound: true };
    }

    if (!response.ok) {
      return { success: false, error: `OSS 下载博客失败 (HTTP ${response.status})` };
    }

    const blogContent = await response.text();
    if (!blogContent || blogContent.trim().length === 0) {
      return { success: false, notFound: true };
    }

    // 提取 Last-Modified 时间戳作为云端版本时间
    const lastModifiedHeader = response.headers.get('Last-Modified') || response.headers.get('last-modified');
    const lastModified = lastModifiedHeader ? new Date(lastModifiedHeader).toISOString() : null;

    return { success: true, blogContent, lastModified };
  } catch (err) {
    return { success: false, error: `博客下载 OSS 异常: ${err.message}` };
  }
}

/**
 * 从 OSS 删除博客文件
 * 
 * @param {string} documentId - 文档 ID
 * @param {object} [ossConfig] - 可选 of OSS 配置
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteBlogFromOss(documentId, ossConfig = null) {
  const config = ossConfig || getOssConfig();
  const validation = validateOssConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.message };
  }

  try {
    const objectKey = getBlogObjectKey(config.pathPrefix, documentId);

    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;
    const authorization = signOssRequest({
      method: 'DELETE',
      contentType: '',
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const deleteResponse = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
        'Date': date,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!deleteResponse.ok && deleteResponse.status !== 204 && deleteResponse.status !== 404) {
      const errorText = await deleteResponse.text();
      return { success: false, error: `OSS 删除博客失败 (HTTP ${deleteResponse.status}): ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `博客删除 OSS 异常: ${err.message}` };
  }
}

/**
 * 上传 Zen Read 用户分析、偏好及评价同步 JSON 到 OSS
 */
export async function uploadZenReadProfileToOss(zenData, ossConfig = null) {
  try {
    const config = ossConfig || getOssConfig();
    const validation = validateOssConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    const objectKey = `${config.pathPrefix}/zen_read_profile.json`;
    const jsonStr = typeof zenData === 'string' ? zenData : JSON.stringify(zenData, null, 2);
    const fileBuffer = Buffer.from(jsonStr, 'utf-8');

    return await uploadFileToOss(fileBuffer, 'zen_read_profile.json', 'application/json; charset=utf-8', config);
  } catch (err) {
    return { success: false, error: `禅阅读数据同步上传 OSS 异常: ${err.message}` };
  }
}

/**
 * 从 OSS 下载 Zen Read 用户偏好与同步 JSON
 */
export async function downloadZenReadProfileFromOss(ossConfig = null) {
  try {
    const config = ossConfig || getOssConfig();
    const validation = validateOssConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    const objectKey = `${config.pathPrefix}/zen_read_profile.json`;
    const date = new Date().toUTCString();
    const resource = `/${config.bucket}/${objectKey}`;

    const authorization = signOssRequest({
      method: 'GET',
      contentType: '',
      date,
      resource,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    });

    const endpoint = config.customDomain
      ? `https://${config.customDomain.replace(/^https?:\/\//, '')}/${objectKey}`
      : `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Date': date,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: true, data: null };
      }
      return { success: false, error: `从 OSS 读取禅阅读同步数据失败 (HTTP ${response.status})` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: `从 OSS 下载禅阅读数据异常: ${err.message}` };
  }
}
