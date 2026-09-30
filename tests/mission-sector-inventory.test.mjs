import test from 'node:test';
import assert from 'node:assert/strict';
import {completedConferenceStock,order} from './mission-inventory-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel,sectorInventorySites,knownCampaignSectorEquipment} from '../game/sector-inventory.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {decodeSave,encodeSave} from '../game/save.js';
const model=(s,site='yatasto')=>sectorInventoryModel(s,site,rosterFor(s),4);
const dressings=s=>model(s).entries.find(r=>r.kind==='ground'&&JSON.parse(r.expected).item==='medkits');
const take=row=>({type:'sectorInventory',sector:'yatasto',operativeId:4,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
const reject=(s,a)=>{const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},{...s,lastError:null});};

test('completed Yatasto equipment can be collected and dropped without changing the separate town pool',()=>{
 let s=completedConferenceStock();assert.equal(s.missions.yatasto.completed,true);
 assert.deepEqual(sectorInventorySites(s,'tucuman').map(site=>site.id),['tucuman','yatasto']);
 const town=structuredClone(s.sectorStates.tucuman),row=dressings(s),before=s.operativeState[4].medkits;
 assert.equal(model(s).reason,null);assert.equal(row.reachable,true);
 s=order(s,take(row));assert.equal(s.operativeState[4].medkits,before+1);assert.equal(dressings(s),undefined);assert.deepEqual(s.sectorStates.tucuman,town);
 reject(s,take(row));
 s=order(s,{type:'sectorInventory',sector:'yatasto',operativeId:4,direction:'drop',item:'medkits',count:1});
 assert.equal(s.operativeState[4].medkits,before);assert.equal(dressings(s).count,1);assert.deepEqual(s.sectorStates.tucuman,town);
 s=decodeSave(encodeSave(s)).campaign;assert.equal(dressings(s).count,1);s=order(s,take(dressings(s)));assert.equal(dressings(s),undefined);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
test('mission pickup retains parent occupation, local soldier, transit, consciousness and pending encounter guards',()=>{
 const base=completedConferenceStock(),a=take(dressings(base));
 for(const change of [s=>s.sectors.tucuman.owner='royalist',s=>s.squads[0].location='retiro',s=>s.squads[0].journey={status:'moving'},s=>s.operativeState[4].asleep=true,s=>s.operativeState[4].hp=9,s=>s.operativeState[4].captured=true,s=>s.pendingEncounter={sector:'tucuman'},s=>s.enemyGroups.push({target:'tucuman',status:'stationed'}),s=>s.sceneStates.yatasto.sectorCleared=false]){
  const s=structuredClone(base);change(s);reject(s,a);
 }
});
test('mission sources retain finite quantity, stale-row and walking-path checks',()=>{
 const base=completedConferenceStock(),row=dressings(base);
 reject(base,{...take(row),count:2});reject(base,{...take(row),expected:'stale'});
 const blocked=structuredClone(base),scene=blocked.sceneStates.yatasto;
 for(const tile of scene.tiles)tile.blocked=true;
 const actor=scene.units.find(u=>u.id==='4'),ground=scene.groundItems.find(g=>g.item==='medkits');
 ground.x=actor.x+4;ground.y=actor.y;
 assert.equal(dressings(blocked).reachable,false);reject(blocked,take(row));
});
test('public map equipment includes distinct visited sites without hidden contents or snapshot data',()=>{
 const s=completedConferenceStock(),before=structuredClone(s),known=knownCampaignSectorEquipment(s,'tucuman');
 assert.deepEqual(s,before);
 assert.ok(known.some(r=>r.siteId==='yatasto'&&r.label==='Vendas'));assert.ok(known.some(r=>r.siteId==='tucuman'&&r.label==='Vendas'));
 assert.equal(new Set(known.map(r=>r.key)).size,known.length);
 s.sceneStates.yatasto.groundItems.push({id:'secret-object',type:'item',item:'medkits',count:777,x:0,y:0,weight:.2,knownToPlayer:false});
 const projected=playerKnownCampaign(s).sectors.find(sector=>sector.id==='tucuman').equipment;
 assert.deepEqual(projected,known);assert.doesNotMatch(JSON.stringify(projected),/secret-object|knownToPlayer|returnLedger|expected/);
 delete s.sceneStates.yatasto;s.sectorStates.san_lorenzo=undefined;
 assert.deepEqual(sectorInventorySites(s,'tucuman').map(site=>site.id),['tucuman']);
});
