import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const python = source => JSON.parse(execFileSync('python3', ['-c', `
from pathlib import Path
import importlib.util, json, copy, tempfile, hashlib, sys
root=Path.cwd()
sys.path.insert(0,str(root/'tools/characters-3d'))
s=importlib.util.spec_from_file_location('library',root/'tools/characters-3d/library_manifest.py')
library=importlib.util.module_from_spec(s);s.loader.exec_module(library)
assets=root/'web/public/models/characters';previous=json.loads((assets/'manifest.json').read_text())
verified_families=set()
predecessor_scope=None;predecessor=None
def predecessor_root():
 global predecessor_scope,predecessor
 if predecessor is None:
  from apparel_surface_context import create_predecessor_snapshot
  predecessor_scope=tempfile.TemporaryDirectory(prefix='granaderos-native-fixture-');predecessor=Path(predecessor_scope.name)/'predecessor'
  snapshot=create_predecessor_snapshot(root,predecessor,link_assets=True);assert snapshot['releasedInputsExact']
 return predecessor
def native_body_and_record(preset,lod):
 s=importlib.util.spec_from_file_location('native_fixture_glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
 native_root=predecessor_root();native_assets=native_root/'web/public/models/characters';native_manifest=json.loads((native_assets/'manifest.json').read_text())
 record=copy.deepcopy(next(r for r in native_manifest['appearances'][preset]['lods'] if r['lod']==lod))
 doc,binary=glb.read_glb(native_assets/Path(record['url']).name)
 if 'familyClothDepth' in record:
  s=importlib.util.spec_from_file_location('native_fixture_family',root/'tools/characters-3d/build-family-cloth-depth.py');family=importlib.util.module_from_spec(s);s.loader.exec_module(family)
  if preset not in verified_families:family.verify_completed(native_root,[preset]);verified_families.add(preset)
  doc,binary=family.restore_body(doc,binary,record['familyClothDepth']);record=family.restore_record(record)
 return doc,binary,record
${source}
`], {cwd:new URL('..',import.meta.url),encoding:'utf8'}));

test('empty and unrelated stale source caches preserve every current library record', () => {
  const result = python(`
with tempfile.TemporaryDirectory() as folder:
 metadata=Path(folder);(metadata/'stale.json').write_text('invalid stale JSON')
 records=library.checked_job_records(metadata,assets,[])
 generated={'complete':False,'appearances':{},'animationLibraries':{}}
 merged=library.merge_job_manifest(previous,generated,assets,[])
 assert records=={} and merged==previous
 merged['equipment']['items'].clear()
 assert previous['equipment']['items']
 print(json.dumps({'exact':True,'bankSupportPreserved':True,'allAppearanceLODRecordsPreserved':True,'inputNotMutated':True}))
`);
  assert.deepEqual(result,{exact:true,bankSupportPreserved:true,allAppearanceLODRecordsPreserved:true,inputNotMutated:true});
});

test('explicit source jobs reject stale or mismatched receipts before changing records', () => {
  const result = python(`
job=('appearance','woman-shawl',1);body=assets/library.job_filename(job);before=body.read_bytes()
record=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1]);record.update(kind='appearance',preset='woman-shawl')
with tempfile.TemporaryDirectory() as folder:
 metadata=Path(folder);path=metadata/'woman-shawl-lod1.json';errors=[]
 for key,value in [('sha256','0'*64),('preset','friar'),('lod',2),('bytes',record['bytes']+1)]:
  changed=copy.deepcopy(record);changed[key]=value;path.write_text(json.dumps(changed))
  try:library.checked_job_records(metadata,assets,[job])
  except AssertionError:errors.append(key)
 path.write_text(json.dumps(record));fresh=library.checked_job_records(metadata,assets,[job])
 try:library.checked_job_records(metadata,assets,[job,job])
 except AssertionError:errors.append('duplicate')
 assert body.read_bytes()==before
 print(json.dumps({'rejected':errors,'requestedOnly':list(fresh),'sourceUnchanged':True}))
`);
  assert.deepEqual(result.rejected,['sha256','preset','lod','bytes','duplicate']);
  assert.deepEqual(result.requestedOnly,['woman-shawl-lod1.glb']); assert.equal(result.sourceUnchanged,true);
});

