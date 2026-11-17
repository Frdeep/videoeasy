"""Long video -> N vertical shorts: download, transcribe, pick moments, render."""

from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from captions import Word, build_ass

MAX_BYTES = int(os.environ.get("MAX_SOURCE_BYTES", str(800 * 1024 * 1024)))
MAX_DURATION = float(os.environ.get("MAX_SOURCE_SECONDS", "5400"))  # 90 min
ALLOWED_HOSTS = {
    h.strip().lower()
    for h in os.environ.get("ALLOWED_SOURCE_HOSTS", "pchdggpprfnyzmcnpigy.supabase.co").split(",")
    if h.strip()
}
# Hugging Face Storage Buckets: signed gateway URLs redirect to the HF CDN.
ALLOWED_SUFFIXES = (".s3.hf.co", ".hf.co", ".huggingface.co")


def _host_ok(url: str) -> bool:
    p = urlparse(url)
    host = (p.hostname or "").lower()
    return p.scheme == "https" and (host in ALLOWED_HOSTS or host.endswith(ALLOWED_SUFFIXES))


RATIOS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}
HOOKS = re.compile(
    r"\b(secret|personne|jamais|pourquoi|comment|voici|attention|erreur|vrai|incroyable|"
    r"never|nobody|why|how|secret|mistake|truth)\b",
    re.I,
)


@dataclass
class Segment:
    start: float
    end: float
    text: str
    words: list[Word]


@dataclass
class Moment:
    start: float
    end: float
    score: float
    text: str


def download(url: str, dest: Path) -> None:
    """Fetch https URLs on allow-listed hosts only (every redirect hop is
    re-checked), size-capped."""
    import requests

    for _ in range(4):
        if not _host_ok(url):
            raise ValueError("source host not allowed")
        r = requests.get(url, stream=True, timeout=(10, 60), allow_redirects=False)
        if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
            url = requests.compat.urljoin(url, r.headers["location"])
            r.close()
            continue
        break
    else:
        raise ValueError("too many redirects")
    with r:
        if r.status_code != 200:
            raise ValueError(f"source fetch failed: HTTP {r.status_code}")
        total = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise ValueError("source too large")
                f.write(chunk)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    video = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    if not video:
        raise ValueError("no video stream")
    if not any(s.get("codec_type") == "audio" for s in data["streams"]):
        raise ValueError("no audio stream")
    duration = float(data["format"]["duration"])
    if duration > MAX_DURATION:
        raise ValueError("source too long")
    w, h = int(video["width"]), int(video["height"])
    rot = int((video.get("tags") or {}).get("rotate", 0) or 0)
    for sd in video.get("side_data_list") or []:
        rot = int(sd.get("rotation", rot) or rot)
    if abs(rot) in (90, 270):
        w, h = h, w
    return {"duration": duration, "width": w, "height": h}


_model = None


def transcribe(path: Path) -> tuple[list[Segment], str]:
    global _model
    from faster_whisper import WhisperModel

    if _model is None:
        _model = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
    segs, info = _model.transcribe(str(path), word_timestamps=True, vad_filter=True)
    result = []
    for s in segs:
        words = [Word(w.word.strip(), float(w.start), float(w.end)) for w in (s.words or []) if w.word.strip()]
        if words:
            result.append(Segment(float(s.start), float(s.end), s.text.strip(), words))
    return result, info.language


def pick_moments(segments: list[Segment], count: int, target: float) -> list[Moment]:
    """Score windows made of whole sentences and keep the best non-overlapping ones."""
    lo, hi = target * 0.75, target * 1.2
    candidates: list[Moment] = []
    for i, first in enumerate(segments):
        text, nwords, punct = [], 0, 0
        for seg in segments[i:]:
            if seg.end - first.start > hi:
                break
            text.append(seg.text)
            nwords += len(seg.words)
            punct += seg.text.count("?") + seg.text.count("!")
            dur = seg.end - first.start
            if dur >= lo:
                density = nwords / dur  # words per second: lively talking scores higher
                hook = 1.0 if HOOKS.search(first.text) else 0.0
                ends_clean = 0.5 if seg.text.rstrip().endswith((".", "!", "?")) else 0.0
                score = float(density) + 0.6 * min(punct, 3) + hook + ends_clean
                candidates.append(Moment(first.start, seg.end, score, " ".join(text)))
    candidates.sort(key=lambda m: m.score, reverse=True)
    chosen: list[Moment] = []
    for c in candidates:
        if all(c.end <= m.start or c.start >= m.end for m in chosen):
            chosen.append(c)
        if len(chosen) == count:
            break
    return sorted(chosen, key=lambda m: m.start)


def _crop_filter(src_w: int, src_h: int, ratio: str) -> str:
    out_w, out_h = RATIOS[ratio]
    target = out_w / out_h
    if src_w / src_h > target:  # too wide: crop the sides, keep centre
        cw, ch = round(src_h * target) // 2 * 2, src_h
    else:
        cw, ch = src_w, round(src_w / target) // 2 * 2
    return f"crop={cw}:{ch},scale={out_w}:{out_h}:flags=lanczos,setsar=1"


def render(src: Path, meta: dict, moment: Moment, segments: list[Segment], ratio: str,
           caption: str, workdir: Path, index: int) -> Path:
    out_w, out_h = RATIOS[ratio]
    words = [
        Word(w.text, w.start - moment.start, w.end - moment.start)
        for s in segments for w in s.words
        if w.start >= moment.start - 0.05 and w.end <= moment.end + 0.05
    ]
    ass = workdir / f"clip{index}.ass"
    ass.write_text(build_ass(words, caption, out_w, out_h), encoding="utf-8")
    out = workdir / f"clip{index}.mp4"
    vf = f"{_crop_filter(meta['width'], meta['height'], ratio)},subtitles={ass.name}:fontsdir=/app/fonts"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{moment.start:.3f}", "-to", f"{moment.end:.3f}",
         "-i", str(src), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out.name],
        cwd=workdir, check=True,
    )
    return out
