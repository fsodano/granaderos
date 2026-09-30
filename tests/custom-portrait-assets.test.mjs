import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {CHARACTER_PORTRAITS} from '../game/character-profile.js';
import {BALANCED_PORTRAITS} from '../game/portrait-expansion.js';

const require=createRequire(new URL('../web/package.json',import.meta.url));
const sharp=require('sharp');
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));

test('the twelve new custom portraits have distinct sources and intact production copies',async()=>{
 const manifest=JSON.parse(read('assets/web/custom-portraits.json'));
 const prompts=JSON.parse(read('assets/prompts/custom-portraits.json'));
 const portraits=CHARACTER_PORTRAITS.filter(p=>p.id.includes('-black-'));
 assert.equal(portraits.length,12);
 assert.deepEqual(manifest.map(p=>p.id).sort(),portraits.map(p=>p.id).sort());
 assert.deepEqual(prompts.map(p=>p.id).sort(),portraits.map(p=>p.id).sort());
 assert.equal(new Set(manifest.map(p=>p.sha256)).size,12);
 assert.deepEqual(read('assets/web/custom-portraits.json'),read('web/public/art/custom-portraits.json'));
 const sourceHashes=new Set();
 for(const entry of manifest){
  const portrait=portraits.find(p=>p.id===entry.id),prompt=prompts.find(p=>p.id===entry.id);
  assert.equal(entry.file,portrait.src);
  assert.equal(entry.source,prompt.source);
  assert.equal(prompt.method,'built-in image_gen');
  assert.ok(prompt.prompt.length>100);
  const source=read(entry.source),deployed=read(`web/public${entry.file}`);
  sourceHashes.add(createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(deployed,read(`assets/web/${entry.file.split('/').at(-1)}`));
  assert.equal(createHash('sha256').update(deployed).digest('hex'),entry.sha256);
  assert.equal(deployed.length,entry.bytes);
  assert.deepEqual(entry.size,[384,384]);
  const metadata=await sharp(deployed).metadata();
  assert.equal(metadata.format,'webp');
  assert.equal(metadata.width,384);
  assert.equal(metadata.height,384);
 }
 assert.equal(sourceHashes.size,12,'each portrait has its own generated source');
});

test('all 122 balancing portraits have individual generated sources, correct metadata and complete deployment copies',async()=>{
 const manifest=JSON.parse(read('assets/web/balanced-portraits.json'));
 const prompts=JSON.parse(read('assets/prompts/balanced-portraits.json'));
 assert.equal(BALANCED_PORTRAITS.length,122);
 assert.deepEqual(manifest.map(p=>p.id).sort(),BALANCED_PORTRAITS.map(p=>p.id).sort());
 assert.deepEqual(prompts.map(p=>p.id).sort(),BALANCED_PORTRAITS.map(p=>p.id).sort());
 assert.deepEqual(read('assets/web/balanced-portraits.json'),read('web/public/art/balanced-portraits.json'));
 const sourceHashes=new Set(),productionHashes=new Set();
 for(const entry of manifest){
  const portrait=BALANCED_PORTRAITS.find(p=>p.id===entry.id),prompt=prompts.find(p=>p.id===entry.id);
  assert.equal(entry.file,portrait.src);assert.equal(entry.source,prompt.source);
  assert.equal(prompt.method,'built-in image_gen');
  for(const key of ['gender','role','skinTone','spriteAppearance','spriteSkinTone'])assert.equal(portrait[key],prompt[key],`${portrait.id} ${key}`);
  const source=read(entry.source),deployed=read(`web/public${entry.file}`);
  sourceHashes.add(createHash('sha256').update(source).digest('hex'));
  const digest=createHash('sha256').update(deployed).digest('hex');productionHashes.add(digest);
  assert.equal(digest,entry.sha256);assert.equal(deployed.length,entry.bytes);
  assert.deepEqual(deployed,read(`assets/web/${entry.file.split('/').at(-1)}`));
  assert.deepEqual(entry.size,[384,384]);
  const metadata=await sharp(deployed).metadata();
  assert.equal(metadata.format,'webp');assert.equal(metadata.width,384);assert.equal(metadata.height,384);
 }
 assert.equal(sourceHashes.size,122,'every added choice has its own generated original');
 assert.equal(productionHashes.size,122,'each added choice displays different artwork');
});
