const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION — must match your migrate-all.js
// ==========================================
const SETTINGS = {
  projectDir:   'C:\\Users\\YOU\\Desktop\\your-website-folder', // ← your website folder
  downloadsDir: 'C:\\Users\\YOU\\Downloads',                    // ← your Downloads folder
  assetsFolder: path.join(__dirname, 'Cleaned_Website_Images'),
  imgixDomain:  'yoursubdomain.imgix.net'                       // ← your Imgix domain
};

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'];

// ==========================================
// Scan HTML/CSS for all Imgix URLs
// ==========================================
function collectImgixUrls(dir, found = new Set()) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.git') collectImgixUrls(full, found);
    } else if (entry.match(/\.(html|css|js|jsx)$/i)) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.match(
        new RegExp(`https?://${SETTINGS.imgixDomain.replace('.', '\\.')}/[^"' )>\\s?]+`, 'g')
      );
      if (matches) matches.forEach(u => found.add(u.split('?')[0]));
    }
  }
  return found;
}

// ==========================================
// Search Downloads + subfolders for a file
// ==========================================
function findInDownloads(filename) {
  const direct = path.join(SETTINGS.downloadsDir, filename);
  if (fs.existsSync(direct)) return true;
  try {
    const entries = fs.readdirSync(SETTINGS.downloadsDir);
    for (const entry of entries) {
      const sub = path.join(SETTINGS.downloadsDir, entry, filename);
      if (fs.existsSync(sub)) return true;
    }
  } catch (e) {}
  return false;
}

// ==========================================
// MAIN
// ==========================================
console.log('🔍 Scanning your website for Imgix images...\n');

const allUrls = collectImgixUrls(SETTINGS.projectDir);
console.log(`   Total Imgix images found in HTML/CSS: ${allUrls.size}\n`);

const missing     = [];
const inAssets    = [];
const inDownloads = [];

for (const url of allUrls) {
  const filename = url.substring(url.lastIndexOf('/') + 1);
  const ext = path.extname(filename).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) continue;

  if (fs.existsSync(path.join(SETTINGS.assetsFolder, filename))) {
    inAssets.push(filename);
  } else if (findInDownloads(filename)) {
    inDownloads.push(filename);
  } else {
    missing.push({ filename, url });
  }
}

// ── Summary ───────────────────────────────
console.log('='.repeat(55));
console.log('📊 RESULTS');
console.log('='.repeat(55));
console.log(`✅ Already in Cleaned_Website_Images : ${inAssets.length}`);
console.log(`📦 Found in Downloads (not yet copied): ${inDownloads.length}`);
console.log(`❌ Missing everywhere                 : ${missing.length}`);
console.log('='.repeat(55));

if (inDownloads.length > 0) {
  console.log('\n📦 These are in your Downloads folder but not copied yet:');
  console.log('   (just run migrate-all.js again and it will pick them up)\n');
  inDownloads.forEach(f => console.log(`   • ${f}`));
}

if (missing.length === 0) {
  console.log('\n🎉 No missing images! You have everything.');
} else {
  console.log(`\n❌ MISSING IMAGES — download these manually (${missing.length} total):`);
  console.log('─'.repeat(55));
  missing.forEach((item, i) => {
    console.log(`\n  ${i + 1}. FILE NAME : ${item.filename}`);
    console.log(`     DOWNLOAD  : ${item.url}`);
  });
  console.log('\n─'.repeat(55));
  console.log('\n📋 HOW TO GET THEM:');
  console.log('   1. Copy each URL above and open it in your browser');
  console.log('   2. Right-click the image → Save As');
  console.log('   3. Save it to your Downloads folder');
  console.log('   4. Run migrate-all.js again — it will pick them up automatically\n');
}
