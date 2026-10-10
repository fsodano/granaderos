import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {prepareRescueClinicGuards,rescueMedicalRouteOptions,restRescuePatients,resolveRescueClinicEncounter} from './rescue-clinic-readiness.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import {recoverRescueForce} from './rescue-recovery.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-clinic-earned-exhaustion.provenance.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
// This immutable pre-edge tape has no edge geometry. Keep every historical
// value in its hashes while omitting the new empty geometry envelope.
const archivalValue=value=>Array.isArray(value)?value.map(archivalValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!(Array.isArray(value.wallEdges)&&value.wallEdges.length===0&&['wallEdges','wallGeometryVersion'].includes(key))).map(([key,value])=>[key,archivalValue(value)])):value;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const stateHash=value=>sha(JSON.stringify(canonical(archivalValue(value))));
const fixture=name=>{const compressed=readFileSync(new URL('./fixtures/'+name,import.meta.url)),raw=gunzipSync(compressed);assert.equal(sha(compressed),provenance.fixtures[name].gzipSha256);assert.equal(sha(raw),provenance.fixtures[name].rawSha256);return raw.toString();};
const initial=decodeSave(fixture('opening-clinic-earned-exhaustion.save.json.gz')).campaign,patients=[121,126,129,130],doctors=[112,122],courier=102;
const nativeTapes=JSON.parse(fixture('opening-clinic-preparation-rest-replay.json.gz'));
let prepared;

function replayRecordedStage(start,stage){
 let pair=decodeSave(encodeSave(start)),child=null,saved=false;const expected=new Map(stage.canonicalResults.map(row=>[row.index,row.resultSha256]));
 for(const row of stage.orders){
  if(row.kind==='campaign'&&row.action.type==='syncTacticalTime'){assert.equal(child,null);child=row;continue;}
  let result;
  if(row.kind==='campaign'){
   if(row.action.sectorState&&pair.battle)assert.deepEqual(archivalValue(row.action.sectorState),archivalValue(pair.battle));
   result=dispatchCampaign(pair.campaign,row.action);assert.equal(result.lastError,null);pair.campaign=result;if(['leaveSector','finishBattle','finishDefense'].includes(row.action.type))pair.battle=null;
  }else if(row.kind==='enter'){
   const args=[pair.campaign.pendingBattle,pair.campaign.sectorStates[pair.campaign.location]];assert.deepEqual(archivalValue(row.args),archivalValue(args));result=enterSector(...args);pair.battle=result;
  }else if(row.kind==='tactical'){
   assert.ok(pair.battle);result=actBattle(pair.battle,row.action,row.movementPath);assert.equal(result.lastError,null);pair.battle=result;
  }else if(row.kind==='save')result=decodeSave(encodeSave(pair.campaign,pair.battle));
  else if(row.kind==='sync'){
   result=syncBattleTime(pair.campaign,pair.battle);assert.equal(result.error,null);if(child){assert.equal(stateHash(result.campaign),expected.get(child.index));child=null;}pair={campaign:result.campaign,battle:result.battle};
  }else assert.fail('unknown retained native tape row');
  assert.equal(stateHash(result),expected.get(row.index),'retain the exact native result at row '+row.index);
  if(row.index===stage.officialReplayReceipt.midpoint){pair=decodeSave(encodeSave(pair.campaign,pair.battle));saved=true;}
 }
 assert.equal(child,null);assert.equal(saved,true);assert.equal(stage.officialReplayReceipt.status,'passed');assert.equal(stage.officialReplayReceipt.savedMidpoint,true);
 return decodeSave(encodeSave(pair.campaign,pair.battle)).campaign;
}

