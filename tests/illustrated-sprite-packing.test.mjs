import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,sheetRectangles,packIllustratedSources} from '../tools/pack-illustrated-sprites.mjs';

test('export key removal preserves red cloth, skin, iron, and navy',()=>{
 const source=Buffer.from([255,0,255,255, 223,10,230,255, 135,22,20,255, 154,93,52,255, 70,80,95,255, 25,40,61,255]);
 const result=removeExportKey(source);
 assert.deepEqual([...result.subarray(0,8)],Array(8).fill(0));
 assert.deepEqual(result.subarray(8),source.subarray(8));
 assert.equal(source[3],255,'source must stay intact');
});

test('key extraction removes pale magenta spill from smoke',()=>{
 const result=removeExportKey(Buffer.from([245,190,245,255]));
 assert.equal(result[0],result[1]);
 assert.equal(result[1],result[2]);
 assert.ok(result[3]>0&&result[3]<255);
});

test('dark key spill is removed at the silhouette while interior colours remain',()=>{
 const source=Buffer.from([255,0,255,255, 80,25,85,255, 80,25,85,255, 90,25,55,255]);
 const result=removeExportKey(source,4);
 assert.ok(result[4]<40&&result[6]<45,'the purple outline must be neutralized');
 assert.ok(result[7]>0&&result[7]<255,'keep a partial-alpha outline');
 assert.deepEqual(result.subarray(8),source.subarray(8),'preserve interior shade and burgundy cloth');
});

test('gutter detection rejects the wrong number of frames',()=>{
 const width=80,height=40,data=Buffer.alloc(width*height*4);
 for(const left of [10,30,50])for(let y=8;y<32;y++)for(let x=left;x<left+10;x++)data[(y*width+x)*4+3]=255;
 assert.equal(sheetRectangles(data,width,height,3,1).length,3);
 assert.throws(()=>sheetRectangles(data,width,height,4,1),/Expected 4 columns/);
});

test('white export extraction preserves enclosed cloth and rejects unknown keys',()=>{
 const width=7,source=Buffer.alloc(width*width*4,255);
 for(let y=2;y<=4;y++)for(let x=2;x<=4;x++){
  if(x===3&&y===3)continue;
  source.set([25,40,61,255],(y*width+x)*4);
 }
 source.set([253,254,253,255],0);
 source.set([195,195,195,255],(3*width+1)*4);
 const clean=removeExportKey(source,width,'white');
 assert.deepEqual([...clean.subarray(0,4)],[0,0,0,0],'remove connected near-white backdrop');
 assert.deepEqual([...clean.subarray((3*width+3)*4,(3*width+3)*4+4)],[255,255,255,255],'keep enclosed white cloth');
 assert.deepEqual([...clean.subarray((2*width+2)*4,(2*width+2)*4+4)],[25,40,61,255],'keep the navy outline');
 assert.equal(source[3],255,'never mutate source pixels');
 const edge=(3*width+1)*4;
 assert.ok(clean[edge]<90&&clean[edge+3]>0&&clean[edge+3]<255,'remove white halo from the dark contour');
 assert.throws(()=>removeExportKey(source,width,'blue'),/Unknown export key/);
 assert.throws(()=>removeExportKey(source,undefined,'white'),/source width/);
});

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
