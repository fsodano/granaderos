"""Pack and audit original crouched and prone render sets."""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/'rig/stance-render-manifest.json').read_text());out=ROOT/'web';public=ROOT.parent/'web/public/art';size=192
directions=list(meta['directions']);manifest={'frame_size':[size,size],'fps':10,'frames_per_direction':8,'direction_rows':directions,'stances':{}}
for stance,info in meta['stances'].items():
 entry={'anchor':info['anchor'],'orthographic_scale':info['orthographic_scale'],'factions':{}};manifest['stances'][stance]=entry
 for faction in ['granadero','royalist']:
  walk=Image.new('RGBA',(1536,1536));idle=Image.new('RGBA',(1536,192));frames=[]
  for row,direction in enumerate(directions):
   sequence=[];hashes=set()
   for phase in range(8):
    path=ROOT/f'rig/stance-frames/{faction}-{stance}-walk-{direction}-{phase}.png';im=Image.open(path).convert('RGBA');a=im.getchannel('A');b=a.getbbox();assert a.getextrema()==(0,255) and b[0]>0 and b[1]>0 and b[2]<192 and b[3]<192,(path,b)
    digest=hashlib.sha256(path.read_bytes()).hexdigest();hashes.add(digest);sequence.append(im);walk.alpha_composite(im,(phase*192,row*192));frames.append({'direction':direction,'phase':phase,'rect':[phase*192,row*192,192,192],'sha256':digest})
   assert len(hashes)==8,(stance,faction,direction,len(hashes))
   sequence[0].save(out/f'{faction}-{stance}-{direction}-preview.webp',save_all=True,append_images=sequence[1:],duration=100,loop=0,lossless=True)
   im=Image.open(ROOT/f'rig/stance-frames/{faction}-{stance}-idle-{direction}.png').convert('RGBA');a=im.getchannel('A');b=a.getbbox();assert a.getextrema()==(0,255) and b[0]>0 and b[1]>0 and b[2]<192 and b[3]<192;idle.alpha_composite(im,(row*192,0))
  w=f'{faction}-{stance}-walk-atlas.png';i=f'{faction}-{stance}-idle-atlas.png';walk.save(out/w,optimize=True);idle.save(out/i,optimize=True);entry['factions'][faction]={'walk':w,'idle':i,'frames':frames}
  for path in out.glob(f'{faction}-{stance}-*'):shutil.copy2(path,public/path.name)
(out/'stance-animation.json').write_text(json.dumps(manifest,indent=2)+'\n');shutil.copy2(out/'stance-animation.json',public/'stance-animation.json')
print('Verified and installed288 unclipped RGBA low stance frames, eight distinct phases in every direction.')
