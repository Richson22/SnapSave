"""
SnapSave API
============
POST /api/resolve   {"url": "..."}   -> metadata + download options
GET  /api/download  ?token=...       -> streams the chosen file to the browser
GET  /api/health                     -> versions / enabled platforms

Run (from this folder, venv active):
    uvicorn main:app --reload --port 8000

IMPORTANT: download tokens live in memory, so run ONE worker process.
(Move TOKENS to Redis if you ever scale to several workers.)
"""
from __future__ import annotations

import ipaddress
import logging
import os
import re
import secrets
import shutil
import tempfile
import threading
import time
from urllib.parse import quote, urlparse

import httpx
import yt_dlp
from yt_dlp.extractor.tiktok import TikTokIE
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("snapsave")

# --------------------------------------------------------------------------
# Config (all optional, set as environment variables)
# --------------------------------------------------------------------------
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
COOKIES_FILE = os.getenv("COOKIES_FILE") or None      # Netscape cookies.txt (helps Instagram/Facebook)
PROXY_URL = os.getenv("PROXY_URL") or None            # e.g. http://user:pass@host:port
ENABLE_YOUTUBE = os.getenv("ENABLE_YOUTUBE", "0") == "1"
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"    # set to 1 behind nginx/Cloudflare
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "20"))       # resolves per IP per minute
MAX_SERVER_SECONDS = int(os.getenv("MAX_SERVER_SECONDS", "1200"))       # fallback path: max video length
MAX_SERVER_BYTES = int(os.getenv("MAX_SERVER_BYTES", str(300 * 1024 * 1024)))  # fallback path: max file size
TOKEN_TTL = 15 * 60
FFMPEG_PATH = shutil.which("ffmpeg") or r"C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
HAS_FFMPEG = os.path.isfile(FFMPEG_PATH)

# Only links from these sites are accepted. This is what stops people using your
# server as a generic downloader / a way to reach internal addresses.
PLATFORMS: dict[str, list[str]] = {
    "TikTok": ["tiktok.com"],
    "Instagram": ["instagram.com", "instagr.am"],
    "Facebook": ["facebook.com", "fb.watch", "fb.com"],
    "X": ["x.com", "twitter.com"],
    "Pinterest": ["pinterest.com", "pin.it"],
    "Snapchat": ["snapchat.com"],   # yt-dlp only supports Spotlight links
    # Threads / LinkedIn posts: no yt-dlp extractor exists, so they are not listed.
}
if ENABLE_YOUTUBE:
    PLATFORMS["YouTube"] = ["youtube.com", "youtu.be"]

MEDIA_TYPES = {
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    "m4a": "audio/mp4", "mp3": "audio/mpeg", "opus": "audio/ogg",
}

# --------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------
app = FastAPI(title="SnapSave API", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    expose_headers=["Content-Disposition"],
)

# --------------------------------------------------------------------------
# Helpers: URL checks
# --------------------------------------------------------------------------
def detect_platform(url: str) -> str | None:
    """Return the platform name if the URL is http(s) and on an allowed domain."""
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower().rstrip(".")
    except ValueError:
        return None
    if p.scheme not in ("http", "https") or not host:
        return None
    for name, domains in PLATFORMS.items():
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return None


def is_safe_media_url(u: str) -> bool:
    """The file URL yt-dlp found must be public http(s), never localhost / private IPs."""
    try:
        p = urlparse(u)
        host = (p.hostname or "").lower()
    except ValueError:
        return False
    if p.scheme not in ("http", "https") or not host:
        return False
    if host == "localhost" or host.endswith((".local", ".internal", ".localhost")):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True  # an ordinary domain name


# --------------------------------------------------------------------------
# Helpers: download tokens (the browser never gets to choose what we fetch)
# --------------------------------------------------------------------------
TOKENS: dict[str, dict] = {}
_tokens_lock = threading.Lock()


def put_token(data: dict) -> str:
    token = secrets.token_urlsafe(18)
    now = time.time()
    with _tokens_lock:
        for k in [k for k, v in TOKENS.items() if v["exp"] < now]:
            del TOKENS[k]
        TOKENS[token] = {**data, "exp": now + TOKEN_TTL}
    return token


def get_token(token: str) -> dict | None:
    with _tokens_lock:
        data = TOKENS.get(token)
    if not data or data["exp"] < time.time():
        return None
    return data


# --------------------------------------------------------------------------
# Helpers: rate limit (simple per-IP sliding window)
# --------------------------------------------------------------------------
_hits: dict[str, list[float]] = {}
_hits_lock = threading.Lock()


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip: str) -> None:
    now = time.time()
    with _hits_lock:
        if len(_hits) > 10_000:  # keep memory bounded
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > 60]:
                del _hits[k]
        recent = [t for t in _hits.get(ip, []) if now - t < 60]
        if len(recent) >= RATE_LIMIT:
            _hits[ip] = recent
            raise HTTPException(429, "Too many requests. Please wait a minute and try again.")
        recent.append(now)
        _hits[ip] = recent


