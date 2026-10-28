"""Pack independently rendered original rig frames into browser atlases."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/'rig/render-manifest.json').read_text())
size=meta['frame_size'][0];count=meta['frames_per_direction'];dirs=list(meta['directions'])
out=ROOT/'web';out.mkdir(exist_ok=True)
manifest={k:meta[k] for k in ['frame_size','anchor','frames_per_direction','fps','directions','camera','rig','model']}
manifest['direction_rows']=dirs
manifest['cycle_seconds']=count/meta['fps']
manifest['factions']={}
for faction in ['granadero','royalist']:
 atlas=Image.new('RGBA',(size*count,size*len(dirs)))
 frames=[]
 for row,direction in enumerate(dirs):
  sequence=[]
  for frame in range(count):
   name=f'{faction}-walk-{direction}-{frame}.png'
   image=Image.open(ROOT/'rig/frames'/name).convert('RGBA').resize((size,size),Image.Resampling.NEAREST)
   assert image.size==(size,size)
   assert image.getchannel('A').getextrema()==(0,255)
   bounds=image.getchannel('A').getbbox();assert bounds[0]>0 and bounds[1]>0 and bounds[2]<size and bounds[3]<size,(name,bounds)
   atlas.alpha_composite(image,(frame*size,row*size));sequence.append(image)
   frames.append({'direction':direction,'frame':frame,'rect':[frame*size,row*size,size,size],
    'alpha_bounds':list(bounds),'sha256':hashlib.sha256((ROOT/'rig/frames'/name).read_bytes()).hexdigest()})
  # A browser-playable preview uses the actual discrete gait, no frame warping.
  sequence[0].save(out/f'{faction}-walk-{direction}-preview.webp',save_all=True,append_images=sequence[1:],duration=100,loop=0,lossless=True)
 atlas_name=f'{faction}-walk-atlas.png';atlas.save(out/atlas_name,optimize=True)
 idle=Image.new('RGBA',(size*len(dirs),size))
 for index,direction in enumerate(dirs):idle.alpha_composite(Image.open(ROOT/f'rig/frames/{faction}-idle-{direction}.png').convert('RGBA').resize((size,size),Image.Resampling.NEAREST),(size*index,0))
 idle_name=f'{faction}-idle-atlas.png';idle.save(out/idle_name,optimize=True)
 manifest['factions'][faction]={'walk':atlas_name,'idle':idle_name,'walk_size':list(atlas.size),'idle_size':list(idle.size),
  'sha256':hashlib.sha256((out/atlas_name).read_bytes()).hexdigest(),'idle_sha256':hashlib.sha256((out/idle_name).read_bytes()).hexdigest(),'frames':frames}
(out/'infantry-animation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Packed two8-direction walk atlases(64frames each) and idle atlases; generated animated previews.')
