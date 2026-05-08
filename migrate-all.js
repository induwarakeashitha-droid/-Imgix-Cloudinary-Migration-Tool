const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cloudinary = require('cloudinary').v2;

// ==========================================
// CONFIGURATION — fill these in before use
// ==========================================
cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME',   // ← from cloudinary.com/console
  api_key:    'YOUR_API_KEY',      // ← from cloudinary.com/console
  api_secret: 'YOUR_API_SECRET'   // ← from cloudinary.com/console
});

const SETTINGS = {
  projectDir:   'C:\\Users\\YOU\\Desktop\\your-website-folder', // ← your website folder
  downloadsDir: 'C:\\Users\\YOU\\Downloads',                    // ← your Downloads folder
  assetsFolder: path.join(__dirname, 'Cleaned_Website_Images'),
  mappingFile:  path.join(__dirname, 'url-mapping.json'),
  imgixDomain:  'yoursubdomain.imgix.net'                       // ← your Imgix domain
};

// Image file extensions to process
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'];

// ==========================================
// HELPER: Download a file from a URL
// ==========================================
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// ==========================================
// STEP 1: Scan all HTML/CSS files and
//         collect every Imgix image URL
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
// STEP 2: Search Downloads folder and all
//         its direct subfolders for a file
// ==========================================
function findInDownloads(filename) {
  const direct = path.join(SETTINGS.downloadsDir, filename);
  if (fs.existsSync(direct)) return direct;
  try {
    const entries = fs.readdirSync(SETTINGS.downloadsDir);
    for (const entry of entries) {
      const sub = path.join(SETTINGS.downloadsDir, entry, filename);
      if (fs.existsSync(sub)) return sub;
    }
  } catch (e) {}
  return null;
}

// ==========================================
// MAIN PIPELINE
// ==========================================
async function startMigration() {
  console.log('🚀 Starting Master Migration...\n');

  if (!fs.existsSync(SETTINGS.assetsFolder)) fs.mkdirSync(SETTINGS.assetsFolder);

  // ── Phase 1: Collect all Imgix URLs from your HTML/CSS ──────────────────
  console.log('📂 Phase 1: Scanning your website files for Imgix images...');
  const imgixUrls = collectImgixUrls(SETTINGS.projectDir);
  console.log(`   Found ${imgixUrls.size} unique Imgix image URLs\n`);

  if (imgixUrls.size === 0) {
    console.log('⚠️  No Imgix URLs found. Check your projectDir path is correct.');
    console.log(`   Looking in: ${SETTINGS.projectDir}`);
    return;
  }

  // ── Phase 2: Gather images (Downloads first, then web) ──────────────────
  console.log('🗂️  Phase 2: Gathering images...');
  const missing = [];

  for (const url of imgixUrls) {
    const filename = url.substring(url.lastIndexOf('/') + 1);
    const ext = path.extname(filename).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;

    const destPath = path.join(SETTINGS.assetsFolder, filename);
    if (fs.existsSync(destPath)) {
      console.log(`   ✅ Already have: ${filename}`);
      continue;
    }

    const foundAt = findInDownloads(filename);
    if (foundAt) {
      fs.copyFileSync(foundAt, destPath);
      console.log(`   📦 Copied from Downloads: ${filename}`);
      continue;
    }

    console.log(`   📡 Downloading from web: ${filename}`);
    try {
      await downloadFile(url, destPath);
      console.log(`   ✅ Downloaded: ${filename}`);
    } catch (e) {
      console.log(`   ❌ Failed to download: ${filename} (${e.message})`);
      missing.push(filename);
    }
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  Could not get these ${missing.length} images:`);
    missing.forEach(f => console.log(`      - ${f}`));
  }
  console.log();

  // ── Phase 3: Upload everything to Cloudinary ────────────────────────────
  console.log('☁️  Phase 3: Uploading to Cloudinary...');
  const mapping = {};

  if (fs.existsSync(SETTINGS.mappingFile)) {
    Object.assign(mapping, JSON.parse(fs.readFileSync(SETTINGS.mappingFile, 'utf8')));
    console.log(`   (Loaded ${Object.keys(mapping).length} existing uploads from mapping file)`);
  }

  const files = fs.readdirSync(SETTINGS.assetsFolder)
    .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));

  for (const file of files) {
    if (mapping[file]) {
      console.log(`   ⏭️  Already uploaded: ${file}`);
      continue;
    }
    try {
      const result = await cloudinary.uploader.upload(
        path.join(SETTINGS.assetsFolder, file),
        { folder: 'website_assets', use_filename: true, unique_filename: false }
      );
      mapping[file] = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
      console.log(`   ✅ Uploaded: ${file}`);
    } catch (e) {
      console.log(`   ❌ Upload failed: ${file} — ${e.message}`);
    }
  }

  fs.writeFileSync(SETTINGS.mappingFile, JSON.stringify(mapping, null, 2));
  console.log(`\n   💾 Mapping saved to url-mapping.json\n`);

  // ── Phase 4: Rewrite HTML/CSS files ─────────────────────────────────────
  console.log('✏️  Phase 4: Updating your HTML/CSS/JS files...');
  let totalFilesUpdated = 0;
  let totalReplacements = 0;

  function updateFiles(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.git') updateFiles(full);
      } else if (entry.match(/\.(html|css|js|jsx)$/i)) {
        let content = fs.readFileSync(full, 'utf8');
        let changed = false;
        let fileReplacements = 0;

        for (const [filename, newUrl] of Object.entries(mapping)) {
          const imgixPattern = new RegExp(
            `https?://${SETTINGS.imgixDomain.replace('.', '\\.')}/` +
            `${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"' )>\\s]*`,
            'g'
          );
          const before = content;
          content = content.replace(imgixPattern, newUrl);
          if (content !== before) {
            fileReplacements++;
            changed = true;
          }
        }

        if (changed) {
          fs.writeFileSync(full, content);
          totalFilesUpdated++;
          totalReplacements += fileReplacements;
          console.log(`   📝 Updated ${fileReplacements} URL(s) in: ${path.relative(SETTINGS.projectDir, full)}`);
        }
      }
    }
  }

  updateFiles(SETTINGS.projectDir);

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('✨ MIGRATION COMPLETE!');
  console.log('='.repeat(50));
  console.log(`   Images gathered : ${files.length}`);
  console.log(`   Uploaded        : ${Object.keys(mapping).length}`);
  console.log(`   Files updated   : ${totalFilesUpdated}`);
  console.log(`   URLs replaced   : ${totalReplacements}`);
  if (missing.length > 0)
    console.log(`   Still missing   : ${missing.length} (listed above)`);
  console.log('\n   Your site now points to Cloudinary. Open your HTML to verify! 🎉');
}

startMigration().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
