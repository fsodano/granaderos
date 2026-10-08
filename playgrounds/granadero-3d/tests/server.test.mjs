import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const root=fileURLToPath(new URL('..',import.meta.url));
const servers=[];
async function start(production){
 const child=spawn(process.execPath,['server.mjs',...(production?['--dist']:[])],{cwd:root,env:{...process.env,GRANADERO_PLAYGROUND_PORT:'0'},stdio:['ignore','pipe','pipe']});
 servers.push(child);
 return new Promise((resolve,reject)=>{
  let output='';const timeout=setTimeout(()=>reject(new Error(`Server did not start: ${output}`)),5000);
  child.once('error',reject);child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Server exited ${code}: ${output}`));});
  child.stderr.on('data',data=>output+=data);
  child.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timeout);resolve(`http://127.0.0.1:${match[1]}`);}});
 });
}
let development,production;
before(async()=>{
 execFileSync(process.execPath,['build.mjs'],{cwd:root,stdio:'pipe'});
 development=await start(false);production=await start(true);
});
after(()=>{for(const server of servers)server.kill();});
for(const mode of ['development','production']){
 test(`${mode} serves the model and all imported runtime modules`,async()=>{
  const base=mode==='development'?development:production;
  for(const [path,type] of [['/','text/html'],['/src/main.js','text/javascript'],['/game/skin-palette.js','text/javascript'],['/src/character-library.js','text/javascript'],['/src/style.css','text/css'],['/vendor/three/build/three.module.js','text/javascript'],['/vendor/three/build/three.core.js','text/javascript'],['/vendor/three/examples/jsm/loaders/GLTFLoader.js','text/javascript'],['/vendor/three/examples/jsm/controls/OrbitControls.js','text/javascript'],['/vendor/three/examples/jsm/environments/RoomEnvironment.js','text/javascript'],['/vendor/three/examples/jsm/utils/BufferGeometryUtils.js','text/javascript'],['/vendor/three/examples/jsm/utils/SkeletonUtils.js','text/javascript'],['/assets/granadero.glb','model/gltf-binary'],['/assets/asset-manifest.json','application/json']]){
   const response=await fetch(base+path);
   assert.equal(response.status,200,`${mode} ${path}`);
   assert.ok(response.headers.get('content-type')?.startsWith(type),`${path}: ${type}`);
   assert.ok((await response.arrayBuffer()).byteLength>0,`${path} empty`);
  }
 });
 test(`${mode} serves only the allowed shared palette helper`,async()=>{
  const base=mode==='development'?development:production;
  const response=await fetch(base+'/game/skin-palette.js');
  assert.equal(response.status,200);
  assert.equal(await response.text(),readFileSync(new URL('../../../game/skin-palette.js',import.meta.url),'utf8'));
  assert.equal((await fetch(base+'/game/actor-action-contract.js')).status,404,'Other repository modules are not exposed');
 });
 test(`${mode} serves every selectable game character with its animation bank and textures`,async()=>{
  const base=mode==='development'?development:production;
  const response=await fetch(base+'/models/characters/manifest.json');assert.equal(response.status,200);
  const manifest=await response.json();assert.equal(Object.keys(manifest.appearances).length,8);
  const files=new Set([...Object.values(manifest.appearances).map(appearance=>appearance.lods.find(lod=>lod.lod===0).url),...Object.values(manifest.animationLibraries).map(bank=>bank.url),manifest.equipment.url]);
  const textures=new Set();
  for(const path of files){
   const response=await fetch(base+path);assert.equal(response.status,200,`${mode} ${path}`);
   const bytes=Buffer.from(await response.arrayBuffer()),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
   for(const image of json.images??[])if(image.uri)textures.add(new URL(image.uri,base+path).href);
  }
  assert.ok(textures.size>0,'Production textures remain external and shared');
  for(const url of textures){const response=await fetch(url);assert.equal(response.status,200,`${mode} ${url}`);assert.ok(response.headers.get('content-type').startsWith('image/'));}
 });
 test(`${mode} rejects missing files and encoded paths outside its root`,async()=>{
  const base=mode==='development'?development:production;
  assert.equal((await fetch(base+'/missing-file')).status,404);
  assert.equal((await fetch(base+'/%2e%2e%2f%2e%2e%2fpackage.json')).status,403);
  assert.equal((await fetch(base+'/models/characters/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fpackage.json')).status,403);
 });
}
