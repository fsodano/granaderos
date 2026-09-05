import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,cp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {verifyTacticalAssets} from '../tools/verify-tactical-assets.mjs';
test('current tactical atlases, terrain and scenery satisfy the static build contract',async()=>{await verifyTacticalAssets(new URL('../web/public',import.meta.url).pathname);});
test('build verification rejects missing dynamic scenery and altered combat pixels before staging',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-assets-'));try{
 await cp(new URL('../web/public/art',import.meta.url),join(root,'art'),{recursive:true});
 const scenery=join(root,'art/scenery-poplar-v1.webp'),saved=await readFile(scenery);await rm(scenery);await assert.rejects(verifyTacticalAssets(root),/ENOENT/);await writeFile(scenery,saved);
 const atlas=join(root,'art/granadero-fire-atlas.png'),bytes=await readFile(atlas);bytes[bytes.length-1]^=1;await writeFile(atlas,bytes);await assert.rejects(verifyTacticalAssets(root),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
