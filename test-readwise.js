import 'dotenv/config';
import fs from 'fs';

const token = process.env.READWISE_API_TOKEN;
if (!token) {
  console.log('No token');
  process.exit(1);
}

const docId = '01kq4vn373s1gvtscv4bgyh4sy'; // 创意机器

fetch(`https://readwise.io/api/v3/list/?id=${docId}`, {
  headers: {
    'Authorization': `Token ${token}`
  }
}).then(res => res.json()).then(data => {
  const doc = data.results[0];
  console.log(Object.keys(doc));
  if (doc.highlights) {
    console.log('Highlights:', doc.highlights.length);
  } else {
    console.log('No highlights field in response');
  }
}).catch(console.error);
