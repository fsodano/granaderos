import test from 'node:test';
import {standingBankPredecessorView} from './standing-bank-predecessor-fixture.mjs';
import assert from 'node:assert/strict';
import {triangleNormal,decodedGlb,primitiveFor,triangleIndices,canonicalTriangles} from './coarse-garment-geometry-fixture.mjs';
import {readFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Vector3} from '../web/node_modules/three/build/three.module.js';

// The 44/88px front/side/rear review decides visual acceptance. These
// independent stream/normal/lineage gates cannot be replaced by pixel changes.
// A complete private candidate can run the same gates before publication.
const root=process.env.GRANADEROS_COARSE_TEST_ROOT?pathToFileURL(resolve(process.env.GRANADEROS_COARSE_TEST_ROOT)+'/'):new URL('..',import.meta.url),assets=new URL('web/public/models/characters/',root);
const baseline=JSON.parse(readFileSync(new URL('./character-coarse-garment-surfaces-baseline.json',import.meta.url)));
const targets=[['gaucho',1,414,0],['gaucho',2,154,0]];
const ownedNames=new Set(targets.map(([preset,lod])=>`${preset}-lod${lod}`));
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const jsonHash=value=>hash(JSON.stringify(stable(value)));
const python=(source,...arguments_)=>JSON.parse(execFileSync('python3',['-c',source,...arguments_],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}));
let native;
function nativeView(){
 if(native)return native;
 const folder=mkdtempSync(join(tmpdir(),'granaderos-coarse-current-test-'));process.on('exit',()=>rmSync(folder,{recursive:true,force:true}));
 const result=python(String.raw`
from pathlib import Path
import sys,json,copy
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import create_native_snapshot,_module
target=Path(sys.argv[1]);receipt=create_native_snapshot(root,target,link_assets=True)
tool=_module('current_correction_test',root/'tools/characters-3d/build-coarse-garment-surfaces.py')
glb=_module('current_correction_glb',root/'tools/characters-3d/merge-animation-bank.py')
verified=tool.verify_completed(target);assets=target/'web/public/models/characters'
manifest=json.loads((assets/'manifest.json').read_bytes());originals=target/'test-originals';originals.mkdir()
for preset,lod in tool.TARGETS:
 record=next(row for row in manifest['appearances'][preset]['lods'] if row['lod']==lod)
 if tool.FIELD not in record:continue
 doc,binary=glb.read_glb(assets/Path(record['url']).name)
 restored,before_binary=tool.restore_body(doc,binary,record[tool.FIELD]);before_record=tool.restore_record(record)
 (originals/f'{preset}-lod{lod}.glb').write_bytes(tool.encode_glb(restored,before_binary))
 (originals/f'{preset}-lod{lod}.json').write_text(json.dumps(before_record))
print(json.dumps({'root':str(target),'receipt':receipt,'verified':verified}))
`,join(folder,'root'));
 native={...result,assets:join(result.root,'web/public/models/characters'),manifest:JSON.parse(readFileSync(join(result.root,'web/public/models/characters/manifest.json')))};
 assert.equal(native.receipt.releasedInputsExact,true);assert.equal(native.verified.pendingWrites,0);assert.ok(native.verified.rows.every(row=>ownedNames.has(`${row.preset}-lod${row.lod}`)),'A private partial candidate may contain only approved correction jobs');
 return native;
}
function ownedMask(body,primitive,anchor){const uv=body.rows(primitive.attributes.TEXCOORD_0);return triangleIndices(body,primitive).flatMap((triangle,i)=>triangle.every(vertex=>uv[vertex].every((value,axis)=>Math.abs(value-anchor[axis])<1e-7))?[i]:[]);}
function state(preset,lod){const view=nativeView(),name=`${preset}-lod${lod}`,record=view.manifest.appearances[preset].lods.find(row=>row.lod===lod),body=decodedGlb(join(view.assets,name+'.glb')),original=decodedGlb(join(view.root,'test-originals',name+'.glb')),before=JSON.parse(readFileSync(join(view.root,'test-originals',name+'.json'))),p=primitiveFor(body,`Human_outfit_LOD${lod}`).primitive,op=primitiveFor(original,`Human_outfit_LOD${lod}`).primitive;return {name,record,body,original,before,p,op,meta:record.coarseGarmentSurface};}