test('an identical body receipt keeps all reviewed fields and rejects stale triangle counts', () => {
  const result = python(`
fresh={k:v for k,v in previous['appearances']['woman-shawl']['lods'][1].items() if k in ('lod','url','triangles','bytes','drawCalls','sha256')}
generated={'appearances':{'woman-shawl':{'lods':[fresh]}},'animationLibraries':{'male':{'clips':[]}}}
merged=library.merge_job_manifest(previous,generated,assets,[('appearance','woman-shawl',1)])
assert merged==previous
fresh['triangles']-=1;rejected=False
try:library.merge_job_manifest(previous,generated,assets,[('appearance','woman-shawl',1)])
except AssertionError:rejected=True
assert rejected
print(json.dumps({'reviewedFieldsExact':True,'staleTriangleCountRejected':True,'untouchedBankAnchorsAndSupportExact':True}))
`);
  assert.deepEqual(result,{reviewedFieldsExact:true,staleTriangleCountRejected:true,untouchedBankAnchorsAndSupportExact:true});
});

test('one changed body owns its fresh record while both bank support tables and other LODs remain exact', () => {
  const result = python(`
import os
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
source=assets/'woman-shawl-lod1.glb';source_before=source.read_bytes()
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder)
 for p in assets.glob('*.glb'):os.link(p,target/p.name)
 doc,binary,native_record=native_body_and_record('woman-shawl',1);doc['extras']={'explicitChangedBodyFixture':True}
 staged=target/'fresh.glb';glb.write_glb(staged,doc,binary)
 selected=target/source.name;selected.unlink();staged.rename(selected)
 fresh={k:v for k,v in previous['appearances']['woman-shawl']['lods'][1].items() if k in ('lod','url','triangles','bytes','drawCalls','sha256')}
 fresh.update(sha256=library.digest(selected),bytes=selected.stat().st_size)
 generated={'appearances':{'woman-shawl':{'lods':[fresh]}},'animationLibraries':{'male':{'clips':[{'seatAnchor':[99,98,97],'nativeProneHealArmSupport':None}]}}}
 merged=library.merge_job_manifest(previous,generated,target,[('appearance','woman-shawl',1)])
 assert merged['appearances']['woman-shawl']['lods'][1]==fresh
 assert merged['animationLibraries']==previous['animationLibraries']
 for gender,bank in previous['animationLibraries'].items():
  assert library.digest(target/Path(bank['url']).name)==bank['sha256']
  assert json.dumps(merged['animationLibraries'][gender],sort_keys=True)==json.dumps(bank,sort_keys=True)
  assert bank['anchorCoordinates']['space']=='model-local'
  assert any(c.get('seatAnchorSpace')=='gltf-model-local' for c in bank['clips'])
  assert any(c.get('nativeProneHealArmSupport') for c in bank['clips'])
 masked=copy.deepcopy(merged);masked['appearances']['woman-shawl']['lods'][1]=previous['appearances']['woman-shawl']['lods'][1]
 assert masked==previous and source.read_bytes()==source_before
 print(json.dumps({'onlyRequestedRecordChanged':True,'bothNativeBankRecordsExact':True,'otherLODRecordsExact':True,'originalAssetUnchanged':True}))
`);
  assert.deepEqual(result,{onlyRequestedRecordChanged:true,bothNativeBankRecordsExact:true,otherLODRecordsExact:true,originalAssetUnchanged:true});
});

