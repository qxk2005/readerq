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
  console.log("1. /api/v3/list/?id=01kw3b1t5xjxptqj6g0tzngp69");
  console.log(await fetchUrl('/api/v3/list/?id=01kw3b1t5xjxptqj6g0tzngp69&limit=1'));
  console.log("2. /api/v3/list/01kw3b1t5xjxptqj6g0tzngp69");
  console.log(await fetchUrl('/api/v3/list/01kw3b1t5xjxptqj6g0tzngp69'));
}
run();
