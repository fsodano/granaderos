import test from 'node:test';import assert from 'node:assert/strict';import {freshCuyoRoute} from './fresh-cuyo-fixture.mjs';
test('a fresh campaign prepares Cuyo with real battles, living roles, purchases, funding and physical late recruitment',()=>{
 const {campaign:s,notes}=freshCuyoRoute();
 assert.deepEqual(notes.filter(n=>n.actions).map(n=>n.stage),['mendoza','uspallata','los_patos']);assert.equal(notes.at(-1).stage,'commander');assert.equal(s.flags.armyFunded,true);assert.equal(s.phase,4);
 for(const id of ['mendoza','uspallata','los_patos']){assert.ok(s.sectors[id].fort>=1);assert.equal(s.sectors[id].owner,'patriot');}
 // Earlier northern counterattacks remain real. Cuyo does not grant control
 // over towns lost while the army earns its funding and recovers casualties.
 for(const note of notes)for(const id of note.deaths)assert.equal(s.operativeState[id].alive,false);
 assert.equal(s.completed,false);assert.ok(s.operativeState[57].alive);
});
