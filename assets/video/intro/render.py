#!/usr/bin/env python3
"""Render the historical Granaderos trailer from recorded game sessions.

Requirements: Python 3, Pillow, NumPy, FFmpeg with libx264 and AAC.
Run: python3 assets/video/intro/render.py
Use --preview for a contact sheet, poster and subtitles without video encoding.
The full render also creates a short silent README GIF and a source audit manifest.

Only the historical illustration moves within the frame. Recorded gameplay keeps
its complete image, native aspect ratio, original timing and ordinary UI.
FFmpeg decodes and composes video; Pillow renders a few static title plates.
Set INTRO_SERIF and INTRO_SANS to installed TrueType font paths if needed.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from score import render_score

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CACHE = ROOT / ".cache/intro-video"
WIDTH, HEIGHT, FPS = 1280, 720, 30
DURATION = 56
HEADER_HEIGHT, FOOTAGE_HEIGHT = 76, 640
CREAM = "#f4ecda"
GOLD = "#ceb077"
MUTED = "#c5c4b5"
INK = "#101917"
ART_PATH = HERE / "source/historical-opening.png"
ART_SOURCE_PATH = HERE / "source/artwork-source.json"
CAPTURE_MANIFEST_PATH = HERE / "source/capture-manifest.json"
OUTPUT = HERE / "granaderos-intro.mp4"
GIF_OUTPUT = HERE / "preview.gif"
GIF_WIDTH, GIF_HEIGHT, GIF_FPS, GIF_COLORS = 640, 360, 6, 96
GIF_EXCERPTS = [{"start": 2, "end": 4, "kind": "historical illustration"},
                {"start": 30, "end": 33, "kind": "recorded game combat"},
                {"start": 43, "end": 46, "kind": "recorded game maneuver"},
                {"start": 52, "end": 54, "kind": "closing title"}]
SCENES = [
    {"start": 0, "end": 7, "key": "opening", "capture": None,
     "eyebrow": "BUENOS AIRES · 1812", "title": "GRANADEROS",
     "caption": "La independencia se conquista."},
    {"start": 7, "end": 15, "key": "recruitment", "capture": "recruitment.mp4",
     "eyebrow": "01 · LA TROPA", "title": "Formá tu escuadra.",
     "caption": "Reclutá combatientes y conocé a tu gente."},
    {"start": 15, "end": 22, "key": "campaign-map", "capture": "campaign-map.mp4",
     "eyebrow": "02 · LA CAMPAÑA", "title": "Elegí tu camino.",
     "caption": "Organizá tus fuerzas en el mapa de campaña."},
    {"start": 22, "end": 29, "key": "preparation", "capture": "preparation.mp4",
     "eyebrow": "03 · EL EQUIPO", "title": "Prepará cada salida.",
     "caption": "Revisá armas y munición."},
    {"start": 29, "end": 41, "key": "battle", "capture": "battle.mp4",
     "eyebrow": "04 · SAN LORENZO · 3 DE FEBRERO DE 1813", "title": "Cada orden cuenta.",
     "caption": "Dirigí a cada soldado en combate por turnos."},
    {"start": 41, "end": 51, "key": "maneuver", "capture": "maneuver.mp4",
     "eyebrow": "05 · EL COMBATE", "title": "Sostené el combate.",
     "caption": "Administrá tus acciones y tu munición."},
    {"start": 51, "end": 56, "key": "outro", "capture": None,
     "eyebrow": "", "title": "GRANADEROS",
     "caption": "La independencia se conquista.\nJugá en tu navegador\nfsodano.github.io/granaderos/\nVersión en desarrollo."},
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


def label(draw, xy, value: str, size: int, color=CREAM, serif=False, anchor="lt"):
    draw.text(xy, value, font=font(size, serif), fill=color, anchor=anchor)


def tracked_label(draw, xy, value: str, size: int, tracking=2.0, color=GOLD):
    face = font(size)
    x, y = xy
    for character in value:
        draw.text((x, y), character, font=face, fill=color, anchor="lt")
        x += draw.textlength(character, font=face) + tracking


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT.resolve()))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def probe(path: Path) -> dict:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path),
    ], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def has_faststart(path: Path) -> bool:
    """Confirm the MP4 index appears before its media data."""
    with path.open("rb") as stream:
        while header := stream.read(8):
            if len(header) != 8:
                return False
            size, kind = struct.unpack(">I4s", header)
            header_size = 8
            if size == 1:
                extended = stream.read(8)
                if len(extended) != 8:
                    return False
                size = struct.unpack(">Q", extended)[0]
                header_size = 16
            if kind == b"moov":
                return True
            if kind == b"mdat" or size < header_size:
                return False
            stream.seek(size - header_size, 1)
    return False


def validate_sources() -> tuple[dict, dict, list[dict]]:
    """Reject missing footage, altered capture hashes and shortened recordings."""
    for path in [ART_PATH, ART_SOURCE_PATH, CAPTURE_MANIFEST_PATH, HERE / "capture.mjs"]:
        if not path.is_file():
            raise SystemExit(f"Required source is missing: {path}")
    captures = json.loads(CAPTURE_MANIFEST_PATH.read_text(encoding="utf-8"))
    artwork = json.loads(ART_SOURCE_PATH.read_text(encoding="utf-8"))
    if captures.get("errors") != []:
        raise SystemExit("Capture manifest must report an empty errors list.")
    revision = captures.get("commit")
    if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", revision):
        raise SystemExit("Capture manifest must identify a complete 40-character Git revision.")
    if captures.get("schema", 1) >= 2:
        build = captures.get("build", {})
        source = build.get("source", "")
        if not re.fullmatch(r"[0-9a-f]{64}", source) or build.get("revision") != revision or build.get("id") != source[:12]:
            raise SystemExit("Capture manifest must bind the recorded game revision to its actual source digest.")
        if captures.get("captureScriptSha256") != sha256(HERE / "capture.mjs"):
            raise SystemExit("Capture script changed after the recorded game session.")
    if not artwork.get("prompt") or not artwork.get("kind"):
        raise SystemExit("Artwork metadata must include its generation prompt and source kind.")
    records = captures.get("clips", [])
    verified = []
    for scene in SCENES:
        if not scene["capture"]:
            continue
        path = HERE / "source" / scene["capture"]
        if not path.is_file():
            raise SystemExit(f"Recorded gameplay is missing: {path}")
        matches = [entry for entry in records if Path(entry.get("path", "")).name == path.name
                   or entry.get("name") in (path.name, path.stem)]
        if len(matches) != 1:
            raise SystemExit(f"Capture manifest must identify {path.name} exactly once.")
        record = matches[0]
        if captures.get("schema", 1) >= 2:
            evidence = record.get("evidence", [])
            hashes = record.get("evidenceSha256", {})
            if not evidence or set(evidence) != set(hashes):
                raise SystemExit(f"Capture evidence must identify every screenshot for {path.name}.")
            for reference in evidence:
                screenshot = ROOT / reference
                if not screenshot.is_file() or sha256(screenshot) != hashes[reference]:
                    raise SystemExit(f"Capture evidence hash does not match {reference}.")
        digest = sha256(path)
        if not record.get("sha256") or record["sha256"] != digest:
            raise SystemExit(f"Capture manifest hash does not match {path.name}.")
        media = probe(path)
        streams = [stream for stream in media["streams"] if stream["codec_type"] == "video"]
        if len(streams) != 1:
            raise SystemExit(f"Expected one recorded video stream in {path.name}.")
        video = streams[0]
        if not math.isclose(video["width"] / video["height"], 16 / 9, abs_tol=0.001):
            raise SystemExit(f"Expected a 16:9 recording in {path.name}.")
        recorded_duration = float(video.get("duration", media["format"]["duration"]))
        required_duration = scene["end"] - scene["start"]
        if recorded_duration < required_duration - 1 / FPS:
            raise SystemExit(f"{path.name} is too short: {recorded_duration:.3f}s; need {required_duration}s.")
        verified.append({"path": relative(path), "sha256": digest,
                         "recording": record, "width": video["width"], "height": video["height"],
                         "native_frame_rate": video["avg_frame_rate"],
                         "native_frames": int(video.get("nb_frames", 0)), "duration_seconds": recorded_duration})
    return captures, artwork, verified


def art_background(progress: float) -> Image.Image:
    art = Image.open(ART_PATH).convert("RGB")
    scale = 1.015 + 0.035 * progress
    art = ImageOps.fit(art, (round(WIDTH * scale), round(HEIGHT * scale)),
                       method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    ox, oy = (art.width - WIDTH) // 2, (art.height - HEIGHT) // 2
    return art.crop((ox, oy, ox + WIDTH, oy + HEIGHT))


def hero_plate(outro: bool = False) -> Image.Image:
    """Transparent, static lettering over the moving historical illustration."""
    x = np.linspace(0, 1, WIDTH)[None, :]
    y = np.linspace(0, 1, HEIGHT)[:, None]
    alpha = np.clip(0.03 + 0.26 * x ** 1.2 + 0.06 * y, 0, 0.65)
    if outro:
        alpha = np.clip(alpha + 0.10, 0, 0.72)
    rgba = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    rgba[:, :, :3] = [10, 17, 18]
    rgba[:, :, 3] = np.round(alpha * 255).astype(np.uint8)
    result = Image.fromarray(rgba)
    draw = ImageDraw.Draw(result)
    left = 738
    if not outro:
        tracked_label(draw, (left + 3, 198), "BUENOS AIRES · 1812", 15, 2.0)
        draw.line((left + 3, 239, left + 79, 239), fill=GOLD, width=2)
        label(draw, (left - 2, 272), "GRANADEROS", 65, serif=True)
        label(draw, (left + 3, 369), "La independencia", 29, serif=True)
        label(draw, (left + 3, 413), "se conquista.", 29, serif=True)
        tracked_label(draw, (left + 3, 568), "ESTRATEGIA Y COMBATE POR TURNOS", 12, 1.4, MUTED)
    else:
        draw.line((left + 3, 198, left + 79, 198), fill=GOLD, width=2)
        label(draw, (left - 2, 234), "GRANADEROS", 65, serif=True)
        label(draw, (left + 3, 337), "La independencia", 27, serif=True)
        label(draw, (left + 3, 376), "se conquista.", 27, serif=True)
        label(draw, (left + 3, 473), "Jugá en tu navegador", 23)
        label(draw, (left + 3, 518), "fsodano.github.io/granaderos/", 20, GOLD)
        tracked_label(draw, (left + 3, 627), "VERSIÓN EN DESARROLLO", 12, 1.5, MUTED)
    return result


def hero(outro: bool = False, progress: float = 0.5) -> Image.Image:
    result = art_background(progress).convert("RGBA")
    result.alpha_composite(hero_plate(outro))
    return result.convert("RGB")


def game_plate(scene: dict) -> Image.Image:
    """A quiet title strip above the recording; no game pixels are covered."""
    result = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    rng = np.random.default_rng(1812)
    noise = rng.integers(-2, 3, size=(HEADER_HEIGHT, WIDTH, 1), dtype=np.int16)
    paper = np.clip(np.array([16, 25, 23], dtype=np.int16) + noise, 0, 255).astype(np.uint8)
    result.paste(Image.fromarray(paper), (0, 0))
    draw = ImageDraw.Draw(result)
    label(draw, (44, 11), scene["eyebrow"], 12, GOLD)
    label(draw, (43, 32), scene["title"], 29, serif=True)
    label(draw, (1236, 44), scene["caption"], 18, MUTED, anchor="rt")
    draw.line((44, 75, 1236, 75), fill=(206, 176, 119, 90), width=1)
    draw.line((71, 718, 1208, 718), fill=(206, 176, 119, 75), width=1)
    return result


def game_still(scene: dict) -> Image.Image:
    path = HERE / "source" / scene["capture"]
    destination = CACHE / f"source-still-{scene['key']}.png"
    elapsed = (scene["end"] - scene["start"]) / 2
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(elapsed),
         "-i", str(path), "-frames:v", "1", str(destination)])
    recorded = Image.open(destination).convert("RGB").resize((1138, FOOTAGE_HEIGHT), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (WIDTH, HEIGHT), INK)
    result.paste(recorded, (71, HEADER_HEIGHT))
    result.alpha_composite(game_plate(scene))
    return result.convert("RGB")


def prepare_plates() -> list[Path]:
    CACHE.mkdir(parents=True, exist_ok=True)
    ImageOps.fit(Image.open(ART_PATH).convert("RGB"), (1920, 1080),
                 method=Image.Resampling.LANCZOS).save(CACHE / "historical-background.png")
    plates = []
    for scene in SCENES:
        plate = hero_plate(scene["key"] == "outro") if not scene["capture"] else game_plate(scene)
        path = CACHE / f"plate-{scene['key']}.png"
        plate.save(path)
        plates.append(path)
    return plates


def write_previews() -> None:
    hero().save(HERE / "poster.jpg", quality=94)
    sheet = Image.new("RGB", (1280, 1440), INK)
    draw = ImageDraw.Draw(sheet)
    for index, scene in enumerate(SCENES):
        still = game_still(scene) if scene["capture"] else hero(scene["key"] == "outro")
        still.save(CACHE / f"scene-{index + 1}.jpg", quality=95)
        x, y = (index % 2) * 640, (index // 2) * 360
        sheet.paste(still.resize((640, 360), Image.Resampling.LANCZOS), (x, y))
    label(draw, (685, 1151), "56 s · 1280 × 720 · 30 fps", 24, GOLD)
    label(draw, (685, 1196), "Ilustración histórica + partida real", 23)
    label(draw, (685, 1238), "Música original", 23, MUTED)
    sheet.save(CACHE / "contact-sheet.jpg", quality=94)


def write_captions() -> None:
    def timestamp(seconds):
        hours, remainder = divmod(seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},000"

    captions = []
    for index, scene in enumerate(SCENES, 1):
        text = "\n".join(value for value in [scene["eyebrow"] if not scene["capture"] or scene["key"] == "battle" else "",
                                                 scene["title"], scene["caption"]] if value)
        captions.append(f"{index}\n{timestamp(scene['start'])} --> {timestamp(scene['end'])}\n{text}\n")
    (HERE / "captions.es.srt").write_text("\n".join(captions), encoding="utf-8")


def encode_segment(scene: dict, plate: Path, index: int) -> Path:
    destination = CACHE / f"segment-{index:02d}-{scene['key']}.mp4"
    seconds = scene["end"] - scene["start"]
    frames = seconds * FPS
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if scene["capture"]:
        command += ["-i", str(HERE / "source" / scene["capture"])]
        # The 16:9 capture scales once and keeps its entire field of view.
        composition = (f"[0:v]setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={frames},"
                       f"scale=1138:{FOOTAGE_HEIGHT}:flags=lanczos,setsar=1,"
                       f"pad={WIDTH}:{HEIGHT}:71:{HEADER_HEIGHT}:color=0x101917[base];")
    else:
        command += ["-i", str(CACHE / "historical-background.png")]
        composition = (f"[0:v]zoompan=z='1.015+0.035*on/{frames}':"
                       "x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':"
                       f"d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},setsar=1[base];")
    command += ["-loop", "1", "-framerate", str(FPS), "-i", str(plate)]
    composition += "[base][1:v]overlay=0:0:format=auto,format=yuv420p"
    # Short dips into ink give each chapter a restrained editorial cut.
    if scene["key"] == "opening":
        composition += f",fade=t=in:st=0:d=0.6,fade=t=out:st={seconds - 0.24}:d=0.24"
    elif scene["key"] == "outro":
        composition += f",fade=t=in:st=0:d=0.24,fade=t=out:st={seconds - 0.65}:d=0.65"
    else:
        composition += f",fade=t=in:st=0:d=0.12,fade=t=out:st={seconds - 0.12}:d=0.12"
    composition += "[video]"
    command += ["-filter_complex", composition, "-map", "[video]", "-an",
                "-frames:v", str(frames), "-r", str(FPS), "-c:v", "libx264",
                "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p",
                "-video_track_timescale", "15360", str(destination)]
    run(command)
    return destination


def encode_video(plates: list[Path]) -> dict:
    segments = []
    for index, (scene, plate) in enumerate(zip(SCENES, plates), 1):
        print(f"Encoding chapter {index}/{len(SCENES)}: {scene['key']}", flush=True)
        segments.append(encode_segment(scene, plate, index))
    playlist = CACHE / "segments.txt"
    # Generated segment names contain no quotes or external paths.
    playlist.write_text("".join(f"file '{path.name}'\n" for path in segments), encoding="utf-8")
    audio = CACHE / "score.wav"
    audio_metadata = render_score(audio, duration=DURATION)
    audio_metadata["sha256"] = sha256(audio)
    print("Encoding the complete trailer and original score", flush=True)
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "concat", "-safe", "1", "-i", str(playlist), "-i", str(audio),
         "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
         "-crf", "20", "-maxrate", "1300k", "-bufsize", "2600k", "-pix_fmt", "yuv420p",
         "-profile:v", "main", "-c:a", "aac", "-b:a", "96k", "-af", "volume=0.7",
         "-frames:v", str(DURATION * FPS), "-t", str(DURATION), "-movflags", "+faststart",
         "-metadata", "title=Granaderos — La independencia se conquista",
         "-metadata", "comment=Partida real. Ilustración histórica creada con IA. Música original. Versión en desarrollo.",
         str(OUTPUT)])
    if OUTPUT.stat().st_size > 10 * 1024 * 1024:
        raise SystemExit("Video exceeds the 10 MiB attachment budget. Inspect quality before reducing the bitrate.")
    if not has_faststart(OUTPUT):
        raise SystemExit("Encoded MP4 does not have its index before the media data.")
    result = probe(OUTPUT)
    video = next(stream for stream in result["streams"] if stream["codec_type"] == "video")
    audio_stream = next(stream for stream in result["streams"] if stream["codec_type"] == "audio")
    if int(video.get("nb_frames", 0)) != DURATION * FPS:
        raise SystemExit("Encoded frame count does not match the 56-second timeline.")
    if (video["width"], video["height"], video["r_frame_rate"], video["codec_name"], audio_stream["codec_name"]) != (
            WIDTH, HEIGHT, "30/1", "h264", "aac"):
        raise SystemExit("Encoded video does not match the required delivery format.")
    audio_metadata["path"] = relative(audio)
    return {"audio": audio_metadata, "video": video, "format": result["format"]}


def encode_readme_preview() -> dict:
    """Extract ordinary-speed moments from the finished video for GitHub Markdown."""
    graph = "[0:v]split=4[opener][combat][maneuver][closing];"
    for index, (name, excerpt) in enumerate(zip(["opener", "combat", "maneuver", "closing"], GIF_EXCERPTS)):
        graph += (f"[{name}]trim=start={excerpt['start']}:end={excerpt['end']},"
                  f"setpts=PTS-STARTPTS[clip{index}];")
    graph += (f"[clip0][clip1][clip2][clip3]concat=n=4:v=1:a=0,fps={GIF_FPS},"
              f"scale={GIF_WIDTH}:{GIF_HEIGHT}:flags=lanczos,split[frames][palette_source];"
              f"[palette_source]palettegen=max_colors={GIF_COLORS}:stats_mode=diff[palette];"
              "[frames][palette]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[gif]")
    print("Creating the short animated README preview", flush=True)
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(OUTPUT),
         "-filter_complex", graph, "-map", "[gif]", "-an", "-loop", "0",
         "-gifflags", "+transdiff", str(GIF_OUTPUT)])
    return readme_preview_metadata()


def readme_preview_metadata() -> dict:
    """Validate and describe the generated animated excerpt."""
    media = probe(GIF_OUTPUT)
    video = next(stream for stream in media["streams"] if stream["codec_type"] == "video")
    duration = float(media["format"]["duration"])
    if (video["width"], video["height"]) != (GIF_WIDTH, GIF_HEIGHT) or not math.isclose(duration, 10, abs_tol=0.05):
        raise SystemExit("Animated README excerpt does not match its expected size or duration.")
    if GIF_OUTPUT.stat().st_size > 4 * 1024 * 1024:
        raise SystemExit("Animated README preview exceeds 4 MiB. Review its palette before reducing quality.")
    return {"path": relative(GIF_OUTPUT), "sha256": sha256(GIF_OUTPUT), "bytes": GIF_OUTPUT.stat().st_size,
            "kind": "Silent animated excerpt taken from the final trailer; not the full video.",
            "duration_seconds": duration, "resolution": [video["width"], video["height"]], "fps": GIF_FPS,
            "colors": GIF_COLORS, "loop": "continuous", "playback_speed": "original",
            "source_video_sha256": sha256(OUTPUT), "excerpts": GIF_EXCERPTS}


def write_metadata(captures: dict, artwork: dict, verified: list[dict], encoded: dict) -> None:
    paths = [ART_PATH, ART_SOURCE_PATH, CAPTURE_MANIFEST_PATH,
             *(HERE / "source" / scene["capture"] for scene in SCENES if scene["capture"]),
             HERE / "capture.mjs", HERE / "render.py", HERE / "score.py"]
    manifest = {
        "title": "Granaderos — La independencia se conquista", "language": "es-AR",
        "duration_seconds": DURATION, "resolution": [WIDTH, HEIGHT], "fps": FPS,
        "rendered_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "capture_date": captures.get("date"), "captured_revision": captures.get("commit"),
        "captured_source_sha256": captures.get("build", {}).get("source"),
        "capture_origin": captures.get("origin"),
        "visuals": {
            "opening_and_closing": "AI-generated historical illustration; an artistic interpretation, not archival footage or gameplay.",
            "middle_chapters": "Real-time recordings of the actual game UI and ordinary game actions. No reconstructed gameplay.",
            "editing": "Full 16:9 recordings fitted beneath a title strip. Original action timing. No moving crops, UI zooms or simulated effects.",
            "artwork_source": artwork,
            "artwork_prompt_sha256": hashlib.sha256(artwork["prompt"].encode("utf-8")).hexdigest(),
            "capture_manifest": captures,
            "verified_clips": verified,
        },
        "audio": encoded["audio"],
        "fonts": {"serif": Path(SERIF).name, "sans": Path(SANS).name,
                  "license_note": "Operating-system fonts used for rasterized titles; font files are not redistributed."},
        "inputs": [{"path": relative(path), "sha256": sha256(path)} for path in paths],
        "scenes": SCENES,
        "output": {"path": relative(OUTPUT), "sha256": sha256(OUTPUT), "bytes": OUTPUT.stat().st_size,
                   "video_codec": encoded["video"]["codec_name"], "audio_codec": "aac",
                   "pixel_format": encoded["video"]["pix_fmt"], "frames": int(encoded["video"]["nb_frames"]),
                   "duration_seconds": float(encoded["format"]["duration"]), "faststart": True},
        "poster": {"path": relative(HERE / "poster.jpg"), "sha256": sha256(HERE / "poster.jpg")},
        "captions": {"path": relative(HERE / "captions.es.srt"), "sha256": sha256(HERE / "captions.es.srt")},
        "readme_preview": encoded["readme_preview"],
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("FFmpeg and FFprobe are required.")
    captures, artwork, verified = validate_sources()
    plates = prepare_plates()
    write_previews()
    write_captions()
    print(f"Preview: {CACHE / 'contact-sheet.jpg'}", flush=True)
    if args.preview:
        return
    encoded = encode_video(plates)
    encoded["readme_preview"] = encode_readme_preview()
    write_metadata(captures, artwork, verified, encoded)
    print(f"Saved {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)", flush=True)


if __name__ == "__main__":
    main()
