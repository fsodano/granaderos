import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const python = source => JSON.parse(execFileSync('python3', ['-c', `
from pathlib import Path
import sys, json, copy, tempfile, hashlib, importlib.util, shutil, struct
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
import library_manifest as library
import library_jobs as jobs
assets=root/'web/public/models/characters';previous=json.loads((assets/'manifest.json').read_text())
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
${source}
`], {cwd:new URL('..',import.meta.url),encoding:'utf8'}));

test('a valid private job is checked against a prospective manifest before only its output and textures install', () => {
  const result = python(`
source=assets/'woman-shawl-lod1.glb';original=source.read_bytes();job=('appearance','woman-shawl',1)
with tempfile.TemporaryDirectory() as folder:
 staged=Path(folder)/'stage';released=Path(folder)/'released';metadata=Path(folder)/'receipts'
 for p in (staged,released,metadata):p.mkdir()
 shutil.copytree(assets/'textures',staged/'textures');shutil.copytree(assets/'textures',released/'textures')
 shutil.copy2(source,released/source.name);(released/'manifest.json').write_bytes((assets/'manifest.json').read_bytes())
 doc,binary=glb.read_glb(source);doc['extras']={'privateJobFixture':True};glb.write_glb(staged/source.name,doc,binary)
 (staged/'unrelated.glb').write_bytes(b'must not install')
 fresh={key:value for key,value in previous['appearances']['woman-shawl']['lods'][1].items() if key in ('lod','url','triangles','bytes','drawCalls','sha256')}
 fresh.update(bytes=(staged/source.name).stat().st_size,sha256=library.digest(staged/source.name))
 record=copy.deepcopy(fresh);record.update(kind='appearance',preset='woman-shawl');(metadata/'woman-shawl-lod1.json').write_text(json.dumps(record))
 checked=library.checked_job_records(metadata,staged,[job]);files=jobs.prepared_job_files(staged,checked)
 generated={'appearances':{'woman-shawl':{'lods':[fresh]}}}
 merged=library.merge_job_manifest(previous,generated,assets,[job],{source.name:staged/source.name})
 assert merged['appearances']['woman-shawl']['lods'][1]==fresh and merged['animationLibraries']==previous['animationLibraries']
 assert source.read_bytes()==original and (released/source.name).read_bytes()==original
 manifest_before=(released/'manifest.json').read_bytes();pins=jobs.current_job_pins(released,[job]);jobs.install_job_files(released,files,pins)
 assert library.digest(released/source.name)==fresh['sha256'] and not (released/'unrelated.glb').exists()
 assert (released/'manifest.json').read_bytes()==manifest_before
 for name,raw in files.items():assert (released/name).read_bytes()==raw
 print(json.dumps({'prospectiveChecked':True,'onlySelectedOutputAndReferencedTexturesInstalled':True,'manifestStillExactBeforeFinalWrite':True,'banksExact':True,'originalTestSourceExact':True}))
`);
  assert.deepEqual(result,{prospectiveChecked:true,onlySelectedOutputAndReferencedTexturesInstalled:true,manifestStillExactBeforeFinalWrite:true,banksExact:true,originalTestSourceExact:true});
});

test('staged geometry and texture failures reject before released files change', () => {
  const result = python(`
source=assets/'woman-shawl-lod1.glb';job=('appearance','woman-shawl',1);errors=[]
with tempfile.TemporaryDirectory() as folder:
 staged=Path(folder);shutil.copytree(assets/'textures',staged/'textures');shutil.copy2(source,staged/source.name)
 doc,binary=glb.read_glb(source);record=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1])
 wrong=copy.deepcopy(record);wrong['triangles']-=1
 try:jobs.prepared_job_files(staged,{source.name:wrong})
 except AssertionError:errors.append('geometry')
 image=next(i for i in doc['images'] if 'uri' in i);texture=staged/image['uri'];old=texture.read_bytes();texture.write_bytes(b'wrong content under a reviewed name')
 try:jobs.prepared_job_files(staged,{source.name:record})
 except AssertionError:errors.append('texture identity')
 texture.write_bytes(old);texture.unlink()
 try:jobs.prepared_job_files(staged,{source.name:record})
 except FileNotFoundError:errors.append('missing texture')
 image['uri']='../outside.png';glb.write_glb(staged/source.name,doc,binary);record.update(sha256=library.digest(staged/source.name),bytes=(staged/source.name).stat().st_size)
 try:jobs.prepared_job_files(staged,{source.name:record})
 except AssertionError:errors.append('texture path')
 assert library.digest(source)==previous['appearances']['woman-shawl']['lods'][1]['sha256']
 print(json.dumps({'rejected':errors,'releasedSourceExact':True}))
`);
  assert.deepEqual(result,{rejected:['geometry','texture identity','missing texture','texture path'],releasedSourceExact:true});
});

