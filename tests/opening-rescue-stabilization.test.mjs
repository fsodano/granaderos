import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {stabilizeRescued} from './northern-route.mjs';

test('earned rescue victory recovers finite linen and gives each released captive actual care',()=>{
 const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-rescue-native-victory.provenance.json',import.meta.url))),compressed=readFileSync(new URL('./fixtures/opening-rescue-native-victory.save.json.gz',import.meta.url)),raw=gunzipSync(compressed),sha=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(sha(compressed),provenance.compressedSha256);assert.equal(sha(raw),provenance.rawSha256);assert.equal(raw.length,provenance.rawBytes);assert.equal(provenance.stateEdits,false);
 const input=decodeSave(raw.toString()),before=structuredClone(input),patients=provenance.patients;
 assert.equal(input.battle,null);assert.equal(input.campaign.pendingBattle,null);assert.equal(input.campaign.sectors.tucuman.owner,'patriot');assert.equal(input.campaign.hour,188);assert.equal(input.campaign.secondOfHour,3231);
 for(const id of patients){assert.equal(input.campaign.operativeState[id].alive,true);assert.equal(input.campaign.operativeState[id].captured,false);assert.ok(input.campaign.recruited.includes(id));assert.equal(input.campaign.operativeState[id].medkits,0);}
 const result=stabilizeRescued(input.campaign,{patients}),final=result.campaign;
 assert.deepEqual(input,before);assert.equal(result.dressingTarget,6);assert.equal(result.medicalCollections.reduce((sum,row)=>sum+row.action.count,0),6);assert.equal(result.emergencyAid.usedDressings,2);assert.equal(result.emergencyAid.steps.filter(action=>action.type==='useItem').length,2);assert.equal(result.emergencyAid.officialMidpoint,true);assert.equal(result.usedDressings,4);assert.equal(result.clinicElapsedSeconds,4*3600);
 for(const row of result.medicalCollections){assert.equal(row.action.type,'sectorInventory');assert.equal(row.action.direction,'take');assert.equal(row.sourceAfter,row.sourceBefore-row.action.count);assert.equal(row.medicalPoolAfter,row.medicalPoolBefore-row.action.count);assert.equal(row.carriedAfter,row.carriedBefore+row.action.count);}
 const doctor=result.doctors[0],remaining=sectorInventoryModel(final,'tucuman',rosterFor(final),doctor).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);assert.equal(remaining,3);assert.equal(final.operativeState[doctor].medkits,0);
 for(const id of [...patients,103,138]){assert.equal(final.operativeState[id].alive,true);assert.equal(final.operativeState[id].captured,false);assert.equal(final.operativeState[id].bleeding,0);}
 for(const id of patients){assert.ok(final.operativeState[id].hp>before.campaign.operativeState[id].hp);assert.deepEqual(final.contracts[id],before.campaign.contracts[id]);}
 for(const [id,record]of Object.entries(before.campaign.operativeState))if(!record.alive)assert.equal(final.operativeState[id].alive,false);
 for(const id of before.campaign.recruited.filter(id=>!final.recruited.includes(id))){const expiry=contractExpiresSeconds(before.campaign.contracts[id]);assert.notEqual(expiry,null);assert.ok(expiry<=final.hour*3600+(final.secondOfHour??0),'actual day-contract expiry remains an ordinary consequence of clinic time');}
 const replayStart=decodeSave(raw.toString());let replay=replayStart,midpointSaved=false,restoredBeforeClinic=false;
 for(let i=0;i<result.orders.length;i++){
  const {scope,action}=result.orders[i];
  if(scope==='campaign'){
   if(!restoredBeforeClinic&&action.type==='assignCare'&&action.assignment==='patient'&&patients.includes(action.operativeId)){
    for(const squad of before.campaign.squads)assert.deepEqual(replay.campaign.squads.find(q=>q.id===squad.id).members,squad.members);
    assert.equal(replay.campaign.activeSquadId,before.campaign.activeSquadId);assert.deepEqual(replay.campaign.squad,before.campaign.squad);assert.equal(replay.campaign.operativeState[doctor].medkits,4);restoredBeforeClinic=true;
   }
   if(action.type==='leaveSector')assert.deepEqual(action.sectorState,replay.battle);
   const campaign=dispatchCampaign(replay.campaign,action);assert.equal(campaign.lastError,null);replay={...replay,campaign};
   if(action.type==='visitSector')replay.battle=enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0},campaign.sectorStates.tucuman);
   if(action.type==='leaveSector')replay.battle=null;
  }else{
   const battle=actBattle(replay.battle,action);assert.equal(battle.lastError,null);const paid=syncBattleTime(replay.campaign,battle);assert.equal(paid.error,null);replay={campaign:paid.campaign,battle:paid.battle};
  }
  if(i===Math.floor(result.orders.length/2)){replay=decodeSave(encodeSave(replay.campaign,replay.battle));midpointSaved=true;}
 }
 assert.equal(restoredBeforeClinic,true);assert.equal(midpointSaved,true);assert.deepEqual(replay,{campaign:final,battle:null});assert.deepEqual(decodeSave(encodeSave(final)).campaign,final);
});
