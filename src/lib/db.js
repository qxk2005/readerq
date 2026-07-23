/**
 * SQLite 本地数据缓存层
 * 缓存 Readwise 数据以提升访问速度
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db = null;

/**
 * 获取数据库实例
 */
export function getDatabase() {
  if (db) return db;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'readerq.db'));

  // 开启 WAL 模式提升性能
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 初始化表结构
  initSchema(db);

  // 重置启动时可能残留的卡死同步状态
  try {
    db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('sync_status', 'idle')").run();
    db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('sync_cancel_requested', 'false')").run();
  } catch (e) {
    console.error('初始化重置同步状态失败:', e);
  }

  return db;
}

/**
 * 初始化数据库表结构
 */
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      url TEXT,
      source_url TEXT,
      title TEXT,
      author TEXT,
      source TEXT,
      category TEXT,
      location TEXT,
      site_name TEXT,
      word_count INTEGER,
      reading_time TEXT,
      created_at TEXT,
      updated_at TEXT,
      published_date TEXT,
      summary TEXT,
      notes TEXT,
      image_url TEXT,
      parent_id TEXT,
      reading_progress REAL DEFAULT 0,
      first_opened_at TEXT,
      last_opened_at TEXT,
      saved_at TEXT,
      last_moved_at TEXT,
      html_content TEXT,
      tags_json TEXT DEFAULT '{}',
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      key TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      text TEXT,
      note TEXT,
      color TEXT DEFAULT 'yellow',
      location_start INTEGER,
      location_end INTEGER,
      created_at TEXT,
      tags_json TEXT DEFAULT '{}',
      readwise_highlight_id TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS subtitles (
      document_id TEXT PRIMARY KEY,
      srt_content TEXT NOT NULL,
      created_at TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_reviews (
      id TEXT PRIMARY KEY,
      review_date TEXT,
      highlight_id TEXT,
      action TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS review_stats (
      review_date TEXT PRIMARY KEY,
      reviewed_count INTEGER DEFAULT 0,
      target_count INTEGER DEFAULT 5,
      streak_days INTEGER DEFAULT 0,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_documents_location ON documents(location);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
    CREATE INDEX IF NOT EXISTS idx_highlights_document_id ON highlights(document_id);
  `);

  try {
    const tableInfo = db.prepare('PRAGMA table_info(highlights)').all();
    if (!tableInfo.find(c => c.name === 'tags_json')) {
      db.prepare("ALTER TABLE highlights ADD COLUMN tags_json TEXT DEFAULT '{}'").run();
    }
    if (!tableInfo.find(c => c.name === 'readwise_highlight_id')) {
      db.prepare("ALTER TABLE highlights ADD COLUMN readwise_highlight_id TEXT").run();
    }
  } catch (e) {
    console.error('Migration error (highlights columns):', e);
  }

  try {
    const tableInfo = db.prepare('PRAGMA table_info(documents)').all();
    if (!tableInfo.find(c => c.name === 'blog_content')) {
      db.prepare("ALTER TABLE documents ADD COLUMN blog_content TEXT").run();
    }
  } catch (e) {
    console.error('Migration error (documents columns):', e);
  }
}

/**
 * 保存/更新文档到缓存
 */
export function upsertDocument(doc) {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO documents
    (id, url, source_url, title, author, source, category, location,
     site_name, word_count, reading_time, created_at, updated_at,
     published_date, summary, notes, image_url, parent_id,
     reading_progress, first_opened_at, last_opened_at, saved_at,
     last_moved_at, html_content, blog_content, tags_json, synced_at)
    VALUES
    (@id, @url, @source_url, @title, @author, @source, @category, @location,
     @site_name, @word_count, @reading_time, @created_at, @updated_at,
     @published_date, @summary, @notes, @image_url, @parent_id,
     @reading_progress, @first_opened_at, @last_opened_at, @saved_at,
     @last_moved_at, @html_content, @blog_content, @tags_json, @synced_at)
    ON CONFLICT(id) DO UPDATE SET
      url = excluded.url,
      source_url = excluded.source_url,
      title = excluded.title,
      author = excluded.author,
      source = excluded.source,
      category = excluded.category,
      location = excluded.location,
      site_name = excluded.site_name,
      word_count = excluded.word_count,
      reading_time = excluded.reading_time,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      published_date = excluded.published_date,
      summary = excluded.summary,
      notes = excluded.notes,
      image_url = excluded.image_url,
      parent_id = excluded.parent_id,
      reading_progress = MAX(documents.reading_progress, excluded.reading_progress),
      first_opened_at = excluded.first_opened_at,
      last_opened_at = excluded.last_opened_at,
      saved_at = excluded.saved_at,
      last_moved_at = excluded.last_moved_at,
      html_content = COALESCE(excluded.html_content, documents.html_content),
      blog_content = COALESCE(excluded.blog_content, documents.blog_content),
      tags_json = excluded.tags_json,
      synced_at = excluded.synced_at
  `);

  stmt.run({
    id: doc.id,
    url: doc.url || null,
    source_url: doc.source_url || null,
    title: doc.title || null,
    author: doc.author || null,
    source: doc.source || null,
    category: doc.category || null,
    location: doc.location || null,
    site_name: doc.site_name || null,
    word_count: doc.word_count || null,
    reading_time: doc.reading_time || null,
    created_at: doc.created_at || null,
    updated_at: doc.updated_at || null,
    published_date: doc.published_date || null,
    summary: doc.summary || null,
    notes: doc.notes || null,
    image_url: doc.image_url || null,
    parent_id: doc.parent_id || null,
    reading_progress: doc.reading_progress || 0,
    first_opened_at: doc.first_opened_at || null,
    last_opened_at: doc.last_opened_at || null,
    saved_at: doc.saved_at || null,
    last_moved_at: doc.last_moved_at || null,
    html_content: doc.html_content !== undefined ? doc.html_content : null,
    blog_content: doc.blog_content !== undefined ? doc.blog_content : null,
    tags_json: JSON.stringify(doc.tags || {}),
    synced_at: new Date().toISOString(),
  });
}

/**
 * 批量保存文档
 */
export function upsertDocuments(docs) {
  const db = getDatabase();
  const transaction = db.transaction((documents) => {
    for (const doc of documents) {
      upsertDocument(doc);
    }
  });
  transaction(docs);
}

/**
 * 获取缓存的文档列表
 */
export function getCachedDocuments({ location, category, tag, search, limit = 100, offset = 0 } = {}) {
  const db = getDatabase();
  let query = `
    SELECT *, 
    COALESCE(
      (SELECT MAX(created_at) FROM highlights WHERE document_id = documents.id),
      updated_at,
      created_at
    ) AS last_highlighted_at 
    FROM documents 
    WHERE parent_id IS NULL
  `;
  const params = {};

  if (location) {
    query += ' AND location = @location';
    params.location = location;
  } else {
    // 如果没有指定 location（如“全部文档”或分类视图），需排除垃圾箱中的文档
    query += " AND (location IS NULL OR location != 'trash')";
  }
  if (category) {
    query += ' AND category = @category';
    params.category = category;
  }
  if (tag) {
    query += ' AND tags_json LIKE @tag';
    params.tag = `%"${tag}"%`;
  }
  if (search) {
    query += ' AND (title LIKE @search OR author LIKE @search OR summary LIKE @search)';
    params.search = `%${search}%`;
  }

  // 排序规则：全部默认以最后标记/更新时间（last_highlighted_at）降序排列
  query += ' ORDER BY last_highlighted_at DESC LIMIT @limit OFFSET @offset';
  params.limit = limit;
  params.offset = offset;

  const docs = db.prepare(query).all(params);
  return docs.map(doc => ({
    ...doc,
    tags: JSON.parse(doc.tags_json || '{}'),
  }));
}

/**
 * 获取单个缓存文档
 */
export function getCachedDocument(id) {
  const db = getDatabase();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (doc) {
    doc.tags = JSON.parse(doc.tags_json || '{}');
  }
  return doc;
}

/**
 * 保存标签
 */
export function upsertTags(tags) {
  const db = getDatabase();
  const stmt = db.prepare('INSERT OR REPLACE INTO tags (key, name) VALUES (?, ?)');
  const transaction = db.transaction((tagList) => {
    for (const tag of tagList) {
      stmt.run(tag.key, tag.name);
    }
  });
  transaction(tags);
}

/**
 * 获取所有标签
 */
export function getCachedTags() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags ORDER BY name').all();
}

