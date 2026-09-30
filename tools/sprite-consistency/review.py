from PIL import Image,ImageDraw
from pathlib import Path
import json
root=Path('web/public/art/illustrated');m=json.load(open('assets/previews/illustrated-sprites/packed/manifest.json'))
for family in ['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl']:
 names=[n for n in m['atlases'] if n.startswith(family+'-') and (root/(n+'.png')).exists()]
 for page in range((len(names)+9)//10):
  selected=names[page*10:(page+1)*10];out=Image.new('RGB',(1400,(len(selected)+1)*170),(66,70,62));draw=ImageDraw.Draw(out)
  for row,name in enumerate([family+'-idle']+selected):
   e=m['atlases'][name];im=Image.open(root/e['file']).convert('RGBA');cell=e['cell'];f=e['framesPerDirection'];draw.text((4,row*170+6),name[len(family)+1:],fill='white')
   for d in range(8):
    x=0 if f>1 else d*cell;y=d*cell if f>1 else 0;crop=im.crop((x,y,x+cell,y+cell));# Same world scale: 2 screen pixels per logical pixel.
    factor=2/e['logicalCell']*cell/3 if False else 2*e['logicalCell']/cell
    crop=crop.resize((round(cell*factor),round(cell*factor)),Image.Resampling.NEAREST)
    # Anchor all frames to a shared floor and horizontal centre.
    px=140+d*155+77-round(e['anchor'][0]*factor);py=row*170+145-round(e['anchor'][1]*factor)
    out.paste(crop,(px,py),crop)
  out.save(f'assets/previews/sprite-consistency/{family}-{page+1}.png')
