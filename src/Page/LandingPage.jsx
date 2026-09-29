import React, { useState } from "react";

/**
 * snapSave — landing page.
 *
 * Structure: dark hero + nav + feature strip, light "platforms" and
 * "tools" sections, dark footer. Self-contained, default export, no
 * required props, plain scoped CSS (prefixed "ss-") so it drops into any
 * React setup without a Tailwind/CSS-module dependency.
 *
 * PLATFORM LOGOS: these are plain string paths (not ES imports), so Vite
 * needs them served as static files from the /public folder, not from
 * /src. Create this folder and drop your downloaded logos in with these
 * exact names (extension set by LOGO_EXT below), or edit PLATFORMS:
 *   public/images/logos/tiktok.svg
 *   public/images/logos/instagram.svg
 *   public/images/logos/facebook.svg
 *   public/images/logos/x.svg
 *   public/images/logos/youtube.svg
 *   public/images/logos/pinterest.svg
 * Feature and tool icons are drawn inline as SVG (generic pictograms, not
 * brand marks), so no image files are needed for those.
 */

const LOGO_BASE = "/images/logos/";
// Change this to "png" (or "webp", "jpg") if your logo files are not SVG.
const LOGO_EXT = "png";
const logo = (name) => `${LOGO_BASE}${name}.${LOGO_EXT}`;

// SnapSave mark (transparent PNG) — save as public/images/snapsave-icon.png
const BRAND_ICON = "/images/snapsave-icon.png";

// Backend address. In dev, Vite proxies /api to the Python server (see vite.config.js),
// so leave this empty. In production set VITE_API_BASE if the API is on another domain.
const API = import.meta.env.VITE_API_BASE || "";

const fmtDuration = (sec) => {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const fmtSize = (bytes) => {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
};

const PLATFORMS = [
  { name: "TikTok", file: "tiktok", tag: "Videos • Photos • Audio" },
  { name: "Instagram", file: "instagram", tag: "Reels • Videos • Photos" },
  { name: "Facebook", file: "facebook", tag: "Videos • Photos" },
  { name: "X (Twitter)", file: "x", tag: "Videos • GIFs • Photos" },
  { name: "YouTube", file: "youtube", tag: "Videos • Shorts • Audio" },
  { name: "Pinterest", file: "pinterest", tag: "Videos • Images" },
];

const DOWNLOADER_LINKS = [
  "TikTok Downloader",
  "Instagram Downloader",
  "Facebook Downloader",
  "X (Twitter) Downloader",
  "YouTube Downloader",
  "Pinterest Downloader",
];

const TOOLS = [
  { key: "mp3", title: "Video to MP3", desc: "Extract audio from any video", color: "#7c3aed" },
  { key: "compress", title: "Video Compressor", desc: "Reduce video file size", color: "#3b82f6" },
  { key: "gif", title: "Video to GIF", desc: "Turn videos into GIFs", color: "#16a34a" },
  { key: "image", title: "Image Downloader", desc: "Download high-quality images", color: "#db2777" },
  { key: "thumb", title: "Thumbnail Downloader", desc: "Get video thumbnails", color: "#ea580c" },
  { key: "qr", title: "QR Code Generator", desc: "Create custom QR codes", color: "#0d9488" },
];

const FEATURES = [
  { key: "bolt", title: "Fast & Simple", desc: "Paste a link and your download starts in seconds.", color: "#7c3aed" },
  { key: "shield", title: "No Watermark", desc: "Every file comes through clean, exactly as it was posted.", color: "#16a34a" },
  { key: "lock", title: "Safe & Private", desc: "No account needed. We don't store what you download.", color: "#2563eb" },
  { key: "device", title: "Any Device", desc: "Works the same on desktop, tablet, and mobile.", color: "#db2777" },
  { key: "star", title: "Free to Use", desc: "Every core download is free, with no hidden charges.", color: "#ea580c" },
];

/* --- Brand lockup: real logo mark + live text (stays sharp, flips in light mode) --- */
function Brand() {
  return (
    <div className="ss-brand">
      <img className="ss-brand-logo" src={BRAND_ICON} alt="" />
      <span>Snap<span className="ss-brand-save">Save</span></span>
    </div>
  );
}

/* --- Inline icon set (generic pictograms, not brand marks) --- */
function Icon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "bolt":
      return <svg {...common}><polygon points="13 2 3 14 11 14 10 22 21 9 13 9 13 2" fill="currentColor" stroke="none" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 2 4 5v6c0 5 3.6 8.4 8 10 4.4-1.6 8-5 8-10V5l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "lock":
      return <svg {...common}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "device":
      return <svg {...common}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>;
    case "star":
      return <svg {...common}><polygon points="12 2 15 9 22 9.5 16.5 14 18 21 12 17.3 6 21 7.5 14 2 9.5 9 9 12 2" fill="currentColor" stroke="none" /></svg>;
    case "mp3":
      return <svg {...common}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>;
    case "compress":
      return <svg {...common}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>;
    case "gif":
      return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10v4M11 10v4M11 12h1.5M17 10h-2.5v4M14.5 12H17" /></svg>;
    case "image":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" /><path d="m5 17 4.5-4.5 3 3L18 9l3 3" /></svg>;
    case "thumb":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" /></svg>;
    case "qr":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>;
    case "link":
      return <svg {...common}><path d="M9 15 15 9" /><path d="M10 7 12.5 4.5a3.5 3.5 0 0 1 5 5L15 12" /><path d="M14 17l-2.5 2.5a3.5 3.5 0 0 1-5-5L9 12" /></svg>;
    case "chevron":
      return <svg {...common} width={14} height={14}><polyline points="6 9 12 15 18 9" /></svg>;
    case "moon":
      return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "close":
      return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    default:
      return null;
  }
}

