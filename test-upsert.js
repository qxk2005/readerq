import 'dotenv/config';
import { getDatabase, upsertDocument } from './src/lib/db.js';

try {
  upsertDocument({
    id: 'test-doc-id',
    title: 'Test Title'
  });
  console.log('Success!');
} catch(e) {
  console.error(e);
}