test('missing or duplicate selected LODs reject both fresh and current records', () => {
  const result = python(`
fresh=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1]);errors=[]
for kind,preset in [('appearance','woman-shawl'),('horse','')]:
 for duplicate in (False,True):
  rows=[copy.deepcopy(fresh),copy.deepcopy(fresh)] if duplicate else []
  generated={'appearances':{'woman-shawl':{'lods':rows}},'horse':{'lods':rows}}
  try:library.merge_job_manifest(previous,generated,assets,[(kind,preset,1)])
  except AssertionError as error:
   assert 'Missing or duplicate requested LOD' in str(error);errors.append(kind+(' duplicate' if duplicate else ' missing'))
for rows in ([],[fresh,fresh]):
 try:library.replace_lod(rows,fresh)
 except AssertionError:errors.append('current')
print(json.dumps({'rejected':errors,'currentUnchanged':previous==json.loads((assets/'manifest.json').read_text())}))
`);
  assert.deepEqual(result.rejected,['appearance missing','appearance duplicate','horse missing','horse duplicate','current','current']);
  assert.equal(result.currentUnchanged,true);
});

test('a failed direct-output receipt keeps the old manifest but cannot roll back the selected worker file', () => {
  const result = python(`
import os
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
source=assets/'woman-shawl-lod1.glb';source_before=source.read_bytes()
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder)/'assets';target.mkdir();metadata=Path(folder)/'receipts';metadata.mkdir()
 for p in assets.glob('*.glb'):os.link(p,target/p.name)
 manifest_bytes=(assets/'manifest.json').read_bytes();(target/'manifest.json').write_bytes(manifest_bytes)
 record=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1]);record.update(kind='appearance',preset='woman-shawl')
 (metadata/'woman-shawl-lod1.json').write_text(json.dumps(record))
 doc,binary,native_record=native_body_and_record('woman-shawl',1);doc['extras']={'failedDirectWorkerFixture':True}
 staged=target/'fresh.glb';glb.write_glb(staged,doc,binary)
 selected=target/source.name;selected.unlink();staged.rename(selected)
 rejected=False
 try:library.checked_job_records(metadata,target,[('appearance','woman-shawl',1)])
 except AssertionError as error:rejected='Stale source receipt' in str(error)
 assert rejected and (target/'manifest.json').read_bytes()==manifest_bytes
 assert selected.read_bytes()!=source_before and source.read_bytes()==source_before
 for bank in previous['animationLibraries'].values():assert library.digest(target/Path(bank['url']).name)==bank['sha256']
 print(json.dumps({'rejected':True,'oldManifestExact':True,'selectedOutputAlreadyChanged':True,'bankFilesExact':True,'originalTestSourceExact':True}))
`);
  assert.deepEqual(result,{rejected:true,oldManifestExact:true,selectedOutputAlreadyChanged:true,bankFilesExact:true,originalTestSourceExact:true});
});

