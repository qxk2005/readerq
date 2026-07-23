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
   * 更新文档 (V3 API)
   * 如果包含标签更新，同时通过 V2 API 同步标签到 V2 系统
   * @param {string} id - V3 文档 ID
   * @param {object} updates - 更新字段 { tags, notes, ... }
   * @param {string} [sourceUrl] - 文档的 source_url (可选，用于 V2 标签同步)
   */
  async updateDocument(id, updates, sourceUrl) {
    const result = await this.fetchWithRetry(`${this.baseUrl}/update/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    // 如果更新包含标签，同步到 V2 books tags 系统
    if (updates.tags && Array.isArray(updates.tags) && updates.tags.length > 0) {
      try {
        let url = sourceUrl;
        if (!url) {
          // Fallback: 从 V3 list 获取 source_url
          const docData = await this.fetchWithRetry(`${this.baseUrl}/list/?id=${id}`);
          url = docData?.results?.[0]?.source_url;
        }
        
        if (url) {
          await this.syncDocumentTagsV2(url, updates.tags);
        } else {
          console.warn('[V2标签同步] 无法获取文档 source_url，跳过 V2 标签同步');
        }
      } catch (err) {
        console.error('[V2标签同步] 同步失败 (不影响 V3):', err.message);
      }
    }

    return result;
  }

  /**
   * 通过 source_url 在 V2 books API 中查找 book_id
   * @param {string} sourceUrl - 文档的原始 URL
   * @returns {number|null} V2 book_id，未找到返回 null
   */
  async findV2BookId(sourceUrl) {
    if (!sourceUrl) return null;

    let nextPage = 'https://readwise.io/api/v2/books/?page_size=100';
    let pageCount = 0;
    const maxPages = 10;

    while (nextPage && pageCount < maxPages) {
      pageCount++;
      const response = await fetch(nextPage, {
        headers: this.headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) break;

      const data = await response.json();
      for (const book of (data.results || [])) {
        if (book.source_url === sourceUrl) {
          console.log(`[V2 Book查找] 匹配到 book_id=${book.id} (搜索了 ${pageCount} 页)`);
          return book.id;
        }
      }
      nextPage = data.next || null;
    }

    console.warn(`[V2 Book查找] 未找到 source_url=${sourceUrl} 对应的 V2 book (搜索了 ${pageCount} 页)`);
    return null;
  }

  /**
   * 通过 V2 books tags API 同步文档标签
   * V2 标签系统独立于 V3，Readwise 后台 bookreview 页面使用 V2 标签
   * 
   * @param {string} sourceUrl - 文档的 source_url
   * @param {string[]} tags - 目标标签列表
   */
  async syncDocumentTagsV2(sourceUrl, tags) {
    const bookId = await this.findV2BookId(sourceUrl);
    if (!bookId) return;

    try {
      // 获取现有 V2 标签
      const existingRes = await fetch(`https://readwise.io/api/v2/books/${bookId}/tags/`, {
        headers: this.headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!existingRes.ok) {
        console.error('[V2标签同步] 获取现有标签失败:', existingRes.status);
        return;
      }

      const existingTags = await existingRes.json();
      const existingNames = new Set(existingTags.map(t => t.name));
      const targetNames = new Set(tags);

      // 删除不在目标列表中的旧标签
      for (const tag of existingTags) {
        if (!targetNames.has(tag.name)) {
          await fetch(`https://readwise.io/api/v2/books/${bookId}/tags/${tag.id}`, {
            method: 'DELETE',
            headers: this.headers,
            signal: AbortSignal.timeout(10000),
          });
          console.log(`[V2标签同步] 删除旧标签: ${tag.name}`);
        }
      }

      // 添加新标签
      for (const tagName of tags) {
        if (!existingNames.has(tagName)) {
          const addRes = await fetch(`https://readwise.io/api/v2/books/${bookId}/tags/`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ name: tagName }),
            signal: AbortSignal.timeout(10000),
          });
          if (addRes.ok) {
            console.log(`[V2标签同步] 添加标签: ${tagName}`);
          } else {
            console.warn(`[V2标签同步] 添加标签 ${tagName} 失败: ${addRes.status}`);
          }
        }
      }

      console.log(`[V2标签同步] book_id=${bookId} 标签同步完成`);
    } catch (err) {
      console.error('[V2标签同步] 异常:', err.message);
    }
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
    const highlightData = {
      text: highlight.text,
      title: highlight.title,
      source_url: highlight.source_url,
      location: highlight.location_start,
    };
    // Readwise V2 API 不接受空字符串的 note 字段
    if (highlight.note) {
      highlightData.note = highlight.note;
    }

    const payload = {
      highlights: [highlightData]
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
      // 注意：POST /highlights/ 返回的对象 ID 其实是 book_id，真实的高亮 ID 在 modified_highlights 数组里
      const createdHighlights = result;
      let readwiseHighlightId = null;
      if (Array.isArray(createdHighlights) && createdHighlights.length > 0) {
        if (createdHighlights[0].modified_highlights && createdHighlights[0].modified_highlights.length > 0) {
          readwiseHighlightId = createdHighlights[0].modified_highlights[0];
        } else if (createdHighlights[0].id) {
          readwiseHighlightId = createdHighlights[0].id; // Fallback
        }
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
   * 从 Readwise 删除高亮
   * 使用 Readwise API v2 接口: DELETE /api/v2/highlights/<id>
   * 
   * @param {string|number} readwiseHighlightId - Readwise 分配的高亮 ID
   */
  async deleteReadwiseHighlight(readwiseHighlightId) {
    if (!readwiseHighlightId) {
      console.warn('[Readwise删除] 缺少 readwiseHighlightId，跳过远程删除');
      return;
    }

    const response = await fetch(`https://readwise.io/api/v2/highlights/${readwiseHighlightId}`, {
      method: 'DELETE',
      headers: this.headers,
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 204) {
      console.log(`[Readwise删除] 高亮 ${readwiseHighlightId} 已从 Readwise 删除`);
      return;
    }

    if (response.status === 404) {
      console.warn(`[Readwise删除] 高亮 ${readwiseHighlightId} 在 Readwise 中不存在，可能已被删除`);
      return;
    }

    const errorText = await response.text();
    throw new Error(`Readwise 删除高亮失败 (${response.status}): ${errorText}`);
  }

  /**
   * 通过文本内容在 Readwise 中查找并删除高亮
   * 用于没有存储 readwise_highlight_id 的旧高亮
   * 
   * 策略: 遍历 V2 highlights 列表 API，通过文本前缀匹配找到目标高亮后删除
   * 
   * @param {string} highlightText - 高亮的文本内容
   * @param {string} sourceUrl - 文档的 source_url (未使用但保留接口兼容)
   * @param {string} [docTitle] - 文档标题 (未使用但保留接口兼容)
   * @returns {number} 删除的高亮数量
   */
  async findAndDeleteReadwiseHighlight(highlightText, sourceUrl, docTitle) {
    if (!highlightText) {
      console.warn('[Readwise查找删除] 缺少文本内容，跳过');
      return 0;
    }

    // 取文本前 60 个字符用于匹配（去除 Markdown 图片语法）
    const textPrefix = highlightText.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim().substring(0, 60);
    if (!textPrefix || textPrefix.length < 10) {
      console.warn('[Readwise查找删除] 清理后文本太短，跳过');
      return 0;
    }

    let deletedCount = 0;
    let nextPage = `https://readwise.io/api/v2/highlights/?page_size=1000`;
    let pageCount = 0;
    const maxPages = 5; // 最多搜索 5 页 (5000 条)
    let targetBookId = null; // 锁定到第一个匹配的 book_id，防止误删其他文档的高亮

    console.log(`[Readwise查找删除] 搜索文本前缀: "${textPrefix.substring(0, 40)}..."`);

    while (nextPage && pageCount < maxPages) {
      pageCount++;
      try {
        const response = await fetch(nextPage, {
          headers: this.headers,
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          console.error(`[Readwise查找删除] API 请求失败: ${response.status}`);
          break;
        }

        const data = await response.json();
        
        for (const hl of (data.results || [])) {
          const hlTextClean = (hl.text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').replace(/\[图片[^\]]*\]/g, '').trim();
          if (hlTextClean.startsWith(textPrefix) || textPrefix.startsWith(hlTextClean.substring(0, 60))) {
            // 第一次匹配时记录 book_id，后续只删除同 book 的高亮
            if (targetBookId === null) {
              targetBookId = hl.book_id;
              console.log(`[Readwise查找删除] 锁定 book_id=${targetBookId}`);
            }
            
            if (hl.book_id !== targetBookId) {
              console.log(`[Readwise查找删除] 跳过非目标 book 的匹配: ID=${hl.id}, book_id=${hl.book_id}`);
              continue;
            }
            
            console.log(`[Readwise查找删除] 匹配到高亮 ID=${hl.id}, book_id=${hl.book_id}`);
            try {
              await this.deleteReadwiseHighlight(hl.id);
              deletedCount++;
            } catch (delErr) {
              console.error(`[Readwise查找删除] 删除 ID=${hl.id} 失败:`, delErr.message);
            }
          }
        }

        // 找到并删除后就停止，不继续翻页
        if (deletedCount > 0) break;

        nextPage = data.next || null;
      } catch (err) {
        console.error('[Readwise查找删除] 搜索异常:', err.message);
        break;
      }
    }

    console.log(`[Readwise查找删除] 完成，共删除 ${deletedCount} 条 (搜索了 ${pageCount} 页)`);
    return deletedCount;
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
  async fetchAllV2Highlights({ updatedAfter } = {}, onProgress = null, checkCancel = null, onBatch = null) {
    let nextPageCursor = null;
    let fetchedCount = 0;
    let totalBookCount = 0;

    do {
      if (checkCancel && checkCancel()) {
        throw new Error('Sync cancelled by user');
      }

      const params = new URLSearchParams();
      if (nextPageCursor) params.append('pageCursor', nextPageCursor);
      if (updatedAfter) params.append('updatedAfter', updatedAfter);

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
            readwise_highlight_id: String(h.id),
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
            readwise_highlight_id: String(h.id),
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
  /**
   * 获取 Readwise 官方每日回顾 (Daily Review)
   * API: GET https://readwise.io/api/v2/review/
   */
  async getDailyReview() {
    return this.fetchWithRetry('https://readwise.io/api/v2/review/');
  }

  /**
   * 提交 Readwise 官方回顾操作状态
   * API: POST https://readwise.io/api/v2/review/action/
   * @param {Object} payload - { highlight_id, action: 'keep'|'discard'|'master'|'favorite' }
   */
  async submitReviewAction(payload) {
    return this.fetchWithRetry('https://readwise.io/api/v2/review/action/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
 * 优先使用数据库中用户设置的值，回退到环境变量
 */
export function getServerReadwiseClient() {
  let token = null;
  // 优先从数据库读取用户在设置页面中配置的 token
  try {
    const { getSetting } = require('@/lib/db');
    token = getSetting('readwise_token');
  } catch { /* ignore */ }
  // 回退到环境变量（开发模式 / CLI 模式）
  if (!token) {
    token = process.env.READWISE_API_TOKEN;
  }
  if (!token) {
    throw new Error('未配置 Readwise API Token。请在设置中填入你的 Token。');
  }
  return createReadwiseClient(token);
}
