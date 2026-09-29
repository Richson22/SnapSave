# SnapSave API

FastAPI + yt-dlp. The React site sends it a pasted link; it finds the video and streams the file back.

## Run it (Windows PowerShell)

Put this `server` folder inside your project (next to `src`), then:

```powershell
cd C:\Users\DELL\Desktop\js.dom\Snap-Save\SnapSave\server
py -m venv .venv
.venv\Scripts\Activate.ps1        # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Check it's alive: open http://localhost:8000/api/health. You should see the yt-dlp version and the enabled platforms.

Leave that terminal running. In a second terminal, run the React site as usual (`npm run dev`).

## Connect the React site (vite.config.js)

Add the `server` block so `/api/...` calls from the page reach this server (no CORS setup needed):

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

Restart `npm run dev` after editing `vite.config.js`.

## Settings (environment variables, all optional)

In PowerShell, set them in the same terminal before starting uvicorn, e.g. `$env:ENABLE_YOUTUBE="1"`.

| Variable | Default | What it does |
|---|---|---|
| `ENABLE_YOUTUBE` | `0` | Turn YouTube on. Off by default: it breaks often and Google blocks server IPs. |
| `COOKIES_FILE` | none | Path to a `cookies.txt` (Netscape format). Often needed for Instagram/Facebook. |
| `PROXY_URL` | none | Send yt-dlp traffic through a proxy (needed on cloud hosts for Instagram etc.). |
| `RATE_LIMIT` | `20` | Link lookups per IP per minute. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated site addresses allowed to call the API (only matters if not using the Vite proxy). |
| `TRUST_PROXY` | `0` | Set `1` behind nginx/Cloudflare so the real visitor IP is used for rate limiting. |
| `MAX_SERVER_SECONDS` | `1200` | Longest video the server will fetch itself (HLS-only fallback). |
| `MAX_SERVER_BYTES` | `314572800` | Largest file for that fallback (300 MB). |

## When downloads stop working

Platforms change constantly. **Update yt-dlp first**, it fixes most breakages:

```powershell
pip install -U yt-dlp
```

then restart uvicorn. Check `/api/health` for the version.

## How it works

1. `POST /api/resolve` takes the link, checks it is on an allowed platform, asks yt-dlp for the formats, and returns a few options (watermark-free ones preferred). Each option carries a short-lived token.
2. `GET /api/download?token=...` streams that file through the server with a `Content-Disposition: attachment` header, so the browser saves it. The browser never chooses what the server fetches; it can only redeem a token.
3. If a video only exists as HLS/DASH, a "Best available" option makes the server download it to a temp file (merged with ffmpeg if installed: `winget install Gyan.FFmpeg`), send it, then delete it.

## Known limits

- **Photos and slideshows** (TikTok photo posts, Instagram images) are not supported: yt-dlp is video-focused.
- **Instagram carousels** return the first item only.
- **Threads and LinkedIn** posts have no yt-dlp support, so they aren't accepted. Snapchat works for Spotlight links only.
- **Private posts** need login cookies and are refused with a friendly message otherwise.
- **Tokens live in memory.** Restarting the server invalidates open download links, and you must run a single worker process. Move tokens to Redis if you ever scale out.
- **Cloud hosting:** Instagram, Facebook and YouTube often block datacenter IPs. Expect to need `PROXY_URL` with a residential proxy once you deploy.