LifeBreath AI — GitHub Pages Dashboard (dark theme)
--------------------------------------------------
Files in this package:
 - index.html
 - style.css
 - app.js
 - manifest.json
 - assets/lifebreath_logo.png
 - assets/bell.mp3

How to publish:
1. Create a GitHub repo named LifeBreathAI-Dashboard
2. Copy these files into the repo root (or upload via GitHub web UI)
3. In repo Settings -> Pages, select branch `main` and folder `/ (root)` to publish
4. Visit https://<your-username>.github.io/LifeBreathAI-Dashboard/

Notes:
 - This frontend calls your backend API at https://api.breathanalyzer.in
 - Make sure the VPS API has CORS enabled to accept requests from GitHub Pages origin.
 - For uploads, browser sends a `POST /api/session` with form-data (file + user + fs).
