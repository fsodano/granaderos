"""Recover small exposed regions in the shared authored fall pose template.
ROIs constrain a warm-skin colour gate; clothing and dark facial detail are retained.
Coordinates are normalized to each frame's visible bounds, not its padded cell.
"""
from pathlib import Path
from PIL import Image
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2];base=ROOT/'assets/previews/illustrated-sprites/packed';out=ROOT/'web/public/art/skin';m=json.loads((base/'manifest.json').read_text())
# Each tuple is face centre, then visible hand centres. North shows the back of the head.
points={
 (0,1):[(.03,.55),(.97,.53)],(0,2):[(.04,.92),(.96,.92)],(0,3):[(.04,.69),(.96,.69)],
 (1,1):[(.20,.25),(.84,.54),(.97,.60)],(1,2):[(.19,.40),(.05,.85),(.56,.95)],(1,3):[(.25,.70),(.74,.69)],
 (2,1):[(.20,.27),(.56,.60),(.72,.50)],(2,2):[(.17,.43),(.17,.91),(.30,.65)],(2,3):[(.20,.40),(.55,.80)],
 (3,1):[(.18,.30),(.59,.55),(.92,.46)],(3,2):[(.18,.37),(.09,.77),(.27,.72)],(3,3):[(.20,.25),(.40,.73)],
 (4,1):[(.50,.22),(.10,.58),(.90,.58)],(4,2):[(.50,.20),(.10,.66),(.90,.66)],(4,3):[(.50,.18),(.04,.65),(.96,.65)],
}
for d in [5,6,7]:
 for f in [1,2,3]:points[(d,f)]=[(1-x,y) for x,y in points[(8-d,f)]]
for a in ['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl']:
 name=a+'-collapse';p=out/(name+'.png')
 if not p.exists():continue
 e=m['atlases'][name];src=np.array(Image.open(base/e['file']).convert('RGBA'));mask=np.array(Image.open(p).convert('RGBA'));cell=e['cell']
 for d in range(8):
  for f in [1,2,3]:
   frame=src[d*cell:(d+1)*cell,f*cell:(f+1)*cell];yy,xx=np.where(frame[:,:,3]>0);l,t,r,b=xx.min(),yy.min(),xx.max()+1,yy.max()+1
   y,x=np.mgrid[0:cell,0:cell];region=np.zeros((cell,cell),bool)
   for i,(cx,cy) in enumerate(points[d,f]):
    if i==0 and d!=0 and a not in ['granadero','royalist']:cy-=.10 if f<3 else .02
    rx=.13 if i==0 else .10;ry=.15 if i==0 else .11
    region|=((x-(l+cx*(r-l)))/(max(3,rx*(r-l))))**2+((y-(t+cy*(b-t)))/(max(3,ry*(b-t))))**2<1
   R,G,B=frame[:,:,:3].astype(float).transpose(2,0,1)
   warm=(R>125)&(R-G>20)&(G-B>10)&((G-B)<(R-G)*1.5)&(G>R*.60)&(frame[:,:,3]>0)
   selected=region&warm;lum=np.clip(.2126*R+.7152*G+.0722*B,0,255).astype('uint8');target=mask[d*cell:(d+1)*cell,f*cell:(f+1)*cell];target[selected,:3]=lum[selected,None];target[selected,3]=frame[selected,3]
 Image.fromarray(mask).save(p,optimize=True)
 print(name,flush=True)
