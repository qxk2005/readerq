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
}

/**
 * 保存/更新文档到缓存
 */
export function upsertDocument(doc) {
  const db = getDatabase();

  // 检查本地已有文档是否是 trash 状态以防覆盖
  let targetLocation = doc.location || null;
  try {
    const existing = db.prepare('SELECT location FROM documents WHERE id = ?').get(doc.id);
    if (existing && existing.location === 'trash') {
      targetLocation = 'trash';
    }
  } catch (e) {
    // 忽略异常，继续流程
  }

  const stmt = db.prepare(`
    INSERT INTO documents
    (id, url, source_url, title, author, source, category, location,
     site_name, word_count, reading_time, created_at, updated_at,
     published_date, summary, notes, image_url, parent_id,
     reading_progress, first_opened_at, last_opened_at, saved_at,
     last_moved_at, html_content, tags_json, synced_at)
    VALUES
    (@id, @url, @source_url, @title, @author, @source, @category, @location,
     @site_name, @word_count, @reading_time, @created_at, @updated_at,
     @published_date, @summary, @notes, @image_url, @parent_id,
     @reading_progress, @first_opened_at, @last_opened_at, @saved_at,
     @last_moved_at, @html_content, @tags_json, @synced_at)
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
      reading_progress = excluded.reading_progress,
      first_opened_at = excluded.first_opened_at,
      last_opened_at = excluded.last_opened_at,
      saved_at = excluded.saved_at,
      last_moved_at = excluded.last_moved_at,
      html_content = COALESCE(excluded.html_content, documents.html_content),
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
    location: targetLocation,
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
  let query = 'SELECT * FROM documents WHERE parent_id IS NULL';
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

  // 排序规则：如果为 archive 或 trash 视图，按照 coalesce(updated_at, created_at) 降序排列
  if (location === 'archive' || location === 'trash') {
    query += ' ORDER BY COALESCE(updated_at, created_at) DESC LIMIT @limit OFFSET @offset';
  } else {
    query += ' ORDER BY updated_at DESC LIMIT @limit OFFSET @offset';
  }
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
