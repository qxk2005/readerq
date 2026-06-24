const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));
const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
let token = row ? row.value : null;

if (token && token.startsWith('"')) token = JSON.parse(token);

const hl = db.prepare("SELECT * FROM highlights WHERE id != '' LIMIT 1").get();
if (!hl) {
  console.log("No highlight found");
  process.exit(1);
}

const https = require('https');

const payload = JSON.stringify({ note: "Test note updated" });
const options = {
  hostname: 'readwise.io',
  path: `/api/v2/highlights/${hl.id}/`,
  method: 'PATCH',
  headers: {
    'Authorization': 'Token ' + token,
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on('error', e => console.error(e));
req.write(payload);
req.end();
