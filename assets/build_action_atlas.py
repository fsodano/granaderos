#!/usr/bin/env python3
"""Pack generated action poses into uniform anchored browser sprite cells.

This is mechanical sprite extraction and resizing, not hand repainting. The
image generator's approximate grid is not directly sliceable at equal widths:
long bayonets cross those nominal boundaries. Source rectangles are recorded
from the visible separated subjects. All frames use the same 0.5 scale.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
# name, source box, foot anchor in original full-image coordinates
FRAMES=[
 ('se-idle',(145,0,325,432),(233,420)),
 ('se-fire',(520,0,925,432),(631,407)),
 ('se-reload',(1000,0,1195,432),(1100,421)),
 ('se-strike',(1380,0,1760,432),(1510,420)),
 ('sw-idle',(115,432,308,880),(228,858)),
 ('sw-fire',(370,432,790,880),(676,846)),
 ('sw-reload',(985,432,1185,880),(1099,858)),
 ('sw-strike',(1295,432,1700,880),(1575,852)),
]

def main():
 source=ROOT/'source/granadero-actions-v1.png'
 original=Image.open(source).convert('RGBA')
 atlas=Image.new('RGBA',(1280,640))
 manifest={'image':'granadero-actions.png','width':1280,'height':640,'cell':[320,320],
  'columns':4,'rows':2,'anchor':[0.5,0.9375],'source':'assets/source/granadero-actions-v1.png',
  'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'prompt':'assets/prompts/granadero-actions-v1.txt','frames':[]}
 for index,(name,box,foot) in enumerate(FRAMES):
  im=original.crop(box)
  im=im.resize((round(im.width*0.5),round(im.height*0.5)),Image.Resampling.LANCZOS)
  x=round(160-(foot[0]-box[0])*0.5)
  y=round(300-(foot[1]-box[1])*0.5)
  assert x>=0 and y>=0 and x+im.width<=320 and y+im.height<=320,(name,x,y,im.size)
  frame=Image.new('RGBA',(320,320));frame.alpha_composite(im,(x,y))
  at=((index%4)*320,(index//4)*320);atlas.alpha_composite(frame,at)
  filename=f'granadero-{name}.png';frame.save(ROOT/'web'/filename,optimize=True)
  manifest['frames'].append({'name':name,'index':index,'rect':[*at,320,320],
   'source_rect':list(box),'source_foot':list(foot),'file':filename,
   'alpha_bounds':list(frame.getchannel('A').getbbox()),
   'sha256':hashlib.sha256((ROOT/'web'/filename).read_bytes()).hexdigest()})
 atlas.save(ROOT/'web/granadero-actions.png',optimize=True)
 manifest['sha256']=hashlib.sha256((ROOT/'web/granadero-actions.png').read_bytes()).hexdigest()
 (ROOT/'web/granadero-actions.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('Packed8 action poses:1280x640 atlas,320x320 cells, foot anchor160,300.')

if __name__=='__main__':main()
