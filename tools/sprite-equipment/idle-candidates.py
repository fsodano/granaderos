"""Build review-only weapon swaps from explicit per-direction rifle masks."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,cv2,json
ROOT=Path(__file__).resolve().parents[2]
source=Image.open(ROOT/'web/public/art/illustrated/granadero-idle.png').convert('RGBA')
skins=Image.open(ROOT/'web/public/art/skin/granadero-idle.png').convert('RGBA')
# Rifle segments exclude portions hidden behind the body. Coordinates are local
# raster pixels; no direction is mirrored, because straps and packs are asymmetric.
rows=[
 {'lines':[[42,40,62,61],[94,86,106,99]],'body':[64,51,92,94],'grip':[63,62],'tip':[51,50]},
 {'lines':[[81,97,127,42]],'body':[62,50,90,96],'grip':[99,73],'tip':[112,57]},
 {'lines':[[77,104,122,43]],'body':[65,49,89,105],'grip':[86,88],'tip':[98,72]},
 {'lines':[[53,100,129,50]],'body':[58,50,91,98],'grip':[69,85],'tip':[88,73]},
 {'lines':[[54,97,116,54]],'body':[58,51,94,97],'grip':[64,85],'tip':[83,73]},
 {'lines':[[55,99,118,53]],'body':[61,50,95,98],'grip':[66,84],'tip':[85,72]},
 {'lines':[[35,49,64,75]],'body':[65,51,89,96],'grip':[62,74],'tip':[49,62]},
 {'lines':[[35,46,66,69],[94,88,100,95]],'body':[65,50,92,96],'grip':[64,65],'tip':[51,54]},
]
review=Image.new('RGB',(8*312,4*334),(88,94,80));draw=ImageDraw.Draw(review)
for d,row in enumerate(rows):
 original=source.crop((d*156,0,(d+1)*156,156));a=np.array(original);skin=np.array(skins.crop((d*156,0,(d+1)*156,156)))[:,:,3]>0
 yy,xx=np.indices((156,156));gx,gy=row['grip'];support=[(63,62),(99,73),(99,70),(95,72),(87,73),(88,74),(62,74),(64,65)][d]
 skin &= ((xx-gx)**2+(yy-gy)**2<=20)|((xx-support[0])**2+(yy-support[1])**2<=20)
 mask=Image.new('L',(156,156));md=ImageDraw.Draw(mask)
 for x0,y0,x1,y1 in row['lines']:md.line([(x0,y0),(x1,y1)],fill=255,width=11)
 m=np.array(mask);m[skin]=0
 body=np.zeros((156,156),bool);x0,y0,x1,y1=row['body'];body[y0:y1,x0:x1]=True
 repaired=cv2.inpaint(a[:,:,:3],m,3,cv2.INPAINT_TELEA)
 palette=np.unique(a[y0:y1,x0:x1,:3].reshape(-1,3),axis=0).astype(float)
 palette=palette[(palette[:,2]>=palette[:,0])&(palette[:,0]>8)&(palette[:,0]<95)]
 for y,x in zip(*np.where((m>0)&body)):
  repaired[y,x]=palette[np.argmin(((palette-repaired[y,x])**2).sum(1))]
 bare=a.copy();bare[:,:,:3]=np.where((m>0)[:,:,None],repaired,a[:,:,:3]);bare[(m>0)&~body]=0
 variants=[original,Image.fromarray(bare)]
 for kind in ['pistol','blade']:
  im=Image.fromarray(bare.copy());dr=ImageDraw.Draw(im);gx,gy=row['grip'];tx,ty=row['tip']
  if kind=='pistol':
   dr.line([(gx,gy),(tx,ty)],fill=(24,25,22,255),width=4)
   dr.line([(gx,gy),(gx+(tx-gx)*.25,gy+(ty-gy)*.25)],fill=(105,68,38,255),width=3)
   dr.line([(gx+(tx-gx)*.25,gy+(ty-gy)*.25),(tx,ty)],fill=(111,110,92,255),width=2)
   dr.line([(gx+(tx-gx)*.3,gy+(ty-gy)*.3-1),(tx,ty-1)],fill=(161,156,127,255),width=1)
  else:
   tx=gx+(tx-gx)*1.7;ty=gy+(ty-gy)*1.7
   dr.line([(gx,gy),(tx,ty),(tx+(1 if tx>gx else -1),ty-3)],fill=(28,29,24,255),width=3)
   dr.line([(gx,gy),(tx,ty),(tx+(1 if tx>gx else -1),ty-3)],fill=(167,166,144,255),width=2)
   dr.line([(gx-2,gy-2),(gx+2,gy+2)],fill=(146,109,49,255),width=2)
  arr=np.array(im);arr[skin]=a[skin];variants.append(Image.fromarray(arr))
 for r,im in enumerate(variants):
  enlarged=im.resize((312,312),Image.Resampling.NEAREST);review.paste(enlarged,(d*312,r*334+22),enlarged)
  draw.text((d*312+4,r*334+4),['Original','Bare hands candidate','Short gun candidate','Blade candidate'][r]+' '+['N','NE','E','SE','S','SW','W','NW'][d],fill='white')
 # Nothing outside the authored weapon-edit area changes.
 for im in variants[1:]:assert np.array_equal(np.array(im)[:35],a[:35])
review.save(ROOT/'assets/previews/equipped-sprites/granadero-idle-four-styles-candidate.png')
(ROOT/'assets/previews/equipped-sprites/review.json').write_text(json.dumps({'status':'in-progress','published':False,'appearance':'granadero','sequence':'idle','directions':8,'equipmentStyles':4,'allActionsReviewed':False,'issue':'Weapon masks and grips require further visual correction before runtime use.'},indent=2)+'\n')
