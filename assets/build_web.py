#!/usr/bin/env python3
"""Resize retained original tool outputs for browser delivery, preserving alpha."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SPECS = [
    ('san-lorenzo-menu-v2.png','main-menu.webp',1448,None),
    ('san-lorenzo-menu-v1.png','san-lorenzo.webp',1448,None),
    ('juan-bautista-cabral-v1.png','cabral.webp',384,None),
    ('granadero-infantry-v1.png','granadero.png',256,[0.5,0.95]),
    ('royalist-infantry-v1.png','royalist.png',256,[0.5,0.95]),
    ('granadero-cavalry-v1.png','cavalry.png',384,[0.55,0.97]),
    ('san-carlos-convent-v1.png','convent.png',512,[0.5,0.85]),
    ('grassland-v1.png','grassland.webp',512,None),
]
PORTRAITS = [(0,"martin-miguel-de-guemes"),(1,"juana-azurduy"),(2,"fray-luis-beltran"),(3,"juan-bautista-cabral"),(4,"manuel-dorrego"),(5,"guillermo-brown"),(6,"hipolito-bouchard"),(7,"lorenzo-barcala"),(8,"macacha-guemes"),(9,"facundo-quiroga"),(10,"james-paroissien"),(11,"jose-maria-paz"),(57,"jose-de-san-martin")]
SPECS.extend((f"{name}-v1.png",f"portrait-{id}.webp",384,None) for id,name in PORTRAITS)

def main():
    (ROOT/'web').mkdir(exist_ok=True)
    manifest = {'generator':'OpenAI built-in image_gen','date':'2026-09-05','assets':[]}
    for source, target, side, anchor in SPECS:
        source_path = ROOT/'source'/source
        with Image.open(source_path) as original:
            im = original.copy()
        im.thumbnail((side,side),Image.Resampling.LANCZOS)
        output = ROOT/'web'/target
        im.save(output,quality=85,optimize=True)
        alpha = im.getchannel('A') if im.mode == 'RGBA' else None
        manifest['assets'].append({
            'path':target,'width':im.width,'height':im.height,'mode':im.mode,
            'source':f'assets/source/{source}','prompt':f'assets/prompts/{Path(source).stem}.txt',
            'anchor':anchor,'alpha_bounds':list(alpha.getbbox()) if alpha else None,
            'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            'source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
        })
    (ROOT/'web/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'Wrote {len(SPECS)} browser images and web/manifest.json')

if __name__ == '__main__': main()
