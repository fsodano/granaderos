import test from 'node:test';import assert from 'node:assert/strict';import {freshCuyoRoute} from './fresh-cuyo-fixture.mjs';
test('a fresh campaign prepares Cuyo with real battles, living roles, purchases, funding and physical late recruitment',()=>{
 const {campaign:s,notes}=freshCuyoRoute();assert.deepEqual(notes.slice(0,3).map(n=>n.stage),['mendoza','uspallata','los_patos']);assert.equal(notes.at(-1).stage,'commander');assert.equal(s.flags.armyFunded,true);for(const id of ['mendoza','uspallata','los_patos'])assert.ok(s.sectors[id].fort>=1);assert.equal(Object.values(s.sectors).filter(s=>s.owner==='patriot').length,9);
});
