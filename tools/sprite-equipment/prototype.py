"""Review-only weapon separation prototype. Does not publish game assets."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import cv2
ROOT=Path(__file__).resolve().parents[2]
source=Image.open(ROOT/'web/public/art/illustrated/granadero-idle.png').convert('RGBA').crop((4*156,0,5*156,156))
skin=Image.open(ROOT/'web/public/art/skin/granadero-idle.png').convert('RGBA').crop((4*156,0,5*156,156))
a=np.array(source);mask=Image.new('L',source.size);d=ImageDraw.Draw(mask)
d.polygon([(52,95),(60,83),(114,53),(117,52),(117,55),(90,76),(70,90),(56,99)],fill=255)
m=cv2.dilate(np.array(mask),np.ones((3,3),np.uint8))
# Explicit hand boundaries protect the fingers; automatic skin masks alone
# miss their dark edges.
hands=Image.new('L',source.size);hd=ImageDraw.Draw(hands)
hd.polygon([(60,82),(62,79),(66,81),(69,86),(64,89),(60,86)],fill=255)
hd.polygon([(83,70),(88,69),(91,72),(88,77),(82,77)],fill=255)
h=np.array(hands)>0;m[h]=0
body=Image.new('L',source.size);ImageDraw.Draw(body).polygon([(64,51),(83,51),(96,67),(92,83),(88,96),(62,96),(58,81),(57,68)],fill=255)
b=np.array(body)>0
# Fill only occluded body pixels. Erase the weapon outside the body silhouette.
rgb=cv2.inpaint(a[:,:,:3],m,3,cv2.INPAINT_TELEA)
# Quantize reconstructed cloth to existing uniform shades rather than adding
# smooth colours or spreading warm hand colours into the jacket.
palette=np.unique(a[53:97,59:94,:3].reshape(-1,3),axis=0).astype(float)
palette=palette[(palette[:,2]>=palette[:,0])&(palette[:,0]>8)&(palette[:,0]<95)]
for yy,xx in zip(*np.where((m>0)&b)):
 value=rgb[yy,xx].astype(float);rgb[yy,xx]=palette[np.argmin(((palette-value)**2).sum(axis=1))]
out=a.copy();out[:,:,:3]=np.where((m>0)[:,:,None],rgb,a[:,:,:3]);out[(m>0)&~b]=0
clean=Image.fromarray(out)
variants=[source,clean]
for kind in ['pistol','sabre']:
 im=clean.copy();draw=ImageDraw.Draw(im)
 if kind=='pistol':
  draw.line([(64,85),(66,81),(79,74)],fill=(24,25,22,255),width=4)
  draw.line([(64,85),(66,82)],fill=(97,63,37,255),width=3)
  draw.line([(67,80),(80,73)],fill=(112,112,92,255),width=2)
  draw.line([(68,79),(80,72)],fill=(175,168,133,255),width=1)
 else:
  draw.line([(63,86),(66,83),(91,64),(98,55)],fill=(30,31,26,255),width=3)
  draw.line([(67,82),(91,63),(98,55)],fill=(177,173,144,255),width=2)
  draw.line([(64,81),(69,86)],fill=(143,111,48,255),width=2)
 # Preserve visible fingers over the grip.
 s=h;arr=np.array(im);arr[s]=a[s];im=Image.fromarray(arr)
 variants.append(im)
review=Image.new('RGB',(4*468,490),(88,94,80));draw=ImageDraw.Draw(review)
for i,(label,im) in enumerate(zip(['Original','Bare hands candidate','Pistol candidate','Sabre candidate'],variants)):
 im=im.resize((468,468),Image.Resampling.NEAREST);review.paste(im,(i*468,22),im);draw.text((i*468+10,4),label,fill='white')
review.save(ROOT/'assets/previews/equipped-sprites/weapon-separation-candidate.png')
