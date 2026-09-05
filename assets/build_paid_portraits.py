"""Install original fictional paid recruit portraits, retaining exact generation prompts."""
from pathlib import Path
import json,shutil,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parent
entries=json.loads((ROOT/'prompts/paid-portraits.json').read_text());manifest=[]
for entry in entries:
 source=ROOT/f"source/paid-portrait-{entry['id']}-v1.png"
 if not source.exists():shutil.copy2(entry['source'],source)
 image=Image.open(source).convert('RGB');assert image.width==image.height
 image=image.resize((384,384),Image.Resampling.LANCZOS)
 path=ROOT/f"web/portrait-{entry['id']}.webp";image.save(path,'WEBP',quality=87,method=6)
 shutil.copy2(path,ROOT.parent/'web/public/art'/path.name)
 manifest.append({'id':entry['id'],'file':'/art/'+path.name,'source':str(source.relative_to(ROOT.parent)),'size':[384,384],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fictional':True})
(ROOT/'web/paid-portraits.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copy2(ROOT/'web/paid-portraits.json',ROOT.parent/'web/public/art/paid-portraits.json')
print([(p['id'],p['bytes']) for p in manifest])
