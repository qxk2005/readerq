const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const commandFile = path.join(rootDir, '改变权限.command');

function postBuild() {
  console.log('Running post-build script for macOS packages...');

  if (!fs.existsSync(commandFile)) {
    console.error('改变权限.command file not found at project root!');
    return;
  }

  // Ensure 改变权限.command is executable in the source
  try {
    fs.chmodSync(commandFile, '755');
    console.log('  ✓ Set executable permission (755) for source 改变权限.command');
  } catch (err) {
    console.warn('  ⚠ Failed to set permission for source file:', err.message);
  }

  // Also copy it to the dist folder so it is available next to the installers
  try {
    const destInDist = path.join(distDir, '改变权限.command');
    fs.copyFileSync(commandFile, destInDist);
    fs.chmodSync(destInDist, '755');
    console.log('  ✓ Copied 改变权限.command to dist/');
  } catch (err) {
    console.warn('  ⚠ Failed to copy 改变权限.command to dist/ folder:', err.message);
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
        // Run zip command to add the command file to the root of the ZIP file
        // -j: junk paths (do not record directory names)
        // -u: update changed/new files
        // We run the command from the root directory so the file path inside zip is '改变权限.command'
        execSync(`zip -ju "${zipPath}" "${commandFile}"`, { cwd: rootDir });
        console.log(`  ✓ Successfully added 改变权限.command to ${zipFile}`);
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
