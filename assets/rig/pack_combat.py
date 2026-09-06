"""Pack rendered poses; preserve the infantry world-reference anchor for every frame."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'web/infantry-animation.json').read_text());size=192
manifest={'frame_size':[size,size],'anchor':base['anchor'],'direction_rows':base['direction_rows'],'frames_per_direction':8,'fps':10,'actions':{}}
for faction in ['granadero','royalist']:
 for action in ['run','fire','reload','strike']:
  atlas=Image.new('RGBA',(1536,1536));records=[]
  for row,direction in enumerate(base['direction_rows']):
   sequence=[]
   for frame in range(8):
    source=ROOT/f'rig/combat-frames/{faction}-{action}-{direction}-{frame}.png';im=Image.open(source).convert('RGBA').resize((size,size),Image.Resampling.NEAREST);bounds=im.getchannel('A').getbbox()
    assert bounds and min(bounds[:2])>0 and max(bounds[2:])<192,(str(source),bounds)
    atlas.alpha_composite(im,(frame*192,row*192));sequence.append(im);records.append({'direction':direction,'frame':frame,'bounds':bounds})
   if direction=='se':sequence[0].save(ROOT/f'web/{faction}-{action}-preview.webp',save_all=True,append_images=sequence[1:],duration=100,loop=0,lossless=True)
  name=f'{faction}-{action}-atlas.png';atlas.save(ROOT/'web'/name,optimize=True);manifest['actions'][f'{faction}-{action}']={'file':name,'world_scale':1 if action=='run' else 3.5/2.6,'frames':records,'sha256':hashlib.sha256((ROOT/'web'/name).read_bytes()).hexdigest()}
(ROOT/'web/combat-animation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Packed 512 original eight-direction articulated run and action frames.')
