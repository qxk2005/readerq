const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const payload = {
    document_id: "01kvwyh2e3q3thdta4gnhhcx3w",
    text: "This is a test highlight from api probing",
  };
  
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const response = await fetch('https://readwise.io/api/v3/highlights/', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  });
  
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Response:", text);
}
test();
