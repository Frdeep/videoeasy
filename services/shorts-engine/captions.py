"""ASS subtitle generation for the five VideoEasy caption styles.

Words are grouped by 3 (or less on a pause) and placed inside the TikTok safe
zone: x 160->920, y 160->1420 on a 1080x1920 canvas (scaled for other ratios).
"""

from __future__ import annotations

from dataclasses import dataclass

YELLOW = "&H0000E5FF&"  # ASS colours are &HBBGGRR
STYLES = {"karaoke", "bold", "box", "pop", "minimal"}


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


def build_ass(words: list[Word], style: str, width: int, height: int) -> str:
    if style not in STYLES:
        raise ValueError(f"unknown caption style: {style}")
    sx, sy = width / 1080, height / 1920
    if width > height:  # landscape: the safe zone is the lower third
        sy = height / 1080 * 0.6
    margin_lr = round(160 * sx)
    # Bottom of the caption block sits ~y=1350 on 1920 → MarginV ≈ 570.
    margin_v = round(570 * sy) if width <= height else round(height * 0.12)
    base = round(78 * min(sx, height / 1920 if width <= height else height / 1080))
    fs = {"karaoke": base, "bold": round(base * 1.1), "box": base,
          "pop": round(base * 1.05), "minimal": round(base * 0.7)}[style]
    border_style, outline, shadow = (3, 14, 0) if style == "box" else (1, 5, 2)
    if style == "minimal":
        outline, shadow = 2, 1
    back = "&H99000000" if style == "box" else "&H80000000"
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 0\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Cap,Inclusive Sans,{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,{back},"
        f"{-1 if style != 'minimal' else 0},0,0,0,100,100,0,0,{border_style},{outline},"
        f"{shadow},2,{margin_lr},{margin_lr},{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines: list[str] = []
    upper = style in {"bold", "pop"}
    for g in group_words(words):
        texts = [_esc(w.text.upper() if upper else w.text) for w in g]
        if style in {"karaoke", "pop"}:
            for i, w in enumerate(g):
                end = g[i + 1].start if i + 1 < len(g) else w.end
                parts = []
                for j, t in enumerate(texts):
                    if j == i:
                        tag = f"{{\\c{YELLOW}" + ("\\fscx115\\fscy115" if style == "pop" else "") + "}"
                        parts.append(f"{tag}{t}{{\\r}}")
                    else:
                        parts.append(t)
                lines.append(f"Dialogue: 0,{_ts(w.start)},{_ts(end)},Cap,,0,0,0,,{' '.join(parts)}")
        else:
            lines.append(f"Dialogue: 0,{_ts(g[0].start)},{_ts(g[-1].end)},Cap,,0,0,0,,{' '.join(texts)}")
    return header + "\n".join(lines) + "\n"
