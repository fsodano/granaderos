import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {handRecord} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareSaltaAssault,saltaBatteryWaypoints} from './salta-route.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-salta-native.provenance.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const clock=s=>s.hour*3600+(s.secondOfHour??0);
const save=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const preserveDeaths=(before,after)=>{for(const [id,record]of Object.entries(before.operativeState))if(!record.alive){assert.equal(after.operativeState[id].alive,false);assert.equal(after.operativeState[id].deathMinute,record.deathMinute);}};
function fixture(name){
 const compressed=readFileSync(new URL('./fixtures/'+name,import.meta.url)),raw=gunzipSync(compressed),metadata=provenance.fixtures[name];
 assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(sha(raw),metadata.rawSha256);
 const campaign=decodeSave(raw.toString()).campaign;
 assert.deepEqual([campaign.hour,campaign.secondOfHour??0],metadata.clock);assert.equal(campaign.resources.treasury,metadata.treasury);
 return campaign;
}

test('earned native rear guard recovers one finite gun and resolves the real support raid with exact replay',()=>{
 const start=fixture('opening-salta-native-recovered.save.json.gz'),before=structuredClone(start),stop=Error('Stop after the real support-battery raid.');
 assert.ok(start.sectorStates.tucuman.wallEdges.length>0);
 assert.ok([121,126,129,130].every(id=>start.operativeState[id].alive&&start.operativeState[id].hp===start.operativeState[id].maxHp&&start.operativeState[id].bleeding===0));
 assert.ok([113,140,144,146,108,101,102].every(id=>!civicStatus(start,id).available),'the old guard shortlist is unavailable in this actual campaign');
 let guard,guardState,raid,settled,defense;const events=[];
 assert.throws(()=>prepareSaltaAssault(start,{report:event=>events.push(event),onCheckpoint:(name,campaign,evidence)=>{
  if(name==='salta-rear-guard'){guard=structuredClone(evidence.reservePreparation);guardState=structuredClone(campaign);}
  if(name==='support-battery-encounter')raid=structuredClone(campaign);
  if(name==='support-battery-settled'){settled=structuredClone(campaign);defense=structuredClone(evidence.defense);throw stop;}
 }}),error=>error===stop);
 assert.deepEqual(start,before);assert.ok(guard&&guardState&&raid&&settled&&defense);
 assert.equal(guard.hired,100);assert.deepEqual(guard.ids,[100]);assert.equal(guard.hiringCost,252);assert.equal(guard.hiringQuote.available,true);assert.equal(guard.hiringQuote.total,guard.hiringCost);
 assert.equal(guardState.contracts[100].paid,guard.hiringQuote.price);assert.equal(before.resources.treasury-guardState.resources.treasury,guard.hiringCost);
 assert.equal(guard.weapon,1801);assert.equal(guard.weaponCost,0);
 const receipt=guard.weaponReceipt;assert.equal(receipt.operativeId,100);assert.equal(receipt.sourceKey,'drop:18');assert.equal(receipt.countBefore-receipt.countAfter,1);assert.equal(receipt.treasuryBefore,receipt.treasuryAfter);
 const model=sectorInventoryModel(guardState,'cordoba',rosterFor(guardState),100),equipped=handRecord(model.personal,'primary');
 for(const [key,value]of Object.entries(JSON.parse(receipt.expected)))if(key!=='item')assert.deepEqual(equipped[key],value);
 assert.equal(equipped.loaded,1);assert.equal(equipped.condition,84);assert.equal(model.entries.find(row=>row.key===receipt.sourceKey)?.count??0,receipt.countAfter);
 assert.deepEqual([raid.hour,raid.secondOfHour],provenance.raid.inputClock);assert.equal(raid.pendingEncounter.groupId,'enemy-group-3');assert.equal(raid.pendingEncounter.sector,'tucuman');
 assert.equal(defense.groupId,'enemy-group-3');assert.equal(defense.status,'victory');assert.ok(defense.actions>0&&defense.elapsedSeconds>0);
 assert.equal(clock(settled),defense.startSeconds+defense.elapsedSeconds);assert.deepEqual([settled.hour,settled.secondOfHour],provenance.raid.settledClock);
 assert.equal(settled.pendingEncounter,null);assert.equal(settled.pendingBattle,null);assert.equal(settled.defeated,false);assert.equal(settled.sectors.tucuman.owner,'patriot');
 assert.equal(settled.enemyGroups.find(group=>group.id===defense.groupId).status,'defeated');assert.ok(settled.encounterHistory.some(row=>row.groupId===defense.groupId&&row.outcome==='victory'));
 assert.deepEqual(Object.entries(before.operativeState).filter(([id,record])=>record.alive&&!settled.operativeState[id].alive).map(([id])=>Number(id)),provenance.raid.newDeaths);
 preserveDeaths(before,settled);
 assert.deepEqual([144,130].map(id=>[settled.operativeState[id].hp,settled.operativeState[id].bleeding]),[[63,1],[39,2]],'real victory retains its bleeding survivors');
 assert.equal(settled.resources.treasury,provenance.raid.treasury);assert.equal(before.resources.treasury-settled.resources.treasury,guard.hiringCost+events.filter(row=>row.event==='routeBatteryRenewal').reduce((sum,row)=>sum+row.price,0));
 assert.deepEqual(settled.squad,[100]);assert.equal(settled.squads.find(row=>row.id===settled.activeSquadId).journey.status,'moving');
 assert.deepEqual(save(settled),settled);
 // The production test driver above runs the actual battle twice, compares
 // its whole result, then settles an official saved campaign/battle pair.
 // This stop qualifies that raid only; it does not certify Salta or Yatasto.
});

