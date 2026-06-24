const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));
const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
let token = JSON.parse(row.value);
const https = require('https');

function fetchUrl(path) {
  return new Promise((resolve) => {
    const start = Date.now();
    https.get({ hostname: 'readwise.io', path, headers: { 'Authorization': 'Token ' + token } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, time: Date.now() - start, data: data.substring(0, 200) }));
    }).on('error', (e) => resolve({ error: e.message }));
  });
}

async function run() {
  const doc = db.prepare("SELECT id FROM documents WHERE category = 'rss' AND html_content IS NULL LIMIT 1").get();
  if (!doc) return console.log("No RSS without html found.");
  
  console.log("Found ID:", doc.id);
  const result = await fetchUrl('/api/v3/list/?id=' + doc.id);
  console.log(result);
}
run();