test('selected source changes and content-addressed texture collisions reject the complete batch before any install', () => {
  const result = python(`
source=assets/'woman-shawl-lod1.glb';job=('appearance','woman-shawl',1);errors=[]
with tempfile.TemporaryDirectory() as folder:
 staged=Path(folder)/'stage';released=Path(folder)/'released';staged.mkdir();released.mkdir()
 for p in (staged,released):shutil.copy2(source,p/source.name);shutil.copytree(assets/'textures',p/'textures')
 record=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1]);files=jobs.prepared_job_files(staged,{source.name:record});pins=jobs.current_job_pins(released,[job])
 original=(released/source.name).read_bytes();(released/source.name).write_bytes(original+b'changed during job')
 before={str(p.relative_to(released)):library.digest(p) for p in released.rglob('*') if p.is_file()}
 try:jobs.install_job_files(released,files,pins)
 except AssertionError:errors.append('selected source changed')
 assert before=={str(p.relative_to(released)):library.digest(p) for p in released.rglob('*') if p.is_file()}
 (released/source.name).write_bytes(original);texture=next(name for name in files if name.startswith('textures/'));(released/texture).write_bytes(b'collision')
 before={str(p.relative_to(released)):library.digest(p) for p in released.rglob('*') if p.is_file()}
 try:jobs.install_job_files(released,files,pins)
 except AssertionError:errors.append('texture collision')
 assert before=={str(p.relative_to(released)):library.digest(p) for p in released.rglob('*') if p.is_file()}
 print(json.dumps({'rejected':errors,'noBatchWrites':True}))
`);
  assert.deepEqual(result,{rejected:['selected source changed','texture collision'],noBatchWrites:true});
});

test('a prospective job cannot hide a changed untouched bank or supply an alternate public URL', () => {
  const result = python(`
source=assets/'woman-shawl-lod1.glb';job=('appearance','woman-shawl',1);errors=[]
fresh=copy.deepcopy(previous['appearances']['woman-shawl']['lods'][1]);generated={'appearances':{'woman-shawl':{'lods':[fresh]}}}
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder);metadata=target/'receipts';metadata.mkdir()
 record=copy.deepcopy(fresh);record.update(kind='appearance',preset='woman-shawl',url='/wrong/models/'+source.name);(metadata/'woman-shawl-lod1.json').write_text(json.dumps(record))
 try:library.checked_job_records(metadata,assets,[job])
 except AssertionError:errors.append('public URL')
 for p in assets.glob('*.glb'):shutil.copy2(p,target/p.name)
 bank=target/'male-animations.glb';bank.write_bytes(bank.read_bytes()+b'changed untouched bank')
 try:library.merge_job_manifest(previous,generated,target,[job],{source.name:source})
 except AssertionError:errors.append('untouched bank')
 print(json.dumps({'rejected':errors,'actualBankExact':library.digest(assets/'male-animations.glb')==previous['animationLibraries']['male']['sha256']}))
`);
  assert.deepEqual(result,{rejected:['public URL','untouched bank'],actualBankExact:true});
});

test('source JSON rejects non-finite constants and numeric overflow', () => {
  const result = python(`
errors=[]
for raw in ('{"position":[NaN,0,0]}','{"position":[Infinity,0,0]}','{"position":[1e309,0,0]}','{"position":['+str(10**400)+',0,0]}'):
 try:library.strict_json(raw)
 except ValueError:errors.append(True)
assert library.strict_json('{"position":[0.25,0,0]}')=={'position':[.25,0,0]}
print(json.dumps({'rejected':len(errors),'finiteSourceAccepted':True}))
`);
  assert.deepEqual(result,{rejected:4,finiteSourceAccepted:true});
});

