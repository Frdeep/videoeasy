"""ASS subtitle generation for the five VideoEasy caption styles.

Words are grouped by 3 (or less on a pause) and placed inside the TikTok safe
zone: x 160->920, y 160->1420 on a 1080x1920 canvas (scaled for other ratios).
"""

from __future__ import annotations

from dataclasses import dataclass

YELLOW = "&H0000C8FF&"  # ASS colours are &HBBGGRR
STYLES = {"karaoke", "bold", "box", "pop", "minimal"}
NO_CAPTIONS = "none"  # accepted by the API: reframed clips with no burned-in text


@dataclass
class Word:
    text: str
    start: float
    end: float


def _ts(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _esc(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")").strip()


def group_words(words: list[Word], size: int = 3, gap: float = 0.6) -> list[list[Word]]:
    groups: list[list[Word]] = []
    cur: list[Word] = []
    for w in words:
        if cur and (len(cur) >= size or w.start - cur[-1].end > gap):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    return groups


# Look of each style. Sizes are for a 1080-wide vertical frame, scaled to
# the output; fonts are bundled in /app/fonts (OFL).
LOOK = {
    "karaoke": {"font": "Poppins Black", "size": 150, "upper": True, "outline": 15, "shadow": 5},
    "bold": {"font": "Anton", "size": 236, "upper": True, "outline": 13, "shadow": 5},
    "box": {"font": "Poppins ExtraBold", "size": 122, "upper": False, "outline": 28, "shadow": 0},
    "pop": {"font": "Poppins Black", "size": 172, "upper": False, "outline": 14, "shadow": 5},
    "minimal": {"font": "Inclusive Sans", "size": 98, "upper": False, "outline": 0, "shadow": 3},
}
WHITE, BLACK, INK = "&H00FFFFFF&", "&H00000000&", "&H00141414&"
POP_IN = "{\\fscx82\\fscy82\\t(0,90,\\fscx106\\fscy106)\\t(90,160,\\fscx100\\fscy100)}"


def caption_groups(words: list[Word], style: str) -> list[list[Word]]:
    """Short groups read faster on mobile: 2 words for the big styles, 3 otherwise;
    a pause or a sentence end always starts a new group."""
    size = 2 if style in ("bold", "pop") else 3
    groups: list[list[Word]] = []
    cur: list[Word] = []
    for w in words:
        if cur and (len(cur) >= size or w.start - cur[-1].end > 0.45
                    or cur[-1].text.rstrip().endswith((".", "!", "?", ","))):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    return groups


def cues(words: list[Word], style: str) -> list[dict]:
    """Caption data for the editor: one cue per group, with word timings."""
    out = []
    for g in caption_groups(words, style):
        out.append({
            "start": round(g[0].start, 3),
            "end": round(g[-1].end, 3),
            "text": " ".join(w.text for w in g),
            "words": [{"text": w.text, "start": round(w.start, 3), "end": round(w.end, 3)} for w in g],
        })
    return out


def build_ass(words: list[Word], style: str, width: int, height: int) -> str:
    if style not in STYLES:
        raise ValueError(f"unknown caption style: {style}")
    look = LOOK[style]
    k = width / 1080
    portrait = height >= width
    fs = round(look["size"] * k * (1 if portrait else 0.8))
    margin_lr = round(110 * k)
    # Keep the block inside the TikTok safe zone (y 160→1420 on 1920).
    margin_v = round(height * (0.29 if portrait else 0.12))
    if style == "box":
        primary, outline_c, back, border = INK, "&H0000C8FF", "&H0000C8FF", 3
    else:
        primary, outline_c, back, border = WHITE, BLACK.rstrip("&"), "&H96000000", 1
    bold = 0 if style == "minimal" else -1
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Cap,{look['font']},{fs},{primary.rstrip('&')},{primary.rstrip('&')},{outline_c},{back},"
        f"{bold},0,0,0,100,100,{1 if style != 'bold' else 2},0,{border},{round(look['outline'] * k)},"
        f"{round(look['shadow'] * k)},2,{margin_lr},{margin_lr},{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines: list[str] = []
    for gi, g in enumerate(caption_groups(words, style)):
        texts = [_esc(w.text.upper() if look["upper"] else w.text) for w in g]
        g_end = g[-1].end + 0.08
        if style == "karaoke":
            # The spoken word turns yellow and grows; the group pops in once.
            for i, w in enumerate(g):
                end = g[i + 1].start if i + 1 < len(g) else g_end
                parts = [
                    f"{{\\c{YELLOW}\\fscx112\\fscy112}}{t}{{\\r}}" if j == i else t
                    for j, t in enumerate(texts)
                ]
                lead = POP_IN if i == 0 else ""
                lines.append(f"Dialogue: 0,{_ts(w.start)},{_ts(end)},Cap,,0,0,0,,{lead}{' '.join(parts)}")
        elif style == "pop":
            # Words appear one by one; the newest one is yellow and bounces.
            for i, w in enumerate(g):
                end = g[i + 1].start if i + 1 < len(g) else g_end
                shown = [
                    (f"{{\\c{YELLOW}\\fscx75\\fscy75\\t(0,110,\\fscx108\\fscy108)\\t(110,180,\\fscx100\\fscy100)}}{t}{{\\r}}"
                     if j == i else t)
                    for j, t in enumerate(texts[: i + 1])
                ]
                lines.append(f"Dialogue: 0,{_ts(w.start)},{_ts(end)},Cap,,0,0,0,,{' '.join(shown)}")
        elif style == "bold":
            # One punchy block per group; every third block is yellow.
            color = f"{{\\c{YELLOW}}}" if gi % 3 == 2 else ""
            lines.append(f"Dialogue: 0,{_ts(g[0].start)},{_ts(g_end)},Cap,,0,0,0,,{POP_IN}{color}{' '.join(texts)}")
        elif style == "box":
            lines.append(f"Dialogue: 0,{_ts(g[0].start)},{_ts(g_end)},Cap,,0,0,0,,{POP_IN}{' '.join(texts)}")
        else:  # minimal
            lines.append(f"Dialogue: 0,{_ts(g[0].start)},{_ts(g_end)},Cap,,0,0,0,,{{\\fad(120,80)}}{' '.join(texts)}")
    return header + "\n".join(lines) + "\n"


def build_title_ass(text: str, duration: float, width: int, height: int) -> str:
    """One boxed caption shown for the whole montage, in the lower safe zone."""
    s = min(width, height) / 1080
    fs = round(64 * s) if height >= width else round(56 * s)
    margin_lr = round(width * 0.12)
    margin_v = round(height * (0.24 if height > width else 0.1))
    safe = _esc(" ".join(text.split()))[:200]
    return (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 0\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: T,Inclusive Sans,{fs},&H00000000,&H00000000,&H0000C8FF,&H0000C8FF,"
        f"0,0,0,0,100,100,0,0,3,{round(16 * s)},0,2,{margin_lr},{margin_lr},{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        f"Dialogue: 0,{_ts(0)},{_ts(duration)},T,,0,0,0,,{{\\fad(250,250)}}{safe}\n"
    )
