const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const response = await fetch('https://readwise.io/api/v3/list/', {
    method: 'GET',
    headers: {
      'Authorization': `Token ${token}`
    }
  });
  
  const data = await response.json();
  const doc = data.results.find(d => d.id === '01kvwyh2e3q3thdta4gnhhcx3w');
  console.log("Document from v3/list/:", JSON.stringify(doc, null, 2));
}
test();
