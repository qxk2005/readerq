const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const response = await fetch('https://readwise.io/api/v2/books/?category=articles&page_size=50', {
    headers: { 'Authorization': `Token ${token}` }
  });
  
  const data = await response.json();
  const book = data.results.find(b => b.title.includes('别让 AI 碰生产环境'));
  if (book) {
    console.log("Found Book in v2:", JSON.stringify(book, null, 2));
    
    // Now try to add a highlight with this book_id!
    /*
    Note: v2 /highlights/ endpoint doesn't accept `book_id` directly in the payload!
    Wait, let's check Readwise API docs if `highlights` can accept a `book_id` or `source_url`.
    Actually, if we just use the EXACT `title` and `source_url` from this Book, it should map to it.
    */
  } else {
    console.log("Book not found in v2.");
    console.log(data.results.map(b => b.title));
  }
}
test();
