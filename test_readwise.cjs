const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));
const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
let token = row ? row.value : null;

if (token && token.startsWith('"')) {
  token = JSON.parse(token);
}

const https = require('https');
const options = {
  hostname: 'readwise.io',
  path: '/api/v3/list/?limit=1',
  headers: {
    'Authorization': 'Token ' + token
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Count:", json.count);
    console.log("Results length:", json.results ? json.results.length : 0);
  });
});
