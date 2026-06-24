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
      const response = await fetch(url, {
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
   */
  async fetchAllDocuments({ updatedAfter, location, category, tag, withHtmlContent } = {}) {
    const allResults = [];
    let nextPageCursor = null;

    do {
      const data = await this.listDocuments({
        updatedAfter,
        location,
        category,
        tag,
        pageCursor: nextPageCursor,
        withHtmlContent,
      });
      allResults.push(...data.results);
      nextPageCursor = data.nextPageCursor;
    } while (nextPageCursor);

    return allResults;
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
   */
  async createReadwiseHighlight(highlight) {
    // 处理高亮的 Inline Tagging
    // 如果高亮包含 tags，则将其以 .tag 形式追加到 note 中
    let finalNote = highlight.note || '';
    if (highlight.tags && Object.keys(highlight.tags).length > 0) {
      const tagString = Object.keys(highlight.tags).map(tag => `.${tag}`).join(' ');
      finalNote = finalNote ? `${finalNote}\n\n${tagString}` : tagString;
    }

    const payload = {
      highlights: [{
        text: highlight.text,
        title: highlight.title,
        source_url: highlight.source_url,
        note: finalNote,
        location: highlight.location_start,
      }]
    };

    const response = await fetch('https://readwise.io/api/v2/highlights/', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Readwise API v2 高亮错误 (${response.status}): ${errorText}`);
    }

    return response.json();
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
  async fetchAllTags() {
    const allResults = [];
    let nextPageCursor = null;

    do {
      const data = await this.listTags({ pageCursor: nextPageCursor });
      allResults.push(...data.results);
      nextPageCursor = data.nextPageCursor;
    } while (nextPageCursor);

    return allResults;
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
