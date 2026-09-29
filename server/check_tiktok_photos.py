import json
import yt_dlp
from yt_dlp.extractor.tiktok import TikTokIE

URL = "https://www.tiktok.com/@aura4k77/photo/7682784536337435925"
URL = URL.replace("/photo/", "/video/")

ydl = yt_dlp.YoutubeDL({"quiet": True})
ie = TikTokIE(ydl)
video_id = ie._match_id(URL)
video_data, status = ie._extract_web_data_and_status(URL, video_id)

print("statusCode:", status)
print("video_data keys:", list(video_data.keys()))
print()
images = (video_data.get("imagePost") or {}).get("images")
print("images found:", len(images) if images else 0)
if images:
    print(json.dumps(images[0], indent=2)[:1000])