const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

async function buildElectron() {
  console.log('Preparing Next.js standalone build for Electron...');

  if (!fs.existsSync(standaloneDir)) {
    console.error('Standalone directory not found! Run "next build" first.');
    process.exit(1);
  }

  // Next.js standalone does not include public/ and .next/static/ by default
  // We need to copy them into the standalone directory for them to be served correctly

  console.log('Copying static assets...');
  
  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    await fs.copy(publicSrc, publicDest);
    console.log('  ✓ public/ copied');
  }

  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    await fs.copy(staticSrc, staticDest);
    console.log('  ✓ .next/static/ copied');
  }

  // Copy .env.local if it exists (for API keys and configuration)
  const envSrc = path.join(rootDir, '.env.local');
  const envDest = path.join(standaloneDir, '.env.local');
  if (fs.existsSync(envSrc)) {
    await fs.copy(envSrc, envDest);
    console.log('  ✓ .env.local copied');
  }

  // Verify key files exist
  const serverJs = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverJs)) {
    console.error('ERROR: server.js not found in standalone directory!');
    process.exit(1);
  }
  console.log('  ✓ server.js verified');

  // Check for better-sqlite3 in standalone node_modules
  const sqlitePath = path.join(standaloneDir, 'node_modules', 'better-sqlite3');
  if (fs.existsSync(sqlitePath)) {
    console.log('  ✓ better-sqlite3 found in standalone');
  } else {
    console.warn('  ⚠ better-sqlite3 NOT found in standalone node_modules');
    // Copy it from root node_modules if missing
    const sqliteRoot = path.join(rootDir, 'node_modules', 'better-sqlite3');
    if (fs.existsSync(sqliteRoot)) {
      await fs.copy(sqliteRoot, sqlitePath);
      console.log('  ✓ better-sqlite3 copied from root node_modules');
    }
  }

  console.log('Standalone preparation completed successfully.');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});