test('actual builder worker and receipt failures leave the entire released asset tree and manifest exact', () => {
  const result = python(`
import os, subprocess
worker = '''#!/usr/bin/env python3
from pathlib import Path
import json,sys,shutil,struct,hashlib,os
a=sys.argv;root=Path(a[a.index('--python')+1]).parents[4];out=Path(a[a.index('--output-dir')+1]);meta=Path(a[a.index('--metadata-dir')+1]);lod=int(a[a.index('--lod')+1]);name='woman-shawl-lod'+str(lod)+'.glb'
assert '/granaderos-source-jobs-' in str(out) and out!=root/'web/public/models/characters'
mode=os.environ['STAGING_FIXTURE_MODE'];source=root/'web/public/models/characters';old=(source/name).read_bytes();n=struct.unpack_from('<I',old,12)[0];doc=json.loads(old[20:20+n]);doc['extras']={'stagedFixture':mode,'lod':lod};text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*(-len(text)%4);body=old[20+n:];header=bytearray(old[:20]);struct.pack_into('<I',header,8,20+len(text)+len(body));struct.pack_into('<I',header,12,len(text));raw=bytes(header)+text+body;(out/name).write_bytes(raw)
(root/('worker-private-path-'+str(lod)+'.json')).write_text(json.dumps(str(out.parent)))
shutil.copytree(source/'textures',out/'textures',dirs_exist_ok=True)
record=json.loads((source/'manifest.json').read_text())['appearances']['woman-shawl']['lods'][lod];record.update(kind='appearance',preset='woman-shawl',sockets=json.loads((source/'manifest.json').read_text())['appearances']['woman-shawl']['sockets'],bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
if mode=='bad-receipt':record['sha256']='0'*64
if mode=='nonfinite-receipt':record['sockets']['nonfiniteFixture']={'position':[float('nan'),0,0]}
if mode=='rounding-receipt':record['sockets']['roundingFixture']={'position':[9007199254740993,0,0]}
if mode=='bad-texture':
 image=next(i for i in doc['images'] if 'uri' in i);(out/image['uri']).write_bytes(b'wrong private pixels')
(meta/('woman-shawl-lod'+str(lod)+'.json')).write_text(json.dumps(record))
if mode=='worker-failure' and lod==2:sys.exit(7)
if mode!='missing-final-marker':print('ASSET_READY',name,record['triangles'],record['bytes'])
'''
rows=[]
with tempfile.TemporaryDirectory() as folder:
 target=Path(folder);out=target/'web/public/models/characters';out.parent.mkdir(parents=True);shutil.copytree(assets,out)
 for name in ('build-library.py','library_manifest.py','library_jobs.py'):
  destination=target/'tools/characters-3d'/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'tools/characters-3d'/name,destination)
 authored=target/'assets/source/characters-3d/authoring';authored.mkdir(parents=True);shutil.copy2(root/'assets/source/characters-3d/authoring/build.py',authored/'build.py')
 shutil.copytree(root/'game',target/'game');shutil.copy2(root/'package.json',target/'package.json')
 fake=target/'fake-blender';fake.write_text(worker);fake.chmod(0o755)
 before={str(p.relative_to(out)):library.digest(p) for p in out.rglob('*') if p.is_file()}
 for mode in ('worker-failure','missing-final-marker','bad-receipt','bad-texture','nonfinite-receipt','rounding-receipt'):
  command=['python3',str(target/'tools/characters-3d/build-library.py'),'--blender',str(fake),'--only','appearance','--preset','woman-shawl','--jobs','3']
  if mode!='worker-failure':command+=['--lod','0' if mode=='rounding-receipt' else '1']
  run=subprocess.run(command,cwd=target,env={**os.environ,'STAGING_FIXTURE_MODE':mode},capture_output=True,text=True)
  assert run.returncode!=0,run.stdout+run.stderr
  if mode=='nonfinite-receipt':assert 'Non-finite source JSON' in run.stderr
  if mode=='rounding-receipt':assert 'Canonical manifest changes source values' in run.stderr
  assert before=={str(p.relative_to(out)):library.digest(p) for p in out.rglob('*') if p.is_file()}
  assert not (authored/'.build').exists()
  rows.append({'mode':mode,'releasedTreeExact':True,'privateWorkerPaths':True})
  for p in target.glob('worker-private-path-*.json'):
   private=Path(json.loads(p.read_text()));assert private.name.startswith('granaderos-source-jobs-');shutil.rmtree(private,ignore_errors=True);p.unlink()
 print(json.dumps({'failures':rows,'allReleasedFilesChecked':len(before),'manifestAndBanksExact':True,'sourceCacheUntouched':True}))
`);
  assert.deepEqual(result.failures.map(row=>row.mode),['worker-failure','missing-final-marker','bad-receipt','bad-texture','nonfinite-receipt','rounding-receipt']);
  assert.ok(result.failures.every(row=>row.releasedTreeExact&&row.privateWorkerPaths));
  assert.equal(result.manifestAndBanksExact,true);assert.equal(result.sourceCacheUntouched,true);
});
