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

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, 'readerq.db'));

  // 开启 WAL 模式提升性能
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 初始化表结构
  initSchema(db);

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
}

/**
 * 保存/更新文档到缓存
 */
export function upsertDocument(doc) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO documents
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

  query += ' ORDER BY updated_at DESC LIMIT @limit OFFSET @offset';
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
  const total = db.prepare('SELECT COUNT(*) as count FROM documents WHERE parent_id IS NULL').get();
  const byLocation = db.prepare(`
    SELECT location, COUNT(*) as count FROM documents
    WHERE parent_id IS NULL
    GROUP BY location
  `).all();
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM documents
    WHERE parent_id IS NULL
    GROUP BY category
  `).all();

  return {
    total: total.count,
    byLocation: Object.fromEntries(byLocation.map(r => [r.location, r.count])),
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
  };
}

/**
 * 保存高亮
 */
export function upsertHighlight(highlight) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO highlights
    (id, document_id, text, note, color, location_start, location_end, created_at)
    VALUES (@id, @document_id, @text, @note, @color, @location_start, @location_end, @created_at)
  `).run(highlight);
}

/**
 * 获取文档的高亮
 */
export function getDocumentHighlights(documentId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM highlights WHERE document_id = ? ORDER BY location_start').all(documentId);
}
