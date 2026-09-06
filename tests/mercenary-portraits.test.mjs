import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {MERCENARY_ADDITIONS} from '../game/mercenaries.js';
import {CIVIC_RECRUITS} from '../game/recruitment.js';
import {portraitFor} from '../web/lib/portraits.ts';
const require=createRequire(new URL('../web/package.json',import.meta.url));
const sharp=require('sharp');
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
test('all paid volunteers resolve to existing portraits; invalid IDs do not',()=>{
 for(const op of CIVIC_RECRUITS){const path=portraitFor(op.id);assert.ok(path,op.name);assert.ok(existsSync(new URL(`web/public${path}`,root)),op.name);}
 for(const id of [-1,99,148,107.5,1000,'unknown'])assert.equal(portraitFor(id),null);
});
test('41 unique generated portraits have intact sources, matching copies and production dimensions',async()=>{
 const manifest=JSON.parse(read('assets/web/mercenary-portraits.json'));
 const prompts=JSON.parse(read('assets/prompts/mercenary-portraits.json'));
 assert.deepEqual(manifest.map(o=>o.id).sort((a,b)=>a-b),MERCENARY_ADDITIONS.map(o=>o.id));
 assert.equal(new Set(manifest.map(o=>o.sha256)).size,41);
 assert.deepEqual(read('assets/web/mercenary-portraits.json'),read('web/public/art/mercenary-portraits.json'));
 for(const entry of manifest){
  const prompt=prompts.find(p=>p.id===entry.id),op=MERCENARY_ADDITIONS.find(o=>o.id===entry.id);
  assert.equal(prompt.source,entry.source);assert.ok(prompt.prompt.includes(op.name),op.name);
  const deployed=read(`web/public${entry.file}`),source=read(entry.source);
  assert.deepEqual(deployed,read(`assets/web/${entry.file.split('/').at(-1)}`));
  assert.equal(createHash('sha256').update(deployed).digest('hex'),entry.sha256);
  assert.equal(deployed.length,entry.bytes);assert.ok(source.length>1000);
  const metadata=await sharp(deployed).metadata();assert.equal(metadata.width,384);assert.equal(metadata.height,384);assert.equal(metadata.format,'webp');
 }
});
