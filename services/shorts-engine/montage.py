"""Montage: assemble generated clips (trim, reframe, cut or crossfade, optional text)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from captions import build_title_ass
from pipeline import download

SIZES = {"9:16": (720, 1280), "1:1": (720, 720), "16:9": (1280, 720)}
FADE = 0.5
MAX_TOTAL = 180.0


def _info(path: Path) -> tuple[float, bool]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    if not any(s.get("codec_type") == "video" for s in data["streams"]):
        raise ValueError("no video stream")
    has_audio = any(s.get("codec_type") == "audio" for s in data["streams"])
    return float(data["format"]["duration"]), has_audio


def _normalize(src: Path, start: float, end: float, ratio: str, out: Path) -> float:
    dur, has_audio = _info(src)
    start = max(0.0, min(start, dur - 0.5))
    end = min(dur, end) if end > start else dur
    length = round(end - start, 3)
    if length < 0.5:
        raise ValueError("clip too short")
    w, h = SIZES[ratio]
    vf = (f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
          "setsar=1,fps=30,format=yuv420p")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", str(src)]
    if not has_audio:
        cmd += ["-f", "lavfi", "-t", f"{length:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
    cmd += ["-vf", vf, "-af", "aresample=48000,aformat=channel_layouts=stereo",
            "-map", "0:v:0", "-map", "1:a:0" if not has_audio else "0:a:0",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-b:a", "160k", "-shortest", str(out)]
    subprocess.run(cmd, check=True)
    return _info(out)[0]


def render_montage(clips: list[dict], ratio: str, text: str, transition: str, workdir: Path) -> Path:
    parts, durs = [], []
    for i, c in enumerate(clips):
        src = workdir / f"src{i}"
        download(c["url"], src)
        part = workdir / f"part{i}.mp4"
        durs.append(_normalize(src, float(c.get("start", 0)), float(c.get("end", 0)), ratio, part))
        parts.append(part)
        src.unlink(missing_ok=True)
    fade = transition == "fade" and len(parts) > 1 and min(durs) > FADE * 2
    total = sum(durs) - (FADE * (len(parts) - 1) if fade else 0)
    if total > MAX_TOTAL:
        raise ValueError("montage too long")

    inputs = []
    for p in parts:
        inputs += ["-i", p.name]
    n = len(parts)
    if fade:
        chain, offset, v_prev, a_prev = [], 0.0, "[0:v]", "[0:a]"
        for i in range(1, n):
            offset += durs[i - 1] - FADE
            chain.append(f"{v_prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={offset:.3f}[v{i}]")
            chain.append(f"{a_prev}[{i}:a]acrossfade=d={FADE}[a{i}]")
            v_prev, a_prev = f"[v{i}]", f"[a{i}]"
        graph, vout, aout = ";".join(chain), v_prev, a_prev
    else:
        graph = "".join(f"[{i}:v][{i}:a]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]"
        vout, aout = "[vc]", "[ac]"
    if text.strip():
        w, h = SIZES[ratio]
        (workdir / "title.ass").write_text(build_title_ass(text, total, w, h), encoding="utf-8")
        graph += f";{vout}subtitles=title.ass:fontsdir=/app/fonts[vt]"
        vout = "[vt]"
    out = workdir / "montage.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph,
         "-map", vout, "-map", aout, "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out.name],
        cwd=workdir, check=True,
    )
    return out
