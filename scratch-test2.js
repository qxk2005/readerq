const fs = require('fs');
async function test() {
  try {
    const db = require('better-sqlite3')('data/readerq.db');
    const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
    const tokenToUse = row ? JSON.parse(row.value) : null;
    if(!tokenToUse) return;
    
    const res = await fetch('https://readwise.io/api/v2/highlights/1030503161/', {
      headers: { 'Authorization': `Token ${tokenToUse}` }
    });
    const result = await res.json();
    console.log("Highlight Info:", JSON.stringify(result, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