test('palette postpass accepts raw and reviewed material states while retaining completed hem data', () => {
  const result = python(`
import io, math, shutil, subprocess
from PIL import Image
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
s=importlib.util.spec_from_file_location('palette_tool',root/'tools/characters-3d/build-woman-shawl-palette.py');palette_tool=importlib.util.module_from_spec(s);s.loader.exec_module(palette_tool)
states=[];unknown_rejected=False
with tempfile.TemporaryDirectory() as folder:
 for state in ('completed-hem','completed-charcoal','raw-charcoal','legacy-burgundy','unknown-pigment'):
  target=Path(folder)/state;out=target/'web/public/models/characters';out.mkdir(parents=True);(out/'textures').mkdir()
  for relative in ('tools/characters-3d/merge-animation-bank.py','assets/source/characters-3d/authoring/appearance_palette.py'):
   destination=target/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/relative,destination)
  current=copy.deepcopy(previous);old_binary={}
  for lod in (0,1,2):
   name=f'woman-shawl-lod{lod}.glb';doc,binary,native_record=native_body_and_record('woman-shawl',lod);old_binary[name]=bytes(binary)
   current['appearances']['woman-shawl']['lods'][lod]=native_record
   for image in doc['images']:
    if 'uri' in image:shutil.copy2(assets/image['uri'],out/image['uri'])
   mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')==f'Human_legwear_LOD{lod}');primitive=doc['meshes'][mesh]['primitives'][0]
   if state!='completed-hem':
    doc['meshes'][mesh]['extras'].pop('nativeSkirtHem',None);current['appearances']['woman-shawl']['lods'][lod].pop('nativeSkirtHem',None)
    index=next(i for i,m in enumerate(doc['materials']) if m.get('name')=='Apparel_Atlas_Charcoal_Legwear');primitive['material']=index
    if state!='completed-charcoal':doc['materials'][index]['name']='Apparel_Atlas'
    if state in ('legacy-burgundy','unknown-pigment'):
     texture=doc['textures'][doc['materials'][index]['pbrMetallicRoughness']['baseColorTexture']['index']];image=doc['images'][texture['source']]
     pixels=Image.open(out/image['uri']).convert('RGBA');side=pixels.width//32
     tiles={(math.floor(u*side),math.floor(v*side)) for u,v in palette_tool.uv_values(doc,binary,primitive['attributes']['TEXCOORD_0'])};assert len(tiles)==1
     x,y=next(iter(tiles));colour=(91,44,53,255) if state=='legacy-burgundy' else (1,2,3,255)
     for py in range(y*32,(y+1)*32):
      for px in range(x*32,(x+1)*32):pixels.putpixel((px,py),colour)
     encoded=io.BytesIO();pixels.save(encoded,format='PNG',compress_level=9);raw=encoded.getvalue();image['uri']='textures/'+hashlib.sha256(raw).hexdigest()[:20]+'.png';(out/image['uri']).write_bytes(raw)
   glb.write_glb(out/name,doc,binary);record=current['appearances']['woman-shawl']['lods'][lod];record.update(bytes=(out/name).stat().st_size,sha256=library.digest(out/name))
  (out/'manifest.json').write_text(json.dumps(current));pins={p.name:library.digest(p) for p in out.glob('*.glb')};manifest_pin=library.digest(out/'manifest.json')
  receipt=target/'receipt.json';run=subprocess.run(['python3',str(root/'tools/characters-3d/build-woman-shawl-palette.py'),'--root',str(target),'--receipt',str(receipt)],capture_output=True,text=True)
  if state=='unknown-pigment':
   assert run.returncode and 'Unrecognized source legwear pigment' in run.stderr
   assert library.digest(out/'manifest.json')==manifest_pin and all(library.digest(out/name)==pin for name,pin in pins.items());unknown_rejected=True;continue
  assert run.returncode==0,run.stderr
  rows=json.loads(receipt.read_text())['rows'];assert all(r['sourceState']==state for r in rows)
  merged=json.loads((out/'manifest.json').read_text());donor=merged['appearances']['woman-shawl']['lods'][0]['sha256']
  assert merged['animationLibraries']==previous['animationLibraries']
  for lod in (0,1,2):
   name=f'woman-shawl-lod{lod}.glb';doc,binary=glb.read_glb(out/name);assert bytes(binary)==old_binary[name]
   if lod:assert merged['appearances']['woman-shawl']['lods'][lod]['nativeClothTopology']['sourceSha256']==donor
   if state=='completed-hem':
    assert merged['appearances']['woman-shawl']['lods'][lod]['nativeSkirtHem']==previous['appearances']['woman-shawl']['lods'][lod]['nativeSkirtHem']
    assert library.digest(out/name)==pins[name]
  stable={p.name:library.digest(p) for p in out.glob('*.glb')};again=subprocess.run(['python3',str(root/'tools/characters-3d/build-woman-shawl-palette.py'),'--root',str(target)],capture_output=True,text=True)
  assert again.returncode==0,again.stderr
  assert all(library.digest(out/name)==pin for name,pin in stable.items())
  states.append(state)
print(json.dumps({'accepted':states,'unknownPigmentRejectedWithoutWrites':unknown_rejected,'nativeBinaryExact':True,'bankMetadataExact':True,'finalCloseDonorIdentity':True,'repeatExact':True}))
`);
  assert.deepEqual(result,{accepted:['completed-hem','completed-charcoal','raw-charcoal','legacy-burgundy'],unknownPigmentRejectedWithoutWrites:true,nativeBinaryExact:true,bankMetadataExact:true,finalCloseDonorIdentity:true,repeatExact:true});
});

