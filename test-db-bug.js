import Database from 'better-sqlite3';

const db = new Database('data/readerq.db');
db.pragma('foreign_keys = ON');

// Reset
db.prepare('DELETE FROM documents WHERE id = "test1"').run();

// Insert document
const insertStmt = db.prepare(`
    INSERT INTO documents (id, title) VALUES ('test1', 'Test')
    ON CONFLICT(id) DO UPDATE SET title = excluded.title
`);
insertStmt.run();

// Insert highlight
db.prepare(`
    INSERT INTO highlights (id, document_id, text, color, location_start, location_end)
    VALUES ('hl1', 'test1', 'hello', 'yellow', 0, 5)
`).run();

const countBefore = db.prepare('SELECT COUNT(*) as c FROM highlights WHERE document_id = "test1"').get().c;
console.log('Highlights before re-upserting doc:', countBefore);

// Re-upsert document
insertStmt.run();

const countAfter = db.prepare('SELECT COUNT(*) as c FROM highlights WHERE document_id = "test1"').get().c;
console.log('Highlights after re-upserting doc:', countAfter);
