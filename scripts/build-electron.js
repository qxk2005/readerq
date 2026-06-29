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
  }

  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    await fs.copy(staticSrc, staticDest);
  }

  console.log('Standalone preparation completed successfully.');
}

buildElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});