for(const[preset,lod,oldCount,growth]of targets)test(`${preset} LOD${lod} correction restores the complete approved native body and changes only its bounded outfit part`,()=>{
 const {name,record,body,original,before,p,op,meta}=state(preset,lod),anchor=baseline.nativeAnchors[name],item=meta.primitive;
 assert.equal(hash(original.raw),anchor.sha256);assert.equal(jsonHash(original.json),anchor.jsonSha256);assert.equal(hash(original.binary),anchor.binarySha256);assert.equal(original.binary.length,anchor.binaryBytes);assert.equal(jsonHash(before),anchor.recordJSONSha256,'The complete original native LOD record matches the approved predecessor');
 assert.deepEqual(body.binary.subarray(0,original.binary.length),original.binary,'Every original binary byte survives as an exact prefix');
 assert.deepEqual(body.json.extras.coarseGarmentSurface,meta);assert.equal(meta.beforeSha256,anchor.sha256);assert.equal(meta.originalRecord,undefined);
 for(const[path,pin]of Object.entries(meta.recipe.sourceSha256))assert.equal(hash(readFileSync(new URL(path,root))),pin);
 assert.deepEqual(meta.recipe.targets.map(row=>`${row.preset}-lod${row.lod}`).sort(),[...ownedNames].sort(),'The production recipe authorizes exactly two coarse ponchos');
 for(const field of ['materials','textures','images','samplers','skins','nodes','scenes','scene','animations','extensions','extensionsUsed','extensionsRequired','asset'])assert.deepEqual(body.json[field],original.json[field],`${field} stays exact`);
 assert.equal(body.json.meshes.length,original.json.meshes.length);assert.equal(body.json.meshes.reduce((sum,mesh)=>sum+mesh.primitives.length,0),before.drawCalls);assert.equal(record.drawCalls,before.drawCalls);
 assert.deepEqual(body.json.accessors.slice(0,original.json.accessors.length),original.json.accessors);assert.deepEqual(body.json.bufferViews.slice(0,original.json.bufferViews.length),original.json.bufferViews);
 const restored=structuredClone(body.json);restored.meshes[item.mesh].primitives[item.primitive].attributes=op.attributes;restored.meshes[item.mesh].primitives[item.primitive].indices=op.indices;restored.accessors=restored.accessors.slice(0,meta.originalAccessorCount);restored.bufferViews=restored.bufferViews.slice(0,meta.originalViewCount);restored.buffers=meta.originalBuffers;delete restored.extras.coarseGarmentSurface;if(!meta.originalHadExtras)delete restored.extras;
 assert.deepEqual(restored,original.json,'Only appended attribute/index bindings and the receipt change complete native JSON');
 for(let mi=0;mi<body.json.meshes.length;mi++)for(let pi=0;pi<body.json.meshes[mi].primitives.length;pi++)if(mi!==item.mesh||pi!==item.primitive){assert.deepEqual(body.json.meshes[mi].primitives[pi],original.json.meshes[mi].primitives[pi]);assert.deepEqual(canonicalTriangles(body,body.json.meshes[mi].primitives[pi]),canonicalTriangles(original,original.json.meshes[mi].primitives[pi]),'Every unowned primitive and morph target corner is exact');}
 const oldMask=ownedMask(original,op,[.015625,.984375]),newMask=ownedMask(body,p,[.015625,.984375]);assert.equal(oldMask.length,oldCount);assert.deepEqual(oldMask,item.oldOwnedTriangles);assert.deepEqual(newMask,item.ownedTriangles);
 assert.ok(newMask.length-oldMask.length<=growth);assert.equal(record.triangles,before.triangles+newMask.length-oldMask.length);
 const oldSet=new Set(oldMask),newSet=new Set(newMask),oldUnowned=triangleIndices(original,op).flatMap((_,i)=>oldSet.has(i)?[]:[i]),newUnowned=triangleIndices(body,p).flatMap((_,i)=>newSet.has(i)?[]:[i]);
 assert.deepEqual(canonicalTriangles(body,p,newUnowned),canonicalTriangles(original,op,oldUnowned),'All unowned oriented outfit triangles retain UVs, colours, normals and skin rows');
 for(const[key,index]of Object.entries(op.attributes))assert.deepEqual(body.rows(p.attributes[key]).slice(0,original.rows(index).length),original.rows(index),`Retained ${key} rows stay exact, including unused native rows`);
 assert.deepEqual(Object.keys(p.attributes).sort(),Object.keys(op.attributes).sort());assert.equal(p.material,op.material);
 const positions=body.rows(p.attributes.POSITION),indices=triangleIndices(body,p),normals=body.rows(p.attributes.NORMAL);
 assert.equal(meta.role,'poncho');assert.equal(newMask.length,oldCount);assert.deepEqual(canonicalTriangles(body,p,newMask,['NORMAL']),canonicalTriangles(original,op,oldMask,['NORMAL']),'Poncho changes only corner normals');assert.equal((meta.correspondence??[]).length,0);
 for(const index of newMask){const normal=triangleNormal(indices[index].map(vertex=>positions[vertex]));assert.ok(normal.lengthSq()>.99);for(const vertex of indices[index]){const corner=new Vector3(...normals[vertex]);assert.ok(Math.abs(corner.length()-1)<1e-5,'Every delivered panel normal has unit length');assert.ok(normal.dot(corner)>.999,'Every poncho corner follows its oriented geometric panel');}}
 const published=decodedGlb(new URL(name+'.glb',assets)),publishedPrimitive=primitiveFor(published,`Human_outfit_LOD${lod}`).primitive,publishedOwned=ownedMask(published,publishedPrimitive,[.015625,.984375]),publishedSet=new Set(publishedOwned),publishedUnowned=triangleIndices(published,publishedPrimitive).flatMap((_,i)=>publishedSet.has(i)?[]:[i]),pins=baseline.publishedCorners[name];
 assert.equal(hash(JSON.stringify(canonicalTriangles(published,publishedPrimitive,null,['NORMAL']))),pins.outfitExceptNormal,'Actual published POSITION,UV,COLOR_0,JOINTS and WEIGHTS stay exact after frozen family/apparel replay');
 assert.equal(hash(JSON.stringify(canonicalTriangles(published,publishedPrimitive,publishedOwned,['NORMAL']))),pins.ownedExceptNormal);assert.equal(hash(JSON.stringify(canonicalTriangles(published,publishedPrimitive,publishedUnowned))),pins.unowned,'All unowned published corner normals and visible pigment stay exact');
 for(const[key,pin]of Object.entries(pins.otherPrimitives)){const[mesh,primitive]=key.split(':').map(Number);assert.equal(hash(JSON.stringify(canonicalTriangles(published,published.json.meshes[mesh].primitives[primitive]))),pin,'Complete unowned published primitive/morph corner streams stay exact');}
});

