import {fightNorthernSector,northernCombatOrder} from './northern-route.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {beginFreshCampaign,recoverFreshCapital,prepareFreshNorthernAssault} from './fresh-campaign-route.mjs';

test('a Retiro-only campaign pays for its opening, retains real losses and funds medical recovery and a coordinated northern assault',()=>{
 const opening=beginFreshCampaign();
 assert.ok(opening.actions>0);assert.ok(opening.casualties.length>0);
 assert.equal(opening.campaign.officer,null);
 const original=structuredClone(opening.campaign),recovered=recoverFreshCapital(opening.campaign);
 assert.deepEqual(opening.campaign,original);
 assert.ok(recovered.campaign.hour>original.hour);
 assert.equal(recovered.campaign.squad.length,6);
 assert.ok(recovered.patients.length>0);
 for(const id of recovered.patients)assert.equal(recovered.campaign.operativeState[id].hp,recovered.campaign.operativeState[id].maxHp);
 for(const id of opening.casualties)assert.equal(recovered.campaign.operativeState[id].alive,false);
 for(const id of recovered.field){assert.ok(recovered.campaign.operativeState[id].alive);assert.ok(recovered.campaign.contracts[id].expiresAt>recovered.campaign.hour);}
 assert.ok(recovered.campaign.resources.treasury>=0);
 assert.equal(recovered.campaign.flags.academy,true);
 assert.deepEqual(Object.keys(recovered.campaign.sectors).filter(id=>recovered.campaign.sectors[id].owner==='patriot').sort(),['buenos_aires','retiro']);
 assert.equal(recovered.campaign.completed,false);
 const deployed=prepareFreshNorthernAssault(recovered);
 const result=fightNorthernSector(deployed,'san_nicolas',{controller:northernCombatOrder});
 assert.equal(result.campaign.sectors.san_nicolas.owner,'patriot');
 for(const id of opening.casualties)assert.equal(result.campaign.operativeState[id].alive,false);
 assert.equal(result.campaign.completed,false);
});
