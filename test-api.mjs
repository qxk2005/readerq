import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('READWISE_TOKEN=')).split('=')[1];
fetch('https://readwise.io/api/v3/list/?limit=1', {
  headers: { 'Authorization': `Token ${env}` }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(Object.keys(data))))
.catch(console.error);
