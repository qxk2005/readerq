const fs = require('fs');
async function test() {
  try {
    const db = require('better-sqlite3')('data/readerq.db');
    const row = db.prepare("SELECT value FROM settings WHERE key = 'readwise_token'").get();
    const tokenToUse = row ? JSON.parse(row.value) : null;
    if(!tokenToUse) return;
    
    // Simulate what the server does
    const highlightData = {
      text: "Test highlight for API tag testing " + Date.now(),
      title: "API Tag Testing",
      source_url: "https://example.com/test",
      location: 1,
      note: "This is a clean note"
    };
    const payload = { highlights: [highlightData] };
    const res = await fetch('https://readwise.io/api/v2/highlights/', {
      method: 'POST',
      headers: { 'Authorization': `Token ${tokenToUse}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    console.log("Create Highlight Result:", JSON.stringify(result, null, 2));

    const createdHighlights = result;
    let readwiseHighlightId = null;
    if (Array.isArray(createdHighlights) && createdHighlights.length > 0) {
      if (createdHighlights[0].modified_highlights && createdHighlights[0].modified_highlights.length > 0) {
        readwiseHighlightId = createdHighlights[0].modified_highlights[0];
      } else if (createdHighlights[0].id) {
        readwiseHighlightId = createdHighlights[0].id; // Fallback
      }
    } else if (createdHighlights?.id) {
      readwiseHighlightId = createdHighlights.id;
    }

    if (readwiseHighlightId) {
      console.log("Trying to add tag to highlight:", readwiseHighlightId);
      const tagRes = await fetch(`https://readwise.io/api/v2/highlights/${readwiseHighlightId}/tags/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${tokenToUse}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "readerq" })
      });
      console.log("Tag Add Status:", tagRes.status);
      const tagResult = await tagRes.json().catch(e=>({error:e.message}));
      console.log("Tag Add Result:", JSON.stringify(tagResult, null, 2));
      
      // Let's verify by fetching the highlight again
      const hlRes = await fetch(`https://readwise.io/api/v2/highlights/${readwiseHighlightId}/`, {
        headers: { 'Authorization': `Token ${tokenToUse}` }
      });
      const hlData = await hlRes.json();
      console.log("Highlight tags after tagging:", JSON.stringify(hlData.tags, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
