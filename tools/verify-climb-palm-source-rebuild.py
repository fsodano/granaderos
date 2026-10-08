#!/usr/bin/env python3
"""Recover the retained native input and reproduce its finger cut twice."""
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
import argparse,copy,hashlib,json,shutil,subprocess,tempfile

def module(name,path):
 spec=spec_from_file_location(name,path);out=module_from_spec(spec);spec.loader.exec_module(out);return out

p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--output',type=Path,default=Path('artifacts/palm-source-rebuild.json'));a=p.parse_args();root=a.root.resolve();sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest();builder=module('palm_builder',root/'tools/characters-3d/build-climb-palm-support.py');recipe=module('palm_recipe',root/'assets/source/characters-3d/authoring/climb_palm_support.py');merge=module('palm_merge',root/'tools/characters-3d/merge-animation-bank.py')
with tempfile.TemporaryDirectory(prefix='granaderos-palm-rebuild-') as name:
 target=Path(name);tools=target/'tools/characters-3d';tools.mkdir(parents=True);authoring=target/'assets/source/characters-3d/authoring';authoring.mkdir(parents=True);out=target/'web/public/models/characters';out.mkdir(parents=True)
 for path in ['build-climb-palm-support.py','merge-animation-bank.py','build-gesture-support.py']:shutil.copyfile(root/'tools/characters-3d'/path,tools/path)
 shutil.copyfile(root/'assets/source/characters-3d/authoring/climb_palm_support.py',authoring/'climb_palm_support.py')
 for preset in ['granadero','woman-scout']:(out/(preset+'-lod0.glb')).symlink_to(root/'web/public/models/characters'/(preset+'-lod0.glb'))
 manifest=json.loads((root/'web/public/models/characters/manifest.json').read_text());inputs={};before=copy.deepcopy(manifest)
 for gender in ['male','female']:
  path=root/'web/public/models/characters'/Path(manifest['animationLibraries'][gender]['url']).name;doc,binary=merge.read_glb(path);doc,binary=builder.retained_before(doc,binary,recipe);saved=target/('before-'+gender+'.glb');merge.write_glb(saved,doc,binary);inputs[gender]=saved;bank=before['animationLibraries'][gender];bank['sha256']=sha(saved);bank['bytes']=saved.stat().st_size
  for clip in bank['clips']:
   if clip['name'] in recipe.NAMES:clip.pop('nativeRoofFingerSupport',None)
  native=root/'web/public/models/characters'/('palm-before-'+gender+'-animations.glb')
  if native.exists():assert sha(native)==sha(saved),'Recovered original bank bytes differ'
 records=[]
 for run in [1,2]:
  for gender,path in inputs.items():shutil.copyfile(path,out/(gender+'-animations.glb'))
  (out/'manifest.json').write_text(json.dumps(before,indent=2)+'\n');subprocess.run(['python3',str(tools/'build-climb-palm-support.py'),'--root',str(target),'--receipt',str(target/'receipt.json')],check=True,capture_output=True)
  pins={path.name:sha(path) for path in [out/'male-animations.glb',out/'female-animations.glb',out/'manifest.json']};records.append({'run':run,'pins':pins,'proof':json.loads((target/'receipt.json').read_text())})
 assert records[0]['pins']==records[1]['pins'],'Deterministic named rebuild changed'
 expected={path:sha(root/'web/public/models/characters'/path) for path in records[0]['pins']};assert expected==records[0]['pins'],'Reviewed private bank differs from source rebuild'
 report={'inputs':{p.name:sha(p) for p in inputs.values()},'recipeSha256':sha(authoring/'climb_palm_support.py'),'records':records,'retainedPredecessorRecovered':True,'deterministic':True,'reviewedOutputsExact':True};a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'deterministic':True,'reviewedOutputsExact':True,'pins':records[0]['pins']},indent=2))
