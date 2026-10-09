#!/usr/bin/env python3
"""Make labeled review grids from render-review.py PNGs (requires Pillow).

python3 tools/characters-3d/review-contact-sheets.py
python3 tools/characters-3d/review-contact-sheets.py /tmp/probe-review/index.json

Images are existing, hashed render artifacts, never pose illustrations. The
source index is read-only; sheet-index.json records every input and output hash.
"""
import argparse
import hashlib
import html
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / 'artifacts/character-anatomy-review/baseline/index.json'
OVERVIEW = [
    'stand.idle.unarmed', 'stand.walk.unarmed', 'stand.run.unarmed',
    'stand.fire.short-gun', 'stand.fire.long-gun',
    'stand.slash.knife.thrust', 'stand.slash.blade.forehand',
    'stand.slash.blade.backhand', 'stand.punch.unarmed',
    'crouch.idle.unarmed', 'prone.idle.unarmed',
    'stand.reload.long-gun.1800', 'mounted.run.blade',
    'mounted.fire.short-gun', 'life.stand.die', 'life.stand.collapse',
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('index', nargs='?', type=Path, default=DEFAULT)
    parser.add_argument('--presets', nargs='+')
    args = parser.parse_args()
    index = args.index.resolve()
    source = json.loads(index.read_text())
    directory = index.parent / 'sheets'
    directory.mkdir(exist_ok=True)
    font_path = next((path for path in [Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
        Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if path.exists()), None)
    font_at = lambda size: ImageFont.truetype(str(font_path), size) if font_path else ImageFont.load_default(size=size)
    font, small, title_font = font_at(16), font_at(13), font_at(22)
    outputs = []

    def grid(preset, name, frames, columns, tile):
        caption = 52
        header = 72
        rows = math.ceil(len(frames) / columns)
        canvas = Image.new('RGB', (columns * tile, header + rows * (tile + caption)), '#202622')
        used, labels = [], []
        for i, frame in enumerate(frames):
            if frame is None:
                continue
            path = index.parent / frame['file']
            actual = digest(path)
            if actual != frame['sha256']:
                raise ValueError('Saved frame changed since render: ' + str(path))
            image = Image.open(path).convert('RGB')
            image.thumbnail((tile, tile), Image.Resampling.LANCZOS)
            x = i % columns * tile
            y = header + i // columns * (tile + caption)
            canvas.paste(image, (x + (tile - image.width) // 2, y))
            labels.extend([((x + 8, y + tile + 5), frame.get('label', frame['clip']), small, '#ecece4'),
                ((x + 8, y + tile + 26), f'{frame["phase"]} | {frame["timeSeconds"]:.3f} s', font, '#c8cbbb')])
            used.append({'file': frame['file'], 'sha256': actual, 'clip': frame['clip'], 'timeSeconds': frame['timeSeconds']})
        draw = ImageDraw.Draw(canvas)
        draw.text((14, 10), preset + ' | ' + name, font=title_font, fill='#ecece4')
        draw.text((14, 42), 'Actual exported GLB | isometric | seconds in authored clip', font=small, fill='#c8cbbb')
        for position, text, face, fill in labels:
            draw.text(position, text, font=face, fill=fill)
        path = directory / (preset + '.' + name + '.png')
        canvas.save(path)
        outputs.append({'file': str(path.relative_to(index.parent)), 'sha256': digest(path), 'frames': used})
        print(path)

    for preset in args.presets or source['presets']:
        frames = [frame for frame in source['frames'] if frame['preset'] == preset and frame.get('view', 'iso') == 'iso']
        if not frames:
            continue
        by_clip = {}
        for frame in frames:
            by_clip.setdefault(frame['clip'], []).append(frame)
        overview = []
        for clip in OVERVIEW:
            candidates = by_clip.get(clip, [])
            if not candidates:
                continue
            preference = ['contact', 'recoil', 'ramrod', 'ground', 'phase-2', 'pose']
            overview.append(min(candidates, key=lambda f: preference.index(f['phase']) if f['phase'] in preference else len(preference)))
        grid(preset, 'overview', overview, 4, 280)
        # Keep each action's full row together, including four reload stages.
        page, rows = 1, []
        for clip, clip_frames in by_clip.items():
            rows.append((clip, clip_frames))
            if len(rows) < 4 and clip != list(by_clip)[-1]:
                continue
            # Four columns keep the longer reload sequence on one row. Empty
            # cells keep shorter actions on their own rows without duplicates.
            cells = []
            for _, row in rows:
                cells.extend(row)
                if len(row) < 4:
                    cells.extend([None] * (4 - len(row)))
            grid(preset, f'motion-{page:02d}', cells, 4, 320)
            page += 1
            rows = []
    for view in ['head', 'hands']:
        details = []
        for preset in args.presets or source['presets']:
            frame = next((f for f in source['frames'] if f['preset'] == preset and f.get('view') == view), None)
            if frame:
                details.append({**frame, 'label': preset + ' | ' + view})
        if details:
            grid('all', view, details, 4, 360)
    report = {'sourceIndex': str(index), 'sourceIndexSha256': digest(index), 'sourceComplete': source['complete'],
              'toolSha256': digest(Path(__file__)), 'font': {'path': str(font_path), 'sha256': digest(font_path)} if font_path else 'Pillow default', 'sheets': outputs}
    (directory / 'sheet-index.json').write_text(json.dumps(report, indent=2) + '\n')
    cards = []
    for preset in args.presets or source['presets']:
        own = [sheet for sheet in outputs if Path(sheet['file']).name.startswith(preset + '.')]
        if not own:
            continue
        links = ' '.join(f'<a href="{html.escape(Path(sheet["file"]).name)}">{html.escape(Path(sheet["file"]).stem)}</a>' for sheet in own[1:])
        image = html.escape(Path(own[0]['file']).name)
        cards.append(f'<section><h2>{html.escape(preset)}</h2><a href="{image}"><img src="{image}" loading="lazy"></a><p>{links}</p></section>')
    (directory / 'index.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>Hojas de revisión</title><style>body{font:16px system-ui;background:#202622;color:#eee;margin:24px}img{max-width:100%;width:840px}a{color:#d4c290}p{display:flex;gap:14px;flex-wrap:wrap}section{margin:32px 0}</style><h1>Hojas de revisión de personajes</h1><p><a href="../index.html">Fotogramas y tiempos</a><a href="sheet-index.json">Fuentes de las hojas</a></p>'+''.join(cards)+'</html>')


if __name__ == '__main__':
    main()
