#!/usr/bin/env python3
"""Pack generated action poses into uniform anchored browser sprite cells.

This is mechanical sprite extraction and resizing, not hand repainting. The
image generator's approximate grid is not directly sliceable at equal widths:
long bayonets cross those nominal boundaries. Source rectangles are recorded
from the visible separated subjects. All frames use the same 0.6 scale.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
# name, source box, foot anchor in original full-image coordinates
FRAMES=[
 ('se-idle',(35,0,400,435),(220,420)),
 ('se-fire',(465,0,815,435),(634,425)),
 ('se-strike',(840,0,1268,435),(1087,427)),
 ('se-charge',(1270,0,1774,435),(1510,425)),
 ('sw-idle',(35,435,405,887),(210,856)),
 ('sw-fire',(470,435,825,887),(645,852)),
 ('sw-strike',(825,435,1255,887),(1050,849)),
 ('sw-charge',(1255,435,1774,868),(1510,835)),
]

def main():
 source=ROOT/'source/cavalry-actions-v3.png'
 original=Image.open(source).convert('RGBA')
 atlas=Image.new('RGBA',(1536,768))
 manifest={'image':'cavalry-actions.png','width':1536,'height':768,'cell':[384,384],
  'columns':4,'rows':2,'anchor':[0.5,0.9375],'source':'assets/source/cavalry-actions-v3.png',
  'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'prompt':'assets/prompts/cavalry-actions-v3.txt','frames':[]}
 for index,(name,box,foot) in enumerate(FRAMES):
  im=original.crop(box)
  im=im.resize((round(im.width*0.6),round(im.height*0.6)),Image.Resampling.LANCZOS)
  x=round(192-(foot[0]-box[0])*0.6)
  y=round(360-(foot[1]-box[1])*0.6)
  assert x>=0 and y>=0 and x+im.width<=384 and y+im.height<=384,(name,x,y,im.size)
  frame=Image.new('RGBA',(384,384));frame.alpha_composite(im,(x,y))
  at=((index%4)*384,(index//4)*384);atlas.alpha_composite(frame,at)
  filename=f'cavalry-{name}.png';frame.save(ROOT/'web'/filename,optimize=True)
  manifest['frames'].append({'name':name,'index':index,'rect':[*at,384,384],
   'source_rect':list(box),'source_foot':list(foot),'file':filename,
   'alpha_bounds':list(frame.getchannel('A').getbbox()),
   'sha256':hashlib.sha256((ROOT/'web'/filename).read_bytes()).hexdigest()})
 atlas.save(ROOT/'web/cavalry-actions.png',optimize=True)
 manifest['sha256']=hashlib.sha256((ROOT/'web/cavalry-actions.png').read_bytes()).hexdigest()
 (ROOT/'web/cavalry-actions.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('Packed8 action poses:1536x768 atlas,384x384 cells, foot anchor192,360.')

if __name__=='__main__':main()