test('earned crew admits the coastal detour and retains actual wounds through bounded paid progress and midpoint save replay',t=>{
 const start=fixture('opening-salta-native-detour.save.json.gz'),before=structuredClone(start);
 assert.equal(start.location,'cell-24-28');assert.deepEqual(start.squad,[100]);assert.ok(start.enemyGroups.some(group=>group.target==='buenos_aires'&&group.status==='stationed'));
 const keepServing=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),waypoints=saltaBatteryWaypoints(start,'ensenada');
 assert.deepEqual(waypoints,['cell-24-27','cell-25-27','cell-26-27','cell-26-28','retiro']);assert.deepEqual(start,before);
 const action={type:'travel',sector:'ensenada',queue:true,mode:'march',waypoints};
 const admitted=order(start,action),journey=admitted.squads.find(row=>row.id===admitted.activeSquadId).journey;
 assert.equal(journey.status,'moving');assert.equal(journey.path.includes('buenos_aires'),false);assert.deepEqual(journey.path,['cell-24-28','cell-24-27','cell-25-27','cell-26-27','cell-26-28','retiro','cell-27-29','cell-27-30','ensenada']);
 const progress=midpoint=>{
  let campaign=save(admitted),renewals=[];
  for(let hour=0;hour<24;hour++){
   for(const id of keepServing){
    const expiry=contractExpiresSeconds(campaign.contracts[id]);assert.ok(campaign.recruited.includes(id)&&campaign.operativeState[id].alive);assert.ok(expiry===null||expiry>clock(campaign));
    if(expiry===null||expiry>clock(campaign)+2*3600)continue;
    const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),contract=campaign.contracts[id],cash=campaign.resources.treasury;assert.equal(quote.available,true);
    campaign=order(campaign,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(campaign.resources.treasury,cash-quote.price);renewals.push({id,price:quote.price});
   }
   campaign=order(campaign,{type:'wait',hours:1});assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
   if(midpoint&&hour===11)campaign=save(campaign);
  }
  return {campaign,renewals};
 };
 const result=progress(true),replayed=progress(false);assert.deepEqual(result,replayed);
 const campaign=result.campaign;assert.equal(clock(campaign)-clock(start),24*3600);assert.equal(campaign.location,'cell-26-27');
 assert.equal(campaign.squads.find(row=>row.id===campaign.activeSquadId).journey.status,'paused');assert.equal(campaign.squads.find(row=>row.id===campaign.activeSquadId).journey.reason,'exhausted');
 assert.equal(campaign.resources.treasury,admitted.resources.treasury-result.renewals.reduce((sum,row)=>sum+row.price,0));preserveDeaths(before,campaign);
 assert.equal(result.renewals.reduce((sum,row)=>sum+row.price,0),897);assert.deepEqual([144,130].map(id=>[campaign.operativeState[id].hp,campaign.operativeState[id].bleeding]),[[28,1],[4,2]]);
 for(const id of [144,130]){assert.equal(campaign.operativeState[id].alive,true);assert.equal(campaign.operativeState[id].bleeding,before.operativeState[id].bleeding);assert.ok(campaign.operativeState[id].hp<before.operativeState[id].hp);assert.equal(campaign.operativeState[id].medkits,0);}
 assert.deepEqual(save(campaign),campaign);
 t.diagnostic(JSON.stringify({scope:'Detour admission and bounded progress only; post-raid care and arrival remain unproved.',clock:[campaign.hour,campaign.secondOfHour],location:campaign.location,renewalCost:result.renewals.reduce((sum,row)=>sum+row.price,0),patients:[144,130].map(id=>({id,hp:campaign.operativeState[id].hp,bleeding:campaign.operativeState[id].bleeding}))}));
});
