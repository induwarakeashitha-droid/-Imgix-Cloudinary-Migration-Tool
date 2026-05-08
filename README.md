# 🖼️ Imgix → Cloudinary Migration Tool

A zero-fuss automation to **escape Imgix paywalls** — gather all your website images, upload them to Cloudinary, and automatically rewrite every URL in your HTML/CSS/JS. One command and you're done.

---

## ✨ What It Does

| Step | What happens |
|------|-------------|
| 🔍 **Scan** | Reads every `.html`, `.css`, `.js` file in your project and finds all Imgix image URLs |
| 📦 **Gather** | Checks your Downloads folder first — copies images it finds there |
| 📡 **Rescue** | Any image not in Downloads gets downloaded directly from the web |
| ☁️ **Upload** | Pushes everything to your Cloudinary account with `f_auto` + `q_auto` optimization |
| ✏️ **Rewrite** | Replaces every old Imgix URL in your code with the new Cloudinary URL |

---

## 📁 Project Structure

```
your-automation-folder/
│
├── migrate-all.js           ← Main script (run this)
├── find-missing.js          ← Helper to check what images are missing
├── url-mapping.json         ← Auto-generated: maps filenames to Cloudinary URLs
└── Cleaned_Website_Images/  ← Auto-created: local copy of all gathered images
```

---

## 🚀 Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free [Cloudinary](https://cloudinary.com/) account
- Your website project folder on your computer

### 2. Install

```bash
git clone https://github.com/YOUR_USERNAME/imgix-to-cloudinary.git
cd imgix-to-cloudinary
npm install cloudinary
```

### 3. Configure `migrate-all.js`

Open `migrate-all.js` and fill in the top section:

```js
cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME',   // ← from cloudinary.com/console
  api_key:    'YOUR_API_KEY',
  api_secret: 'YOUR_API_SECRET'
});

const SETTINGS = {
  projectDir:  'C:\\Users\\YOU\\Desktop\\your-website',  // ← your website folder
  downloadsDir: 'C:\\Users\\YOU\\Downloads',             // ← your Downloads folder
  imgixDomain: 'yoursubdomain.imgix.net'                 // ← your Imgix domain
};
```

Do the same in `find-missing.js` — it needs the same 3 path settings.

> 💡 Find your Cloudinary credentials at **cloudinary.com/console**

### 4. Run

```bash
node migrate-all.js
```

That's it. Your HTML/CSS files are updated automatically.

---

## 🔍 Finding Missing Images

If some images weren't in your Downloads folder, run the helper script first:

```bash
node find-missing.js
```

It will print a clear list like this:

```
✅ Already in Cleaned_Website_Images : 22
📦 Found in Downloads (not yet copied): 3
❌ Missing everywhere                 : 4

❌ MISSING IMAGES — download these manually:
─────────────────────────────────────────────
  1. FILE NAME : photo.jpg
     DOWNLOAD  : https://yoursubdomain.imgix.net/photo.jpg
```

**Workflow for missing images:**
1. Open each URL in your browser
2. Right-click the image → **Save As** → save to your Downloads folder
3. Run `migrate-all.js` again — it picks them up automatically

---

## ⚙️ How the Optimization Works

Every image uploaded to Cloudinary gets these flags added automatically:

```
/upload/f_auto,q_auto/
```

| Flag | What it does |
|------|-------------|
| `f_auto` | Serves WebP to modern browsers, JPEG to older ones — automatically |
| `q_auto` | Compresses to the smallest size without visible quality loss |

A 1.8MB JPEG can shrink to under 200KB with zero code changes on your end.

---

## 🔁 Re-running Safely

The script is safe to run multiple times:

- **Already uploaded?** Skips re-uploading (checks `url-mapping.json`)
- **Already copied?** Skips files already in `Cleaned_Website_Images`
- **URL already replaced?** The regex won't double-replace

---

## 🖥️ Platform

Currently configured for **Windows** paths (`C:\Users\...`).  
Mac/Linux users: change backslashes `\\` to forward slashes `/` in the path settings.

---

## 📋 Example Terminal Output

```
🚀 Starting Master Migration...

📂 Phase 1: Scanning your website files for Imgix images...
   Found 26 unique Imgix image URLs

🗂️  Phase 2: Gathering images...
   📦 Copied from Downloads: hero-banner.jpg
   📦 Copied from Downloads: about-team.webp
   📡 Downloading from web: gallery-3.jpg
   ✅ Downloaded: gallery-3.jpg
   ❌ Failed to download: old-photo.jpg (HTTP 404)

☁️  Phase 3: Uploading to Cloudinary...
   ✅ Uploaded: hero-banner.jpg
   ✅ Uploaded: about-team.webp
   ✅ Uploaded: gallery-3.jpg

✏️  Phase 4: Updating your HTML/CSS/JS files...
   📝 Updated 3 URL(s) in: index.html
   📝 Updated 1 URL(s) in: about.html
   📝 Updated 2 URL(s) in: css/style.css

==================================================
✨ MIGRATION COMPLETE!
==================================================
   Images gathered : 25
   Uploaded        : 25
   Files updated   : 3
   URLs replaced   : 6

   Your site now points to Cloudinary. Open your HTML to verify! 🎉
```

---

## 🤝 Contributing

Pull requests welcome! Some ideas for improvements:

- [ ] Mac/Linux path support out of the box
- [ ] Support for more CDN providers (Fastly, ImageKit)
- [ ] HTML report output instead of terminal
- [ ] Dry-run mode (preview changes without writing files)

---

## 📄 License

MIT — free to use, modify, and share.

---

> Built out of frustration with Imgix paywalls. Hope it saves you time! ⚡