# --------------------------------------------------------------------------
# Helpers: yt-dlp
# --------------------------------------------------------------------------
def base_opts() -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 20,
        "retries": 2,
        "extractor_retries": 2,
    }
    if COOKIES_FILE:
        opts["cookiefile"] = COOKIES_FILE
    if PROXY_URL:
        opts["proxy"] = PROXY_URL
    return opts


def extract(url: str) -> dict:
    """Ask yt-dlp about the link (no download). Blocking: call from a thread."""
    if "tiktok.com/" in url:
        url = url.replace("/photo/", "/video/")
    with yt_dlp.YoutubeDL({**base_opts(), "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    if info and info.get("_type") == "playlist":  # e.g. Instagram carousel -> first item
        entries = [e for e in (info.get("entries") or []) if e]
        if not entries:
            raise yt_dlp.utils.DownloadError("No media found")
        info = entries[0]
    return info

def friendly_error(e: Exception) -> HTTPException:
    msg = str(e)
    low = msg.lower()
    log.warning("extract failed: %s", msg[:600])
    if "unsupported url" in low:
        return HTTPException(422, "That link isn't supported.")
    if any(k in low for k in ("login", "log in", "sign in", "cookies", "private", "age-restricted", "confirm your age")):
        return HTTPException(403, "This post is private or needs a login, so it can't be downloaded.")
    if any(k in low for k in ("404", "not found", "not available", "unavailable", "removed", "deleted", "does not exist", "no media found")):
        return HTTPException(404, "That video couldn't be found. It may have been removed.")
    if "429" in low or "too many requests" in low or "rate limit" in low:
        return HTTPException(503, "The platform is limiting requests right now. Please try again shortly.")
    return HTTPException(502, "Couldn't fetch that video right now. Please try again in a moment.")


def safe_name(title: str | None, ext: str) -> str:
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", title or "video")
    base = re.sub(r"\s+", " ", base).strip(" .")[:80] or "video"
    return f"{base}.{ext}"


def content_disposition(filename: str) -> str:
    """Header with a plain-ASCII fallback name plus the full UTF-8 name (emoji etc.)."""
    base, _, ext = filename.rpartition(".")
    if not base:
        base, ext = filename, "mp4"
    ascii_base = re.sub(r"\s+", " ", base.encode("ascii", "ignore").decode()).replace('"', "").strip() or "video"
    return f"attachment; filename=\"{ascii_base}.{ext}\"; filename*=UTF-8''{quote(filename)}"


def _http_ok(f: dict) -> bool:
    return bool(f.get("url")) and (f.get("protocol") or "https") in ("http", "https")


def _watermarked(f: dict) -> bool:
    text = " ".join(str(f.get(k) or "") for k in ("format_id", "format_note", "format")).lower()
    return "watermark" in text


def tiktok_images(page_url: str) -> list[str]:
    """Photo posts: yt-dlp only exposes a cover thumbnail, so read every picture from TikTok's own data."""
    url = page_url.replace("/photo/", "/video/")
    with yt_dlp.YoutubeDL({**base_opts(), "quiet": True}) as ydl:
        ie = TikTokIE(ydl)
        video_id = ie._match_id(url)
        video_data, _status = ie._extract_web_data_and_status(url, video_id, fatal=False)
    images = ((video_data or {}).get("imagePost") or {}).get("images") or []
    urls = []
    for img in images:
        u = ((img.get("imageURL") or {}).get("urlList") or [None])[0]
        if u:
            urls.append(u)
    return urls


def build_options(info: dict, page_url: str) -> list[dict]:
    """Turn yt-dlp's format list into a few simple choices for the UI."""
    formats = info.get("formats") or ([info] if info.get("url") else [])
    title = info.get("title")
    options: list[dict] = []

    # 1) Normal files: video+audio in a single downloadable URL. Prefer watermark-free.
    progressive = [
        f for f in formats
        if _http_ok(f) and f.get("vcodec") != "none" and f.get("acodec") != "none"
    ]
    pool = [f for f in progressive if not _watermarked(f)] or progressive
    pool.sort(key=lambda f: (f.get("height") or 0, f.get("tbr") or 0), reverse=True)

    seen: set = set()
    for f in pool:
        key = f.get("height") or f.get("format_id")
        if key in seen:
            continue
        seen.add(key)
        ext = f.get("ext") or "mp4"
        if detect_platform(page_url) == "TikTok":
            # TikTok's CDN rejects plain requests (403), so yt-dlp downloads this exact format itself
            token = put_token({
                "mode": "ytdlp",
                "page_url": page_url,
                "format_id": f.get("format_id"),
                "title": title,
            })
        else:
            token = put_token({
                "mode": "direct",
                "url": f["url"],
                "headers": f.get("http_headers") or info.get("http_headers") or {},
                "filename": safe_name(title, ext),
                "ext": ext,
            })
        options.append({
            "kind": "video",
            "label": f"{f['height']}p" if f.get("height") else "Download Original quality",
            "ext": ext,
            "size": f.get("filesize") or f.get("filesize_approx"),
            "watermark": _watermarked(f),
            "url": f"/api/download?token={token}",
        })
        if len(options) == 4:
            break

    # 2) Audio-only file, when the platform offers one
    audio = [
        f for f in formats
        if _http_ok(f) and f.get("vcodec") == "none" and f.get("acodec") not in (None, "none")
    ]
    if audio:
        audio.sort(key=lambda f: f.get("abr") or f.get("tbr") or 0, reverse=True)
        f = audio[0]
        ext = f.get("ext") or "m4a"
        token = put_token({
            "mode": "direct",
            "url": f["url"],
            "headers": f.get("http_headers") or info.get("http_headers") or {},
            "filename": safe_name(title, ext),
            "ext": ext,
        })
        options.append({
            "kind": "audio",
            "label": "Audio only",
            "ext": ext,
            "size": f.get("filesize") or f.get("filesize_approx"),
            "watermark": False,
            "url": f"/api/download?token={token}",
        })

    # 2b) TikTok photo posts: every picture, not just the cover
    if "/photo/" in page_url and detect_platform(page_url) == "TikTok":
        try:
            pics = tiktok_images(page_url)
        except Exception as e:
            log.warning("tiktok photo fetch failed: %s", e)
            pics = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Referer": "https://www.tiktok.com/",
        }
        for i, pic_url in enumerate(pics, start=1):
            token = put_token({
                "mode": "direct",
                "url": pic_url,
                "headers": headers,
                "filename": safe_name(f"{title} {i}" if title else f"picture {i}", "jpg"),
                "ext": "jpg",
            })
            options.append({
                "kind": "image",
                "label": f"Picture {i}" if len(pics) > 1 else "Picture",
                "ext": "jpg",
                "size": None,
                "watermark": False,
                "url": f"/api/download?token={token}",
            })
    # 3) Nothing directly downloadable (HLS/DASH only): let the server fetch + merge it
    if not any(o["kind"] in ("video", "image") for o in options) and formats:
        duration = info.get("duration") or 0
        if duration <= MAX_SERVER_SECONDS:
            token = put_token({"mode": "ytdlp", "page_url": page_url, "title": title})
            options.insert(0, {
                "kind": "video",
                "label": "Best available",
                "ext": "mp4",
                "size": None,
                "watermark": False,
                "url": f"/api/download?token={token}",
            })
    return options


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
def pinterest_image(page_url: str) -> dict | None:
    """Image pins have no video, so read the picture address from the pin page instead."""
    from html import unescape
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True, headers={"User-Agent": ua}) as client:
            r = client.get(page_url)
            if detect_platform(str(r.url)) != "Pinterest":
                return None
            page = r.text

            def meta(prop: str) -> str | None:
                m = (re.search(r'<meta[^>]+property=["\']' + prop + r'["\'][^>]+content=["\']([^"\']+)', page)
                     or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']' + prop + r'["\']', page))
                return unescape(m.group(1)) if m else None

            image_url = meta("og:image")
            if not image_url or not (urlparse(image_url).hostname or "").endswith("pinimg.com"):
                return None
            title = meta("og:title") or "Pinterest image"
            chosen = image_url
            original = re.sub(r"pinimg\.com/\d+x/", "pinimg.com/originals/", image_url)
            if original != image_url:
                head = client.head(original)
                if head.status_code == 200:
                    chosen = original
    except httpx.HTTPError as e:
        log.warning("pinterest image fetch failed: %s", e)
        return None

    ext = chosen.rsplit(".", 1)[-1].split("?")[0].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "jpg"
    token = put_token({
        "mode": "direct",
        "url": chosen,
        "headers": {"User-Agent": ua},
        "filename": safe_name(title, ext),
        "ext": ext,
    })
    return {
        "platform": "Pinterest",
        "title": title,
        "uploader": None,
        "duration": None,
        "thumbnail": image_url,
        "options": [{
            "kind": "image",
            "label": "Image",
            "ext": ext,
            "size": None,
            "watermark": False,
            "url": f"/api/download?token={token}",
        }],
    }


