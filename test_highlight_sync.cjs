const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'data', 'readerq.db'));

// Get the latest highlight
const hl = db.prepare('SELECT * FROM highlights ORDER BY created_at DESC LIMIT 1').get();
console.log('Latest Local Highlight:', hl);

if (!hl) {
  console.log('No local highlight found.');
  process.exit(0);
}

// Get Readwise Token
const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
const token = tokenRow ? tokenRow.value : process.env.READWISE_API_TOKEN;

async function checkSync() {
  // Check v2 API
  console.log('\n--- Checking Readwise v2 API ---');
  const res2 = await fetch(`https://readwise.io/api/v2/highlights/?page_size=10`, {
    headers: { 'Authorization': `Token ${token}` }
  });
  const data2 = await res2.json();
  const v2Match = data2.results && data2.results.find(h => h.text.trim() === hl.text.trim());
  if (v2Match) {
    console.log('Found in Readwise v2!');
    console.log(v2Match);
  } else {
    console.log('Not found in recent Readwise v2 highlights.');
  }

  // Check Reader v3 API for the document
  console.log('\n--- Checking Reader v3 API ---');
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(hl.document_id);
  console.log('Document ID in local DB:', doc ? doc.id : 'N/A');
  
  if (doc) {
    const res3 = await fetch(`https://readwise.io/api/v3/list/?location=new`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    const data3 = await res3.json();
    const docMatch = data3.results && data3.results.find(d => d.id === doc.id);
    if (docMatch) {
      console.log(`Found Document ${doc.id} in Reader v3!`);
      const hlMatch = docMatch.highlights && docMatch.highlights.find(h => h.text.trim() === hl.text.trim());
      if (hlMatch) {
        console.log('Highlight found in Reader v3!');
        console.log(hlMatch);
      } else {
        console.log('Highlight NOT found in Reader v3 document!');
        console.log('Document Highlights:', docMatch.highlights);
      }
    } else {
      console.log('Document not found in first page of Reader v3.');
    }
  }
}

checkSync();
