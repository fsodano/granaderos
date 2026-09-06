"""Pack native-resolution offline renders without resampling their pixels.

Legacy packers can still expand these frames to the old 192/256 layout. The
runtime uses only this native atlas set and its checked manifest.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
from tempfile import TemporaryDirectory

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'web/pixel'
PUBLIC=ROOT.parent/'web/public/art/pixel'
DIRECTIONS=['n','ne','e','se','s','sw','w','nw']


def families():
    for faction in ['granadero','royalist']:
        for action in ['idle','walk']:
            yield f'{faction}-{action}', 'frames', 52, [26,46]
        for action in ['run','fire','reload','strike']:
            yield f'{faction}-{action}', 'combat-frames', 52 if action=='run' else 70, [26,46] if action=='run' else [35,62]
        for stance in ['crouch']:
            for action in ['idle','walk']:
                yield f'{faction}-{stance}-{action}', 'stance-frames', 62 if stance=='prone' else 52, [31,40] if stance=='prone' else [26,46]
    for family in ['granadero','royalist','civilian']:
        yield f'{family}-dead-idle', 'ground-frames', 80, [40,47]
        yield f'{family}-unconscious-breathe', 'ground-frames', 80, [40,47]
        if family!='civilian':
            for action in ['idle','walk','fire','reload']:
                yield f'{family}-prone-armed-{action}', 'ground-frames', 80, [40,47]
            for action in ['idle','walk']:
                yield f'{family}-prone-unarmed-{action}', 'ground-frames', 80, [40,47]
    for action in ['idle','walk']:
        yield f'civilian-{action}', 'civilian-frames', 52, [26,46]
        yield f'cavalry-{action}', 'cavalry-frames', 76, [38,63]


def pack(stage):
    manifest={'version':1,'style':'native-resolution-isometric-pixel-art',
              'directions':DIRECTIONS,'fps':10,'frames_per_direction':8,'atlases':{}}
    for name,folder,cell,anchor in families():
        idle=name.endswith('-idle');rows=1 if idle else 8
        atlas=Image.new('RGBA',(cell*8,cell*rows))
        records=[]
        for direction_index,direction in enumerate(DIRECTIONS):
            sequence=[]
            for frame in range(1 if idle else 8):
                source=ROOT/'rig'/folder/f'{name}-{direction}{"" if idle else "-"+str(frame)}.png'
                image=Image.open(source).convert('RGBA')
                if image.size!=(cell,cell):raise ValueError(f'{source}: expected native {cell}px, got {image.size}')
                alpha=image.getchannel('A');bounds=alpha.getbbox()
                if not bounds or alpha.getextrema()!=(0,255) or min(bounds[:2])<=0 or max(bounds[2:])>=cell:
                    raise ValueError(f'{source}: missing alpha or clipped silhouette {bounds}')
                x=(direction_index if idle else frame)*cell;y=0 if idle else direction_index*cell
                atlas.paste(image,(x,y))
                sequence.append(image)
                records.append({'direction':direction,'frame':frame,'rect':[x,y,cell,cell],
                                'bounds':list(bounds),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
            if not idle:
                preview=stage/f'{name}-{direction}-preview.webp'
                sequence[0].save(preview,save_all=True,append_images=sequence[1:],duration=500 if '-unconscious-' in name else 100,loop=0,lossless=True)
        file=f'{name}-atlas.png';atlas.save(stage/file,optimize=True)
        manifest['atlases'][name]={'file':file,'cell':cell,'size':list(atlas.size),'anchor':anchor,
                                 'fps':2 if '-unconscious-' in name else 10,'sha256':hashlib.sha256((stage/file).read_bytes()).hexdigest(),'frames':records}
    (stage/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    # Publish only after every family has passed validation. A clipped late
    # frame must not replace some atlases while leaving the old manifest.
    OUTPUT.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
    for path in stage.iterdir():
        shutil.copy2(path,OUTPUT/path.name)
        if path.suffix in ['.png','.json']:shutil.copy2(path,PUBLIC/path.name)
    print(f'Packed {len(manifest["atlases"])} native pixel atlases; no resampling. Installed {PUBLIC}.')


def build():
    with TemporaryDirectory(prefix='granaderos-pixel-pack-') as temp:
        pack(Path(temp))


if __name__=='__main__':build()
