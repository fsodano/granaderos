"""Measure each frame without changing game assets."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
m=json.loads(Path('assets/previews/illustrated-sprites/packed/manifest.json').read_text());rows=[]
active=json.loads(Path('web/public/art/skin/manifest.json').read_text())['masks']
for name,e in m['atlases'].items():
 if name not in active:continue
 path=Path('web/public/art/illustrated')/e['file']
 if not path.exists():continue
 a=np.array(Image.open(path).convert('RGBA'));cell=e['cell'];frames=e['framesPerDirection']
 for d in range(8):
  for f in range(frames):
   x=f*cell if frames>1 else d*cell;y=d*cell if frames>1 else 0;alpha=a[y:y+cell,x:x+cell,3]>0;yy,xx=np.where(alpha)
   if not len(xx):continue
   t,b=int(yy.min()),int(yy.max()+1);h=b-t
   # Occupied scanline pixels: a diagnostic, not a torso segmentation claim.
   widths=alpha.sum(axis=1);middle=widths[t+int(.28*h):t+int(.52*h)]
   rows.append(dict(sheet=name,direction=m['directions'][d],frame=f,height=h,midBodyPixels=float(np.median(middle)),bounds=[int(xx.min()),t,int(xx.max()+1),b]))
Path('assets/previews/sprite-consistency/measurements.json').write_text(json.dumps(rows,indent=2)+'\n')
print(len(rows),'frames measured')
