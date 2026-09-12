"""Include the friar's pale exposed scalp, which the clothing parser misses.
Head regions keep pale scalp highlights separate from the robe, rope and horse.
Run after correct-falls.py and before finalize.mjs (which derives aim/dead masks).
"""
from pathlib import Path
from PIL import Image
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2]
base=ROOT/'web/public/art/illustrated';out=ROOT/'web/public/art/skin'
manifest=json.loads((ROOT/'assets/previews/illustrated-sprites/packed/manifest.json').read_text())
prone=[(.5,.12),(.80,.18),(.84,.28),(.83,.53),(.5,.66),(.17,.53),(.16,.28),(.20,.18)]
fallen=[(.5,.14),(.84,.20),(.84,.45),(.83,.74),(.5,.78),(.17,.74),(.16,.45),(.16,.20)]
fall={1:[(.5,.12),(.2,.15),(.2,.17),(.18,.20),(.5,.12)],2:[(.5,.12),(.19,.30),(.17,.33),(.18,.27),(.5,.10)],3:[(.5,.77),(.25,.68),(.20,.38),(.20,.23),(.5,.16)]}
for name,e in manifest['atlases'].items():
 if not name.startswith('friar-') or not (out/(name+'.png')).exists():continue
 if 'aim-idle' in name or name.endswith('dead-idle'):continue
 src=np.array(Image.open(base/e['file']).convert('RGBA'));mask=np.array(Image.open(out/(name+'.png')).convert('RGBA'));cell=e['cell'];frames=e['framesPerDirection'];added=0
 for d in range(8):
  for f in range(frames):
   left=f*cell if frames>1 else d*cell;top=d*cell if frames>1 else 0
   frame=src[top:top+cell,left:left+cell];yy,xx=np.where(frame[:,:,3]>0)
   if not len(xx):continue
   l,t,r,b=xx.min(),yy.min(),xx.max()+1,yy.max()+1;y,x=np.mgrid[0:cell,0:cell]
   if 'prone-' in name:cx,cy=prone[d];rx,ry=.20,.23
   elif 'unconscious' in name:cx,cy=fallen[d];rx,ry=.22,.24
   elif 'collapse' in name and f>0:
    cx,cy=fall[f][d if d<5 else 8-d];cx=1-cx if d>4 else cx;rx,ry=.18,.21
   else:cx,cy=.5,.10;rx,ry=.35,.20 if 'crouch' in name else .12
   region=((x-(l+cx*(r-l)))/max(5,rx*(r-l)))**2+((y-(t+cy*(b-t)))/max(5,ry*(b-t)))**2<1
   R,G,B=frame[:,:,:3].astype(float).transpose(2,0,1)
   # No red/yellow ratio cutoff: pale crown highlights are yellower than faces.
   skin=(R>110)&(G>80)&(B>45)&(R>G+4)&(G>B+5)&(frame[:,:,3]>0)
   selected=region&skin;target=mask[top:top+cell,left:left+cell];added+=int(np.count_nonzero(selected&(target[:,:,3]==0)))
   lum=np.clip(.2126*R+.7152*G+.0722*B,0,255).astype('uint8');target[selected,:3]=lum[selected,None];target[selected,3]=frame[selected,3]
 Image.fromarray(mask).save(out/(name+'.png'),optimize=True)
 print(name,added)
