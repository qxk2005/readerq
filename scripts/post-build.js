const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const readmeFile = path.join(rootDir, '安装说明.txt');

function postBuild() {
  console.log('Running post-build script for macOS packages...');

  if (!fs.existsSync(readmeFile)) {
    console.error('安装说明.txt file not found at project root!');
    return;
  }

  // Also copy it to the dist folder so it is available next to the installers
  try {
    const destInDist = path.join(distDir, '安装说明.txt');
    fs.copyFileSync(readmeFile, destInDist);
    console.log('  ✓ Copied 安装说明.txt to dist/');
  } catch (err) {
    console.warn('  ⚠ Failed to copy 安装说明.txt to dist/ folder:', err.message);
  }

  // Process all macOS ZIP files in dist/
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const zipFiles = files.filter(f => f.startsWith('ReaderQ-') && f.endsWith('.zip'));

    if (zipFiles.length === 0) {
      console.log('  No macOS ZIP files found in dist/ to update.');
    }

    for (const zipFile of zipFiles) {
      const zipPath = path.join(distDir, zipFile);
      console.log(`  Updating ZIP archive: ${zipFile}...`);
      try {
        // Run zip command to add the readme file to the root of the ZIP file
        // -j: junk paths (do not record directory names)
        // -u: update changed/new files
        execSync(`zip -ju "${zipPath}" "${readmeFile}"`, { cwd: rootDir });
        console.log(`  ✓ Successfully added 安装说明.txt to ${zipFile}`);
      } catch (err) {
        console.error(`  ❌ Failed to update ZIP archive ${zipFile}:`, err.message);
      }
    }
  } else {
    console.error('dist/ directory does not exist!');
  }

  console.log('Post-build scripting completed.');
}

if (process.platform === 'darwin') {
  postBuild();
} else {
  console.log('Not on macOS, skipping macOS post-build steps.');
}
