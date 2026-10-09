import{register}from'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';
import{standingBankPredecessorView}from'./standing-bank-predecessor-fixture.mjs';import{publishedActor}from'./published-actor-fixture.mjs';
const{ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const root=new URL('..',import.meta.url),assets=new URL('../web/public/models/characters/',import.meta.url),targets=['stand.idle.short-gun','stand.idle.blade','stand.idle.knife'];
function python(script){return JSON.parse(execFileSync('python3',['-c',script],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));}
test('relaxed standing free-arm banks retain every old byte and reconstruct the complete preceding banks and records',()=>{
 const result=python(String.raw`
from pathlib import Path
import sys,json,copy,struct
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
import standing_arm_context as context
u=context._module('free_arm_install',root/'tools/characters-3d/build-standing-free-arm-rest.py');g=context._module('free_arm_glb',root/'tools/characters-3d/merge-animation-bank.py');a=context._module('free_arm_author',root/u.SOURCE)
assets=root/'web/public/models/characters';m=json.loads((assets/'manifest.json').read_bytes());rows=[]
for gender,record in m['animationLibraries'].items():
 doc,binary=g.read_glb(assets/Path(record['url']).name);meta=record[u.FIELD];old,old_binary=u.restore_bank(doc,binary,meta);old_record=u.restore_record(record);proof=u.verify(root,doc,binary,record)
 assert len(doc['animations'])==len(old['animations'])==334
 assert binary[:len(old_binary)]==old_binary and len(binary)-len(old_binary)==2928
 assert len(meta['recipe']['sourceSha256'])==3 and 'originalRecord' not in meta and 'originalJSON' not in meta
 assert doc['nodes']==old['nodes'] and doc['skins']==old['skins']
 before={c['name']:c for c in old['animations']};after={c['name']:c for c in doc['animations']};changed=set(a.TARGETS)
 assert all(before[n]==after[n]for n in before if n not in changed)
 donor=a.sampler_map(old,before[a.SOURCE])
 for name in a.TARGETS:
  prior=before[name];current=after[name];expected=copy.deepcopy(prior);patch=next(p for p in meta['patches']if p['name']==name)
  assert current['samplers'][:len(prior['samplers'])]==prior['samplers']
  for p in patch['channels']:
   expected['channels'][p['channel']]['sampler']=p['sampler'];sampler=current['samplers'][p['sampler']];old_sampler=prior['samplers'][p['originalSampler']]
   assert sampler['input']==old_sampler['input'] and sampler.get('interpolation','LINEAR')==old_sampler.get('interpolation','LINEAR')
   values=a.rows(doc,binary,sampler['output']);native=a.rows(old,old_binary,donor[p['bone'],'rotation'][1]['output'])
   if p['bone']=='lowerarm_l':assert len(values)==61 and all(abs(sum(v*v for v in q)-1)<1e-6 for q in values)
   else:assert values==native
  expected['samplers']=current['samplers'];assert expected==current
 assert len(meta['patches'])==3 and sum(len(p['channels'])for p in meta['patches'])==9
 rows.append({'anatomy':gender,**proof})
print(json.dumps(rows))
`);assert.equal(result.length,2);for(const row of result){assert.equal(row.originalBinaryPrefixExact,true);assert.equal(row.oldBankAndRecordRestorationExact,true);assert.equal(row.appendedRotationBytes,2928);}
});
test('free-arm authoring rejects a changed clock, unknown anatomy and unreceipted donor bindings',()=>{
 const result=python(String.raw`
from pathlib import Path
import sys,json,copy,struct
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'));import standing_arm_context as c
u=c._module('reject_install',root/'tools/characters-3d/build-standing-free-arm-rest.py');g=c._module('reject_glb',root/'tools/characters-3d/merge-animation-bank.py');a=c._module('reject_source',root/u.SOURCE)
m=json.loads((root/'web/public/models/characters/manifest.json').read_bytes());r=m['animationLibraries']['male'];doc,binary=g.read_glb(root/'web/public/models/characters/male-animations.glb');doc,binary=u.restore_bank(doc,binary,r[u.FIELD]);cases=[]
def reject(label,fn,fragment):
 try:fn()
 except AssertionError as e:assert fragment in str(e);cases.append(label)
 else:raise AssertionError('Accepted '+label)
reject('unknown anatomy',lambda:a.compose(doc,binary,'other'),'anatomy')
changed=copy.deepcopy(doc);clip=next(x for x in changed['animations']if x['name']==a.TARGETS[0]);index,sampler=a.sampler_map(changed,clip)['upperarm_l','rotation'];times=a.rows(changed,binary,sampler['input']);data=struct.pack('<'+'f'*len(times),*[r[0]+.001 for r in times]);view=len(changed['bufferViews']);changed['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});sampler['input']=len(changed['accessors']);changed['accessors'].append({'bufferView':view,'componentType':5126,'count':len(times),'type':'SCALAR'})
reject('changed input clock',lambda:a.compose(changed,binary+data,'male'),'input clocks')
changed=copy.deepcopy(doc);clips={x['name']:x for x in changed['animations']};index,sampler=a.sampler_map(changed,clips[a.TARGETS[0]])['upperarm_l','rotation'];sampler['output']=a.sampler_map(changed,clips[a.SOURCE])['upperarm_l','rotation'][1]['output']
reject('unreceipted donor binding',lambda:a.compose(changed,binary,'male'),'unreceipted donor')
print(json.dumps(cases))
`);assert.equal(result.length,3);
});
test('completed free-arm replay is a byte-exact no-op and an invalid second bank rejects before any write',()=>{
 const result=python(String.raw`
from pathlib import Path
import sys,json,tempfile,shutil,subprocess
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'));import standing_arm_context as c
u=c._module('atomic_install',root/'tools/characters-3d/build-standing-free-arm-rest.py');g=c._module('atomic_glb',root/'tools/characters-3d/merge-animation-bank.py');assets=root/'web/public/models/characters';paths=[assets/n for n in ('manifest.json','male-animations.glb','female-animations.glb')];pins={p.name:p.read_bytes()for p in paths}
subprocess.run([sys.executable,str(root/'tools/characters-3d/build-standing-free-arm-rest.py'),'--root',str(root),'--verify-only'],check=True,capture_output=True)
subprocess.run([sys.executable,str(root/'tools/characters-3d/build-standing-free-arm-rest.py'),'--root',str(root)],check=True,capture_output=True)
assert all(p.read_bytes()==pins[p.name]for p in paths)
with tempfile.TemporaryDirectory()as folder:
 private=Path(folder);pa=private/'web/public/models/characters';pa.mkdir(parents=True)
 for path in (*u.recipe(root)['sourceSha256'],'tools/characters-3d/merge-animation-bank.py'):
  target=private/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/path,target)
 m=json.loads(pins['manifest.json'])
 for gender,r in m['animationLibraries'].items():
  doc,binary=g.read_glb(assets/Path(r['url']).name);doc,binary=u.restore_bank(doc,binary,r[u.FIELD]);m['animationLibraries'][gender]=u.restore_record(r);(pa/Path(r['url']).name).write_bytes(u.encode(doc,binary))
 # The first valid bank is prepared. Reject the second before either output or manifest is written.
 m['animationLibraries']['female']['url']='/models/characters/unowned.glb';(pa/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');before={p.name:p.read_bytes()for p in pa.iterdir()}
 run=subprocess.run([sys.executable,str(private/'tools/characters-3d/build-standing-free-arm-rest.py'),'--root',str(private)],capture_output=True,text=True);assert run.returncode!=0 and 'Unowned standing free arm bank URL'in run.stderr
 assert before=={p.name:p.read_bytes()for p in pa.iterdir()}
print(json.dumps({'completedNoOp':True,'rejectBeforeWrite':True}))
`);assert.deepEqual(result,{completedNoOp:true,rejectBeforeWrite:true});
});
test('source drift during preparation or final preflight rejects before either bank or manifest is written',()=>{
 const result=python(String.raw`
from pathlib import Path
import sys,json,contextlib,io
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'));import standing_arm_context as c
u=c._module('source_drift_install',root/'tools/characters-3d/build-standing-free-arm-rest.py');g=c._module('source_drift_glb',root/'tools/characters-3d/merge-animation-bank.py');assets=root/'web/public/models/characters';mp=assets/'manifest.json';manifest=json.loads(mp.read_bytes());fresh={}
for gender,record in manifest['animationLibraries'].items():
 path=assets/Path(record['url']).name;doc,binary=g.read_glb(path);old,old_binary=u.restore_bank(doc,binary,record[u.FIELD]);fresh[path]=u.encode(old,old_binary);manifest['animationLibraries'][gender]=u.restore_record(record)
fresh[mp]=(json.dumps(manifest,indent=2)+'\n').encode();sources=[root/path for path in u.recipe(root)['sourceSha256']];read_original=Path.read_bytes;write_bytes_original=Path.write_bytes;write_text_original=Path.write_text;prepare_original=u.prepare;cases=[]
for phase in ('first preparation','final preflight'):
 virtual=dict(fresh);writes=[];state={'manifestReads':0,'changed':False,'prepared':set()}
 def change_sources(paths):
  for path in paths:virtual[path]=read_original(path)+b'\n# source drift injected only in memory\n'
  state['changed']=True
 def read(path):
  if path==mp:
   state['manifestReads']+=1
   if phase=='final preflight'and state['manifestReads']==2:change_sources(sources)
  return virtual[path]if path in virtual else read_original(path)
 def write_bytes(path,raw):writes.append(path.name);virtual[path]=bytes(raw);return len(raw)
 def write_text(path,text,*args,**kwargs):return write_bytes(path,text.encode())
 def prepare(*args):
  if phase=='first preparation'and not state['changed']:change_sources(sources[:1])
  raw,record=prepare_original(*args);state['prepared'].add(args[-1]);return raw,record
 Path.read_bytes=read;Path.write_bytes=write_bytes;Path.write_text=write_text;u.prepare=prepare;sys.argv=['build-standing-free-arm-rest.py','--root',str(root)]
 try:
  with contextlib.redirect_stdout(io.StringIO()):u.main()
 except AssertionError as error:assert str(error)=='Concurrent standing free arm source recipe change'
 else:raise AssertionError('Accepted source drift at '+phase)
 finally:Path.read_bytes=read_original;Path.write_bytes=write_bytes_original;Path.write_text=write_text_original;u.prepare=prepare_original
 assert state['changed']and state['prepared']=={'male','female'}and not writes
 assert all(virtual[path]==raw for path,raw in fresh.items())
 cases.append({'phase':phase,'preparedBanks':2,'publishedWrites':len(writes)})
print(json.dumps(cases))
`);assert.deepEqual(result,[{phase:'first preparation',preparedBanks:2,publishedWrites:0},{phase:'final preflight',preparedBanks:2,publishedWrites:0}]);
});
const visual=(appearance,equipment,id)=>({key:'unit:free-arm-test',id:'free-arm-test',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment,items:[{id,reference:'primary',socket:'handRight'}],garments:{},selected:false,bodyHeights:{}});
const familyNames=['granadero','royalist','gaucho','worker','surgeon','friar','woman-scout','woman-shawl'];
function exactRetainedMatrices(current,old){for(const name of['Root','pelvis','spine_03','clavicle_l','upperarm_r','lowerarm_r','hand_r'])assert.deepEqual(current.model.getObjectByName(name).matrixWorld.elements,old.model.getObjectByName(name).matrixWorld.elements,name);const held=current.model.getObjectByName(`primary:${current.visual.items[0].id}`),native=old.model.getObjectByName(`primary:${old.visual.items[0].id}`);assert.deepEqual(held.matrixWorld.elements,native.matrixWorld.elements,'Right primary grip');}
test('all families at both tactical LODs retain roots and right grips through native 120 ms transitions',async t=>{
 const view=standingBankPredecessorView(root),before=await import(pathToFileURL(view.receipt.root+'/tests/published-actor-fixture.mjs').href);let cases=0,samples=0;
 for(const appearance of familyNames)for(const lod of[1,2])for(const[equipment,id]of[['short-gun','1805'],['blade','1809'],['blade','1813']]){
  const [a,b]=await Promise.all([publishedActor(appearance,lod),before.publishedActor(appearance,lod)]),initial=visual(appearance,equipment,id);
  for(const destination of[equipment==='short-gun'?'aim':'brace','walk','crouched','prone']){
   const current=new ActorRuntime(a,initial),old=new ActorRuntime(b,initial);current.tick(.4,400);old.tick(.4,400);const next=['crouched','prone'].includes(destination)?{...initial,action:`stance:standing:${destination}`,posture:destination,cue:{id:`stance:${destination}`,action:`stance:standing:${destination}`,fromPosture:'standing',startedAt:400,durationMs:1000}}:{...initial,action:destination};current.update(next,400);old.update(next,400);
   for(let frame=0;frame<=12;frame++){if(frame){current.tick(.01,400+10*frame);old.tick(.01,400+10*frame);}current.root.updateMatrixWorld(true);old.root.updateMatrixWorld(true);exactRetainedMatrices(current,old);samples++;}
   assert.equal(current.action.getClip().name,old.action.getClip().name);assert.equal(current.action.time,old.action.time);current.dispose();old.dispose();cases++;
  }
 }
 assert.equal(cases,192);assert.equal(samples,2496);t.diagnostic(JSON.stringify({cases,samples,productionFadeSeconds:.12,exactRetainedMatrices:true}));
});
test('a real secondary pistol stays seated on the surgeon left socket through the relaxed idle cycle',async t=>{
 let samples=0;for(const lod of[1,2]){const asset=await publishedActor('surgeon',lod),initial=visual('surgeon','short-gun','1805');initial.items.push({id:'1806',reference:'offhand',socket:'handLeft'});const current=new ActorRuntime(asset,initial),item=current.model.getObjectByName('offhand:1806');
  for(let frame=0;frame<=60;frame++){current.action.time=frame/30;current.mixer.update(0);current.placeEquipment(current.action.time);current.root.updateMatrixWorld(true);assert.equal(item.parent.name,asset.appearance.sockets.handLeft_pistol.node);assert.equal(item.userData.presentationStowed,false);assert.equal(item.visible,true);assert.deepEqual(item.matrix.elements,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);samples++;}current.dispose();
 }assert.equal(samples,122);t.diagnostic('Actual secondary item and native socket; item and active weapon rules remain unchanged.');
});
test('the bounded native forearm correction keeps the accepted relaxed wrist at both tactical LODs',async()=>{
 const{Vector3}=await import('../web/node_modules/three/build/three.module.js');
 for(const[appearance,expectedPistol,expectedBlade]of[['granadero',[.23137,.87694,.11465],[.23209,.88146,.11589]],['woman-scout',[.24261,.90875,.09641],[.24328,.91219,.09550]]])for(const lod of[1,2])for(const[equipment,id,expected]of[['short-gun','1805',expectedPistol],['blade','1809',expectedBlade],['blade','1813',expectedBlade]]){
  const asset=await publishedActor(appearance,lod),actor=new ActorRuntime(asset,visual(appearance,equipment,id));actor.action.time=.5;actor.mixer.update(0);actor.root.updateMatrixWorld(true);const wrist=actor.model.getObjectByName('hand_l').getWorldPosition(new Vector3()).toArray();for(let axis=0;axis<3;axis++)assert.ok(Math.abs(wrist[axis]-expected[axis])<.00001,`${appearance}/${lod}/${id} wrist axis ${axis}: ${wrist[axis]}`);actor.dispose();
 }
});
test('completed native donor checks return a zero-write no-op through the exact standing bank predecessor',()=>{
 const result=python(String.raw`
from pathlib import Path
import sys,json
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'));import standing_arm_context as c
rows=[c.verify_native_bank_repeat(root,name)for name in ('build-prone-pistol-forearm-support.py','build-standing-blade-wrists.py')]
try:c.verify_native_bank_repeat(root,'unowned.py')
except AssertionError as e:assert 'Unowned native' in str(e)
else:raise AssertionError('Accepted an unowned native pass')
print(json.dumps(rows))
`);assert.equal(result.length,2);for(const row of result){assert.equal(row.exactNoOp,true);assert.equal(row.publishedWrites,0);assert.equal(row.privatePredecessorVerified,true);}
});
