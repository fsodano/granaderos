"""Offline skin masks; only PNGs are used by the game. No model runs in the browser.
Install torch, torchvision, transformers, pillow, numpy in an isolated environment.
The model produces candidates; colour gates retain eyes, hair, and dark outlines.
"""
import argparse,json,hashlib,time
from pathlib import Path
import numpy as np
from PIL import Image
import torch
from transformers import AutoImageProcessor,AutoModelForSemanticSegmentation
ROOT=Path(__file__).resolve().parents[2]
MODEL='mattmdjaga/segformer_b2_clothes'
REVISION='584abc1e1d260e23c0fc627c5217a09b2b461046'
p=argparse.ArgumentParser();p.add_argument('--only',default='');p.add_argument('--force',action='store_true');args=p.parse_args()
source=ROOT/'assets/previews/illustrated-sprites/packed'
out=ROOT/'web/public/art/skin';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text())
variants=['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl']
sequences=['idle','walk','run','crouch-idle','crouch-walk','prone-armed-idle','prone-armed-walk','mounted-idle','mounted-walk','mounted-run','aim-idle','crouch-aim-idle','prone-aim-idle','fire','crouch-fire','prone-armed-fire','reload','crouch-reload','prone-armed-reload','strike','mounted-strike','interact','crouch-interact','collapse','unconscious-breathe','mounted-fire','mounted-reload','prone-unarmed-idle','prone-unarmed-walk','dead-idle']
device='mps' if torch.backends.mps.is_available() else 'cpu'
processor=AutoImageProcessor.from_pretrained(MODEL,revision=REVISION,token=False,use_fast=False)
model=AutoModelForSemanticSegmentation.from_pretrained(MODEL,revision=REVISION,token=False).eval().to(device)
torch.set_num_threads(4)
def parse(im):
 bg=Image.new('RGBA',im.size,(230,230,230,255));bg.alpha_composite(im)
 with torch.inference_mode():
  logits=model(**{k:v.to(device) for k,v in processor(images=bg.convert('RGB'),return_tensors='pt').items()}).logits
  prob=torch.nn.functional.interpolate(logits,size=(im.height,im.width),mode='bilinear',align_corners=False).softmax(1)[0]
  skin=prob[[11,14,15]].sum(0).cpu().numpy();label=prob.argmax(0).cpu().numpy()
 return skin,np.isin(label,[11,14,15])
def candidate(im,mounted):
 arr=np.array(im);height,width=arr.shape[:2]
 if mounted:
  limit=max(1,round(height*.57));crop=im.crop((0,0,width,limit));prob,skin=parse(crop)
  mask=np.zeros((height,width),dtype=bool);mask[:limit]=skin&(prob>.5)
 elif width>height*1.2:
  masks=[]
  for angle in [90,270]:
   rotated=im.rotate(angle,expand=True);prob,skin=parse(rotated)
   warm=np.array(rotated).astype(float);r,g,b=warm[:,:,0],warm[:,:,1],warm[:,:,2]
   valid=skin&(prob>.5)&(r>g+8)&(g>b+6)
   score=(prob*valid).sum()
   back=np.array(Image.fromarray((skin&(prob>.5)).astype('uint8')*255).rotate(-angle,expand=True))>0
   masks.append((score,back))
  mask=max(masks,key=lambda x:x[0])[1]
 else:prob,skin=parse(im);mask=skin&(prob>.5)
 r,g,b=arr[:,:,:3].astype(float).transpose(2,0,1)
 # Skin-only chroma guard inside semantic regions; keep black features and ivory cloth.
 mask &= (arr[:,:,3]>0)&(r>45)&(r-g>8)&(g-b>6)&(r-b>18)&((g-b)<(r-g)*2.2)
 lum=np.clip(.2126*r+.7152*g+.0722*b,0,255).astype('uint8')
 result=np.zeros_like(arr);result[:,:,:3]=lum[:,:,None];result[:,:,3]=np.where(mask,arr[:,:,3],0)
 return Image.fromarray(result)
metadata=ROOT/'assets/source/skin-masks/candidates';metadata.mkdir(parents=True,exist_ok=True)
index={};start=time.time()
for a in variants:
 for seq in sequences:
  name=f'{a}-{seq}'
  if args.only and name not in args.only.split(','):continue
  e=manifest['atlases'][name];dest=out/f'{name}.png'
  record_path=metadata/f'{name}.json'
  if not args.force and dest.exists() and record_path.exists() and json.loads(record_path.read_text()).get('sourceSha256')==e['sha256']:continue
  atlas=Image.open(source/e['file']).convert('RGBA');mask=Image.new('RGBA',atlas.size)
  records=[]
  for record in e['records']:
   d=manifest['directions'].index(record['direction']);f=record['frame'];cell=e['cell'];x=(d if e['framesPerDirection']==1 else f)*cell;y=0 if e['framesPerDirection']==1 else d*cell
   frame=atlas.crop((x,y,x+cell,y+cell));bbox=frame.getbbox()
   layer=candidate(frame.crop(bbox),'mounted-' in seq);mask.paste(layer,(x+bbox[0],y+bbox[1]))
   records.append({'direction':record['direction'],'frame':f,'pixels':int(np.count_nonzero(np.array(layer)[:,:,3]))})
  mask.save(dest,optimize=True)
  record_path.write_text(json.dumps({'sourceSha256':e['sha256'],'records':records}))
  print(name,round(time.time()-start,1),flush=True)
