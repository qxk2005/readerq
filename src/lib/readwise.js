/**
 * Readwise API v3 封装
 * 处理所有与 Readwise Reader 的通信
 */

const READWISE_BASE_URL = 'https://readwise.io/api/v3';

class ReadwiseAPI {
  constructor(token) {
    this.token = token;
    this.baseUrl = READWISE_BASE_URL;
  }

  get headers() {
    return {
      'Authorization': `Token ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 处理速率限制的 fetch 包装
   */
  async fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000), // 15秒超时，防止网络请求因网络丢包无限卡死
          ...options,
          headers: { ...this.headers, ...options.headers },
        });

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          console.warn(`速率限制，${retryAfter} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Readwise API 错误 (${response.status}): ${errorText}`);
        }

        // DELETE 请求返回 204 无内容
        if (response.status === 204) {
          return null;
        }

        return response.json();
      } catch (err) {
        if (i === retries - 1) {
          throw err;
        }
        console.warn(`请求失败: ${err.message}，正在进行第 ${i + 2} 次重试...`);
        // 等待 1 秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('超过最大重试次数');
  }

  /**
   * 获取文档列表 (支持分页)
   */
  async listDocuments({ id, updatedAfter, location, category, tag, limit, pageCursor, withHtmlContent } = {}) {
    const params = new URLSearchParams();
    if (id) params.append('id', id);
    if (updatedAfter) params.append('updatedAfter', updatedAfter);
    if (location) params.append('location', location);
    if (category) params.append('category', category);
    if (tag) params.append('tag', tag);
    if (limit) params.append('limit', String(limit));
    if (pageCursor) params.append('pageCursor', pageCursor);
    if (withHtmlContent) params.append('withHtmlContent', 'true');

    return this.fetchWithRetry(`${this.baseUrl}/list/?${params.toString()}`);
  }

  /**
   * 获取所有文档 (自动分页)
   * 支持传入 onProgress 回调和 checkCancel 函数
   */
  async fetchAllDocuments({ updatedAfter, location, category, tag, withHtmlContent } = {}, onProgress = null, checkCancel = null, onBatch = null) {
    const allResults = [];
    let nextPageCursor = null;
    let totalCount = 0;
    let fetchedCount = 0;

    do {
      if (checkCancel && checkCancel()) {
        throw new Error('Sync cancelled by user');
      }

      const data = await this.listDocuments({
        updatedAfter,
        location,
        category,
        tag,
        pageCursor: nextPageCursor,
        withHtmlContent,
      });
      
      if (data.count !== undefined && totalCount === 0) {
        totalCount = data.count;
      }
      
      if (onBatch) {
        // 分批处理，不占用全局内存
        await onBatch(data.results);
      } else {
        allResults.push(...data.results);
      }
      
      fetchedCount += data.results.length;
      nextPageCursor = data.nextPageCursor;

      if (onProgress) {
        onProgress({ fetched: fetchedCount, total: totalCount });
      }
    } while (nextPageCursor);

    return { results: allResults, totalCount, fetchedCount };
  }

  /**
   * 获取单个文档 (包含 HTML 内容)
   */
  async getDocument(id) {
    const data = await this.listDocuments({ id, withHtmlContent: true });
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
    return null;
  }

  /**
   * 保存新文档
   */
  async saveDocument({ url, html, shouldCleanHtml, title, author, summary, publishedDate, imageUrl, location, category, tags, notes }) {
    const body = { url };
    if (html) body.html = html;
    if (shouldCleanHtml !== undefined) body.should_clean_html = shouldCleanHtml;
    if (title) body.title = title;
    if (author) body.author = author;
    if (summary) body.summary = summary;
    if (publishedDate) body.published_date = publishedDate;
    if (imageUrl) body.image_url = imageUrl;
    if (location) body.location = location;
    if (category) body.category = category;
    if (tags) body.tags = tags;
    if (notes) body.notes = notes;

    return this.fetchWithRetry(`${this.baseUrl}/save/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * 更新文档
   */
  async updateDocument(id, updates) {
    return this.fetchWithRetry(`${this.baseUrl}/update/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * 专门用于更新文档标签的方法
   */
  async updateDocumentTags(id, tags) {
    return this.updateDocument(id, { tags });
  }

  /**
   * 批量更新文档
   */
  async bulkUpdateDocuments(updates) {
    return this.fetchWithRetry(`${this.baseUrl}/bulk_update/`, {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
  }

  /**
   * 删除文档
   */
  async deleteDocument(id) {
    return this.fetchWithRetry(`${this.baseUrl}/delete/${id}/`, {
      method: 'DELETE',
    });
  }

  /**
   * 创建高亮并发送到 Readwise
   * 使用 Readwise API v2 接口
   * 
   * 标签处理：创建高亮后，使用 V2 专用 tags 端点为每个标签单独发请求
   * （Inline Tagging .tag 格式仅在 Readwise Reader 原生 UI 中有效，API 创建时不会自动解析）
   */
  async createReadwiseHighlight(highlight) {
    const payload = {
      highlights: [{
        text: highlight.text,
        title: highlight.title,
        source_url: highlight.source_url,
        note: highlight.note || '',
        location: highlight.location_start,
      }]
    };

    const response = await fetch('https://readwise.io/api/v2/highlights/', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Readwise API v2 高亮错误 (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // 使用 V2 tags 端点为高亮添加标签
    // 端点: POST /api/v2/highlights/<highlight_id>/tags/
    if (highlight.tags && Object.keys(highlight.tags).length > 0) {
      // 从返回结果中获取 Readwise 分配的 highlight ID
      const createdHighlights = result;
      let readwiseHighlightId = null;
      if (Array.isArray(createdHighlights) && createdHighlights.length > 0) {
        readwiseHighlightId = createdHighlights[0].id;
      } else if (createdHighlights?.id) {
        readwiseHighlightId = createdHighlights.id;
      }

      if (readwiseHighlightId) {
        const tagNames = Object.keys(highlight.tags);
        for (const tagName of tagNames) {
          try {
            const tagResponse = await fetch(
              `https://readwise.io/api/v2/highlights/${readwiseHighlightId}/tags/`,
              {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ name: tagName }),
                signal: AbortSignal.timeout(10000),
              }
            );
            if (!tagResponse.ok) {
              console.warn(`为高亮添加标签 "${tagName}" 失败: HTTP ${tagResponse.status}`);
            }
          } catch (tagErr) {
            console.warn(`为高亮添加标签 "${tagName}" 异常:`, tagErr.message);
          }
        }
      }
    }

    return result;
  }

  /**
   * 使用 V2 Export API 批量拉取所有高亮
   * V2 Export 按 book 分组返回高亮，每个 book 包含 source_url 等信息
   * 用于同步时补全通过 V2 API 创建的高亮（这些高亮不会出现在 V3 list 结果中）
   * 
   * @param {Function} onProgress - 进度回调
   * @param {Function} checkCancel - 检查取消回调
   * @param {Function} onBatch - 批处理回调，接收 [{book, highlights}] 数组
   * @returns {Object} { fetchedCount, totalBookCount }
   */
  async fetchAllV2Highlights(onProgress = null, checkCancel = null, onBatch = null) {
    let nextPageCursor = null;
    let fetchedCount = 0;
    let totalBookCount = 0;

    do {
      if (checkCancel && checkCancel()) {
        throw new Error('Sync cancelled by user');
      }

      const params = new URLSearchParams();
      if (nextPageCursor) params.append('pageCursor', nextPageCursor);

      const data = await this.fetchWithRetry(
        `https://readwise.io/api/v2/export/?${params.toString()}`
      );

      if (data.count !== undefined && totalBookCount === 0) {
        totalBookCount = data.count;
      }

      // 从 export 数据中提取每本书的高亮
      const batchItems = [];
      for (const book of (data.results || [])) {
        if (book.highlights && book.highlights.length > 0) {
          const highlights = book.highlights.map(h => ({
            id: h.external_id || `readwise-v2-${h.id}`,
            readwise_id: h.id,
            text: h.text || '',
            note: h.note || '',
            color: h.color || 'yellow',
            tags: this._convertV2Tags(h.tags),
            location: h.location || null,
            created_at: h.highlighted_at || h.created_at || new Date().toISOString(),
          }));
          batchItems.push({
            book_id: book.user_book_id,
            title: book.title,
            source_url: book.source_url,
            readable_id: book.readable_id,
            asin: book.asin,
            highlights,
          });
          fetchedCount += highlights.length;
        }
      }

      if (onBatch && batchItems.length > 0) {
        await onBatch(batchItems);
      }

      nextPageCursor = data.nextPageCursor;

      if (onProgress) {
        onProgress({ fetched: fetchedCount, total: totalBookCount });
      }
    } while (nextPageCursor);

    return { fetchedCount, totalBookCount };
  }

  /**
   * 获取标签列表
   */
  async listTags({ pageCursor } = {}) {
    const params = new URLSearchParams();
    if (pageCursor) params.append('pageCursor', pageCursor);

    return this.fetchWithRetry(`${this.baseUrl}/tags/?${params.toString()}`);
  }

  /**
   * 获取所有标签
   */
  async fetchAllTags(onProgress = null, checkCancel = null, onBatch = null) {
    const allResults = [];
    let nextPageCursor = null;
    let totalCount = 0;
    let fetchedCount = 0;

    do {
      if (checkCancel && checkCancel()) {
        throw new Error('Sync cancelled by user');
      }

      const data = await this.listTags({ pageCursor: nextPageCursor });
      
      if (data.count !== undefined && totalCount === 0) {
        totalCount = data.count;
      }
      
      if (onBatch) {
        await onBatch(data.results);
      } else {
        allResults.push(...data.results);
      }
      
      fetchedCount += data.results.length;
      nextPageCursor = data.nextPageCursor;
      
      if (onProgress) {
        onProgress({ fetched: fetchedCount, total: totalCount });
      }
    } while (nextPageCursor);

    return { results: allResults, totalCount, fetchedCount };
  }

  /**
   * 通过 Readwise v2 Export API 获取指定文档的高亮
   * v2 API 比 v3 list 更适合获取高亮，因为：
   * 1. 可以按 ids (user_book_id) 筛选特定文档
   * 2. 返回完整的 text, note, color, tags 信息
   * 3. 只需 1 次 API 调用
   * 
   * @param {string} externalId - v3 API 的文档 ID（documents 表中的 id）
   * @returns {Array} 高亮数组
   */
  async fetchDocumentHighlightsV2(externalId) {
    // 方法1: 先尝试用 v2 export API 分页搜索包含该 external_id 的 book
    // v2 export 的 ids 参数需要 user_book_id（整数），不是 v3 的文档 ID
    // 所以我们需要遍历 export 数据找到匹配的 book
    const allHighlights = [];
    let nextPageCursor = null;

    do {
      const params = new URLSearchParams();
      if (nextPageCursor) params.append('pageCursor', nextPageCursor);

      const data = await this.fetchWithRetry(
        `https://readwise.io/api/v2/export/?${params.toString()}`
      );

      for (const book of (data.results || [])) {
        if (book.external_id === externalId) {
          // 找到匹配的书/文档，返回其高亮
          return (book.highlights || []).map(h => ({
            id: h.external_id || `readwise-v2-${h.id}`,
            readwise_id: h.id,
            text: h.text || '',
            note: h.note || '',
            color: h.color || 'yellow',
            tags: this._convertV2Tags(h.tags),
            location: h.location || null,
            created_at: h.highlighted_at || h.created_at || new Date().toISOString(),
          }));
        }
      }

      nextPageCursor = data.nextPageCursor;
    } while (nextPageCursor);

    return allHighlights; // empty if not found
  }

  /**
   * 转换 v2 tags 格式为本地格式
   * v2: [{id: 123, name: "tag1"}, ...]
   * 本地: {"tag1": "123", ...}
   */
  _convertV2Tags(tags) {
    if (!tags || !Array.isArray(tags)) return {};
    const result = {};
    for (const t of tags) {
      result[t.name] = String(t.id);
    }
    return result;
  }

  /**
   * 验证 Token 是否有效
   */
  async validateToken() {
    try {
      const response = await fetch('https://readwise.io/api/v2/auth/', {
        headers: this.headers,
        signal: AbortSignal.timeout(10000), // 10秒超时
      });
      return response.status === 204;
    } catch {
      return false;
    }
  }
}

/**
 * 创建 Readwise API 实例
 */
export function createReadwiseClient(token) {
  if (!token) {
    throw new Error('未提供 Readwise API Token');
  }
  return new ReadwiseAPI(token);
}

/**
 * 获取服务端 Readwise 客户端
 * 优先使用环境变量，回退到数据库中用户设置的值
 */
export function getServerReadwiseClient() {
  let token = process.env.READWISE_API_TOKEN;
  if (!token) {
    // 从数据库读取用户在 WebUI 中设置的 token
    try {
      const { getSetting } = require('@/lib/db');
      token = getSetting('readwise_token');
    } catch { /* ignore */ }
  }
  if (!token) {
    throw new Error('未配置 Readwise API Token。请在设置中填入你的 Token，或在 .env.local 中配置 READWISE_API_TOKEN');
  }
  return createReadwiseClient(token);
}