test('current complete library keeps every unowned body, protected texture, bank, rig, equipment and close LOD exact',()=>{
 const view=nativeView();assert.deepEqual(view.verified.rows.map(row=>`${row.preset}-lod${row.lod}`).sort(),[...ownedNames].sort(),'The delivered candidate contains the complete approved two-job correction set');const manifest=JSON.parse(readFileSync(new URL('manifest.json',assets)));
 for(const[name,pin]of Object.entries(baseline.bodies))if(!ownedNames.has(name)){assert.equal(hash(readFileSync(new URL(name+'.glb',assets))),pin,name);const[preset,lod]=name.split('-lod');assert.equal(jsonHash(manifest.appearances[preset].lods.find(row=>row.lod===Number(lod))),baseline.recordJSONSha256[name]);}
 for(const[uri,pin]of Object.entries(baseline.textures))assert.equal(hash(readFileSync(new URL(uri,assets))),pin,'All released palette/MR/normal maps remain exact');
 const oldBanks=standingBankPredecessorView(root);assert.equal(oldBanks.receipt.standingBanksRestoredExact,true);
 for(const[name,pin]of Object.entries(baseline.otherGLBs))assert.equal(hash(readFileSync(new URL(name,name.endsWith('-animations.glb')?oldBanks.assets:assets))),pin,name);
 assert.equal(jsonHash(manifest.equipment),baseline.equipment.recordJSONSha256);for(const[gender,bank]of Object.entries(oldBanks.manifest.animationLibraries))assert.equal(jsonHash(bank),baseline.banks[gender].recordJSONSha256);
 assert.equal(jsonHash(manifest.horse),baseline.horse.recordJSONSha256);
 const referenced=new Set();for(const appearance of Object.values(manifest.appearances))for(const record of appearance.lods){const body=decodedGlb(new URL(record.url.replace('/models/characters/',''),assets));for(const image of body.json.images??[])if(image.uri)referenced.add(image.uri);}
 for(const name of readdirSync(new URL('textures/',assets)))if(!baseline.textures['textures/'+name])assert.ok(referenced.has('textures/'+name)&&/^[a-f0-9]{20}\.png$/.test(name),'New maps are referenced content-addressed assets');
 assert.deepEqual(readdirSync(assets).filter(name=>name.endsWith('.glb')).sort(),[...Object.keys(baseline.bodies).map(name=>name+'.glb'),...Object.keys(baseline.otherGLBs)].sort(),'No extra GLB or draw inventory');
});

