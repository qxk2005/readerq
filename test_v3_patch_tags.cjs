const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? JSON.parse(tokenRow.value) : process.env.READWISE_API_TOKEN;

async function test() {
  const payload = { tags: ["hello", "world"] };
  
  let res = await fetch('https://readwise.io/api/v3/update/01kvwyh2e3q3thdta4gnhhcx3w/', {
    method: 'PATCH',
    headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log("PATCH tags status:", res.status);
  
  res = await fetch('https://readwise.io/api/v3/list/?id=01kvwyh2e3q3thdta4gnhhcx3w', {
    headers: { 'Authorization': `Token ${token}` }
  });
  let data = await res.json();
  let doc = data.results.find(d => d.id === '01kvwyh2e3q3thdta4gnhhcx3w');
  console.log("Tags after PATCH:", doc.tags);
}
test();
