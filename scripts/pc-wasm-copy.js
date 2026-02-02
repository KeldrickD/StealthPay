// Cross-platform postinstall to copy Privacy Cash wasm files for Next.js
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function copyIfExists(src, destDir) {
  if (!fs.existsSync(src)) return false;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  return true;
}

try {
  const nm = path.join(__dirname, '..', 'node_modules');
  const hasherDist = path.join(nm, '@lightprotocol', 'hasher.rs', 'dist');
  const browserFatEs = path.join(hasherDist, 'browser-fat', 'es');
  const nestedHasherDist = path.join(
    nm,
    '@privacy-cash',
    'privacy-cash-sdk',
    'node_modules',
    '@lightprotocol',
    'hasher.rs',
    'dist'
  );
  const nestedBrowserFatEs = path.join(nestedHasherDist, 'browser-fat', 'es');
  const destDirs = [browserFatEs];
  if (fs.existsSync(nestedHasherDist)) destDirs.push(nestedBrowserFatEs);

  const files = [
    path.join(hasherDist, 'hasher_wasm_simd_bg.wasm'),
    path.join(hasherDist, 'light_wasm_hasher_bg.wasm'),
  ];

  let copied = 0;
  for (const f of files) {
    for (const dest of destDirs) {
      if (copyIfExists(f, dest)) copied++;
    }
  }

  console.log(`[postinstall] Privacy-Cash wasm copy: ${copied}/${files.length * destDirs.length} files copied.`);

  // Attempt to build the SDK locally if dist is missing (git dependency often lacks prebuilt dist)
  const sdkDir = path.join(nm, '@privacy-cash', 'privacy-cash-sdk');
  const distIndex = path.join(sdkDir, 'dist', 'index.js');
  if (!fs.existsSync(distIndex) && fs.existsSync(sdkDir)) {
    console.log('[postinstall] Building Privacy Cash SDK (git dependency)...');
    try {
      cp.execSync('npm install', { cwd: sdkDir, stdio: 'inherit' });
      cp.execSync('npm run build', { cwd: sdkDir, stdio: 'inherit' });
      console.log('[postinstall] Privacy Cash SDK built successfully.');
    } catch (e) {
      console.warn('[postinstall] Failed to build Privacy Cash SDK:', e?.message || e);
    }
  }
} catch (e) {
  console.warn('[postinstall] Privacy-Cash wasm copy failed:', e?.message || e);
}
