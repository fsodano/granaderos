import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const meta=JSON.parse(readFileSync(new URL('../web/public/art/combat-animation.json',import.meta.url)));
test('articulated run and combat atlases cover eight facing directions with fixed ground anchors',()=>{
 assert.deepEqual(meta.frame_size,[192,192]);assert.equal(meta.direction_rows.length,8);assert.ok(Math.abs(meta.anchor[1]-.8830497935)<.000001);
 for(const faction of ['granadero','royalist'])for(const action of ['run','fire','reload','strike']){
  const info=meta.actions[`${faction}-${action}`];assert.equal(info.frames.length,64);
  const image=readFileSync(new URL(`../web/public/art/${info.file}`,import.meta.url));assert.equal(image.readUInt32BE(16),1536);assert.equal(image.readUInt32BE(20),1536);
  assert.equal(info.world_scale,action==='run'?1:3.5/2.6);
  for(const f of info.frames){assert.ok(f.bounds[0]>0&&f.bounds[1]>0&&f.bounds[2]<192&&f.bounds[3]<192,'musket and silhouette remain inside their frame');}
 }
});
