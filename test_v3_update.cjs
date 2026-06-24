const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const hl = db.prepare('SELECT * FROM highlights ORDER BY created_at DESC LIMIT 1').get();
if (!hl) process.exit(0);

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const payload = {
    // try to append a note or highlight
    document_note: "Test document note from api"
  };
  
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(`https://readwise.io/api/v3/update/${hl.document_id}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  });
  
  console.log("Status:", response.status);
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}
test();