test('frozen family adapter accepts only exact split poncho lineage, retains normal fallback rejection and repeats without writes',()=>{
 const view=nativeView(),result=python(String.raw`
from pathlib import Path
import sys,json,copy,tempfile,subprocess,hashlib,os
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import _module
from family_surface_context import _copy_inputs,_pins,_check_pins
import family_fold_context as adapter
tool=_module('adapter_correction_test',root/'tools/characters-3d/build-coarse-garment-surfaces.py');glb=_module('adapter_glb_test',root/'tools/characters-3d/merge-animation-bank.py')
frozen=_module('adapter_frozen_test',root/'tools/characters-3d/build-family-cloth-depth.py');recipe=frozen.recipe_for(root)[0]
native=Path(sys.argv[1]);assets=native/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes());pins=_pins(root)
adapted=adapter.installer_for(native).recipe_for(native)[0];checked=[]
for record in manifest['appearances']['gaucho']['lods']:
 if tool.FIELD not in record:continue
 doc,binary=glb.read_glb(assets/Path(record['url']).name);meta=record[tool.FIELD];_,primitive=tool.primitive_for(doc,record['lod']);positions=tool.rows(doc,binary,primitive['attributes']['POSITION']);uv=tool.rows(doc,binary,primitive['attributes']['TEXCOORD_0']);triangles=tool.triangles(doc,binary,primitive);indices=[vertex for triangle in triangles for vertex in triangle]
 selected,protected=adapted.selections('gaucho','outfit',positions,indices,uv);assert not protected
 before,old_binary=tool.restore_body(doc,binary,meta);_,op=tool.primitive_for(before,record['lod']);original=recipe.selections('gaucho','outfit',tool.rows(before,old_binary,op['attributes']['POSITION']),[vertex for triangle in tool.triangles(before,old_binary,op) for vertex in triangle],tool.rows(before,old_binary,op['attributes']['TEXCOORD_0']))[0]
 active={vertex for index in meta['primitive']['ownedTriangles'] for vertex in triangles[index]};assert selected==original|active,'The adapter expands only the exact original connected drape'
 assert adapted.selections('gaucho','footwear',positions,indices,uv)==recipe.selections('gaucho','footwear',positions,indices,uv),'Unowned parts keep the original selector'
 checked.append(record['lod'])
# A hem island disconnected from the shoulder still fails the frozen rule.
disconnected=[[0,.89,0],[.1,.9,0],[0,.91,.1],[0,1.5,0],[.1,1.5,0],[0,1.6,.1]];disconnected_indices=[0,1,2,3,4,5];disconnected_uv=[(.015625,.984375)]*6
rejected=[]
try:adapted.selections('gaucho','outfit',disconnected,disconnected_indices,disconnected_uv)
except AssertionError as error:assert 'Ambiguous hanging-cloth component' in str(error);rejected.append('unreceipted-disconnected-drape')
else:raise AssertionError('Adapter accepted unrelated disconnected cloth')
with tempfile.TemporaryDirectory(prefix='granaderos-poncho-adapter-test-') as folder:
 target=Path(folder)/'root';_copy_inputs(native,target,_pins(native));out=target/'web/public/models/characters';mp=out/'manifest.json';body=out/'gaucho-lod1.glb';original_manifest=mp.read_bytes();original_body=body.read_bytes();files=lambda:{str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
 for field,value,label in [('preset','worker','unowned-preset'),('role','vest','unowned-garment-role')]:
  changed=json.loads(original_manifest);record=changed['appearances']['gaucho']['lods'][1];record[tool.FIELD][field]=value;doc,binary=glb.read_glb(body);doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD]);raw=tool.encode_glb(doc,binary);body.write_bytes(raw);record.update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest());mp.write_text(json.dumps(changed));stable=files()
  try:adapter._selection_rows(target,recipe.selections)
  except AssertionError as error:assert 'Unowned split-drape selection context' in str(error);rejected.append(label)
  else:raise AssertionError('Adapter accepted widened garment context')
  assert files()==stable;body.write_bytes(original_body);mp.write_bytes(original_manifest)
 command=['python3',str(target/'tools/characters-3d/family_fold_context.py'),'--root',str(target),'--presets','gaucho'];first=subprocess.run(command,capture_output=True,text=True);assert first.returncode==0,first.stdout+first.stderr
 stable=files();repeat=subprocess.run(command,capture_output=True,text=True);assert repeat.returncode==0,repeat.stdout+repeat.stderr;assert files()==stable
 verify=subprocess.run(command+['--verify-only'],capture_output=True,text=True);assert verify.returncode==0,verify.stdout+verify.stderr;assert files()==stable
 retained=os.environ.get('GRANADEROS_COARSE_TEST_ARTIFACTS')
 if retained:
  destination=Path(retained);destination.mkdir(parents=True,exist_ok=True);(destination/'adapter.json').write_text(json.dumps({'checked':checked,'rejected':rejected,'repeatExact':True,'verifyOnlyExact':True},indent=2)+'\n')
_check_pins(root,pins)
print(json.dumps({'checked':checked,'rejected':rejected,'exactOriginalDrapeOnly':True,'unownedSelectorExact':True,'repeatExact':True,'verifyOnlyExact':True,'releasedInputsExact':True}))
`,view.root);
 assert.deepEqual(result.checked,[1,2]);assert.deepEqual(result.rejected,['unreceipted-disconnected-drape','unowned-preset','unowned-garment-role']);for(const[key,value]of Object.entries(result))if(!['checked','rejected'].includes(key))assert.equal(value,true,key);
});

