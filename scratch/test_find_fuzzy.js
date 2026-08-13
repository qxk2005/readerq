const { findFuzzyOffset } = require('./src/lib/highlight.js');
const sqlite3 = require('better-sqlite3');

const db = sqlite3('data/readerq.db');
const doc = db.prepare("SELECT blog_content FROM documents WHERE id = '01kzx1y757ttbq5xdcnyhaewa0'").get();
const hl = db.prepare("SELECT text FROM highlights WHERE document_id = '01kzx1y757ttbq5xdcnyhaewa0'").get();

console.log('--- Highlight Text ---');
console.log(JSON.stringify(hl.text));

console.log('\n--- Blog Content ---');
console.log(JSON.stringify(doc.blog_content));

// 模拟 DOM textContent (去除 Markdown 标记)
const domText = doc.blog_content.replace(/#+\s*/g, '').replace(/\*+/g, '').replace(/\[\d+:\d+\]/g, '');

console.log('\n--- DOM Text ---');
console.log(JSON.stringify(domText.substring(0, 500)));

const offset = findFuzzyOffset(domText, hl.text);
console.log('\n--- Fuzzy Matching Result ---');
console.log(offset);