test('earned clinic guards use finite guns and matching rounds and reach actual roofs without adding force',()=>{
 const before=structuredClone(initial);prepared=prepareRescueClinicGuards(initial,{courier});assert.deepEqual(initial,before);
 assert.equal(stateHash(prepared.campaign),provenance.expected.preparationResultCanonicalSha256,'match the earlier admitted native preparation exactly');
 assert.deepEqual(prepared.evidence.ids,[112,122,103,108,121,126,129,130]);assert.deepEqual(prepared.evidence.ungrouped,[129,130]);
 assert.equal(prepared.evidence.armament.length,2);assert.equal(prepared.evidence.ammunitionTransactions.reduce((sum,row)=>sum+row.quantity,0),25);assert.ok(prepared.evidence.ammunitionTransactions.every(row=>row.cost===0));
 assert.equal(prepared.evidence.elapsedSeconds,644);assert.equal(prepared.evidence.cost,0);assert.deepEqual(prepared.campaign.contracts,before.contracts);assert.deepEqual(prepared.campaign.recruited,before.recruited);
 assert.equal(new Set(prepared.evidence.roofEvidence.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,8);assert.ok(prepared.evidence.roofEvidence.positions.every(point=>point.tacticalLevel===1));
 for(const[id,record]of Object.entries(before.operativeState)){assert.equal(prepared.campaign.operativeState[id].alive,record.alive);assert.equal(prepared.campaign.operativeState[id].captured,record.captured);assert.equal(prepared.campaign.operativeState[id].medkits,record.medkits);}
 assert.deepEqual(decodeSave(encodeSave(prepared.campaign)).campaign,prepared.campaign);
});

test('public route preview rejects blocked coast sources and preserves witnessed empty C stock',()=>{
 assert.ok(prepared);const before=structuredClone(prepared.campaign),routes=rescueMedicalRouteOptions(prepared.campaign,courier,{exhaustedSources:['cordoba']});assert.deepEqual(prepared.campaign,before);
 assert.equal(routes.some(route=>route.admitted),false);
 const c=routes.find(route=>route.sector==='cordoba');assert.equal(c.knownMedical,0);assert.equal(c.witnessedEmpty,true);assert.equal(c.quote.valid,true);assert.equal(c.quote.hours,20);
 for(const route of routes.filter(route=>route.sector!=='cordoba')){assert.equal(route.quote.valid,false);assert.equal(route.admitted,false);}
 assert.equal(rescueMedicalRouteOptions(prepared.campaign,courier).find(route=>route.sector==='cordoba').admitted,true,'without a witnessed empty source, a valid route still needs ordinary discovery');
});

test('native rest derives its bound from actual wounds and stops at the same genuine raid without combat',()=>{
 assert.ok(prepared);const before=structuredClone(prepared.campaign);let observed,checkpoint,executions=0;
 assert.throws(()=>restRescuePatients(prepared.campaign,{patients,doctors,courier,exhaustedSources:['cordoba'],onCheckpoint:(name,campaign,evidence)=>{if(name==='rescue-rest-encounter')checkpoint=evidence;},resolveEncounter:campaign=>{executions++;observed=structuredClone(campaign);throw Error('Encounter observation stop; no new battle.');}}),/Encounter observation stop/);
 assert.deepEqual(prepared.campaign,before);assert.equal(executions,1);assert.equal(checkpoint.boundHours,108);assert.equal(stateHash(observed),provenance.expected.restRaidCanonicalSha256);
 assert.equal(observed.hour,288);assert.equal(observed.secondOfHour,437);assert.equal(before.resources.treasury-observed.resources.treasury,278);assert.equal(observed.pendingEncounter.sector,'tucuman');
 assert.deepEqual(patients.map(id=>observed.operativeState[id].hp),[65,55,70,58]);assert.ok(patients.every(id=>observed.operativeState[id].bleeding===0&&observed.recruited.includes(id)));
 assert.ok(observed.recruited.every(id=>observed.operativeState[id].medkits===before.operativeState[id].medkits));
});

test('repository preparation and rest tapes replay every native order with official midpoint saves',()=>{
 assert.ok(prepared);assert.equal(nativeTapes.preparation.orders.length,99);assert.equal(nativeTapes.rest.orders.length,25);
 const replayedPreparation=replayRecordedStage(initial,nativeTapes.preparation);assert.deepEqual(archivalValue(replayedPreparation),archivalValue(prepared.campaign));
 const replayedRest=replayRecordedStage(replayedPreparation,nativeTapes.rest);assert.equal(stateHash(replayedRest),provenance.expected.restRaidCanonicalSha256);
 assert.deepEqual(archivalValue(replayedRest),archivalValue(decodeSave(fixture('opening-clinic-earned-raid.save.json.gz')).campaign));
});

test('retained native defeat tape settles exact losses and still fails the strict clinic victory requirement',()=>{
 const start=decodeSave(fixture('opening-clinic-earned-raid.save.json.gz')).campaign,before=structuredClone(start),retained=JSON.parse(fixture('opening-clinic-retained-defeat.json.gz'));let settled,evidence,executions=0;
 assert.ok(retained.battle.wallEdges===undefined||retained.battle.wallEdges.length===0);
 retained.battle.wallEdges=[];retained.battle.wallGeometryVersion=2;
 assert.equal(retained.orders.length,184);assert.equal(retained.battle.status,'defeat');
 assert.throws(()=>resolveRescueClinicEncounter(start,{executeBattle:(request,snapshot,options)=>{executions++;assert.equal(options.controller,northernClinicDefenseOrder);assert.equal(stateHash(request),provenance.expected.nativeRequestCanonicalSha256);assert.equal(stateHash(snapshot),provenance.expected.nativeSnapshotCanonicalSha256);return structuredClone(retained);},onCheckpoint:(name,campaign,receipt)=>{assert.equal(name,'rescue-clinic-defense');settled=structuredClone(campaign);evidence=receipt;}}),/real clinic defense must win/);
 assert.deepEqual(start,before);assert.equal(executions,1);assert.equal(evidence.exactNativeReplay,true);assert.equal(evidence.midpoint,92);assert.equal(evidence.status,'defeat');assert.equal(stateHash(settled),provenance.expected.settledDefeatCanonicalSha256);
 assert.equal(settled.hour,288);assert.equal(settled.secondOfHour,750);assert.equal(settled.resources.treasury,2940);assert.equal(settled.sectors.tucuman.owner,'royalist');assert.equal(settled.pendingEncounter,null);assert.equal(settled.pendingBattle,null);
 assert.deepEqual(Object.entries(settled.operativeState).filter(([id,record])=>before.operativeState[id].alive&&!record.alive).map(([id])=>Number(id)),[103,108,112,121,122,126,129,130]);
 assert.equal(settled.operativeState[102].captured,true);assert.equal(settled.operativeState[102].hp,8);assert.equal(settled.operativeState[102].bleeding,5);
 for(const[id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(settled.operativeState[id].alive,false);
});

test('earned native clinic searches finite visible remains and restores every actual released patient before the real raid',()=>{
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/opening-clinic-native-edge-stabilized.provenance.json',import.meta.url),'utf8'));
 const compressed=readFileSync(new URL('./fixtures/opening-clinic-native-edge-stabilized.save.json.gz',import.meta.url)),raw=gunzipSync(compressed);
 assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(sha(raw),metadata.rawSha256);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),nativePatients=metadata.patients;
 assert.deepEqual([start.hour,start.secondOfHour],metadata.inputClock);assert.equal(start.sectors.tucuman.owner,'patriot');
 assert.ok(start.sectorStates.tucuman.wallEdges.length>0);assert.ok(nativePatients.every(id=>start.operativeState[id].alive&&!start.operativeState[id].captured&&start.operativeState[id].hp<start.operativeState[id].maxHp));
 let beforeSearch=null,afterSearch=null;
 const result=recoverRescueForce(start,{patients:nativePatients,onCheckpoint:(name,campaign,evidence)=>{
  if(name==='local-medical-cache-122'&&evidence.count===0&&beforeSearch===null)beforeSearch=structuredClone(campaign);
  if(name==='visible-medical-remains')afterSearch=structuredClone(campaign);
 }}),{campaign,recovery}=result;
 assert.deepEqual(start,before);assert.ok(beforeSearch&&afterSearch);
 assert.equal(sectorInventoryModel(beforeSearch,'tucuman',rosterFor(beforeSearch),122).entries.filter(row=>JSON.parse(row.expected).item==='medkits').length,0,'known stock can be empty before ordinary body inspection');
 const search=recovery.medicalRemains;assert.equal(search.operativeId,recovery.courier);assert.equal(search.sector,'tucuman');assert.equal(search.collected,7);
 assert.equal(search.receipts.reduce((sum,row)=>sum+row.count,0),search.collected);
 assert.equal(search.actions.filter(action=>action.type==='loot'&&action.item==='medkits').reduce((sum,action)=>sum+action.count,0),search.collected);
 for(const row of search.receipts){assert.ok(row.count>0);assert.equal(row.before-row.after,row.count);assert.ok(row.after>=0);}
 assert.equal(afterSearch.operativeState[recovery.courier].medkits-beforeSearch.operativeState[recovery.courier].medkits,7);
 for(const id of nativePatients)assert.equal(afterSearch.operativeState[id].hp,beforeSearch.operativeState[id].hp,'inspection cannot grant patient health');
 assert.ok(search.elapsedSeconds>0);assert.equal(afterSearch.resources.treasury,beforeSearch.resources.treasury);
 assert.equal(recovery.boughtDressings,0);assert.equal(recovery.cost,0);assert.equal(recovery.donatedDressings,9,'retain the two starting reserve dressings plus seven inspected body dressings');
 assert.deepEqual(recovery.doctors,[122,116]);assert.deepEqual(recovery.hiredDoctors,[116]);assert.equal(recovery.hiringCost,campaign.contracts[116].paid);
 assert.equal(recovery.guardPreparation.cost,0);assert.equal(recovery.restRecovery.boundHours,6);assert.equal(recovery.restRecovery.defenses.length,0);
 const raid=campaign.enemyGroups.find(group=>group.id==='enemy-group-3');assert.equal(raid.status,'marching');assert.equal(raid.arrivalAt,288);assert.ok(campaign.hour<raid.arrivalAt,'earned care finishes before the unchanged raid clock');
 const now=campaign.hour*3600+(campaign.secondOfHour??0);
 for(const id of nativePatients){const record=campaign.operativeState[id];assert.ok(record.alive&&campaign.recruited.includes(id));assert.equal(record.captured,false);assert.equal(record.hp,record.maxHp);assert.equal(record.bleeding,0);assert.equal(record.energy,100);assert.equal(record.location,'tucuman');assert.ok(contractExpiresSeconds(campaign.contracts[id])>now);}
 for(const id of recovery.doctors){assert.ok(campaign.operativeState[id].alive);assert.ok(campaign.contracts[id].paid>0);assert.ok(contractExpiresSeconds(campaign.contracts[id])>now);}
 for(const[id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,record.deathMinute);}
 assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.equal(campaign.sectors.tucuman.owner,'patriot');
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
});
