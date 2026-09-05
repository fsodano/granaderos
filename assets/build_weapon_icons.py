#!/usr/bin/env python3
"""Extract original generated inventory sheets to canonical game weapon icons."""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
NAMES=[
 'Brown Bess modelo India','Charleville Modèle 1777','Fusil Baker 1800',
 'Tercerola de Caballería','Escopeta Criolla','Pistola de Arzón',
 'Pistola de Duelo','Trabuco Naranjero','Pistola Doble Cañón',
 'Sable Corvo Sanmartiniano','Sable de Caroya','Bayoneta de Cubo',
 'Lanza de Tacuara','Facón Gaucho',
]

def main():
 firearms=ROOT/'source/firearms-inventory-v1.png'
 melee=ROOT/'source/melee-inventory-v1.png'
 sheets=[Image.open(firearms).convert('RGBA'),Image.open(melee).convert('RGBA')]
 manifest={'generated_with':'OpenAI built-in image_gen','dimensions':[256,128],
 'interpretation':'Original historical game illustrations; display lengths are normalized, not physical scale.',
 'sources':[{'path':f'assets/source/{p.name}','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
  'prompt':f'assets/prompts/{p.stem}.txt'} for p in [firearms,melee]],'weapons':[]}
 # Measured source row boundaries preserve each full blade; the generative grid
 # is approximate and the curved first saber extends past one nominal fifth.
 melee_rows=[0,285,515,745,935,1254]
 for index,name in enumerate(NAMES):
  sheet=sheets[index>=9]
  if index<9:
   x,y=index%3,index//3
   box=(round(x*sheet.width/3),round(y*sheet.height/3),round((x+1)*sheet.width/3),round((y+1)*sheet.height/3))
  else:
   row=index-9;box=(0,melee_rows[row],sheet.width,melee_rows[row+1])
  cut=sheet.crop(box)
  # Ignore near-transparent generator padding when measuring content, keeping
  # four pixels of margin and retaining original alpha within the crop.
  visible=cut.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()
  assert visible is not None
  visible=(max(0,visible[0]-4),max(0,visible[1]-4),min(cut.width,visible[2]+4),min(cut.height,visible[3]+4))
  cut=cut.crop(visible);cut.thumbnail((240,112),Image.Resampling.LANCZOS)
  icon=Image.new('RGBA',(256,128));icon.alpha_composite(cut,((256-cut.width)//2,(128-cut.height)//2))
  id=1800+index;filename=f'weapon-{id}.png';target=ROOT/'web'/filename
  icon.save(target,optimize=True)
  manifest['weapons'].append({'id':id,'name':name,'file':filename,'source_index':int(index>=9),
   'source_cell':list(box),'source_content_bounds':list(visible),'width':256,'height':128,
   'alpha_bounds':list(icon.getchannel('A').getbbox()),'bytes':target.stat().st_size,
   'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
 (ROOT/'web/weapon-icons.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'Extracted {len(NAMES)} weapon icons, canonical IDs1800–1813.')

if __name__=='__main__':main()