/**
 * 获取带详细统计信息的标签列表 (包含文档数、高亮数、总次数与最后使用时间)
 */
export function getDetailedTagsStats() {
  const db = getDatabase();
  const allTags = db.prepare('SELECT * FROM tags').all();

  const docs = db.prepare(`
    SELECT tags_json, updated_at, created_at FROM documents 
    WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '{}'
  `).all();

  const highlights = db.prepare(`
    SELECT tags_json, created_at FROM highlights 
    WHERE tags_json IS NOT NULL AND tags_json != '' AND tags_json != '{}'
  `).all();

  const tagStatsMap = {};

  allTags.forEach(t => {
    tagStatsMap[t.key] = {
      key: t.key,
      name: t.name || t.key,
      document_count: 0,
      highlight_count: 0,
      total_count: 0,
      last_used_at: null,
    };
  });

  docs.forEach(doc => {
    try {
      const tagsObj = JSON.parse(doc.tags_json || '{}');
      const time = doc.updated_at || doc.created_at;
      const tagKeys = Array.isArray(tagsObj) ? tagsObj : Object.keys(tagsObj);

      tagKeys.forEach(rawKey => {
        const k = String(rawKey);
        if (!tagStatsMap[k]) {
          tagStatsMap[k] = {
            key: k,
            name: k,
            document_count: 0,
            highlight_count: 0,
            total_count: 0,
            last_used_at: null,
          };
        }
        tagStatsMap[k].document_count += 1;
        tagStatsMap[k].total_count += 1;

        if (time) {
          if (!tagStatsMap[k].last_used_at || new Date(time) > new Date(tagStatsMap[k].last_used_at)) {
            tagStatsMap[k].last_used_at = time;
          }
        }
      });
    } catch { /* 忽略解析错误 */ }
  });

  highlights.forEach(hl => {
    try {
      const tagsObj = JSON.parse(hl.tags_json || '{}');
      const time = hl.created_at;
      const tagKeys = Array.isArray(tagsObj) ? tagsObj : Object.keys(tagsObj);

      tagKeys.forEach(rawKey => {
        const k = String(rawKey);
        if (!tagStatsMap[k]) {
          tagStatsMap[k] = {
            key: k,
            name: k,
            document_count: 0,
            highlight_count: 0,
            total_count: 0,
            last_used_at: null,
          };
        }
        tagStatsMap[k].highlight_count += 1;
        tagStatsMap[k].total_count += 1;

        if (time) {
          if (!tagStatsMap[k].last_used_at || new Date(time) > new Date(tagStatsMap[k].last_used_at)) {
            tagStatsMap[k].last_used_at = time;
          }
        }
      });
    } catch { /* 忽略解析错误 */ }
  });

  return Object.values(tagStatsMap);
}

