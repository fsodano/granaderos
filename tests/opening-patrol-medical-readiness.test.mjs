import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {prepareOpeningPatrolMedicalReadiness,OPENING_PATROL_DRESSINGS} from './opening-patrol-medical-readiness.mjs';
import {advanceOnCitadelOrder} from './northern-route.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {assertCustodyCare} from './custody-care-evidence.mjs';
import {fight} from './opening-driver.mjs';
const checkpoint=(stage,pair,detail)=>{};

test('finite patrol dressings survive a genuine poor-tactics capture and pay for actual custody care',t=>{
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-patrol-earned-cordoba.provenance.json',import.meta.url))),compressed=readFileSync(new URL('./fixtures/opening-patrol-earned-cordoba.save.json.gz',import.meta.url)),raw=gunzipSync(compressed);
 assert.equal(createHash('sha256').update(compressed).digest('hex'),provenance.compressedSha256);
 assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.rawSha256);assert.equal(raw.length,provenance.rawBytes);
 const input=decodeSave(raw.toString()).campaign,original=structuredClone(input),prepared=prepareOpeningPatrolMedicalReadiness(input);
 assert.deepEqual(input,original);assert.equal(OPENING_PATROL_DRESSINGS,2);
 assert.equal(prepared.receipt.totalTaken,8);assert.equal(prepared.receipt.cost,0);assert.equal(prepared.receipt.elapsedSeconds,0);assert.deepEqual(prepared.receipt.donations,[]);
 assert.equal(new Set(prepared.receipt.takes.map(row=>row.sourceKey)).size,1);assert.equal(prepared.receipt.takes[0].sourceBefore,8);assert.equal(prepared.receipt.takes.at(-1).sourceAfter,0);
 let inventoryReplay=structuredClone(input);for(const [index,action]of prepared.receipt.orders.entries()){inventoryReplay=dispatchCampaign(inventoryReplay,action);assert.equal(inventoryReplay.lastError,null);if(index===Math.floor(prepared.receipt.orders.length/2))inventoryReplay=decodeSave(encodeSave(inventoryReplay)).campaign;}
 assert.deepEqual(inventoryReplay,prepared.campaign);checkpoint('prepared',{campaign:prepared.campaign},prepared.receipt);
 const loaded=finishReloadsBeforeMarch(prepared.campaign),deployed=dispatchCampaign(loaded,{type:'attack',sector:'tucuman'});assert.equal(deployed.lastError,null);
 assert.ok(deployed.pendingBattle);assert.equal(deployed.pendingBattle.squad.length,4);checkpoint('deployment',{campaign:deployed,battle:enterSector(deployed.pendingBattle,deployed.sectorStates.tucuman)});
 const beforeDeployment=structuredClone(deployed),result=fight(deployed.pendingBattle,deployed.sectorStates.tucuman,{controller:advanceOnCitadelOrder});
 assert.deepEqual(deployed,beforeDeployment);assert.equal(result.battle.status,'defeat','the original poor patrol must still suffer an actual native defeat');checkpoint('defeat',{campaign:deployed,battle:result.battle},result);
 let pair={campaign:structuredClone(deployed),battle:enterSector(deployed.pendingBattle,deployed.sectorStates.tucuman)},reference=structuredClone(pair);let midpointSaved=false;
 for(const [index,action]of result.orders.entries()){
  const apply=p=>{const battle=action.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,action);assert.equal(battle.lastError,null);const next=syncBattleTime(p.campaign,battle);assert.equal(next.error,null);return {campaign:next.campaign,battle:next.battle};};
  pair=apply(pair);reference=apply(reference);
  if(index===Math.floor(result.orders.length/2)){const encoded=encodeSave(pair.campaign,pair.battle);pair=decodeSave(encoded);midpointSaved=true;checkpoint('midpoint',pair);}
 }
 assert.ok(midpointSaved);assert.deepEqual(pair,reference);assert.deepEqual(pair.battle,syncBattleTime(deployed,result.battle).battle);
 const lost=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:deployed.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(u=>u.side==='player'),sectorState:pair.battle});assert.equal(lost.lastError,null);assert.equal(lost.pendingBattle,null);
 const captives=prepared.receipt.field.filter(id=>lost.operativeState[id].captured),fallen=prepared.receipt.field.filter(id=>!lost.operativeState[id].alive);
 assert.deepEqual(captives,prepared.receipt.field,'the complete serving patrol must become genuine captives after native defeat');
 const priorDeaths=Object.entries(deployed.operativeState).filter(([,row])=>!row.alive).map(([id])=>id);assert.equal(priorDeaths.length,17);
 for(const id of captives){assert.ok(!lost.recruited.includes(id));assert.ok(!lost.squads.some(squad=>squad.members.includes(id)));assert.equal(lost.contracts[id],undefined);assert.ok(lost.operativeState[id].capturedContract);}
 assert.equal(captives.reduce((sum,id)=>sum+lost.operativeState[id].medkits,0),5,'three native first-aid strokes leave five actual confiscated dressings');
 assert.equal(result.orders.filter(action=>action.type==='useItem').length,3);
 assert.equal(lost.operativeState[121].alive,true,'ordinary finite first aid saves the former patrol casualty');
 for(const id of captives){const unit=pair.battle.units.find(u=>u.id===String(id)),record=lost.operativeState[id];assert.equal(record.hp,unit.hp);assert.equal(record.bleeding,unit.bleeding);assert.equal(record.medkits,unit.medkits);}
 checkpoint('accepted-capture',{campaign:lost},captives.map(id=>({id,hp:lost.operativeState[id].hp,bleeding:lost.operativeState[id].bleeding,medkits:lost.operativeState[id].medkits})));
 let cared=decodeSave(encodeSave(lost)).campaign;
 for(let hour=0;hour<2;hour++){cared=dispatchCampaign(cared,{type:'wait',hours:1});assert.equal(cared.lastError,null);cared=decodeSave(encodeSave(cared)).campaign;checkpoint('custody-hour-'+(hour+1),{campaign:cared});}
 const care=captives.map(id=>({id,strokes:assertCustodyCare(lost,cared,id),before:{hp:lost.operativeState[id].hp,bleeding:lost.operativeState[id].bleeding,medkits:lost.operativeState[id].medkits},after:{hp:cared.operativeState[id].hp,bleeding:cared.operativeState[id].bleeding,medkits:cared.operativeState[id].medkits}}));
 checkpoint('care-receipts',{campaign:cared},care);
 for(const id of captives){assert.equal(cared.operativeState[id].alive,true);assert.equal(cared.operativeState[id].captured,true);assert.equal(cared.operativeState[id].bleeding,0,'actual finite care must stop bleeding before the later physical rescue');}
 assert.equal(care.flatMap(row=>row.strokes).reduce((sum,stroke)=>sum+stroke.dressings,0),5);assert.equal(captives.reduce((sum,id)=>sum+cared.operativeState[id].medkits,0),0);
 for(const guard of lost.sectorStates.tucuman.units.filter(unit=>unit.side==='enemy'))assert.equal(cared.sectorStates.tucuman.units.find(unit=>unit.id===guard.id).medkits,guard.medkits,'custody care uses confiscated linen, not guard private supplies');
 assert.deepEqual(decodeSave(encodeSave(cared)).campaign,cared);
 for(const [id,row]of Object.entries(input.operativeState))if(!row.alive)assert.equal(cared.operativeState[id].alive,false);
 for(const id of priorDeaths)assert.equal(cared.operativeState[id].alive,false);for(const id of fallen)assert.equal(cared.operativeState[id].alive,false);assert.deepEqual(input,original);
 t.diagnostic(JSON.stringify({policy:prepared.receipt.policy,takes:prepared.receipt.takes,status:result.battle.status,turns:result.battle.turn,actions:result.actions,orders:result.orders.length,midpointSaved,captives,fallen,priorDeaths,firstAidSaved121:true,dressings:{acquired:8,spentInCombat:3,confiscated:5,spentInCustody:5,remaining:0},care}));
});
