from pathlib import Path
from PIL import Image
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'web';public=ROOT.parent/'web/public/art'
base=json.loads((out/'infantry-animation.json').read_text());dirs=base['direction_rows'];meta={'frame_size':[192,192],'anchor':base['anchor'],'direction_rows':dirs,'frames_per_direction':8,'fps':10,'atlases':{}}
for action in ['idle','walk']:
 atlas=Image.new('RGBA',(1536,192 if action=='idle' else 1536));records=[]
 for row,direction in enumerate(dirs):
  for frame in range(1 if action=='idle' else 8):
   im=Image.open(ROOT/f'rig/civilian-frames/civilian-{action}-{direction}{"" if action=="idle" else "-"+str(frame)}.png').convert('RGBA');bounds=im.getchannel('A').getbbox();assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<192 and bounds[3]<192
   atlas.alpha_composite(im,((row if action=='idle' else frame)*192,0 if action=='idle' else row*192));records.append({'direction':direction,'frame':frame,'bounds':bounds})
 name=f'civilian-{action}-atlas.png';atlas.save(out/name,optimize=True);shutil.copy2(out/name,public/name);meta['atlases'][action]={'file':name,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest(),'frames':records}
(out/'civilian-animation.json').write_text(json.dumps(meta,indent=2)+'\n');shutil.copy2(out/'civilian-animation.json',public/'civilian-animation.json')
print('Packed72 original civilian frames with shared fixed ground anchor.')
