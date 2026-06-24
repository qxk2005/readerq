import { getDatabase, upsertDocument } from './src/lib/db.js';

try {
  upsertDocument({
    id: 'test-doc-id-123',
    title: 'Test Title'
  });
  console.log('Success!');
} catch(e) {
  console.error('Error during upsertDocument:', e);
}
