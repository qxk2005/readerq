require('dotenv').config({ path: '.env.local' });
fetch('https://readwise.io/api/v3/list/?limit=1', {
  headers: { 'Authorization': `Token ${process.env.READWISE_TOKEN}` }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(Object.keys(data))))
.catch(console.error);