test('verified selected source patches own only the approved coarse jobs, repeat exactly, and reject stale or corrupt proposals before writes',()=>{
 const view=nativeView(),result=python(String.raw`
from pathlib import Path
import sys,json,copy,tempfile,subprocess,hashlib,shutil,os,struct
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import create_native_snapshot,restore_corrections,_module
from family_surface_context import _copy_inputs,_pins,_check_pins
from apparel_surface_context import verify_layer,create_predecessor_snapshot,unwrap_body_and_record
tool=_module('fresh_coarse_test',root/'tools/characters-3d/build-coarse-garment-surfaces.py')
glb=_module('fresh_coarse_glb',root/'tools/characters-3d/merge-animation-bank.py')
family=_module('fresh_coarse_family',root/'tools/characters-3d/build-family-cloth-depth.py')
digest=lambda raw:hashlib.sha256(raw).hexdigest()
live_pins=_pins(root);source=Path(sys.argv[1]);source_assets=source/'web/public/models/characters'
source_manifest=json.loads((source_assets/'manifest.json').read_bytes())
with tempfile.TemporaryDirectory(prefix='granaderos-coarse-source-test-') as folder:
 folder=Path(folder);target=folder/'root';_copy_inputs(root,target,live_pins);assets=target/'web/public/models/characters';mp=assets/'manifest.json';patches=folder/'patches';patches.mkdir()
 selected=[]
 for preset,appearance in source_manifest['appearances'].items():
  for active in appearance['lods']:
   if tool.FIELD not in active:continue
   lod=active['lod'];name=f'{preset}-lod{lod}';selected.append(('appearance',preset,lod));doc,binary=glb.read_glb(source_assets/(name+'.glb'));meta=active[tool.FIELD]
   old_doc,old_binary=tool.restore_body(doc,binary,meta);item=meta['primitive'];primitive=doc['meshes'][item['mesh']]['primitives'][item['primitive']];count=item['originalVertexCount']
   patch_doc=copy.deepcopy(old_doc);patch_doc['meshes']=[{'primitives':[{'attributes':{},'material':old_doc['meshes'][item['mesh']]['primitives'][item['primitive']]['material']}]}];patch_doc.pop('extras',None);patch_binary=bytearray(old_binary);patch=patch_doc['meshes'][0]['primitives'][0]
   for key,index in primitive['attributes'].items():patch['attributes'][key]=tool.append_rows(patch_doc,patch_binary,doc['accessors'][index],tool.rows(doc,binary,index)[count:])
   triangles=tool.triangles(doc,binary,primitive);owned=[[vertex-count for vertex in triangles[index]] for index in item['ownedTriangles']]
   patch['indices']=tool.append_rows(patch_doc,patch_binary,{'type':'SCALAR','componentType':5123},[(vertex,) for triangle in owned for vertex in triangle],indices=True)
   patch_binary.extend(b'\0'*(-len(patch_binary)%4));patch_doc['buffers']=[{'byteLength':len(patch_binary)}]
   path=patches/(name+'-coarse-patch.glb');path.write_bytes(tool.encode_glb(patch_doc,patch_binary))
   for image in patch_doc.get('images',[]):
    destination=patches/image['uri'];destination.parent.mkdir(parents=True,exist_ok=True)
    if not destination.exists():destination.symlink_to((source_assets/image['uri']).resolve())
   proposal=dict(meta['sourceProof'],preset=preset,lod=lod,role=meta['role'],sourceMaterial=meta['sourceMaterial'],atlasAnchor=tool.TARGETS[(preset,lod)]['anchor'],sourceTriangleRows=[],patch={'sha256':digest(path.read_bytes()),'bytes':path.stat().st_size})
   (patches/(name+'-coarse-patch.json')).write_text(json.dumps(proposal))
 selected.sort();expected={'gaucho-lod1.glb','gaucho-lod2.glb'};assert {f'{p}-lod{l}.glb' for _,p,l in selected}==expected
 files=lambda:{str(p.relative_to(assets)):digest(p.read_bytes()) for p in assets.rglob('*') if p.is_file()}
 stable=files();records,outputs,receipt=tool.prepare_selected_jobs(target,selected,patches);assert files()==stable,'Preparation must not publish any file'
 source_inputs=receipt['sourceInputs'];assert {f'{p}-lod{l}-coarse-patch.{suffix}' for _,p,l in selected for suffix in ('glb','json')}<=set(source_inputs)
 for name,pin in source_inputs.items():assert pin=={'sha256':digest((patches/name).read_bytes()),'bytes':(patches/name).stat().st_size},'Source pins describe the immutable bytes actually consumed'
 assert set(records)==expected and expected<=set(outputs) and set(outputs)<=expected|{name for name in receipt['changedFiles'] if name.startswith('textures/')}
 assert set(receipt['changedFiles'])==expected|{'manifest.json'},'Recorded source fixtures change only their new provenance receipts and manifest'
 for name,raw in outputs.items():(assets/name).write_bytes(raw)
 manifest=json.loads(mp.read_bytes())
 for _,preset,lod in selected:manifest['appearances'][preset]['lods'][lod]=records[f'{preset}-lod{lod}.glb']
 mp.write_text(json.dumps(manifest,indent=2)+'\n');first=files();assert {name for name,pin in first.items() if stable.get(name)!=pin}==expected|{'manifest.json'}
 verify_layer(target);lower=folder/'strict-folds';create_predecessor_snapshot(target,lower);family.verify_completed(lower,['friar','woman-shawl'])
 records2,outputs2,repeat=tool.prepare_selected_jobs(target,selected,patches);assert repeat['exactNoOp'] and repeat['changedFiles']==[] and files()==first
 assert records2==records and all(outputs2[name]==outputs[name] for name in outputs)
 verify_receipt=folder/'verify.json';run=subprocess.run(['python3',str(target/'tools/characters-3d/build-coarse-garment-surfaces.py'),'--root',str(target),'--verify-only','--receipt',str(verify_receipt)],capture_output=True,text=True)
 assert run.returncode==0,run.stdout+run.stderr;assert files()==first and json.loads(verify_receipt.read_bytes())['pendingWrites']==0
 for unowned_job in [('appearance','worker',2),('appearance','woman-shawl',1),('appearance','woman-shawl',2),('appearance','gaucho',0)]:
  unowned=tool.prepare_selected_jobs(target,[unowned_job],patches);assert unowned[0]=={} and unowned[1]=={} and unowned[2]['exactNoOp'] and files()==first
 rejected=[]
 try:tool.prepare_selected_jobs(target,selected+[selected[0]],patches)
 except AssertionError as error:assert 'Duplicate selected' in str(error);rejected.append('duplicate')
 patch=patches/'gaucho-lod1-coarse-patch.glb';proposal=patches/'gaucho-lod1-coarse-patch.json';original_patch=patch.read_bytes();original_proposal=proposal.read_bytes()
 import family_surface_context as final_context
 checked_outputs=final_context._checked_outputs
 def change_external_source(*arguments,**keywords):
  result=checked_outputs(*arguments,**keywords);proposal.write_bytes(original_proposal+b'\n');return result
 final_context._checked_outputs=change_external_source;pins=files()
 try:
  try:tool.prepare_selected_jobs(target,selected,patches)
  except AssertionError as error:assert str(error)=='Selected source input changed during validation';rejected.append('concurrent-source-input')
  else:raise AssertionError('Concurrent selected source mutation accepted')
  assert files()==pins,'A late source pin failure must publish nothing'
 finally:final_context._checked_outputs=checked_outputs;proposal.write_bytes(original_proposal)
 def rejected_source(label):
  pins=files()
  try:tool.prepare_selected_jobs(target,selected,patches)
  except AssertionError:rejected.append(label)
  else:raise AssertionError('Corrupt selected source accepted: '+label)
  assert files()==pins,'Rejected source wrote a published asset'
 proposal.unlink();rejected_source('missing-proposal');proposal.write_bytes(original_proposal)
 changed=json.loads(original_proposal);changed['lod']=0;proposal.write_text(json.dumps(changed));rejected_source('wrong-job');proposal.write_bytes(original_proposal)
 changed=json.loads(original_proposal);changed['atlasAnchor']=[0,0];proposal.write_text(json.dumps(changed));rejected_source('wrong-UV-role');proposal.write_bytes(original_proposal)
 def changed_patch(semantic,mutate):
  pd,pb=glb.read_glb(patch);pp=tool._patch_primitive(pd);values=tool.rows(pd,pb,pp['attributes'][semantic]);mutate(values);pp['attributes'][semantic]=tool.append_rows(pd,pb,pd['accessors'][pp['attributes'][semantic]],values);pb.extend(b'\0'*(-len(pb)%4));pd['buffers']=[{'byteLength':len(pb)}];raw=tool.encode_glb(pd,pb);patch.write_bytes(raw);changed=json.loads(original_proposal);changed['patch']={'sha256':digest(raw),'bytes':len(raw)};proposal.write_text(json.dumps(changed))
 changed_patch('POSITION',lambda values:values.__setitem__(0,tuple(value+.04 for value in values[0])));rejected_source('changed-oriented-geometry');patch.write_bytes(original_patch);proposal.write_bytes(original_proposal)
 changed_patch('NORMAL',lambda values:values.__setitem__(0,tuple(-value for value in values[0])));rejected_source('inverted-panel-normal');patch.write_bytes(original_patch);proposal.write_bytes(original_proposal)
 changed_patch('COLOR_0',lambda values:values.__setitem__(0,tuple(.5 for value in values[0])));rejected_source('changed-visible-pigment');patch.write_bytes(original_patch);proposal.write_bytes(original_proposal)
 # A coherent manifest SHA cannot hide corruption below all colour layers.
 corrupt=folder/'corrupt-native';create_native_snapshot(target,corrupt);co=corrupt/'web/public/models/characters';cm=co/'manifest.json';original_manifest=cm.read_bytes();body=co/'gaucho-lod1.glb';original_body=body.read_bytes()
 def reject_native(label,mutate,expected_error=None):
  doc,binary=glb.read_glb(body);record=json.loads(original_manifest)['appearances']['gaucho']['lods'][1];mutate(doc,binary,record);raw=tool.encode_glb(doc,binary);body.write_bytes(raw);manifest=json.loads(original_manifest);record.update(bytes=len(raw),sha256=digest(raw));manifest['appearances']['gaucho']['lods'][1]=record;cm.write_text(json.dumps(manifest));pins={str(p.relative_to(co)):digest(p.read_bytes()) for p in co.rglob('*') if p.is_file()}
  try:tool.verify_completed(corrupt)
  except AssertionError as error:
   if expected_error is not None:assert str(error)==expected_error
   rejected.append(label)
  else:raise AssertionError('Corrupt native correction accepted: '+label)
  assert pins=={str(p.relative_to(co)):digest(p.read_bytes()) for p in co.rglob('*') if p.is_file()};body.write_bytes(original_body);cm.write_bytes(original_manifest)
 reject_native('retained-binary',lambda doc,binary,record:binary.__setitem__(0,binary[0]^1))
 def false_receipt(doc,binary,record):record[tool.FIELD]['primitive']['ownedStreamSha256']='0'*64;doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD])
 reject_native('false-installed-stream',false_receipt)
 def false_bindings(doc,binary,record):doc['meshes'][record[tool.FIELD]['primitive']['mesh']]['primitives'][0]['indices']=record[tool.FIELD]['primitive']['originalIndices']
 reject_native('changed-active-bindings',false_bindings)
 def false_identity(field,value):
  def mutate(doc,binary,record):record[tool.FIELD][field]=value;doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD])
  return mutate
 reject_native('wrong-installed-lod',false_identity('lod',2),'Completed correction identity differs from its selected body')
 reject_native('wrong-installed-role',false_identity('role','vest'),'Completed correction garment role differs')
 def false_count(doc,binary,record):record[tool.FIELD]['primitive']['originalVertexCount']+=1;doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD])
 reject_native('false-corner-count',false_count,'Completed correction corner counts differ from its retained and split geometry')
 def false_export_source(doc,binary,record):record[tool.FIELD]['sourceProof']['sourceSha256']='0'*64;doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD])
 reject_native('false-export-source',false_export_source,'Completed correction export source differs from its recipe')
 def false_primitive(doc,binary,record):record[tool.FIELD]['primitive']['primitive']=-1;doc['extras'][tool.FIELD]=copy.deepcopy(record[tool.FIELD])
 reject_native('negative-primitive-alias',false_primitive,'Completed correction names an unowned primitive')
 def replace_indices(doc,binary,record,mutate):
  meta=record[tool.FIELD];primitive=doc['meshes'][meta['primitive']['mesh']]['primitives'][0];accessor=doc['accessors'][primitive['indices']];view=doc['bufferViews'][accessor['bufferView']];assert accessor['bufferView']==len(doc['bufferViews'])-1 and not accessor.get('byteOffset') and not view.get('byteStride');values=tool.rows(doc,binary,primitive['indices']);mutate(values,meta);raw=struct.pack('<'+tool.FORMAT[accessor['componentType']]*len(values),*(value[0] for value in values));del binary[view['byteOffset']:];binary.extend(raw);view['byteLength']=len(raw);accessor['count']=len(values);binary.extend(b'\0'*(-len(binary)%4));doc['buffers']=[{'byteLength':len(binary)}];meta['primitive']['ownedStreamSha256']=tool.stream_hash(doc,binary,primitive,meta['primitive']['ownedTriangles']);doc['extras'][tool.FIELD]=copy.deepcopy(meta)
 def extra_tail(doc,binary,record):replace_indices(doc,binary,record,lambda values,meta:values.extend(values[:3]))
 reject_native('unowned-extra-tail-triangle',extra_tail,'Completed correction contains unaccounted outfit triangles')
 def rotated_corner(values,meta):
  start=3*meta['primitive']['ownedTriangles'][0];values[start:start+3]=values[start+1:start+3]+values[start:start+1]
 def false_owned_indices(doc,binary,record):replace_indices(doc,binary,record,rotated_corner)
 reject_native('noncontiguous-split-corners',false_owned_indices,'Completed correction split corner indices differ')
 def nonunit_normal(doc,binary,record):
  meta=record[tool.FIELD];primitive=doc['meshes'][meta['primitive']['mesh']]['primitives'][0];accessor=doc['accessors'][primitive['attributes']['NORMAL']];view=doc['bufferViews'][accessor['bufferView']];values=tool.rows(doc,binary,primitive['attributes']['NORMAL']);vertex=tool.triangles(doc,binary,primitive)[meta['primitive']['ownedTriangles'][0]][0];struct.pack_into('<fff',binary,view['byteOffset']+12*vertex,*(value*2 for value in values[vertex]));values=tool.rows(doc,binary,primitive['attributes']['NORMAL']);accessor['min']=[min(row[axis] for row in values) for axis in range(3)];accessor['max']=[max(row[axis] for row in values) for axis in range(3)];meta['primitive']['ownedStreamSha256']=tool.stream_hash(doc,binary,primitive,meta['primitive']['ownedTriangles']);doc['extras'][tool.FIELD]=copy.deepcopy(meta)
 reject_native('nonunit-installed-normal',nonunit_normal,'Poncho corner normal is not a unit geometric panel normal')
 packing_error='Completed correction appended accessors or views differ from their packed contract'
 def normalized_joints(doc,binary,record):doc['accessors'][doc['meshes'][record[tool.FIELD]['primitive']['mesh']]['primitives'][0]['attributes']['JOINTS_0']]['normalized']=True
 reject_native('normalized-joint-interpretation',normalized_joints,packing_error)
 def false_bounds(doc,binary,record):
  accessor=doc['accessors'][doc['meshes'][record[tool.FIELD]['primitive']['mesh']]['primitives'][0]['attributes']['POSITION']];accessor['min']=[100,100,100];accessor['max']=[101,101,101]
 reject_native('false-active-position-bounds',false_bounds,packing_error)
 def truncated_normal(doc,binary,record):
  accessor=doc['accessors'][doc['meshes'][record[tool.FIELD]['primitive']['mesh']]['primitives'][0]['attributes']['NORMAL']];doc['bufferViews'][accessor['bufferView']]['byteLength']=4
 reject_native('truncated-active-normal-view',truncated_normal,packing_error)
 recipe=corrupt/'assets/source/characters-3d/authoring/coarse_garment_surfaces.py';recipe.write_bytes(recipe.read_bytes()+b'\n# stale correction recipe\n');pins={str(p.relative_to(co)):digest(p.read_bytes()) for p in co.rglob('*') if p.is_file()}
 try:tool.verify_completed(corrupt)
 except AssertionError:rejected.append('changed-recipe')
 else:raise AssertionError('Changed correction recipe accepted')
 assert pins=={str(p.relative_to(co)):digest(p.read_bytes()) for p in co.rglob('*') if p.is_file()}
 # Strict current top and lower fold donor links remain mandatory. The stale
 # allowance only exposes a private lower view; it does not verify that view.
 donor=assets/'woman-shawl-lod0.glb';donor_raw=donor.read_bytes();manifest_raw=mp.read_bytes();doc,binary,record=unwrap_body_and_record(target,'woman-shawl',0);doc,binary=family.restore_body(doc,binary,record['familyClothDepth']);record=family.restore_record(record);doc.setdefault('extras',{})['staleDonorProbe']=True;raw=glb.write_glb(donor,doc,binary);record.update(bytes=len(raw),sha256=digest(raw));manifest=json.loads(manifest_raw);manifest['appearances']['woman-shawl']['lods'][0]=record;mp.write_text(json.dumps(manifest));pins=files()
 try:verify_layer(target)
 except AssertionError:rejected.append('strict-top-donor')
 else:raise AssertionError('Stale active apparel donor accepted')
 stale=folder/'stale-lower';create_predecessor_snapshot(target,stale,allow_stale_donor=True)
 try:family.verify_completed(stale,['woman-shawl'])
 except AssertionError as error:assert 'Completed coarse donor identity is stale' in str(error);rejected.append('strict-lower-donor')
 else:raise AssertionError('Stale lower family donor accepted')
 assert files()==pins;donor.write_bytes(donor_raw);mp.write_bytes(manifest_raw);assert files()==first
 _check_pins(root,live_pins)
 retained=os.environ.get('GRANADEROS_COARSE_TEST_ARTIFACTS')
 if retained:
  destination=Path(retained);destination.mkdir(parents=True,exist_ok=True)
  for label,value in [('selected-source',receipt),('repeat-source',repeat),('verify-only',json.loads(verify_receipt.read_bytes()))]:(destination/(label+'.json')).write_text(json.dumps(value,indent=2)+'\n')
  (destination/'rejections.json').write_text(json.dumps({'rejected':rejected,'publishedFilesExactAfterEveryRejection':True},indent=2)+'\n')
 print(json.dumps({'selected':sorted(expected),'freshAllowlistExact':True,'completeRepeatExact':True,'currentTopAndLowerDonorsStrict':True,'unownedJobWritesNothing':True,'preparationWritesNothing':True,'liveInputsExact':True,'rejected':rejected}))
`,view.root);
 assert.deepEqual(result.selected,[...ownedNames].map(name=>name+'.glb').sort());assert.deepEqual(result.rejected,['duplicate','concurrent-source-input','missing-proposal','wrong-job','wrong-UV-role','changed-oriented-geometry','inverted-panel-normal','changed-visible-pigment','retained-binary','false-installed-stream','changed-active-bindings','wrong-installed-lod','wrong-installed-role','false-corner-count','false-export-source','negative-primitive-alias','unowned-extra-tail-triangle','noncontiguous-split-corners','nonunit-installed-normal','normalized-joint-interpretation','false-active-position-bounds','truncated-active-normal-view','changed-recipe','strict-top-donor','strict-lower-donor']);
 for(const[key,value]of Object.entries(result))if(!['selected','rejected'].includes(key))assert.equal(value,true,key);
});
