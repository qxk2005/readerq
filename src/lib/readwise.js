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
  async listDocuments({ updatedAfter, location, category, tag, limit, pageCursor, withHtmlContent } = {}) {
    const params = new URLSearchParams();
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
    return this.fetchWithRetry(`${this.baseUrl}/update/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
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
    return this.fetchWithRetry(`${this.baseUrl}/delete/${id}`, {
      method: 'DELETE',
    });
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
 */
export function getServerReadwiseClient() {
  const token = process.env.READWISE_API_TOKEN;
  if (!token) {
    throw new Error('未配置 READWISE_API_TOKEN 环境变量');
  }
  return createReadwiseClient(token);
}