export default function LandingPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [downloadersOpen, setDownloadersOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [light, setLight] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mSub, setMSub] = useState(null);
  const closeMenu = () => { setMenuOpen(false); setMSub(null); };

  const handleGrab = async (e) => {
    e.preventDefault();
    const link = url.trim();
    if (!link || status === "loading") return;

    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/api/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Something went wrong. Please try again.");
      setResult(data);
      setStatus("done");
    } catch (err) {
      // fetch() itself failing (server down / no internet) throws a TypeError
      setError(err instanceof TypeError ? "Can't reach the server. Please try again in a moment." : err.message);
      setStatus("error");
    }
  };

  const openDownloaders = () => { setDownloadersOpen((v) => !v); setToolsOpen(false); };
  const openTools = () => { setToolsOpen((v) => !v); setDownloadersOpen(false); };

  return (
    <div className={`ss-root${light ? " ss-light" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

        .ss-root {
          --grad-a: #7c3aed;
          --grad-b: #3b82f6;
          --hero-bg: #0b1120;
          --nav-bg: #0c1324;
          --hero-elevated: #121a2e;
          --hero-ink: #ffffff;
          --hero-muted: #aab4c8;
          --hero-line: rgba(255,255,255,0.09);
          --section-bg: #f5f6fb;
          --card-bg: #ffffff;
          --heading: #14172b;
          --muted: #6b7280;
          --line: rgba(15,23,42,0.08);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--section-bg);
          color: var(--heading);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          transition: background 0.25s ease;
        }
        .ss-root.ss-light {
          --hero-bg: #ffffff;
          --nav-bg: #ffffff;
          --hero-elevated: #f3f4f8;
          --hero-ink: #14172b;
          --hero-muted: #5b6272;
          --hero-line: rgba(15,23,42,0.1);
        }
        .ss-root * { box-sizing: border-box; }
        .ss-root h1, .ss-root h2, .ss-root h3 {
          font-family: 'Sora', sans-serif;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .ss-wrap { max-width: 1200px; margin: 0 auto; padding: 0 28px; }
        .ss-grad-text {
          background: linear-gradient(90deg, var(--grad-a), var(--grad-b));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* Nav */
        .ss-nav-outer { background: var(--nav-bg); border-bottom: 1px solid var(--hero-line); position: relative; z-index: 30; }
        .ss-nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; }
        .ss-brand { display: flex; align-items: center; gap: 9px; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1.25rem; color: var(--hero-ink); }
        .ss-brand-mark {
          width: 34px; height: 34px; border-radius: 9px;
          background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800;
        }
        .ss-brand-logo { height: 38px; width: auto; display: block; }
        .ss-brand-save {
          background: linear-gradient(90deg, #27c4ff 0%, #4c6bff 55%, #d23cff 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .ss-phone-logo { height: 64px; width: auto; display: block; }
        .ss-navlinks { display: none; align-items: center; gap: 28px; font-size: 0.95rem; color: var(--hero-muted); }
        @media (min-width: 900px) { .ss-navlinks { display: flex; } }
        .ss-navlink { color: inherit; text-decoration: none; cursor: pointer; background: none; border: none; font: inherit; display: flex; align-items: center; gap: 4px; padding: 6px 0; }
        .ss-navlink:hover { color: var(--hero-ink); }
        .ss-navlink.active { color: var(--grad-b); border-bottom: 2px solid var(--grad-b); }
        .ss-dropdown-wrap { position: relative; }
        .ss-dropdown {
          position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%);
          background: var(--card-bg); border: 1px solid var(--line); border-radius: 10px;
          box-shadow: 0 12px 28px rgba(10,15,30,0.18); min-width: 220px; padding: 8px; z-index: 40;
        }
        .ss-dropdown a {
          display: block; padding: 9px 12px; border-radius: 6px; color: var(--heading);
          text-decoration: none; font-size: 0.9rem;
        }
        .ss-dropdown a:hover { background: var(--section-bg); }
        .ss-nav-right { display: flex; align-items: center; gap: 14px; }
        .ss-theme-btn {
          width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--hero-line);
          background: transparent; color: var(--hero-ink); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .ss-theme-btn:hover { border-color: var(--grad-b); color: var(--grad-b); }

        /* Hero */
        .ss-hero { background: var(--hero-bg); padding: 76px 0 64px; overflow: hidden; }
        .ss-hero-grid { display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center; }
        @media (min-width: 980px) { .ss-hero-grid { grid-template-columns: 1.1fr 0.9fr; } }
        .ss-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--hero-elevated); border: 1px solid var(--hero-line); color: var(--hero-muted);
          padding: 8px 16px; border-radius: 100px; font-size: 0.85rem; margin-bottom: 22px;
        }
        .ss-h1 { font-size: clamp(2.2rem, 4.6vw, 3.3rem); font-weight: 800; line-height: 1.08; color: var(--hero-ink); }
        .ss-sub { margin-top: 20px; font-size: 1.05rem; color: var(--hero-muted); max-width: 52ch; }
        .ss-sub b { color: var(--hero-ink); font-weight: 600; }

        .ss-search { margin-top: 30px; display: flex; gap: 10px; background: var(--card-bg); border-radius: 100px; padding: 6px; max-width: 560px; box-shadow: 0 18px 40px rgba(10,15,30,0.35); }
        .ss-search-icon { display: flex; align-items: center; padding-left: 14px; color: #9aa2b1; }
        .ss-search input {
          flex: 1; border: none; outline: none; background: transparent; font-size: 0.95rem; color: var(--heading); padding: 10px 6px; font-family: inherit;
        }
        .ss-search input::placeholder { color: #9aa2b1; }
        .ss-search button {
          display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; color: #fff;
          font-weight: 700; font-size: 0.92rem; padding: 12px 22px; border-radius: 100px;
          background: linear-gradient(90deg, var(--grad-a), var(--grad-b));
        }
        .ss-search button:hover { filter: brightness(1.06); }
        .ss-search:focus-within { outline: 2px solid var(--grad-b); outline-offset: 3px; }

        @keyframes ss-rise { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes ss-spin { to { transform: rotate(360deg); } }
        .ss-spin { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; animation: ss-spin 0.7s linear infinite; }
        .ss-search button[disabled] { opacity: 0.75; cursor: progress; }

        .ss-error { margin-top: 16px; max-width: 560px; padding: 12px 16px; border-radius: 12px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; font-size: 0.9rem; animation: ss-rise 0.3s ease; }
        .ss-light .ss-error { color: #b91c1c; }

        .ss-result { margin-top: 16px; max-width: 560px; background: var(--hero-elevated); border: 1px solid var(--hero-line); border-radius: 14px; padding: 16px; animation: ss-rise 0.35s ease; }
        .ss-result-top { display: flex; gap: 14px; align-items: flex-start; }
        .ss-result-thumb { width: 72px; height: 96px; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); }
        .ss-result-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ss-result-title { font-size: 0.95rem; font-weight: 600; color: var(--hero-ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .ss-result-meta { font-size: 0.8rem; color: var(--hero-muted); margin-top: 4px; }
        .ss-opts { margin-top: 14px; display: grid; gap: 8px; }
        .ss-opt { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 10px; text-decoration: none; font-size: 0.92rem; font-weight: 600; border: 1px solid var(--hero-line); color: var(--hero-ink); }
        .ss-opt:hover { border-color: var(--grad-b); }
        .ss-opt.primary { border-color: transparent; color: #fff; background: linear-gradient(90deg, var(--grad-a), var(--grad-b)); }
        .ss-opt.primary:hover { filter: brightness(1.06); }
        .ss-opt-left { display: flex; align-items: center; gap: 8px; }
        .ss-opt small { font-weight: 500; opacity: 0.85; font-size: 0.78rem; }

        .ss-supported { margin-top: 26px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .ss-supported-label { font-size: 0.85rem; color: var(--hero-muted); }
        .ss-mini-logos { display: flex; gap: 8px; }
        .ss-mini-logo { width: 30px; height: 30px; border-radius: 8px; background: var(--hero-elevated); border: 1px solid var(--hero-line); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .ss-mini-logo img { width: 18px; height: 18px; object-fit: contain; }
        .ss-more-note { font-size: 0.85rem; color: var(--hero-muted); }

        /* Hero graphic */
        .ss-graphic { position: relative; height: 380px; display: none; }
        @media (min-width: 980px) { .ss-graphic { display: block; } }
        .ss-phone {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: 190px; height: 340px; border-radius: 28px; background: #0f1526;
          border: 6px solid #1c2440; box-shadow: 0 30px 60px rgba(10,10,30,0.4);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
        }
        .ss-phone-mark { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-family: 'Sora', sans-serif; }
        .ss-phone-tag { color: #fff; font-weight: 700; font-family: 'Sora', sans-serif; font-size: 1rem; }
        .ss-phone-sub { color: #8892a8; font-size: 0.75rem; }
        .ss-float { position: absolute; width: 52px; height: 52px; border-radius: 14px; background: var(--card-bg); display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 30px rgba(10,10,30,0.35); }
        .ss-float img { width: 28px; height: 28px; object-fit: contain; }
        .ss-float.p1 { top: 12%; left: 4%; }
        .ss-float.p2 { top: 6%; right: 10%; }
        .ss-float.p3 { bottom: 18%; left: 0%; }
        .ss-float.p4 { bottom: 10%; right: 2%; }
        .ss-float.p5 { top: 42%; right: -4%; }

        /* Feature strip (dark) */
        .ss-features-strip { background: var(--hero-bg); border-top: 1px solid var(--hero-line); padding: 40px 0 52px; }
        .ss-features-row { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 760px) { .ss-features-row { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1100px) { .ss-features-row { grid-template-columns: repeat(5, 1fr); } }
        .ss-feature-item { display: flex; align-items: flex-start; gap: 12px; }
        .ss-feature-icon { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
        .ss-feature-title { font-size: 0.95rem; font-weight: 700; color: var(--hero-ink); }
        .ss-feature-desc { font-size: 0.82rem; color: var(--hero-muted); margin-top: 2px; }

        /* Light sections */
        .ss-section { padding: 72px 0; }
        .ss-eyebrow { text-align: center; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.02em; color: var(--grad-b); margin-bottom: 10px; }
        .ss-h2 { text-align: center; font-size: clamp(1.6rem, 3.2vw, 2.15rem); font-weight: 800; }
        .ss-section-sub { text-align: center; color: var(--muted); margin-top: 10px; max-width: 52ch; margin-left: auto; margin-right: auto; }

        .ss-platform-grid { margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (min-width: 640px) { .ss-platform-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 980px) { .ss-platform-grid { grid-template-columns: repeat(7, 1fr); } }
        .ss-platform-card { background: var(--card-bg); border: 1px solid var(--line); border-radius: 14px; padding: 22px 14px; text-align: center; }
        .ss-platform-logo { width: 44px; height: 44px; border-radius: 12px; background: var(--section-bg); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
        .ss-platform-logo img { width: 24px; height: 24px; object-fit: contain; }
        .ss-platform-name { font-weight: 700; font-size: 0.92rem; }
        .ss-platform-tag { font-size: 0.75rem; color: var(--muted); margin-top: 3px; }
        .ss-platform-card.ss-more { background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.08)); border-style: dashed; }
        .ss-more-plus { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); color: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 1.3rem; font-weight: 700; }

        .ss-tools-grid { margin-top: 40px; display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 640px) { .ss-tools-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 980px) { .ss-tools-grid { grid-template-columns: repeat(6, 1fr); } }
        .ss-tool-card { background: var(--card-bg); border: 1px solid var(--line); border-radius: 14px; padding: 20px 16px; }
        .ss-tool-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 12px; }
        .ss-tool-title { font-weight: 700; font-size: 0.92rem; }
        .ss-tool-desc { font-size: 0.78rem; color: var(--muted); margin-top: 3px; }

        /* Footer */
        .ss-footer { background: var(--hero-bg); border-top: 1px solid var(--hero-line); padding: 44px 0 32px; color: var(--hero-muted); }
        .ss-footer-top { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 24px; padding-bottom: 28px; }
        .ss-footer-tagline { max-width: 30ch; font-size: 0.88rem; margin-top: 10px; }
        .ss-footer-cols { display: flex; gap: 56px; flex-wrap: wrap; }
        .ss-footer-col h4 { font-family: 'Sora', sans-serif; font-size: 0.85rem; color: var(--hero-ink); margin-bottom: 12px; }
        .ss-footer-col a { display: block; color: var(--hero-muted); text-decoration: none; font-size: 0.85rem; margin-bottom: 8px; }
        .ss-footer-col a:hover { color: var(--hero-ink); }
        .ss-footer-bottom { border-top: 1px solid var(--hero-line); padding-top: 20px; font-size: 0.8rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }

        /* ---------- Responsive ---------- */
        .ss-root { overflow-x: hidden; }
        .ss-burger {
          display: none; width: 40px; height: 40px; border-radius: 10px;
          border: 1px solid var(--hero-line); background: transparent; color: var(--hero-ink);
          align-items: center; justify-content: center; cursor: pointer;
        }
        .ss-mobile-menu { display: none; }
        .ss-m-chev { display: flex; transition: transform 0.2s ease; }
        .ss-m-chev.open { transform: rotate(180deg); }

        @media (max-width: 899px) {
          .ss-burger { display: flex; }
          .ss-theme-btn { width: 40px; height: 40px; }
          .ss-mobile-menu {
            display: block; position: absolute; left: 0; right: 0; top: 100%;
            background: var(--nav-bg); border-bottom: 1px solid var(--hero-line);
            box-shadow: 0 18px 32px rgba(5,8,20,0.35);
            padding: 6px 20px 18px; max-height: calc(100vh - 72px); overflow-y: auto;
          }
          .ss-m-link {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; padding: 15px 4px; text-align: left; text-decoration: none;
            background: none; border: none; border-bottom: 1px solid var(--hero-line);
            color: var(--hero-ink); font: inherit; font-size: 1rem; font-weight: 500; cursor: pointer;
          }
          .ss-m-sub { padding: 6px 0 10px 10px; border-bottom: 1px solid var(--hero-line); }
          .ss-m-sub a {
            display: block; padding: 11px 10px; border-radius: 8px;
            color: var(--hero-muted); text-decoration: none; font-size: 0.93rem;
          }
          .ss-m-sub a:hover { background: var(--hero-elevated); color: var(--hero-ink); }
        }

        @media (max-width: 979px) {
          .ss-platform-card.ss-more { grid-column: span 2; }
        }

        @media (max-width: 639px) {
          .ss-wrap { padding: 0 18px; }
          .ss-nav { padding: 14px 0; }
          .ss-brand { font-size: 1.15rem; }
          .ss-brand-logo { height: 34px; }
          .ss-hero { padding: 40px 0 36px; }
          .ss-hero-grid { gap: 28px; }
          .ss-pill { font-size: 0.78rem; padding: 7px 13px; margin-bottom: 18px; }
          .ss-sub { font-size: 0.98rem; }

          .ss-search { flex-wrap: wrap; border-radius: 20px; padding: 8px; gap: 8px; margin-top: 24px; }
          .ss-search-icon { padding-left: 8px; }
          .ss-search input { min-width: 0; padding: 12px 6px; font-size: 16px; }
          .ss-search button { flex: 1 1 100%; justify-content: center; padding: 14px 22px; border-radius: 14px; }

          .ss-result { padding: 14px; }
          .ss-opt { padding: 14px; }
          .ss-supported { gap: 10px; }

          .ss-features-strip { padding: 28px 0 36px; }
          .ss-features-row { gap: 20px; }

          .ss-section { padding: 48px 0; }
          .ss-platform-grid, .ss-tools-grid { margin-top: 28px; gap: 12px; }
          .ss-platform-card { padding: 18px 10px; }
          .ss-tools-grid { grid-template-columns: repeat(2, 1fr); }
          .ss-tool-card { padding: 16px 14px; }

          .ss-footer { padding: 36px 0 24px; }
          .ss-footer-cols { gap: 28px 40px; }
          .ss-footer-bottom { flex-direction: column; }
        }

        @media (prefers-reduced-motion: reduce) { .ss-result, .ss-error { animation: none; } .ss-spin { animation-duration: 2s; } .ss-m-chev { transition: none; } }
      `}</style>

      <div className="ss-nav-outer">
        <div className="ss-wrap">
          <nav className="ss-nav">
            <Brand />

            <div className="ss-navlinks">
              <a className="ss-navlink active" href="#top">Home</a>

              <div className="ss-dropdown-wrap">
                <button className="ss-navlink" onClick={openDownloaders}>
                  Downloaders <Icon name="chevron" />
                </button>
                {downloadersOpen && (
                  <div className="ss-dropdown">
                    {DOWNLOADER_LINKS.map((d) => <a key={d} href="#downloaders">{d}</a>)}
                  </div>
                )}
              </div>

              <div className="ss-dropdown-wrap">
                <button className="ss-navlink" onClick={openTools}>
                  Tools <Icon name="chevron" />
                </button>
                {toolsOpen && (
                  <div className="ss-dropdown">
                    {TOOLS.map((t) => <a key={t.key} href="#tools">{t.title}</a>)}
                  </div>
                )}
              </div>

              <a className="ss-navlink" href="#pricing">Pricing</a>
              <a className="ss-navlink" href="#blog">Blog</a>
            </div>

            <div className="ss-nav-right">
              <button className="ss-theme-btn" onClick={() => setLight((v) => !v)} aria-label="Toggle theme">
                <Icon name={light ? "sun" : "moon"} size={17} />
              </button>
              <button
                className="ss-burger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                <Icon name={menuOpen ? "close" : "menu"} size={20} />
              </button>
            </div>
          </nav>
        </div>

        {menuOpen && (
          <div className="ss-mobile-menu">
            <a className="ss-m-link" href="#top" onClick={closeMenu}>Home</a>

            <button className="ss-m-link" onClick={() => setMSub(mSub === "dl" ? null : "dl")} aria-expanded={mSub === "dl"}>
              Downloaders
              <span className={`ss-m-chev${mSub === "dl" ? " open" : ""}`}><Icon name="chevron" /></span>
            </button>
            {mSub === "dl" && (
              <div className="ss-m-sub">
                {DOWNLOADER_LINKS.map((d) => <a key={d} href="#downloaders" onClick={closeMenu}>{d}</a>)}
              </div>
            )}

            <button className="ss-m-link" onClick={() => setMSub(mSub === "tools" ? null : "tools")} aria-expanded={mSub === "tools"}>
              Tools
              <span className={`ss-m-chev${mSub === "tools" ? " open" : ""}`}><Icon name="chevron" /></span>
            </button>
            {mSub === "tools" && (
              <div className="ss-m-sub">
                {TOOLS.map((t) => <a key={t.key} href="#tools" onClick={closeMenu}>{t.title}</a>)}
              </div>
            )}

            <a className="ss-m-link" href="#pricing" onClick={closeMenu}>Pricing</a>
            <a className="ss-m-link" href="#blog" onClick={closeMenu}>Blog</a>
          </div>
        )}
      </div>

      <header className="ss-hero" id="top">
        <div className="ss-wrap ss-hero-grid">
          <div>
            <span className="ss-pill"><Icon name="bolt" size={14} /> All-in-one social media downloader</span>
            <h1 className="ss-h1">
              Grab Videos, Photos &amp; Audio
              <br />
              <span className="ss-grad-text">From Any Social Platform</span>
            </h1>
            <p className="ss-sub">
              Paste a link from <b>TikTok, Instagram, Facebook, X, YouTube</b> and
              more. Get the original file — video, photo, or audio — in seconds,
              completely free.
            </p>

            <form className="ss-search" onSubmit={handleGrab}>
              <span className="ss-search-icon"><Icon name="link" size={18} /></span>
              <input
                type="text"
                placeholder="Paste your link here…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label="Video link"
              />
              <button type="submit" disabled={status === "loading"}>
                {status === "loading" ? (
                  <><span className="ss-spin" aria-hidden="true" /> Fetching…</>
                ) : (
                  <><Icon name="download" size={16} /> Download</>
                )}
              </button>
            </form>

            {status === "error" && (
              <div className="ss-error" role="alert">{error}</div>
            )}

            {status === "done" && result && (
              <div className="ss-result">
                <div className="ss-result-top">
                  <div className="ss-result-thumb">
                    {result.thumbnail && (
                      <img
                        src={result.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                      />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="ss-result-title">{result.title}</div>
                    <div className="ss-result-meta">
                      {[result.platform, result.uploader, fmtDuration(result.duration)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="ss-opts">
                  {result.options.map((o, i) => (
                    <a
                      key={o.url}
                      className={`ss-opt${i === 0 ? " primary" : ""}`}
                      href={`${API}${o.url}`}
                      rel="noopener"
                    >
                      <span className="ss-opt-left">
                        <Icon name="download" size={16} />
                        Download {o.label}
                      </span>
                      <small>
                        {o.ext.toUpperCase()}
                        {o.size ? ` · ${fmtSize(o.size)}` : ""}
                        {o.watermark ? " · may have watermark" : ""}
                      </small>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="ss-supported">
              <span className="ss-supported-label">Supported platforms:</span>
              <div className="ss-mini-logos">
                {PLATFORMS.map((p) => (
                  <span className="ss-mini-logo" key={p.name}>
                    <img src={logo(p.file)} alt={p.name} />
                  </span>
                ))}
              </div>
              <span className="ss-more-note">… and more</span>
            </div>
          </div>

          <div className="ss-graphic" aria-hidden="true">
            <div className="ss-phone">
              <img className="ss-phone-logo" src={BRAND_ICON} alt="" />
              <div className="ss-phone-tag">SnapSave</div>
              <div className="ss-phone-sub">Save what you love</div>
            </div>
            <div className="ss-float p1"><img src={logo("tiktok")} alt="" /></div>
            <div className="ss-float p2"><img src={logo("instagram")} alt="" /></div>
            <div className="ss-float p3"><img src={logo("x")} alt="" /></div>
            <div className="ss-float p4"><img src={logo("facebook")} alt="" /></div>
            <div className="ss-float p5"><img src={logo("youtube")} alt="" /></div>
          </div>
        </div>
      </header>

      <section className="ss-features-strip">
        <div className="ss-wrap ss-features-row">
          {FEATURES.map((f) => (
            <div className="ss-feature-item" key={f.key}>
              <span className="ss-feature-icon" style={{ background: f.color }}>
                <Icon name={f.key} size={20} />
              </span>
              <div>
                <div className="ss-feature-title">{f.title}</div>
                <div className="ss-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ss-section" id="downloaders">
        <div className="ss-wrap">
          <div className="ss-eyebrow">Supported Platforms</div>
          <h2 className="ss-h2">Download From Your Favorite Platforms</h2>
          <div className="ss-platform-grid">
            {PLATFORMS.map((p) => (
              <div className="ss-platform-card" key={p.name}>
                <div className="ss-platform-logo"><img src={logo(p.file)} alt={p.name} /></div>
                <div className="ss-platform-name">{p.name}</div>
                <div className="ss-platform-tag">{p.tag}</div>
              </div>
            ))}
            <div className="ss-platform-card ss-more">
              <div className="ss-more-plus">+</div>
              <div className="ss-platform-name">More Platforms</div>
              <div className="ss-platform-tag">Snapchat Spotlight and more coming soon…</div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section" id="tools" style={{ paddingTop: 0 }}>
        <div className="ss-wrap">
          <div className="ss-eyebrow">More Useful Tools</div>
          <h2 className="ss-h2">More Than Just Downloading</h2>
          <p className="ss-section-sub">A handful of extra tools for working with the media you save.</p>
          <div className="ss-tools-grid">
            {TOOLS.map((t) => (
              <div className="ss-tool-card" key={t.key}>
                <span className="ss-tool-icon" style={{ background: t.color }}>
                  <Icon name={t.key} size={18} />
                </span>
                <div className="ss-tool-title">{t.title}</div>
                <div className="ss-tool-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="ss-footer">
        <div className="ss-wrap">
          <div className="ss-footer-top">
            <div>
              <Brand />
              <p className="ss-footer-tagline">The fastest way to save videos, photos, and audio from any social platform.</p>
            </div>
            <div className="ss-footer-cols">
              <div className="ss-footer-col">
                <h4>Downloaders</h4>
                {DOWNLOADER_LINKS.slice(0, 4).map((d) => <a key={d} href="#downloaders">{d}</a>)}
              </div>
              <div className="ss-footer-col">
                <h4>Tools</h4>
                {TOOLS.slice(0, 4).map((t) => <a key={t.key} href="#tools">{t.title}</a>)}
              </div>
              <div className="ss-footer-col">
                <h4>Legal</h4>
                <a href="#privacy">Privacy Policy</a>
                <a href="#terms">Terms of Service</a>
                <a href="#contact">Contact</a>
              </div>
            </div>
          </div>
          <div className="ss-footer-bottom">
            <span>© {new Date().getFullYear()} SnapSave. All rights reserved.</span>
            <span>Not affiliated with TikTok, Instagram, Facebook, X, YouTube, or Pinterest.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}