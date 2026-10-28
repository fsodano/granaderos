import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

const helper=fileURLToPath(new URL('../tools/characters-3d/library_publication.py',import.meta.url));
const compiler=fileURLToPath(new URL('../tools/characters-3d/compile-locomotion-profile.mjs',import.meta.url));
const python=process.platform==='win32'?'python':'python3';
const environment={...process.env};delete environment.GRANADEROS_LIBRARY_LOCK;
const prelude=`import sys,os,json\nfrom pathlib import Path\nsys.path.insert(0,str(Path(sys.argv[1]).parent))\nfrom library_publication import publication_lock,TOKEN\nfolder=Path(sys.argv[2])\n`;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function launch(command,args){
 const child=spawn(command,args,{env:environment,stdio:['pipe','pipe','pipe']});
 const state={child,stdout:'',stderr:'',finished:false};
 child.stdout.on('data',data=>{state.stdout+=data;});child.stderr.on('data',data=>{state.stderr+=data;});
 state.done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>{state.finished=true;resolve({code,signal,stdout:state.stdout,stderr:state.stderr});});});
 state.ready=async()=>{
  const deadline=Date.now()+5000;
  while(!state.stdout.includes('LOCKED\n')){
   assert.ok(!state.finished,`Writer exited before taking lock: ${state.stderr}`);
   assert.ok(Date.now()<deadline,'Writer did not take its lock in time');await pause(10);
  }
 };
 return state;
}
function run(args){return spawnSync(python,args,{env:environment,encoding:'utf8',timeout:5000});}

test('competing publishers serialize the fresh read and write without losing an update',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-publication-'));
 writeFileSync(join(directory,'counter'),'0');
 const alias=join(directory,'alias');symlinkSync(directory,alias,process.platform==='win32'?'junction':'dir');
 const writer=`with publication_lock(folder):\n value=int((folder/'counter').read_text())\n print('LOCKED',flush=True)\n sys.stdin.readline()\n (folder/'counter').write_text(str(value+1))\n`;
 const first=launch(python,['-c',prelude+writer,helper,directory]);let second;
 try{
  await first.ready();
  second=launch(python,['-c',prelude+writer,helper,alias]);second.child.stdin.end('\n');
  await pause(120);assert.equal(second.stdout,'','Second publisher must wait before reading the counter');
  first.child.stdin.end('\n');
  const results=await Promise.all([first.done,second.done]);
  for(const result of results)assert.equal(result.code,0,result.stderr);
  assert.equal(readFileSync(join(directory,'counter'),'utf8'),'2');
  assert.deepEqual(readdirSync(directory).sort(),['alias','counter'],'No lock file may enter the asset directory');
 }finally{
  first.child.stdin.end();second?.child.stdin.end();await Promise.all([first.done,second?.done]);rmSync(directory,{recursive:true,force:true});
 }
});

test('publication timeout is bounded and failed child commands release the lock',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-publication-failure-'));
 const holder=launch(python,['-c',prelude+"with publication_lock(folder):\n print('LOCKED',flush=True)\n sys.stdin.readline()\n",helper,directory]);
 try{
  await holder.ready();
  const started=Date.now(),blocked=run([helper,'--directory',directory,'--timeout','0.12','--',python,'-c','raise SystemExit(37)']);
  assert.equal(blocked.status,75,blocked.stderr);assert.match(blocked.stderr,/Publication lock timed out/);
  assert.ok(Date.now()-started<2000,'Short lock timeout must not wait for the 30 second default');
  holder.child.stdin.end('\n');assert.equal((await holder.done).code,0);
  const failed=run([helper,'--directory',directory,'--timeout','0.1','--',python,'-c','raise SystemExit(37)']);
  assert.equal(failed.status,37,failed.stderr);
  const next=run([helper,'--directory',directory,'--timeout','0.1','--',python,'-c','print("reacquired")']);
  assert.equal(next.status,0,next.stderr);assert.match(next.stdout,/reacquired/);
  assert.deepEqual(readdirSync(directory),[]);
 }finally{holder.child.stdin.end();await holder.done;rmSync(directory,{recursive:true,force:true});}
});

