import { getServerReadwiseClient } from './src/lib/readwise.js';
import { setSyncState } from './src/lib/db.js';

async function run() {
  const client = getServerReadwiseClient();
  const data = await client.listDocuments({ limit: 1 });
  if (data.count) {
    console.log("Remote count is", data.count);
    setSyncState('remote_doc_count', data.count.toString());
  } else {
    console.log("No count returned");
  }
}
run();