/**
 * 保存同步状态
 */
export function setSyncState(key, value) {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run(key, value);
}

/**
 * 获取同步状态
 */
export function getSyncState(key) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
  return row?.value || null;
}

/**
 * 保存设置
 */
export function setSetting(key, value) {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

/**
 * 获取设置
 */
export function getSetting(key, defaultValue = null) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : defaultValue;
}

/**
 * 获取文档统计
 */
export function getDocumentStats() {
  const db = getDatabase();
  const total = db.prepare("SELECT COUNT(*) as count FROM documents WHERE parent_id IS NULL AND (location IS NULL OR location != 'trash')").get();
  const byLocation = db.prepare(`
    SELECT location, COUNT(*) as count FROM documents
    WHERE parent_id IS NULL
    GROUP BY location
  `).all();
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM documents
    WHERE parent_id IS NULL AND (location IS NULL OR location != 'trash')
    GROUP BY category
  `).all();

  return {
    total: total.count,
    byLocation: Object.fromEntries(byLocation.map(r => [r.location, r.count])),
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
  };
}

/**
 * 获取本地文档总数（包含文档和高亮，以对齐云端 Readwise 的统计口径）
 */
export function getDocumentCount() {
  const db = getDatabase();
  const docs = db.prepare('SELECT COUNT(*) as count FROM documents').get();
  const highlights = db.prepare('SELECT COUNT(*) as count FROM highlights').get();
  return docs.count + highlights.count;
}

/**
 * 保存高亮
 */
export function upsertHighlight(highlight) {
  const db = getDatabase();
  
  // 插入一个占位 document 防止外键约束失败（增量同步时可能会遇到子元素先于父元素被处理或只返回子元素）
  db.prepare(`INSERT OR IGNORE INTO documents (id) VALUES (?)`).run(highlight.document_id);

  const cleanText = (t) => (t || '').replace(/\r\n/g, '\n').trim();
  const highlightText = cleanText(highlight.text);

  const getIdPriority = (id) => {
    if (!id) return 0;
    if (id.startsWith('local_')) return 1;
    if (id.startsWith('readwise-v2-')) return 2;
    return 3; // UUID
  };

  // 1. 查找是否已存在相同文本的高亮
  const docHighlights = db.prepare('SELECT * FROM highlights WHERE document_id = ?').all(highlight.document_id);
  const existingByText = docHighlights.find(h => h.id !== highlight.id && cleanText(h.text) === highlightText);

  if (existingByText) {
    const existingPriority = getIdPriority(existingByText.id);
    const newPriority = getIdPriority(highlight.id);

    if (existingPriority >= newPriority) {
      // 数据库已存的高亮更好，保留已存的，把传入的内容合入
      const mergedReadwiseId = highlight.readwise_highlight_id || existingByText.readwise_highlight_id;
      const updatedTags = { ...JSON.parse(existingByText.tags_json || '{}'), ...(highlight.tags || {}) };
      const mergedNote = highlight.note || existingByText.note || '';

      db.prepare(`
        UPDATE highlights SET
          note = @note,
          tags_json = @tags_json,
          readwise_highlight_id = @readwise_highlight_id
        WHERE id = @id
      `).run({
        id: existingByText.id,
        note: mergedNote,
        tags_json: JSON.stringify(updatedTags),
        readwise_highlight_id: mergedReadwiseId || null
      });

      // 如果当前处理的 highlight.id 在数据库里原本就存在，删除它以清理重复
      db.prepare('DELETE FROM highlights WHERE id = ?').run(highlight.id);
      
      console.log(`[排重合并] 保留优先级更高的已有记录 ${existingByText.id} (级:${existingPriority})，合并并清除传入的 ${highlight.id} (级:${newPriority})`);
      return;
    } else {
      // 传入的高亮更好，删除已存的高亮，并合入有用的字段
      // 1. 删除数据库中旧的高亮（以及如果原本就存在同名主键也删掉防止冲突）
      db.prepare('DELETE FROM highlights WHERE id = ?').run(existingByText.id);
      db.prepare('DELETE FROM highlights WHERE id = ?').run(highlight.id);

      // 2. 合并信息
      const mergedReadwiseId = highlight.readwise_highlight_id || existingByText.readwise_highlight_id;
      const mergedTags = { ...JSON.parse(existingByText.tags_json || '{}'), ...(highlight.tags || {}) };
      const mergedNote = highlight.note || existingByText.note || '';

      // 3. 插入新的高亮
      db.prepare(`
        INSERT INTO highlights
        (id, document_id, text, note, color, location_start, location_end, created_at, tags_json, readwise_highlight_id)
        VALUES (@id, @document_id, @text, @note, @color, @location_start, @location_end, @created_at, @tags_json, @readwise_highlight_id)
      `).run({
        location_start: null,
        location_end: null,
        created_at: new Date().toISOString(),
        ...highlight,
        note: mergedNote,
        tags_json: JSON.stringify(mergedTags),
        readwise_highlight_id: mergedReadwiseId || null
      });

      console.log(`[排重合并] 保留优先级更高的传入记录 ${highlight.id} (级:${newPriority})，替代并清除了已有记录 ${existingByText.id} (级:${existingPriority})`);
      return;
    }
  }

  // 2. 文本无冲突，执行常规更新或插入
  const existingById = db.prepare('SELECT * FROM highlights WHERE id = ?').get(highlight.id);

  if (existingById) {
    db.prepare(`
      UPDATE highlights SET
        document_id = @document_id,
        text = @text,
        note = @note,
        color = @color,
        location_start = COALESCE(@location_start, location_start),
        location_end = COALESCE(@location_end, location_end),
        created_at = @created_at,
        tags_json = @tags_json,
        readwise_highlight_id = COALESCE(@readwise_highlight_id, readwise_highlight_id)
      WHERE id = @id
    `).run({
      location_start: null,
      location_end: null,
      created_at: new Date().toISOString(),
      ...highlight,
      tags_json: JSON.stringify(highlight.tags || {}),
      readwise_highlight_id: highlight.readwise_highlight_id || null
    });
  } else {
    db.prepare(`
      INSERT INTO highlights
      (id, document_id, text, note, color, location_start, location_end, created_at, tags_json, readwise_highlight_id)
      VALUES (@id, @document_id, @text, @note, @color, @location_start, @location_end, @created_at, @tags_json, @readwise_highlight_id)
    `).run({
      location_start: null,
      location_end: null,
      created_at: new Date().toISOString(),
      ...highlight,
      tags_json: JSON.stringify(highlight.tags || {}),
      readwise_highlight_id: highlight.readwise_highlight_id || null
    });
  }
}

/**
 * 批量保存高亮
 */
export function upsertHighlights(highlights) {
  const db = getDatabase();
  const transaction = db.transaction((hlList) => {
    for (const hl of hlList) {
      upsertHighlight(hl);
    }
  });
  transaction(highlights);
}

/**
 * 将 Readwise API v3 返回的 highlight 类型文档转换为本地 highlights 表格式
 * Readwise Reader 中 highlights 以独立文档形式存在，带有 parent_id 指向父文档
 *
 * 经 API 实测，v3 highlight 文档的实际字段：
 * - content: 字符串类型，包含高亮文本（title 和 summary 通常为空）
 * - notes: 用户备注
 * - tags: 标签对象 (v3 格式: { "tag_name": tag_id })
 * - 没有 highlight_color / color 字段
 */
export function convertReadwiseDocToHighlight(doc) {
  // 高亮文本内容：
  // v3 API 中 content 是字符串类型，直接包含高亮文本
  // title 和 summary 通常为空
  let text = '';
  if (typeof doc.content === 'string') {
    text = doc.content;
  } else if (doc.content?.text) {
    text = doc.content.text;
  }
  // 回退到 summary/title
  if (!text) {
    text = doc.summary || doc.title || '';
  }

  // v3 API 不提供颜色信息，使用默认值
  const color = 'yellow';

  // 标签：Readwise v3 的 tags 是 { "tag_name": tag_id } 格式
  const tags = doc.tags || {};

  return {
    id: doc.id,
    document_id: doc.parent_id,
    text: text,
    note: doc.notes || '',
    color: color,
    location_start: null,
    location_end: null,
    created_at: doc.created_at || new Date().toISOString(),
    tags: tags,
  };
}

/**
 * 获取单个高亮
 */
export function getHighlight(id) {
  const db = getDatabase();
  const hl = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
  if (hl) {
    hl.tags = JSON.parse(hl.tags_json || '{}');
  }
  return hl;
}

/**
 * 删除高亮
 */
export function deleteHighlight(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM highlights WHERE id = ?').run(id);
}

/**
 * 获取文档的高亮
 */
export function getDocumentHighlights(documentId) {
  const db = getDatabase();
  const highlights = db.prepare('SELECT * FROM highlights WHERE document_id = ? ORDER BY location_start').all(documentId);
  return highlights.map(h => ({
    ...h,
    tags: JSON.parse(h.tags_json || '{}')
  }));
}

/**
 * 清空所有数据 (用于全量覆盖同步)
 */
export function clearAllData() {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM highlights').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM tags').run();
    db.prepare("DELETE FROM sync_state WHERE key IN ('remote_doc_count', 'lastDocumentSync')").run();
  });
  transaction();
}

/**
 * 批量更新文档分类 (location)
 */
export function batchUpdateLocation(ids, location) {
  if (!ids || ids.length === 0) return;
  const db = getDatabase();
  const stmt = db.prepare('UPDATE documents SET location = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  
  const updateMany = db.transaction((docIds) => {
    for (const id of docIds) {
      stmt.run(location, now, id);
    }
  });
  
  updateMany(ids);
}

/**
 * 获取符合条件的文档中最新的更新时间
 */
export function getLatestDocumentDate({ location, category, tag } = {}) {
  const db = getDatabase();
  let query = 'SELECT MAX(updated_at) as max_date FROM documents WHERE parent_id IS NULL';
  const params = {};

  if (location) {
    query += ' AND location = @location';
    params.location = location;
  }
  if (category) {
    query += ' AND category = @category';
    params.category = category;
  }
  if (tag) {
    query += ' AND tags_json LIKE @tag';
    params.tag = `%"${tag}"%`;
  }

  const result = db.prepare(query).get(params);
  return result?.max_date || null;
}

/**
 * 通过 source_url 查找本地文档 ID
 * 用于将 V2 Export API 返回的高亮关联到对应的 V3 文档
 * 
 * @param {string} sourceUrl - 文档的 source URL
 * @returns {string|null} 文档 ID 或 null
 */
export function findDocumentIdBySourceUrl(sourceUrl) {
  if (!sourceUrl) return null;
  const db = getDatabase();
  // 优先匹配 source_url，其次匹配 url
  const doc = db.prepare('SELECT id FROM documents WHERE (source_url = ? OR url = ?) AND parent_id IS NULL LIMIT 1').get(sourceUrl, sourceUrl);
  return doc?.id || null;
}

/**
 * 通过标题查找本地文档 ID（用于没有 source_url 的书籍等）
 */
export function findDocumentIdByTitle(title) {
  if (!title) return null;
  const db = getDatabase();
  const doc = db.prepare('SELECT id FROM documents WHERE title = ? AND parent_id IS NULL LIMIT 1').get(title);
  return doc?.id || null;
}

/**
 * 批量物理删除文档及关联高亮
 */
export function deleteDocuments(ids) {
  if (!ids || ids.length === 0) return;
  const db = getDatabase();
  const deleteHighlightsStmt = db.prepare('DELETE FROM highlights WHERE document_id = ?');
  const deleteDocStmt = db.prepare('DELETE FROM documents WHERE id = ?');
  
  const runTransaction = db.transaction((docIds) => {
    for (const id of docIds) {
      deleteHighlightsStmt.run(id);
      deleteDocStmt.run(id);
    }
  });
  runTransaction(ids);
}

/**
 * 保存用户上传的 SRT 字幕
 * @param {string} documentId - 文档 ID
 * @param {string} srtContent - 原始 SRT 文件内容
 */
export function saveSubtitle(documentId, srtContent) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO subtitles (document_id, srt_content, created_at)
    VALUES (?, ?, ?)
  `).run(documentId, srtContent, new Date().toISOString());
}