test('nested trusted calls reuse the lock and exceptions restore the previous token',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-publication-nested-'));
 try{
  const result=run(['-c',prelude+`import subprocess\nos.environ[TOKEN]='previous-token'\ntry:\n with publication_lock(folder) as canonical:\n  assert os.environ[TOKEN]==str(canonical)\n  with publication_lock(folder,timeout=0):\n   subprocess.run([sys.executable,sys.argv[1],'--directory',str(folder),'--timeout','0','--',sys.executable,'-c','pass'],check=True)\n  raise RuntimeError('deliberate')\nexcept RuntimeError:\n pass\nassert os.environ[TOKEN]=='previous-token'\ndel os.environ[TOKEN]\nwith publication_lock(folder,timeout=0):\n pass\nassert TOKEN not in os.environ\ntry:\n with publication_lock(folder,timeout=31):\n  pass\nexcept ValueError:\n pass\nelse:\n raise AssertionError('Timeout limit was not enforced')\n`,helper,directory]);
  assert.equal(result.status,0,result.stderr);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('compiler writes wait for publication but --check stays read-only',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-compiler-lock-'));
 const manifest={animationLibraries:{},appearances:{},horse:{actions:{walk:'walk',run:'run'},clips:[{name:'walk',locomotionSpeed:1,duration:1},{name:'run',locomotionSpeed:2,duration:1}]},equipment:{items:{},aliases:{}},revision:0};
 writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest));
 const initial=spawnSync(process.execPath,[compiler,'--directory',directory],{env:environment,encoding:'utf8',timeout:5000});assert.equal(initial.status,0,initial.stderr);
 const holder=launch(python,['-c',prelude+`with publication_lock(folder):\n print('LOCKED',flush=True)\n sys.stdin.readline()\n value=json.loads((folder/'manifest.json').read_text())\n value['revision']=1\n (folder/'manifest.json').write_text(json.dumps(value))\n`,helper,directory]);let writer;
 try{
  await holder.ready();
  const check=spawnSync(process.execPath,[compiler,'--directory',directory,'--check'],{env:environment,encoding:'utf8',timeout:3000});assert.equal(check.status,0,check.stderr);
  writer=launch(process.execPath,[compiler,'--directory',directory]);writer.child.stdin.end();await pause(120);
  assert.equal(writer.finished,false,'Compiler must acquire the lock before reading and writing the manifest');
  holder.child.stdin.end('\n');assert.equal((await holder.done).code,0);
  const written=await writer.done;assert.equal(written.code,0,written.stderr);
  assert.equal(JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')).revision,1,'Compiler preserves the preceding publisher update');
  assert.deepEqual(readdirSync(directory).sort(),['locomotion-profile.json','manifest.json']);
 }finally{holder.child.stdin.end();await Promise.all([holder.done,writer?.done]);rmSync(directory,{recursive:true,force:true});}
});

test('compiler calibration uses the same library identity through a symlink',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-compiler-alias-'));
 try{
  const manifest={animationLibraries:{},appearances:{},horse:{actions:{walk:'walk',run:'run'},clips:[{name:'walk',locomotionSpeed:1,duration:1},{name:'run',locomotionSpeed:2,duration:1}]},equipment:{items:{},aliases:{}}};
  writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest));
  const alias=join(directory,'alias');symlinkSync(directory,alias,process.platform==='win32'?'junction':'dir');
  const initial=spawnSync(process.execPath,[compiler,'--directory',directory],{env:environment,encoding:'utf8',timeout:5000});assert.equal(initial.status,0,initial.stderr);
  const before=readFileSync(join(directory,'locomotion-profile.json'),'utf8');
  const check=spawnSync(process.execPath,[compiler,'--directory',alias,'--check'],{env:environment,encoding:'utf8',timeout:5000});assert.equal(check.status,0,check.stderr);
  const rewrite=spawnSync(process.execPath,[compiler,'--directory',alias],{env:environment,encoding:'utf8',timeout:5000});assert.equal(rewrite.status,0,rewrite.stderr);
  assert.equal(readFileSync(join(directory,'locomotion-profile.json'),'utf8'),before,'Path aliases must not invalidate calibration');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('paired motion publication rejects geometry edits made during a worker export',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granaderos-motion-source-'));
 const builder=fileURLToPath(new URL('../tools/characters-3d/build-motion-increment.py',import.meta.url));
 try{
  const source=join(directory,'assets/source/characters-3d/authoring'),game=join(directory,'game'),output=join(directory,'models');
  for(const path of [source,game,output])mkdirSync(path,{recursive:true});
  writeFileSync(join(source,'gltf_pack.py'),'# No packing may occur after the guard fails.\n');
  writeFileSync(join(game,'actor-action-contract.js'),"export const ACTOR_CLIP_SPECS=[{name:'life.climbUp',gesture:'climbUp',equipment:'unarmed'}];\n");
  writeFileSync(join(directory,'package.json'),'{"type":"module"}');
  const manifest=JSON.stringify({complete:true,animationLibraries:Object.fromEntries(['male','female'].map(g=>[g,{url:`/models/characters/${g}.glb`}]))});
  writeFileSync(join(output,'manifest.json'),manifest);
  for(const gender of ['male','female'])writeFileSync(join(output,gender+'.glb'),'original bank');
  const script=`import sys,importlib.util,subprocess,types\nfrom pathlib import Path\np=Path(sys.argv[1]);sys.path.insert(0,str(p.parent))\nspec=importlib.util.spec_from_file_location('motion_builder',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)\nsource,output,geometry=map(Path,sys.argv[2:5]);original=subprocess.run\ndef worker(command,**kwargs):\n if command[0]!='fake-blender':return original(command,**kwargs)\n target=Path(command[command.index('--output')+1]);target.with_suffix('.json').write_text('{}')\n if command[command.index('--preset')+1]=='granadero':geometry.write_text(geometry.read_text()+'// concurrent edit\\n')\n kwargs['stdout'].write('MOTION_INCREMENT_READY\\n');return types.SimpleNamespace(returncode=0)\nsubprocess.run=worker\nsys.argv=[str(p),'--gesture','climbUp','--equipment','unarmed','--directory',str(output),'--source-directory',str(source),'--blender','fake-blender']\nmodule.main()\n`;
  for(const changed of ['climb-geometry.js','building-types.js','building-scale.js']){
   for(const name of ['climb-geometry.js','building-types.js','building-scale.js'])writeFileSync(join(game,name),'export const geometry=1;\n');
   const result=run(['-c',script,builder,source,output,join(game,changed)]);
   assert.notEqual(result.status,0);assert.match(result.stderr,/Authoring source changed during the build; no assets were published/);
   assert.equal(readFileSync(join(output,'manifest.json'),'utf8'),manifest);
   for(const gender of ['male','female'])assert.equal(readFileSync(join(output,gender+'.glb'),'utf8'),'original bank');
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
