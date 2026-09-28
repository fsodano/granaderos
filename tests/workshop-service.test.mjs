import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,operativeLocation} from '../game/campaign.js';
import {refillCost,firearmRepairCost} from '../game/equipment.js';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {separatedWorkshop,returnToWorkshop,REMOTE,LOCAL} from './workshop-service-fixture.mjs';

test('a selected headquarters squad cannot replenish or repair a person in a different sector',()=>{
 const s=separatedWorkshop();assert.equal(s.location,'retiro');assert.equal(operativeLocation(s,REMOTE),'buenos_aires');
 for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:REMOTE});assert.match(n.lastError??'',/mismo taller/);assert.equal(n.resources.treasury,s.resources.treasury);assert.deepEqual(n.operativeState[REMOTE],s.operativeState[REMOTE]);}
 let n=order(s,{type:'resupply',operativeId:LOCAL});n=order(n,{type:'repairWeapon',operativeId:LOCAL});assert.equal(n.operativeState[LOCAL].condition,100);assert.deepEqual(n.operativeState[REMOTE],s.operativeState[REMOTE]);assert.ok(saved({campaign:n}));
});

test('a real return to the workshop enables paid service once and preserves it on deployment',()=>{
 let s=returnToWorkshop(separatedWorkshop());const before=s.resources.treasury,record=s.operativeState[REMOTE],cost=refillCost(record)+firearmRepairCost(record);
 s=order(s,{type:'resupply',operativeId:REMOTE});s=order(s,{type:'repairWeapon',operativeId:REMOTE});assert.equal(s.resources.treasury,before-cost);assert.equal(s.operativeState[REMOTE].condition,100);assert.equal(s.operativeState[REMOTE].priming,50);
 for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:REMOTE});assert.ok(n.lastError);assert.equal(n.resources.treasury,s.resources.treasury);}
 const p=visit(saved({campaign:s}).campaign),u=p.battle.units.find(u=>u.id===String(REMOTE));assert.equal(u.condition,100);assert.equal(u.priming,50);assert.equal(u.medkits,2);assert.ok(saved(p));
});

test('local workshop service still requires an available person, an actual workshop, supply and funds',()=>{
 const s=separatedWorkshop(),remote=order(s,{type:'selectSquad',id:s.squads.find(q=>q.members.includes(REMOTE)).id});
 for(const type of ['resupply','repairWeapon']){
  assert.ok(dispatchCampaign(remote,{type,operativeId:REMOTE}).lastError,'Buenos Aires has no workshop');
  for(const change of [n=>{n.resources.treasury=0;},n=>{n.recruited=n.recruited.filter(id=>id!==LOCAL);},n=>{n.sectors.retiro.owner='royalist';}]){const before=structuredClone(s);change(before);const n=dispatchCampaign(before,{type,operativeId:LOCAL});assert.ok(n.lastError);assert.equal(n.resources.treasury,before.resources.treasury);assert.deepEqual(n.operativeState[LOCAL],before.operativeState[LOCAL]);}
 }
});