/**
 * 获取文档的用户上传字幕
 * @param {string} documentId - 文档 ID
 * @returns {{ srt_content: string, created_at: string } | null}
 */
export function getSubtitle(documentId) {
  const db = getDatabase();
  return db.prepare('SELECT srt_content, created_at FROM subtitles WHERE document_id = ?').get(documentId) || null;
}

/**
 * 删除文档的用户上传字幕
 * @param {string} documentId - 文档 ID
 */
export function deleteSubtitle(documentId) {
  const db = getDatabase();
  db.prepare('DELETE FROM subtitles WHERE document_id = ?').run(documentId);
}

/**
 * 记录单条每日回顾动作并更新连续打卡 (Streak)
 */
export function recordReviewAction(reviewDate, highlightId, action, customTargetCount = 5) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `${reviewDate}_${highlightId}_${action}_${Date.now()}`;

  // 1. 插入每日回顾记录
  db.prepare(`
    INSERT OR REPLACE INTO daily_reviews (id, review_date, highlight_id, action, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, reviewDate, highlightId, action, now);

  // 2. 更新或查询今日打卡统计
  let stat = db.prepare('SELECT * FROM review_stats WHERE review_date = ?').get(reviewDate);
  let reviewedCount = (stat?.reviewed_count || 0) + 1;
  const targetCount = customTargetCount || stat?.target_count || 15;

  // 3. 计算连续打卡 Streak 天数
  let streakDays = 1;
  const yesterday = new Date(new Date(reviewDate).getTime() - 86400000).toISOString().split('T')[0];
  const yesterdayStat = db.prepare('SELECT * FROM review_stats WHERE review_date = ?').get(yesterday);
  if (yesterdayStat && yesterdayStat.streak_days > 0) {
    streakDays = yesterdayStat.streak_days + 1;
  }

  const completedAt = reviewedCount >= targetCount ? now : (stat?.completed_at || null);

  db.prepare(`
    INSERT OR REPLACE INTO review_stats (review_date, reviewed_count, target_count, streak_days, completed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(reviewDate, reviewedCount, targetCount, streakDays, completedAt);

  return {
    reviewedCount,
    targetCount,
    streakDays,
    isCompleted: reviewedCount >= targetCount
  };
}

/**
 * 获取每日回顾与打卡统计全量数据 (支持同步 Readwise 官方历史 Strike 与高亮基数)
 */
export function getReviewStatsData() {
  const db = getDatabase();
  const todayDate = new Date().toISOString().split('T')[0];

  // 1. 读取设置中可能保存的 Readwise 官方基准统计数据
  const officialStreakSetting = getSetting('readwise_official_streak');
  const officialBestStreakSetting = getSetting('readwise_official_best_streak');
  const officialTotalHlSetting = getSetting('readwise_official_total_highlights');

  const baseStreak = officialStreakSetting ? parseInt(officialStreakSetting, 10) : 0;
  const baseBestStreak = officialBestStreakSetting ? parseInt(officialBestStreakSetting, 10) : 0;
  const baseTotalHl = officialTotalHlSetting ? parseInt(officialTotalHlSetting, 10) : 0;

  // 2. 获取近 30 天的打卡数据
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const statsList = db.prepare(`
    SELECT * FROM review_stats 
    WHERE review_date >= ?
    ORDER BY review_date ASC
  `).all(thirtyDaysAgo);

  // 3. 获取全库的高亮总数作为基础统计（若无官方手动基数）
  const dbTotalHlRow = db.prepare('SELECT COUNT(*) as total FROM highlights').get();
  const dbTotalHls = dbTotalHlRow?.total || 0;

  const totalReviewedRow = db.prepare('SELECT COUNT(DISTINCT highlight_id) as total FROM daily_reviews').get();
  const totalReviewedInApp = totalReviewedRow?.total || 0;
  
  // 综合得到呈现给用户的总高亮数
  const displayTotalReviewed = baseTotalHl > 0 ? baseTotalHl : (dbTotalHls + totalReviewedInApp);

  // 4. 获取今天已完成的计数
  const todayStat = db.prepare('SELECT * FROM review_stats WHERE review_date = ?').get(todayDate);
  const todayReviewedCount = todayStat?.reviewed_count || 0;
  const targetCount = todayStat?.target_count || 15;

  // 5. 获取历史最长打卡纪录 (Best Streak)
  const maxStreakRow = db.prepare('SELECT MAX(streak_days) as best FROM review_stats').get();
  const localBestStreak = maxStreakRow?.best || (todayStat?.streak_days || 0);

  const finalStreak = Math.max(baseStreak, todayStat?.streak_days || (baseStreak > 0 ? baseStreak : 0));
  const finalBestStreak = Math.max(baseBestStreak, localBestStreak, finalStreak);

  // 6. 获取今日已看过的 highlight_id 列表
  const todayReviewedHls = db.prepare(`
    SELECT DISTINCT highlight_id FROM daily_reviews WHERE review_date = ?
  `).all(todayDate).map(r => r.highlight_id);

  return {
    todayDate,
    todayReviewedCount,
    targetCount,
    streakDays: finalStreak,
    bestStreak: finalBestStreak,
    totalReviewed: displayTotalReviewed,
    statsList,
    todayReviewedHls
  };
}

/**
 * 当无法链接 Readwise API 时，根据目标条数从本地数据库抽取高亮进行备用每日回顾 (Fallback)
 */
export function getFallbackDailyReviewHighlights(limit = 5) {
  const db = getDatabase();
  const countLimit = parseInt(limit, 10) || 5;
  
  // 关联高亮与文档元数据，按随机/间隔从库中选取指定数量条数
  const rows = db.prepare(`
    SELECT 
      h.id as highlight_id,
      h.text,
      h.note,
      h.color,
      h.created_at,
      h.tags_json,
      d.id as doc_id,
      d.title as doc_title,
      d.author as doc_author,
      d.source_url,
      d.image_url,
      d.category
    FROM highlights h
    LEFT JOIN documents d ON h.document_id = d.id
    WHERE h.text IS NOT NULL AND h.text != ''
    ORDER BY RANDOM()
    LIMIT ?
  `).all(countLimit);

  return rows.map(r => {
    let tagList = [];
    try {
      const parsed = JSON.parse(r.tags_json || '[]');
      tagList = Array.isArray(parsed) ? parsed : Object.keys(parsed || {});
    } catch { /* ignore */ }

    return {
      id: String(r.highlight_id),
      text: r.text || '',
      note: r.note || '',
      color: r.color || 'yellow',
      title: r.doc_title || 'Readwise Highlight',
      author: r.doc_author || '',
      source_url: r.source_url || '',
      image_url: r.image_url || '',
      category: r.category || 'article',
      tags: tagList,
      created_at: r.created_at
    };
  });
}

/**
 * 更新单条划线高亮的 Markdown 正文、笔记与标签
 */
export function updateHighlightAndTags(highlightId, text, note, tags = []) {
  const db = getDatabase();
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  const now = new Date().toISOString();

  // 更新 highlights 表
  const result = db.prepare(`
    UPDATE highlights
    SET text = ?, note = ?, tags_json = ?, updated_at = ?
    WHERE id = ? OR id = ?
  `).run(text, note, tagsJson, now, highlightId, parseInt(highlightId, 10) || 0);

  return result.changes > 0;
}

/**
 * 根据文章标题或 Document ID 获取属于该文章的所有划线高亮
 */
export function getArticleHighlightsByTitle(title) {
  const db = getDatabase();
  if (!title) return [];

  const rows = db.prepare(`
    SELECT 
      h.id as highlight_id,
      h.text,
      h.note,
      h.color,
      h.created_at,
      h.tags_json,
      d.id as doc_id,
      d.title as doc_title,
      d.author as doc_author,
      d.source_url,
      d.image_url
    FROM highlights h
    LEFT JOIN documents d ON h.document_id = d.id
    WHERE d.title = ? OR d.title LIKE ?
    ORDER BY h.created_at DESC
  `).all(title, `%${title}%`);

  return rows.map(r => {
    let tagList = [];
    try {
      const parsed = JSON.parse(r.tags_json || '[]');
      tagList = Array.isArray(parsed) ? parsed : Object.keys(parsed || {});
    } catch { /* ignore */ }

    return {
      id: String(r.highlight_id),
      text: r.text || '',
      note: r.note || '',
      color: r.color || 'yellow',
      title: r.doc_title || title,
      author: r.doc_author || '',
      source_url: r.source_url || '',
      image_url: r.image_url || '',
      tags: tagList,
      created_at: r.created_at
    };
  });
}
