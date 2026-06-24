const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));
const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
let token = row ? row.value : null;

if (token && token.startsWith('"')) {
  token = JSON.parse(token);
}

const https = require('https');

function fetchPage(cursor) {
  return new Promise((resolve, reject) => {
    let url = '/api/v3/list/';
    if (cursor) url += '?pageCursor=' + cursor;
    
    const options = {
      hostname: 'readwise.io',
      path: url,
      headers: { 'Authorization': 'Token ' + token }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

async function run() {
  let cursor = null;
  let ignored = 0;
  let total = 0;
  let pages = 0;
  
  do {
    const data = await fetchPage(cursor);
    if (!data.results) break;
    
    for (const doc of data.results) {
      total++;
      if (doc.parent_id && doc.category === 'highlight') {
        // highlight
      } else if (!doc.parent_id) {
        // regular
      } else {
        ignored++;
        if (ignored <= 5) {
          console.log("Ignored doc:", doc.id, doc.category, "parent:", doc.parent_id);
        }
      }
    }
    cursor = data.nextPageCursor;
    pages++;
    
    if (pages >= 10) break; // Check first 10 pages
  } while (cursor);
  
  console.log(`Total checked: ${total}, Ignored: ${ignored}`);
}

run();
