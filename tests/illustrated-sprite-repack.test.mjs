import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {packIllustratedSources} from '../tools/pack-illustrated-sprites.mjs';

test('authored illustrated sheets pack as RGBA with all directions and intact margins',async()=>{
 const destination=await mkdtemp(join(tmpdir(),'granaderos-illustrated-test-'));
 try{
  const manifest=await packIllustratedSources({destination});
  for(const [name,entry] of Object.entries(manifest.atlases)){
   const {data,info}=await sharp(await readFile(join(destination,entry.file))).raw().toBuffer({resolveWithObject:true});
   assert.equal(info.channels,4,name);
   assert.equal(entry.records.length,8*entry.framesPerDirection,name);
   assert.equal(new Set(entry.records.map(r=>r.direction)).size,8,name);
   assert.equal(new Set(entry.records.map(r=>r.sha256)).size,entry.records.length,`${name}: repeated raster frames`);
   for(const r of entry.records){assert.ok(r.bounds[0]>0&&r.bounds[1]>0&&r.bounds[2]<entry.cell&&r.bounds[3]<entry.cell);}
   let visible=0,transparent=0;
   for(let i=0;i<data.length;i+=4){if(data[i+3])visible++;else transparent++;}
   assert.ok(visible>0&&transparent>visible,name);
  }
 }finally{await rm(destination,{recursive:true,force:true});}
});
