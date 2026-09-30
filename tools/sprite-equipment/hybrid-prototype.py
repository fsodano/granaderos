"""Review-only: transplant repaired torso while preserving original head/legs."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,cv2
import argparse
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--candidate',required=True);args=parser.parse_args()
candidate=Image.open(args.candidate).convert('RGB')
source=Image.open(ROOT/'web/public/art/illustrated/granadero-idle.png').convert('RGBA')
review=Image.new('RGB',(8*312,2*334),(88,94,80));draw=ImageDraw.Draw(review)
for d in range(8):
 original=source.crop((d*156,0,(d+1)*156,156));a=np.array(original)
 c=np.array(candidate.crop((round(d*candidate.width/8),0,round((d+1)*candidate.width/8),candidate.height)))
 # Discard the generated checkerboard, retain the largest enclosed person.
 seed=(c.min(2)<130).astype('uint8');seed=cv2.morphologyEx(seed,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
 count,labels,stats,_=cv2.connectedComponentsWithStats(seed)
 k=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);mask=(labels==k).astype('uint8')*255
 contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(mask,contours,-1,255,-1)
 y,x=np.where(mask);x0,x1=x.min(),x.max()+1;y0,y1=y.min(),y.max()+1
 rgba=np.dstack([c,mask]);g=Image.fromarray(rgba)
 # Fixed anatomical bands are a prototype, not accepted atlas metadata.
 top=round(y0+(y1-y0)*.28);bottom=round(y0+(y1-y0)*.65)
 width=[40,36,29,37,36,37,29,36][d]
 patch=g.crop((x0,top,x1,bottom)).resize((width,42),Image.Resampling.NEAREST)
 out=original.copy();out.paste((0,0,0,0),(0,50,156,92));out.alpha_composite(patch,(78-width//2,50))
 # Rifle tips extend beside the head in several views. Protect the original
 # head column while removing disconnected weapon pixels outside it.
 out.paste((0,0,0,0),(0,0,65,50));out.paste((0,0,0,0),(89,0,156,50))
 for row,im in enumerate([original,out]):
  im=im.resize((312,312),Image.Resampling.NEAREST);review.paste(im,(d*312,row*334+22),im)
 draw.text((d*312+4,4),['N','NE','E','SE','S','SW','W','NW'][d],fill='white')
review.save(ROOT/'assets/previews/equipped-sprites/hybrid-torso-candidate.png')
