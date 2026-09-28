import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {combatMilitia} from './militia-combat-fixture.mjs';
import {visit} from './local-contract-fixture.mjs';

test('mounted exploration pause and hidden-document guards stop patrols while an active tick saves their real movement',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const p=visit(combatMilitia().s),m=await mountCampaign(t,p),before=m.saved();
 const tick=async()=>{await act(async()=>t.mock.timers.tick(6000));};
 await tick();assert.deepEqual(m.saved(),before);
 await m.click('Reanudar exploración');Object.defineProperty(m.document,'hidden',{value:true,configurable:true});await tick();assert.deepEqual(m.saved(),before);
 Object.defineProperty(m.document,'hidden',{value:false,configurable:true});await tick();
 const after=m.saved();assert.equal(after.battle.elapsedSeconds,before.battle.elapsedSeconds+6);assert.equal(after.campaign.secondOfHour,before.campaign.secondOfHour+6);
 const militia=after.battle.units.filter(u=>u.militia);assert.ok(militia.some(u=>{const old=before.battle.units.find(v=>v.id===u.id);return u.x!==old.x||u.y!==old.y;}));
 for(const u of militia){const old=before.battle.units.find(v=>v.id===u.id);for(const key of ['ap','hp','loaded','ammo','condition'])assert.equal(u[key],old[key],`${u.id}: ${key}`);assert.ok(u.energy<=old.energy);}
 assert.equal(after.battle.syncedSeconds,after.battle.elapsedSeconds);assert.equal(m.read().battle.elapsedSeconds,after.battle.elapsedSeconds);assert.match(m.document.querySelector('[aria-label="Guarnición local"]').textContent,/actúan por su cuenta/);
});
