import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,cp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {verifyTacticalAssets} from '../tools/verify-tactical-assets.mjs';
test('current tactical atlases, terrain and scenery satisfy the static build contract',async()=>{await verifyTacticalAssets(new URL('../web/public',import.meta.url).pathname);});
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