class ResolveIn(BaseModel):
    url: str


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "yt_dlp": yt_dlp.version.__version__,
        "ffmpeg": HAS_FFMPEG,
        "platforms": list(PLATFORMS),
    }


@app.post("/api/resolve")
def resolve(body: ResolveIn, request: Request):  # sync def -> FastAPI runs it in a thread
    check_rate_limit(client_ip(request))

    url = body.url.strip()
    if not url or len(url) > 2048:
        raise HTTPException(400, "Please paste a valid link.")
    platform = detect_platform(url)
    if not platform:
        names = ", ".join(PLATFORMS)
        raise HTTPException(422, f"That link isn't from a supported platform. Supported: {names}.")

    try:
        info = extract(url)
    except Exception as e:  # yt-dlp raises many different error types
        if platform == "Pinterest" and "no video formats" in str(e).lower():
            image = pinterest_image(url)
            if image:
                return image
        raise friendly_error(e)

    options = build_options(info, url)
    if not options:
        raise HTTPException(422, "No downloadable video was found at that link.")

    return {
        "platform": platform,
        "title": info.get("title") or "Video",
        "uploader": info.get("uploader") or info.get("channel"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "options": options,
    }


@app.get("/api/download")
async def download(token: str):
    data = get_token(token)
    if not data:
        raise HTTPException(410, "This download link has expired. Paste the link again.")
    if data["mode"] == "ytdlp":
        return await run_in_threadpool(serve_via_ytdlp, data)
    return await stream_direct(data)


async def stream_direct(data: dict) -> StreamingResponse:
    """Fetch the file from the platform's CDN and pass the bytes straight through."""
    skip = {"host", "accept-encoding", "range", "content-length"}
    headers = {k: v for k, v in (data["headers"] or {}).items() if k.lower() not in skip}
    headers["Accept-Encoding"] = "identity"  # keeps Content-Length accurate

    client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, read=60.0), follow_redirects=False)
    url = data["url"]
    upstream = None
    try:
        for _ in range(5):  # follow redirects by hand so each hop is safety-checked
            if not is_safe_media_url(url):
                raise HTTPException(502, "Blocked an unsafe download address.")
            upstream = await client.send(client.build_request("GET", url, headers=headers), stream=True)
            loc = upstream.headers.get("location")
            if upstream.status_code in (301, 302, 303, 307, 308) and loc:
                await upstream.aclose()
                url = str(httpx.URL(url).join(loc))
                upstream = None
                continue
            break
        if upstream is None:
            raise HTTPException(502, "Too many redirects from the video server.")
        if upstream.status_code >= 400:
            code = upstream.status_code
            await upstream.aclose()
            raise HTTPException(502, f"The video server refused the request ({code}). Paste the link again.")
    except HTTPException:
        await client.aclose()
        raise
    except httpx.HTTPError as e:
        await client.aclose()
        log.warning("upstream error: %s", e)
        raise HTTPException(502, "Couldn't reach the video server. Please try again.")

    async def body():
        try:
            async for chunk in upstream.aiter_raw(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    out_headers = {
        "Content-Disposition": content_disposition(data["filename"]),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if upstream.headers.get("content-length"):
        out_headers["Content-Length"] = upstream.headers["content-length"]
    media_type = MEDIA_TYPES.get(data["ext"], "application/octet-stream")
    return StreamingResponse(body(), media_type=media_type, headers=out_headers)


def serve_via_ytdlp(data: dict) -> FileResponse:
    """yt-dlp downloads (and merges with ffmpeg if needed) to a temp file, then we send it."""
    tmp = tempfile.mkdtemp(prefix="snapsave_")
    if data.get("format_id"):
        fmt = f"b[format_id={data['format_id']}]"
    else:
        fmt = "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b" if HAS_FFMPEG else "b"
    opts = {
        **base_opts(),
        "format": fmt,
        "merge_output_format": "mp4",
        "outtmpl": os.path.join(tmp, "video.%(ext)s"),
        "max_filesize": MAX_SERVER_BYTES,
        "ffmpeg_location": FFMPEG_PATH,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([data["page_url"]])
        files = [f for f in os.listdir(tmp) if not f.endswith((".part", ".ytdl"))]
        if not files:
            raise yt_dlp.utils.DownloadError("No media found")
        path = os.path.join(tmp, max(files, key=lambda f: os.path.getsize(os.path.join(tmp, f))))
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise friendly_error(e)

    ext = os.path.splitext(path)[1].lstrip(".") or "mp4"
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(ext, "application/octet-stream"),
        headers={
            "Content-Disposition": content_disposition(safe_name(data.get("title"), ext)),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True),
    )