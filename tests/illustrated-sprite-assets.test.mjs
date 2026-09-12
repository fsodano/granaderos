import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyIllustratedSpriteAssets} from '../tools/verify-tactical-assets.mjs';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {SPRITE_SEQUENCES,CIVILIAN_SPRITE_SEQUENCES} from '../game/sprite-state.js';
import sharp from '../web/node_modules/sharp/lib/index.js';

test('dead poses exactly preserve the final collapse pixels with no breathing',async()=>{
 const directory=new URL('../web/public/art/illustrated/',import.meta.url).pathname;
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 for(const appearance of Object.keys(SPRITE_APPEARANCES)){
  const fall=manifest.atlases[`${appearance}-collapse`],dead=manifest.atlases[`${appearance}-dead-idle`];
  assert.equal(dead.fps,0);assert.equal(dead.framesPerDirection,1);
  for(let direction=0;direction<8;direction++){
   const final=await sharp(join(directory,fall.file)).extract({left:(fall.framesPerDirection-1)*fall.cell,top:direction*fall.cell,width:fall.cell,height:fall.cell}).raw().toBuffer();
   const still=await sharp(join(directory,dead.file)).extract({left:direction*dead.cell,top:0,width:dead.cell,height:dead.cell}).raw().toBuffer();
   assert.deepEqual(still,final,`${appearance} direction ${direction}`);
  }
 }
});

test('published illustrated metadata and every atlas match the runtime and static build contract',async()=>{
 await verifyIllustratedSpriteAssets(new URL('../web/public',import.meta.url).pathname);
 const manifest=JSON.parse(await readFile(new URL('../web/public/art/illustrated/manifest.json',import.meta.url),'utf8'));
 const expected=Object.keys(SPRITE_APPEARANCES).flatMap(appearance=>(appearance==='civilian'?CIVILIAN_SPRITE_SEQUENCES:SPRITE_SEQUENCES).map(sequence=>`${appearance}-${sequence}`));
 assert.equal(manifest.status,'complete');
 assert.equal(expected.length,240);
 for(const name of expected)assert.ok(manifest.atlases[name],`active appearance and action must be published: ${name}`);
 // Retired art remains available; it does not increase the active authoring scope.
});

test('illustrated validation rejects stale runtime metadata, missing directions and changed pixels',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-illustrated-build-'));
 try{
  await cp(new URL('../web/public/art/illustrated',import.meta.url),join(root,'art/illustrated'),{recursive:true});
  const path=join(root,'art/illustrated/manifest.json'),original=await readFile(path,'utf8');
  for(const alter of [
   m=>{delete m.atlases['granadero-walk'];},
   m=>{m.atlases['granadero-walk'].fps=10;},
   m=>{m.atlases['granadero-walk'].records[0].direction='ne';},
   m=>{m.atlases['granadero-idle'].anchor[1]=137;},
  ]){
   const manifest=JSON.parse(original);alter(manifest);await writeFile(path,JSON.stringify(manifest));
   await assert.rejects(verifyIllustratedSpriteAssets(root),/illustrated sprite|Illustrated sprite/);
  }
  await writeFile(path,original);
  const atlas=join(root,'art/illustrated/granadero-idle.png'),bytes=await readFile(atlas);bytes[bytes.length-1]^=1;await writeFile(atlas,bytes);
  await assert.rejects(verifyIllustratedSpriteAssets(root),/Illustrated sprite checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