test('coarse donor composition supplies hem classification and the retained UV0 palette resource', () => {
  const result = python(`
import shutil, subprocess
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder);out=target/'web/public/models/characters';out.mkdir(parents=True)
 for relative in ('tools/characters-3d','assets/source/characters-3d/authoring','web/lib','game'):
  shutil.copytree(root/relative,target/relative,ignore=shutil.ignore_patterns('__pycache__','.build'))
 for name in ('published-actor-fixture.mjs','tactical-render-loader.mjs'):
  destination=target/'tests'/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'tests'/name,destination)
 shutil.copy2(root/'package.json',target/'package.json');(target/'web/node_modules').symlink_to((root/'web/node_modules').resolve(),target_is_directory=True)
 current=copy.deepcopy(previous)
 for id in ('friar','woman-shawl'):
  for lod in (0,1,2):
   doc,binary,native_record=native_body_and_record(id,lod);glb.write_glb(out/f'{id}-lod{lod}.glb',doc,binary)
   current['appearances'][id]['lods'][lod]=native_record
 native_assets=predecessor_root()/'web/public/models/characters'
 for name in ('male-animations.glb','female-animations.glb','equipment.glb'):shutil.copy2(native_assets/name,out/name)
 current['equipment']=json.loads((native_assets/'manifest.json').read_text())['equipment']
 shutil.copytree(assets/'textures',out/'textures')
 # Model a fresh donor with updated native map bindings. Old coarse palette
 # materials remain, so names alone cannot identify the new active surface.
 path=out/'woman-shawl-lod0.glb';doc,binary=glb.read_glb(path)
 mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')=='Human_legwear_LOD0');primitive=doc['meshes'][mesh]['primitives'][0]
 charcoal=next(i for i,m in enumerate(doc['materials']) if m.get('name')=='Apparel_Atlas_Charcoal_Legwear')
 normal_index=doc['materials'][charcoal]['normalTexture']['index']
 for material in doc['materials']:
  if material.get('normalTexture',{}).get('index')==normal_index:material['normalTexture']['scale']=.85
 primitive['material']=charcoal;primitive['attributes'].pop('TEXCOORD_1');doc['meshes'][mesh]['extras'].pop('nativeSkirtHem');current['appearances']['woman-shawl']['lods'][0].pop('nativeSkirtHem')
 glb.write_glb(path,doc,binary);current['appearances']['woman-shawl']['lods'][0].update(bytes=path.stat().st_size,sha256=library.digest(path))
 for lod in (1,2):
  path=out/f'woman-shawl-lod{lod}.glb';doc,binary=glb.read_glb(path)
  mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')==f'Human_legwear_LOD{lod}');primitive=doc['meshes'][mesh]['primitives'][0]
  primitive['material']=next(i for i,m in enumerate(doc['materials']) if m.get('name')=='Apparel_Atlas');primitive['attributes'].pop('TEXCOORD_1')
  for key in ('nativeSkirtHem','nativeClothTopology'):doc['meshes'][mesh]['extras'].pop(key,None);current['appearances']['woman-shawl']['lods'][lod].pop(key,None)
  glb.write_glb(path,doc,binary);current['appearances']['woman-shawl']['lods'][lod].update(bytes=path.stat().st_size,sha256=library.digest(path))
 (out/'manifest.json').write_text(json.dumps(current))
 for tool in ('build-reviewed-long-cloth-lods.py','build-woman-shawl-palette.py','build-woman-shawl-hem.py','build-reviewed-long-cloth-lods.py'):
  run=subprocess.run(['python3',str(target/'tools/characters-3d'/tool)],cwd=target,capture_output=True,text=True)
  assert run.returncode==0,run.stdout+run.stderr
 completed=json.loads((out/'manifest.json').read_text());donor=completed['appearances']['woman-shawl']['lods'][0]['sha256']
 for lod in (1,2):
  doc,binary=glb.read_glb(out/f'woman-shawl-lod{lod}.glb');mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')==f'Human_legwear_LOD{lod}');record=completed['appearances']['woman-shawl']['lods'][lod]
  assert doc['meshes'][mesh]['extras']['nativeSkirtHem']==record['nativeSkirtHem']
  assert record['nativeClothTopology']['sourceSha256']==donor
  assert len([m for m in doc['materials'] if m.get('name')=='Apparel_Atlas_Charcoal_Legwear'])>=2
  active=doc['materials'][doc['meshes'][mesh]['primitives'][0]['material']]
  assert active['normalTexture']['scale']==.85
  assert 'TEXCOORD_1' in doc['meshes'][mesh]['primitives'][0]['attributes']
 assert completed['animationLibraries']==previous['animationLibraries']
 for bank in previous['animationLibraries'].values():assert library.digest(out/Path(bank['url']).name)==bank['sha256']
 stable={str(p.relative_to(out)):library.digest(p) for p in out.rglob('*') if p.is_file()}
 for tool in ('build-reviewed-long-cloth-lods.py','build-woman-shawl-palette.py','build-woman-shawl-hem.py','build-reviewed-long-cloth-lods.py'):
  run=subprocess.run(['python3',str(target/'tools/characters-3d'/tool)],cwd=target,capture_output=True,text=True);assert run.returncode==0,run.stdout+run.stderr
 assert stable=={str(p.relative_to(out)):library.digest(p) for p in out.rglob('*') if p.is_file()}
 print(json.dumps({'coarseHemClassificationRestored':True,'retainedUV0PaletteCopied':True,'finalDonorIdentity':True,'bothBankFilesAndMetadataExact':True,'orderedRepeatExact':True}))
`);
  assert.deepEqual(result,{coarseHemClassificationRestored:true,retainedUV0PaletteCopied:true,finalDonorIdentity:true,bothBankFilesAndMetadataExact:true,orderedRepeatExact:true});
});

