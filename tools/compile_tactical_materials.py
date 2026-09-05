#!/usr/bin/env python3
"""Compile the preserved original 3x3 terrain atlas; requires Pillow.

Run normally to export both asset copies, or --check to verify byte-for-byte
reproduction without changing files. Run from any working directory.
"""
from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/tactical-materials-v1.png'
NAMES = ('dry-grass', 'dirt', 'cobble', 'green-grass', 'mud', 'floor',
         'plaster', 'roof', 'wood')
DESTINATIONS = (ROOT / 'assets/web', ROOT / 'web/public/art')


def compile_materials(check=False):
    source = Image.open(SOURCE)
    if source.size != (1254, 1254):
        raise ValueError('Expected the preserved 1254x1254, three-by-three atlas')
    source = source.convert('RGB')
    mismatches = []
    for index, name in enumerate(NAMES):
        col, row = index % 3, index // 3
        # Each source cell is 418px; remove three pixels from every edge.
        crop = source.crop((col * 418 + 3, row * 418 + 3,
                            (col + 1) * 418 - 3, (row + 1) * 418 - 3))
        texture = crop.resize((256, 256), Image.Resampling.LANCZOS)
        output = BytesIO()
        texture.save(output, format='WEBP', quality=92)
        data = output.getvalue()
        filename = f'terrain-{name}-v1.webp'
        for directory in DESTINATIONS:
            path = directory / filename
            if check:
                if not path.exists() or path.read_bytes() != data:
                    mismatches.append(str(path.relative_to(ROOT)))
            else:
                directory.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
        print(f'{filename}: {len(data)} bytes; sha256 {hashlib.sha256(data).hexdigest()}')
    if mismatches:
        raise SystemExit('Non-reproducible or missing outputs: ' + ', '.join(mismatches))
    print(f'{"Verified" if check else "Exported"} nine textures in both destinations.')


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare existing outputs without writing')
    compile_materials(parser.parse_args().check)
