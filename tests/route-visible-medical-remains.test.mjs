import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {saved,visit,leave} from './local-contract-fixture.mjs';

test('public body inspection recovers finite dressings from actual native deaths and retains them across saves and visits',()=>{
 let checkpoint;const stop=new Error('native capital checkpoint complete');
 assert.throws(()=>freshCoastalRoute('local',{onCheckpoint:(sector,campaign)=>{if(sector==='buenos_aires'){checkpoint=campaign;throw stop;}}}),error=>error===stop);
 assert.ok(checkpoint);assert.equal(checkpoint.sectors.buenos_aires.owner,'patriot');
 const before=structuredClone(checkpoint),carrier=3,bodyStock=campaign=>campaign.sectorStates.buenos_aires.units.filter(u=>u.hp===0&&!u.departure).reduce((sum,u)=>sum+(u.medkits??0),0),stock=bodyStock(checkpoint);
 assert.ok(stock>0,'native combat leaves actual finite corpse dressings');
 const result=recoverVisibleRouteDressings(checkpoint,carrier,1);
 const newlyFallen=result.campaign.sectorStates.buenos_aires.units.filter(unit=>unit.hp===0&&before.sectorStates.buenos_aires.units.find(old=>old.id===unit.id)?.hp>0);
 for(const unit of newlyFallen){const old=before.sectorStates.buenos_aires.units.find(old=>old.id===unit.id);assert.ok(old.bleeding>0,'only an actual unresolved native wound can create another corpse during inspection');assert.equal(unit.medkits,old.medkits,'a new casualty retains its actual carried dressings');}
 const remainingStock=stock-1+newlyFallen.reduce((sum,unit)=>sum+(unit.medkits??0),0);
 assert.deepEqual(checkpoint,before,'inspection does not change the supplied checkpoint');assert.equal(result.collected,1);assert.equal(bodyStock(result.campaign),remainingStock);
 assert.equal(result.campaign.operativeState[carrier].medkits,before.operativeState[carrier].medkits+1);assert.equal(result.campaign.resources.treasury,before.resources.treasury);
 assert.ok(result.evidence.elapsedSeconds>0);assert.ok(result.evidence.actions.some(action=>action.type==='approachLoot'));assert.equal(result.evidence.actions.filter(action=>action.type==='loot').length,1);
 const receipt=result.evidence.receipts[0];assert.equal(receipt.before-receipt.after,1);assert.equal(result.campaign.sectorStates.buenos_aires.units.find(u=>u.id===receipt.bodyId).medkits,receipt.after);
 for(const [id,record]of Object.entries(before.operativeState)){assert.equal(result.campaign.operativeState[id].alive,record.alive);assert.equal(result.campaign.operativeState[id].hp,record.hp);}
 assert.deepEqual(saved({campaign:result.campaign}).campaign,result.campaign);
 assert.deepEqual(recoverVisibleRouteDressings(saved({campaign:before}).campaign,carrier,1),result,'the full saved native checkpoint replays the exact ordinary recovery');
 const again=visit(result.campaign),body=again.battle.units.find(u=>u.id===receipt.bodyId);assert.equal(body.medkits,receipt.after);assert.equal(again.battle.units.find(u=>u.id===String(carrier)).medkits,before.operativeState[carrier].medkits+1);
 const returned=saved({campaign:leave(again)}).campaign;assert.equal(bodyStock(returned),remainingStock);assert.equal(returned.operativeState[carrier].medkits,before.operativeState[carrier].medkits+1);
});