test('completed layered surface replay keeps final bytes exact and safely rebases selected close and coarse sources', () => {
  const result = python(`
import subprocess
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(s);s.loader.exec_module(value);return value
context=module('family_surface_fixture',root/'tools/characters-3d/family_surface_context.py')
family=module('family_surface_export',root/'tools/characters-3d/build-family-cloth-depth.py')
apparel=module('apparel_surface_fixture',root/'tools/characters-3d/apparel_surface_context.py')
glb=module('family_surface_glb',root/'tools/characters-3d/merge-animation-bank.py')
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder).resolve();context._copy_inputs(root,target,context._pins(root));out=target/'web/public/models/characters'
 def files():return {str(p.relative_to(out)):library.digest(p) for p in out.rglob('*') if p.is_file()}
 def run(tool,label,*arguments):
  receipt=target/(label+'.json')
  result=subprocess.run(['python3',str(target/'tools/characters-3d'/tool),'--root',str(target),'--receipt',str(receipt),*arguments],cwd=target,capture_output=True,text=True)
  assert result.returncode==0,result.stdout+result.stderr
  return json.loads(receipt.read_text())
 stable=files()
 apparel.verify_layer(target)
 for tool in ('build-reviewed-long-cloth-lods.py','build-woman-shawl-palette.py','build-woman-shawl-hem.py'):
  receipt=run(tool,tool)
  assert receipt['exactNoOp'] and not receipt['changedFiles']
  assert files()==stable
 for layer in ('pilot','family'):
  receipt=run('build-layered-cloth-depth.py','completed-'+layer,'--layer',layer)
  assert receipt['exactNoOp'] and not receipt['changedFiles']
  assert files()==stable
 def verify_family(label,allow_stale_donor=False):
  snapshot=target/label
  apparel.create_predecessor_snapshot(target,snapshot,allow_stale_donor=allow_stale_donor,link_assets=True)
  family.verify_completed(snapshot,['friar','woman-shawl'])
 # Model an explicitly selected fresh source body. Restore its actual native
 # stream first, then retain a source marker that must survive all postpasses.
 def fresh(preset,lod,label):
  mp=out/'manifest.json';manifest=json.loads(mp.read_text());record=manifest['appearances'][preset]['lods'][lod];path=out/Path(record['url']).name
  doc,binary,record=apparel.unwrap_body_and_record(target,preset,lod)
  doc,binary=family.restore_body(doc,binary,record['familyClothDepth']);record=family.restore_record(record)
  doc.setdefault('extras',{})[label]=True;raw=glb.write_glb(path,doc,binary)
  record.update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest());manifest['appearances'][preset]['lods'][lod]=record;mp.write_text(json.dumps(manifest,indent=2)+'\\n')
 fresh('friar',0,'selectedCloseSourceFixture')
 # The old coarse receipts remain valid; their old final donor links are stale
 # until native topology is rebuilt from the selected fresh close source.
 strict_rejected=False
 try:verify_family('stale-lower-state',allow_stale_donor=True)
 except AssertionError as error:strict_rejected='Completed coarse donor identity is stale' in str(error)
 assert strict_rejected
 strict_apparel_rejected=False
 try:apparel.verify_layer(target)
 except AssertionError as error:strict_apparel_rejected='Delivered apparel surface differs from its recipe' in str(error)
 assert strict_apparel_rejected
 receipt=run('build-reviewed-long-cloth-lods.py','mixed-close')
 assert not receipt['exactNoOp']
 apparel.verify_layer(target);verify_family('completed-close-lower-state')
 close_changes={name for name,pin in files().items() if stable.get(name)!=pin}
 assert close_changes=={'manifest.json','friar-lod0.glb','friar-lod1.glb','friar-lod2.glb'},close_changes
 completed=json.loads((out/'manifest.json').read_text());donor=completed['appearances']['friar']['lods'][0]['sha256']
 doc,binary=glb.read_glb(out/'friar-lod0.glb');assert doc['extras']['selectedCloseSourceFixture'] is True
 for lod in (1,2):
  record=completed['appearances']['friar']['lods'][lod];doc,binary=glb.read_glb(out/f'friar-lod{lod}.glb')
  mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')==f'Human_outfit_LOD{lod}')
  assert doc['meshes'][mesh]['extras']['nativeClothTopology']['sourceSha256']==record['nativeClothTopology']['sourceSha256']==donor
 before_coarse=files();fresh('woman-shawl',1,'selectedCoarseSourceFixture')
 receipt=run('build-reviewed-long-cloth-lods.py','mixed-coarse');assert not receipt['exactNoOp']
 apparel.verify_layer(target);verify_family('completed-coarse-lower-state')
 coarse_changes={name for name,pin in files().items() if before_coarse.get(name)!=pin}
 assert coarse_changes=={'manifest.json','woman-shawl-lod1.glb'},coarse_changes
 doc,binary=glb.read_glb(out/'woman-shawl-lod1.glb');assert doc['extras']['selectedCoarseSourceFixture'] is True
 assert json.loads((out/'manifest.json').read_text())['animationLibraries']==previous['animationLibraries']
 for bank in previous['animationLibraries'].values():assert library.digest(out/Path(bank['url']).name)==bank['sha256']
 print(json.dumps({'allCompletedPassesByteExact':True,'selectedCloseRebasedWithFinalDonorLinks':True,'selectedCoarseRebased':True,'nativeSourceMarkersRetained':True,'bothBanksExact':True,'otherLibraryFilesExact':True}))
`);
  assert.deepEqual(result,{allCompletedPassesByteExact:true,selectedCloseRebasedWithFinalDonorLinks:true,selectedCoarseRebased:true,nativeSourceMarkersRetained:true,bothBanksExact:true,otherLibraryFilesExact:true});
});
