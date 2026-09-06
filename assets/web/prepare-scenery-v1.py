from PIL import Image
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[2]
src=root/'assets/web/scenery-source-v1.png'
im=Image.open(src);assert im.mode=='RGBA';assert im.getchannel('A').histogram()[0]>0
# The complete original source is already preserved beside this script.
boxes=[('tree',(0,0,512,560)),('poplar',(512,0,1024,560)),('shrub',(0,560,512,1000)),('rocks',(512,560,1024,1000)),('barrels',(0,1000,512,1536)),('hay',(512,1000,1024,1536))]
atlas=Image.new('RGBA',(1024,1920));meta={}
for index,(name,cell) in enumerate(boxes):
 original=im.crop(cell);a=original.getchannel('A');b=a.point(lambda value:255 if value>16 else 0).getbbox();b=(max(0,b[0]-8),max(0,b[1]-8),min(original.width,b[2]+8),min(original.height,b[3]+8))
 obj=original.crop(b);canvas=Image.new('RGBA',(512,640));pos=((512-obj.width)//2,576-obj.height);canvas.paste(obj,pos)
 filename=f'scenery-{name}-v1.webp';out=root/'assets/web'/filename;canvas.save(out,'WEBP',lossless=True,exact=True);shutil.copy2(out,root/'web/public/art'/filename)
 checked=Image.open(out).convert('RGBA');assert checked.getchannel('A').tobytes()==canvas.getchannel('A').tobytes();assert checked.getpixel((0,0))[3]==0
 atlas.paste(canvas,((index%2)*512,(index//2)*640));meta[name]={'file':filename,'width':512,'height':640,'anchor':[0.5,0.9],'contentBox':[pos[0],pos[1],pos[0]+obj.width,pos[1]+obj.height],'sourceCrop':[cell[0]+b[0],cell[1]+b[1],cell[0]+b[2],cell[1]+b[3]],'bytes':out.stat().st_size}
atlas.save(root/'assets/web/scenery-atlas-v1.png');(root/'assets/web/scenery-v1.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
