import { findFuzzyOffset } from '../src/lib/highlight.js';
import sqlite3 from 'better-sqlite3';

const db = sqlite3('data/readerq.db');
const doc = db.prepare("SELECT blog_content FROM documents WHERE id = '01kzx1y757ttbq5xdcnyhaewa0'").get();
const hl = db.prepare("SELECT text FROM highlights WHERE document_id = '01kzx1y757ttbq5xdcnyhaewa0'").get();

const domText = doc.blog_content.replace(/#+\s*/g, '').replace(/\*+/g, '').replace(/\[\d+:\d+\]/g, '');

function findFuzzyMatchesForBlock(fullText, query) {
  if (!query || !fullText) return [];
  // 先尝试全文匹配
  const singleMatch = findFuzzyOffset(fullText, query);
  if (singleMatch) return [singleMatch];

  // 全文未匹配时，按段落/句子拆分逐句匹配
  const lines = query.split(/[\n\r]+/).map(s => s.trim()).filter(s => s.length > 5);
  const matches = [];

  for (const line of lines) {
    // 清理可能包含的开头的标记如 [0:29] 或 • 或 💡
    const cleanLine = line.replace(/^([•\-\*]|\[\d+:\d+\]|💡|💬|\d+\.)\s*/g, '').trim();
    if (cleanLine.length < 4) continue;

    const match = findFuzzyOffset(fullText, cleanLine);
    if (match) {
      matches.push(match);
    } else {
      // 进一步按句号/分号拆分短句
      const subSentences = cleanLine.split(/[。；!?!?]+/).map(s => s.trim()).filter(s => s.length > 6);
      for (const sub of subSentences) {
        const subMatch = findFuzzyOffset(fullText, sub);
        if (subMatch) {
          matches.push(subMatch);
        }
      }
    }
  }

  return matches;
}

const matches = findFuzzyMatchesForBlock(domText, hl.text);
console.log('--- Matches Found ---');
console.log(matches.length, 'matches');
matches.forEach((m, idx) => {
  console.log(`Match ${idx + 1}:`, domText.substring(m.start, m.end));
});
