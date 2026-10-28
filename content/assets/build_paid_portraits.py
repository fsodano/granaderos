"""Install original fictional paid recruit portraits, retaining exact generation prompts."""
from pathlib import Path
import json,shutil,hashlib,subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parent
CAMPAIGN=ROOT.parent/'campaigns/granaderos/assets'
CAMPAIGN.mkdir(parents=True,exist_ok=True)
entries=json.loads((ROOT/'prompts/paid-portraits.json').read_text());manifest=[]
for entry in entries:
 source=ROOT/f"source/paid-portrait-{entry['id']}-v1.png"
 if not source.exists():shutil.copy2(entry['source'],source)
 image=Image.open(source).convert('RGB');assert image.width==image.height
 image=image.resize((384,384),Image.Resampling.LANCZOS)
 path=ROOT/f"web/portrait-{entry['id']}.webp";image.save(path,'WEBP',quality=87,method=6)
 shutil.copy2(path,CAMPAIGN/path.name)
 manifest.append({'id':entry['id'],'file':'/campaigns/granaderos/assets/'+path.name,'source':str(source.relative_to(ROOT.parents[1])),'size':[384,384],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fictional':True})
(ROOT/'web/paid-portraits.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copy2(ROOT/'web/paid-portraits.json',CAMPAIGN/'paid-portraits.json')
print([(p['id'],p['bytes']) for p in manifest])

subprocess.run(['node',str(ROOT.parents[1]/'tools/campaign-authoring.mjs'),'assets',str(CAMPAIGN.parent)],check=True)
