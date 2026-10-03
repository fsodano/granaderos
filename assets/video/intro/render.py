#!/usr/bin/env python3
"""Render the Spanish introduction from current game captures and original music.

Requirements: Python 3, Pillow, NumPy, FFmpeg with libx264 and AAC.
Run from any directory: python3 assets/video/intro/render.py
Use --preview to render a contact sheet without encoding the video.
Fonts are supplied by the operating system, not redistributed. Set INTRO_SERIF
and INTRO_SANS to TrueType font paths to override the installed font choices.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from score import render_score

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CACHE = ROOT / ".cache/intro-video"
WIDTH, HEIGHT, FPS = 1280, 720, 30
DURATION = 45
CREAM = "#f5efdb"
GOLD = "#c7aa6c"
MUTED = "#c4cdc4"
SCENES = [
    (0, 6, None, "GRANADEROS", "Estrategia y combate por turnos\nen la independencia argentina."),
    (6, 11, "recruitment.jpg", "Formá tu tropa", "Reclutá combatientes y elegí sus contratos."),
    (11, 16, "profile.jpg", "Conocé a cada combatiente", "Atributos, especialidades y equipo propio."),
    (16, 22, "map.jpg", "Sostené la campaña", "Organizá escuadras y decidí tu próximo destino."),
    (22, 29, "battle.jpg", "Cada decisión cuenta", "Dirigí a cada soldado en combates por turnos."),
    (29, 35, "equipment.jpg", "Prepará tu equipo", "Administrá armas, suministros y munición."),
    (35, 40, "errands.jpg", "Creá nuevas historias", "Editá personajes, reglas y encargos."),
    (40, 45, None, "La campaña te espera.", "Jugá en tu navegador\nfsodano.github.io/granaderos"),
]


def find_font(env: str, candidates: list[str]) -> str:
    for value in [os.environ.get(env), *candidates]:
        if value and Path(value).is_file():
            return value
    raise SystemExit(f"No installed font found. Set {env} to a TrueType font path.")


SERIF = find_font("INTRO_SERIF", [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
])
SANS = find_font("INTRO_SANS", [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
])


def font(size: int, serif: bool = False):
    return ImageFont.truetype(SERIF if serif else SANS, size)


def label(draw, xy, text, size, color=CREAM, serif=False):
    for line_number, line in enumerate(text.splitlines()):
        draw.text((xy[0], xy[1] + line_number * (size + 12)), line,
                  font=font(size, serif), fill=color, anchor="lt")


def background() -> Image.Image:
    y, x = np.mgrid[:HEIGHT, :WIDTH]
    glow = np.exp(-((x - 530) ** 2 / 560000 + (y - 200) ** 2 / 250000))
    pixels = np.stack([13 + 10 * glow, 24 + 11 * glow, 23 + 8 * glow], axis=-1)
    return Image.fromarray(pixels.astype(np.uint8))


ART_PATH = ROOT / "web/public/art/san-lorenzo.webp"
ART = Image.open(ART_PATH).convert("RGB")
BG = background()


def hero(index: int, progress: float) -> Image.Image:
    # Slow movement is restricted to artwork; the UI captures remain legible.
    scale = 1.0 + 0.025 * progress
    art = ImageOps.fit(ART, (round(WIDTH * scale), round(HEIGHT * scale)),
                       method=Image.Resampling.LANCZOS, centering=(0.5, 0.6))
    ox, oy = (art.width - WIDTH) // 2, (art.height - HEIGHT) // 2
    result = art.crop((ox, oy, ox + WIDTH, oy + HEIGHT)).convert("RGBA")
    x = np.linspace(0, 1, WIDTH)[None, :]
    y = np.linspace(0, 1, HEIGHT)[:, None]
    alpha = np.clip(0.14 + 0.64 * x ** 0.75 + 0.13 * y, 0, 0.9)
    veil = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    veil[:, :, :3] = [6, 17, 17]
    veil[:, :, 3] = (alpha * 255).astype(np.uint8)
    result.alpha_composite(Image.fromarray(veil))
    draw = ImageDraw.Draw(result)
    x0 = 567
    draw.line((x0, 215, x0 + 70, 215), fill=GOLD, width=2)
    label(draw, (x0, 168), "INDEPENDENCIA ARGENTINA", 18, GOLD)
    if index == 0:
        label(draw, (x0 - 3, 257), "GRANADEROS", 68, serif=True)
        label(draw, (x0, 359), SCENES[index][4], 26)
        label(draw, (x0, 487), "Formá tu tropa. Decidí su destino.", 22, MUTED)
    else:
        label(draw, (x0, 265), "La campaña", 57, serif=True)
        label(draw, (x0, 337), "te espera.", 57, serif=True)
        label(draw, (x0, 444), "Jugá en tu navegador", 26)
        label(draw, (x0, 490), "fsodano.github.io/granaderos", 23, GOLD)
    label(draw, (x0, 653), "VERSIÓN EN DESARROLLO", 16, MUTED)
    draw.line((48, 684, 1232, 684), fill=(199, 170, 108, 85), width=1)
    return result.convert("RGB")


def card(index: int) -> Image.Image:
    result = BG.copy()
    draw = ImageDraw.Draw(result)
    _, _, source, title, subtitle = SCENES[index]
    label(draw, (48, 18), title, 39, serif=True)
    label(draw, (49, 69), subtitle, 23, MUTED)
    label(draw, (1132, 31), f"0{index} / 06", 18, GOLD)
    shot = Image.open(HERE / "source" / source).convert("RGB")
    if shot.size != (WIDTH, HEIGHT):
        raise ValueError(f"Unexpected capture size for {source}: {shot.size}")
    shot = shot.resize((1056, 594), Image.Resampling.LANCZOS)
    draw.rectangle((109, 105, 1170, 702), outline=GOLD, width=1)
    result.paste(shot, (112, 108))
    return result


CARDS = {i: card(i) for i in range(1, 7)}


def scene(index: int, progress: float) -> Image.Image:
    return hero(index, progress) if index in (0, 7) else CARDS[index]


def frame(t: float) -> Image.Image:
    index = next(i for i, s in enumerate(SCENES) if s[0] <= t < s[1])
    start, end = SCENES[index][:2]
    result = scene(index, (t - start) / (end - start))
    transition = 0.6
    if index and t - start < transition:
        factor = (t - start) / transition
        factor = factor * factor * (3 - 2 * factor)
        result = Image.blend(scene(index - 1, 1), result, factor)
    return result


def write_metadata():
    def timestamp(seconds):
        return f"00:00:{seconds:02d},000"

    captions = []
    for i, (start, end, _, title, subtitle) in enumerate(SCENES, 1):
        captions.append(f"{i}\n{timestamp(start)} --> {timestamp(end)}\n{title}\n{subtitle}\n")
    (HERE / "captions.es.srt").write_text("\n".join(captions), encoding="utf-8")
    paths = [ART_PATH, *(HERE / "source" / row[2] for row in SCENES if row[2])]
    manifest = {
        "title": "Granaderos — Presentación", "language": "es-AR", "duration_seconds": DURATION,
        "resolution": [WIDTH, HEIGHT], "fps": FPS, "captured_revision": "b987d63140019b550f05dad2e5cbfdd37accef79",
        "capture_date": "2026-10-03", "capture_origin": "http://localhost:3141",
        "visuals": "Capturas reales del juego y del editor; ilustración existente de San Lorenzo.",
        "audio": "Música original sintetizada por score.py; sin muestras ni grabaciones externas.",
        "fonts": {"serif": Path(SERIF).name, "sans": Path(SANS).name},
        "inputs": [{"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],
        "scenes": [{"start": row[0], "end": row[1], "capture": row[2], "title": row[3], "caption": row[4]} for row in SCENES],
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    hero(0, 0.5).save(HERE / "poster.jpg", quality=93)
    sheet = Image.new("RGB", (1280, 1440))
    for i, (start, end, *_) in enumerate(SCENES):
        still = frame((start + end) / 2)
        still.save(CACHE / f"scene-{i + 1}.jpg", quality=94)
        sheet.paste(still.resize((640, 360), Image.Resampling.LANCZOS), ((i % 2) * 640, (i // 2) * 360))
    sheet.save(CACHE / "contact-sheet.jpg", quality=93)
    write_metadata()
    if args.preview:
        return
    executable = shutil.which("ffmpeg")
    if not executable:
        raise SystemExit("FFmpeg is required to encode the video.")
    audio = CACHE / "score.wav"
    render_score(audio, duration=DURATION)
    output = HERE / "granaderos-intro.mp4"
    command = [executable, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
               "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0",
               "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264",
               "-preset", "medium", "-crf", "22", "-maxrate", "1600k", "-bufsize", "3200k",
               "-pix_fmt", "yuv420p", "-profile:v", "main", "-c:a", "aac", "-b:a", "96k",
               "-af", "volume=0.55", "-movflags", "+faststart", "-t", str(DURATION),
               "-metadata", "title=Granaderos — Presentación", "-metadata", "comment=Capturas del juego. Música original. Versión en desarrollo.", str(output)]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
        try:
            for number in range(FPS * DURATION):
                process.stdin.write(frame(number / FPS).tobytes())
                if number % (FPS * 5) == 0:
                    print(f"Rendered {number // FPS}/{DURATION} seconds", flush=True)
        finally:
            process.stdin.close()
        if process.wait() != 0:
            raise SystemExit("FFmpeg failed to encode the video.")
    if output.stat().st_size > 10 * 1024 * 1024:
        raise SystemExit("Video exceeds the 10 MiB attachment budget.")
    print(f"Saved {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
