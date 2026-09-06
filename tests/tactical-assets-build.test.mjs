import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,cp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {verifyTacticalAssets} from '../tools/verify-tactical-assets.mjs';
test('current tactical atlases, terrain and scenery satisfy the static build contract',async()=>{await verifyTacticalAssets(new URL('../web/public',import.meta.url).pathname);});
test('unconscious frames contain authored breathing while corpses are distinct still images',async()=>{
 const meta=JSON.parse(await readFile(new URL('../assets/web/pixel/manifest.json',import.meta.url),'utf8'));
 for(const family of ['granadero','royalist','civilian']){
  const breathing=meta.atlases[`${family}-unconscious-breathe`],dead=meta.atlases[`${family}-dead-idle`];
  assert.equal(breathing.fps,2);assert.equal(breathing.frames.length,64);assert.equal(dead.frames.length,8);
  for(const direction of meta.directions){
   const frames=breathing.frames.filter(f=>f.direction===direction);
   assert.ok(new Set(frames.map(f=>f.source_sha256)).size>=3,`${family} ${direction} must actually breathe`);
   assert.notEqual(frames[0].source_sha256,dead.frames.find(f=>f.direction===direction).source_sha256);
  }
 }
 for(const family of ['granadero','royalist']){
  const armed=meta.atlases[`${family}-prone-armed-idle`],unarmed=meta.atlases[`${family}-prone-unarmed-idle`];
  for(let i=0;i<8;i++)assert.notEqual(armed.frames[i].source_sha256,unarmed.frames[i].source_sha256);
 }
});
test('native pixel sprites reject stale layouts, missing families, duplicate frames and changed idle pixels',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-pixel-'));
 try{
  await cp(new URL('../web/public/art',import.meta.url),join(root,'art'),{recursive:true});
  const path=join(root,'art/pixel/manifest.json'),original=await readFile(path,'utf8');
  for(const alter of [m=>delete m.atlases['cavalry-walk'],m=>m.atlases['granadero-idle'].cell=192,m=>m.atlases['granadero-prone-unarmed-idle'].anchor[1]=46,m=>m.atlases['royalist-walk'].frames[1]=m.atlases['royalist-walk'].frames[0],m=>m.atlases['granadero-fire'].frames[0].bounds[0]=0]){
   const meta=JSON.parse(original);alter(meta);await writeFile(path,JSON.stringify(meta));await assert.rejects(verifyTacticalAssets(root),/native pixel sprite/);
  }
  await writeFile(path,original);
  const atlas=join(root,'art/pixel/granadero-idle-atlas.png'),bytes=await readFile(atlas);bytes[bytes.length-1]^=1;await writeFile(atlas,bytes);
  await assert.rejects(verifyTacticalAssets(root),/checksum mismatch.*pixel\/granadero-idle/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('all 1704 native frames and their authored exports match the served assets',async()=>{
 const root=new URL('../assets/web/pixel/',import.meta.url),served=new URL('../web/public/art/pixel/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 assert.equal(Object.values(manifest.atlases).reduce((sum,a)=>sum+a.frames.length,0),1704);
 for(const name of ['manifest.json',...Object.values(manifest.atlases).map(a=>a.file)])assert.deepEqual(await readFile(new URL(name,root)),await readFile(new URL(name,served)));
});
test('build verification rejects missing dynamic scenery and altered combat pixels before staging',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-assets-'));try{
 await cp(new URL('../web/public/art',import.meta.url),join(root,'art'),{recursive:true});
 const scenery=join(root,'art/scenery-poplar-v1.webp'),saved=await readFile(scenery);await rm(scenery);await assert.rejects(verifyTacticalAssets(root),/ENOENT/);await writeFile(scenery,saved);
 const atlas=join(root,'art/granadero-fire-atlas.png'),bytes=await readFile(atlas);bytes[bytes.length-1]^=1;await writeFile(atlas,bytes);await assert.rejects(verifyTacticalAssets(root),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('civilian metadata and pixels reject broken layout, coverage, anchors and checksums',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-civilian-'));
 try{
  await cp(new URL('../web/public/art',import.meta.url),join(root,'art'),{recursive:true});
  const path=join(root,'art/civilian-animation.json'),original=await readFile(path,'utf8');
  for(const alter of [m=>m.anchor[1]=.5,m=>m.frame_size[0]=256,m=>m.direction_rows.reverse(),m=>m.fps=8,m=>delete m.atlases.idle.sha256,m=>m.atlases.walk.frames[1]=m.atlases.walk.frames[0],m=>m.atlases.walk.frames[0].bounds[0]=0]){
   const meta=JSON.parse(original);alter(meta);await writeFile(path,JSON.stringify(meta));await assert.rejects(verifyTacticalAssets(root),/civilian/);
  }
  await writeFile(path,original);
  const atlas=join(root,'art/civilian-walk-atlas.png'),bytes=await readFile(atlas);bytes[bytes.length-1]^=1;await writeFile(atlas,bytes);await assert.rejects(verifyTacticalAssets(root),/checksum mismatch.*civilian/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('authored and served civilian metadata and atlases are identical',async()=>{
 for(const name of ['civilian-animation.json','civilian-idle-atlas.png','civilian-walk-atlas.png'])assert.deepEqual(await readFile(new URL(`../assets/web/${name}`,import.meta.url)),await readFile(new URL(`../web/public/art/${name}`,import.meta.url)));
});
