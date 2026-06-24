const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const response = await fetch('https://readwise.io/api/v2/books/?page_size=100', {
    headers: { 'Authorization': `Token ${token}` }
  });
  
  const data = await response.json();
  const books = data.results.filter(b => b.title && b.title.includes('别让 AI 碰生产环境'));
  console.log("Matching Books in v2:", JSON.stringify(books, null, 2));
}
test();
