"""Install original fictional player portraits, retaining exact generation prompts."""
from pathlib import Path
import json,shutil,hashlib,subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parent
CAMPAIGN=ROOT.parent/'campaigns/granaderos/assets'
CAMPAIGN.mkdir(parents=True,exist_ok=True)
entries=json.loads((ROOT/'prompts/custom-avatars.json').read_text());manifest=[]
for entry in entries:
 source=ROOT/f"source/{entry['id']}-v1.png"
 if not source.exists():shutil.copy2(entry['source'],source)
 image=Image.open(source).convert('RGB');assert image.width==image.height
 image=image.resize((384,384),Image.Resampling.LANCZOS)
 path=ROOT/f"web/{entry['id']}.webp";image.save(path,'WEBP',quality=87,method=6)
 shutil.copy2(path,CAMPAIGN/path.name)
 manifest.append({'id':entry['id'],'file':'/campaigns/granaderos/assets/'+path.name,'source':str(source.relative_to(ROOT.parent)),'size':[384,384],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fictional':True})
(ROOT/'web/custom-avatars.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copy2(ROOT/'web/custom-avatars.json',CAMPAIGN/'custom-avatars.json')
print([(p['id'],p['bytes']) for p in manifest])

subprocess.run(['node',str(ROOT.parent/'tools/campaign-authoring.mjs'),'assets',str(CAMPAIGN.parent)],check=True)
