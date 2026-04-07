# 📚 Class Tracker — Web App

## Deploy to Vercel (free, ~5 minutes)

### Option A — Drag & Drop (easiest, no account needed for basic)

1. Go to https://vercel.com and sign up free
2. On your dashboard click **"Add New Project"**
3. Click **"Import from folder"** (or drag this whole folder into the page)
4. Leave all settings as default and click **Deploy**
5. Vercel gives you a URL like `class-tracker-abc.vercel.app` ✅

---

### Option B — Via command line

```bash
npm install
npm run build       # test the build locally first
npx vercel          # follow the prompts (login + deploy)
```

---

## Add to Android Home Screen (after deploying)

1. Open your Vercel URL in **Chrome on Android**
2. Tap the **⋮ menu** (top right)
3. Tap **"Add to Home screen"**
4. Confirm — it appears on your home screen with its own icon 🎉

It will open full-screen, just like a native app.

---

## Run locally (to test before deploying)

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

---

## Project structure

```
class-tracker-web/
├── index.html              # Entry point + PWA meta tags
├── vite.config.js          # Build config
├── vercel.json             # Routing for Vercel
├── public/
│   ├── manifest.json       # PWA manifest (enables "Add to Home Screen")
│   ├── icon-192.png        # App icon
│   └── icon-512.png        # App icon (large)
└── src/
    ├── main.jsx            # React entry
    └── ClassTracker.jsx    # Your full app
```
