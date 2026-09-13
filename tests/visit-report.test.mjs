import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {stockAndCarriedAmmo,stockAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const visit=(s=initialCampaign())=>order(s,{type:'visitSector'});
const receipt=(s,b,type='leaveSector')=>({type,battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
function reject(s,a){const text=serializeCampaign(s),n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.equal(serializeCampaign(s),text);assert.deepEqual({...n,lastError:null},JSON.parse(text));}
const act=(s,a)=>{const n=actBattle(s,{unitId:'4',...a});assert.equal(n.lastError,null,n.lastError);return n;};

test('actual visit supply consumption and drops survive caller overrides, save and reentry',()=>{
 let s=initialCampaign();s.operativeState[4].inventory={letters:{count:1,weight:.1}};s=visit(s);let b=enterSector(s.pendingBattle);b=act(b,{type:'weapon',slot:'supply',supplyKey:'torches'});const u=b.units.find(u=>u.id==='4');b=act(b,{type:'useItem',x:u.x,y:u.y});b=act(b,{type:'drop',item:'primary'});b=act(b,{type:'drop',item:'inventory:letters'});const actual=b.units.find(u=>u.id==='4');assert.equal(actual.torches,1);assert.equal(actual.weaponDropped,true);assert.equal(actual.inventory.letters,undefined);const pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;const a=receipt(s,b),stock=stockAmmo(s),returned=b.units.filter(u=>u.side==='player'&&u.hp>0).reduce((n,u)=>n+u.loaded+totalReserveAmmunition(u),0);
 a.survivors=a.survivors.map(u=>({...u,weaponDropped:false,weapon:1800,condition:100,loaded:99,ammo:99,torches:20,medkits:20,inventory:{letters:{count:100,weight:0}}}));s=order(s,a);assert.equal(stockAndCarriedAmmo(s),stock+returned);assert.equal(s.operativeState[4].torches,1);assert.equal(s.operativeState[4].weaponDropped,true);assert.deepEqual(s.operativeState[4].inventory,actual.inventory);assert.equal(s.sectorStates.retiro.groundItems.filter(g=>g.count>0).length,2);reject(s,a);s=visit(restoreCampaign(serializeCampaign(s)));b=enterSector(s.pendingBattle,s.sectorStates.retiro);const again=b.units.find(u=>u.id==='4');assert.equal(again.torches,1);assert.equal(again.weaponDropped,true);assert.equal(again.loaded,0);assert.deepEqual(again.inventory,actual.inventory);
});
test('visits reject omitted participants, missing records and wrong deployment, sector or scene atomically',()=>{
 const s=visit(),base=receipt(s,enterSector(s.pendingBattle));for(const change of [a=>delete a.sectorState,a=>delete a.survivors,a=>a.survivors=[],a=>a.survivors.pop(),a=>a.survivors.push(a.survivors[0]),a=>a.sectorState.units=a.sectorState.units.filter(u=>u.id!=='3'),a=>delete a.sectorState.units[0].medkits,a=>a.battleId='stale',a=>a.sectorState.battleId='stale',a=>a.sectorState.sectorId='ensenada',a=>a.sectorState.sceneId='yatasto']){const a=structuredClone(base);change(a);reject(s,a);}
});
test('an exploration request does not require stale hostile records from an earlier engagement',()=>{
 let s=visit();const old=enterSector({...s.pendingBattle,exploration:false,enemies:[{id:'old-realista',hp:10}]});old.sectorCleared=false;s.sectorStates.retiro=old;const b=enterSector(s.pendingBattle,old);assert.deepEqual(s.pendingBattle.enemies,[]);assert.equal(b.units.filter(u=>u.side==='enemy').length,0);s=order(s,receipt(s,b));assert.equal(s.pendingBattle,null);assert.equal(s.sectorStates.retiro.units.filter(u=>u.side==='enemy').length,0);
});
test('full visit reports retain fallen soldiers and militia bodies without restoring their gear',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[3,0,0];s=visit(s);let b=enterSector(s.pendingBattle);const fallen=b.units.find(u=>u.id==='3'),militia=b.units.find(u=>u.militia);for(const field of ['priming','medkits','jammed']){const partial=structuredClone(b);delete partial.units.find(u=>u.id===militia.id)[field];reject(s,receipt(s,partial));}for(const u of [fallen,militia])Object.assign(u,{hp:0,bleeding:0,bandaged:0,unconscious:false,ap:0});const id=militia.id;s=order(s,receipt(s,b));assert.equal(s.operativeState[3].alive,false);assert.equal(s.sectors.retiro.militia[0],2);const ammunition=s.garrisons.retiro.reduce((n,u)=>n+u.loaded+totalReserveAmmunition(u),0);s=visit(restoreCampaign(serializeCampaign(s)));b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.find(u=>u.id===id).hp,0);assert.equal(b.units.filter(u=>u.militia&&u.hp>0).length,2);s=order(s,receipt(s,b));assert.equal(s.garrisons.retiro.reduce((n,u)=>n+u.loaded+totalReserveAmmunition(u),0),ammunition);assert.equal(s.operativeState[3].alive,false);
});
test('finishing Yatasto uses the same authoritative visit report and cannot commit a partial scene',()=>{
 let s=initialCampaign();s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;for(const id of ['cordoba','tucuman','salta'])s.sectors[id].owner='patriot';s.location='tucuman';s.squads[0].location=s.location;s.missions.yatasto={reports:true,assessment:true,frontier:true,stage:'ready',completed:false};s=order(s,{type:'visitMission',mission:'yatasto'});let b=enterSector(s.pendingBattle);b=act(b,{type:'weapon',slot:'supply',supplyKey:'torches'});const u=b.units.find(u=>u.id==='4');b=act(b,{type:'useItem',x:u.x,y:u.y});const base=receipt(s,b,'finishMission');reject(s,{...base,survivors:[]});const wrong=structuredClone(base);wrong.sectorState.sceneId=null;reject(s,wrong);assert.equal(s.missions.yatasto.completed,false);base.survivors=base.survivors.map(u=>({...u,torches:20,medkits:20}));s=order(s,base);assert.equal(s.missions.yatasto.completed,true);assert.equal(s.operativeState[4].torches,1);assert.equal(s.sceneStates.yatasto.sceneId,'yatasto');reject(s,base);
});
