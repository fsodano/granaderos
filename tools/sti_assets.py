#!/usr/bin/env python3
"""Rebuild and install original Granaderos image assets from retained PNGs."""
import hashlib
import json
from pathlib import Path
from sti import convert

ROOT = Path(__file__).resolve().parents[1]
ASSETS = [
    ('san-lorenzo-menu-v2.png', 'san-lorenzo-menu', (640,480), 'rgb565', 'Loadscreens/MainMenuBackground.sti'),
    ('juan-bautista-cabral-v1.png', 'cabral-tactical', (48,43), 'etrle', 'Faces/03.sti'),
    ('juan-bautista-cabral-v1.png', 'cabral-dialogue', (90,100), 'etrle', 'Faces/b03.sti'),
    ('juan-bautista-cabral-v1.png', 'cabral-recruitment', (106,122), 'etrle', 'Faces/BIGFACES/03.sti'),
]

def main():
    manifest = {'generator': 'OpenAI built-in image_gen', 'generated_date': '2026-09-05', 'assets': []}
    for source, name, size, mode, destination in ASSETS:
        source_path = ROOT/'assets/source'/source
        output_path = ROOT/'assets/engine'/f'{name}.sti'
        encoded = convert(source_path, output_path, size, mode, ROOT/'assets/previews'/f'{name}.png')
        mod_path = ROOT/'mod/Data-Granaderos'/destination
        mod_path.parent.mkdir(parents=True, exist_ok=True)
        mod_path.write_bytes(encoded)
        manifest['assets'].append({
            'source': str(source_path.relative_to(ROOT)),
            'source_sha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
            'prompt': f'assets/prompts/{Path(source).stem}.txt',
            'output': str(output_path.relative_to(ROOT)),
            'sha256': hashlib.sha256(encoded).hexdigest(),
            'dimensions': list(size), 'format': mode,
            'installed': str(mod_path.relative_to(ROOT)),
        })
    (ROOT/'assets/manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Built and installed {len(ASSETS)} images; wrote assets/manifest.json')

if __name__ == '__main__': main()
