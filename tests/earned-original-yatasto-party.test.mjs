import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,dailyIncome} from '../game/campaign.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {finishFreshNorthernCampaign} from './fresh-northern-recovery.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-yatasto-party.provenance.json',import.meta.url)));
function earned(){
 const packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const c=decodeSave(raw.toString()).campaign;assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 assert.deepEqual([c.hour,c.secondOfHour],meta.clock);assert.equal(c.resources.treasury,meta.treasury);
 assert.equal(c.sectors.salta.owner,'patriot');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 return c;
}
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const physical=r=>Object.fromEntries(Object.entries(r).filter(([key])=>/^(inventory|ammo|carriedAmmo|carriedLoaded|medkits|condition|headwear|outfit|legwear|weaponDropped|weaponFittings|weaponFittingPattern|bladeFittingPattern|bladeCondition|toolkitPoints|serviceEquipmentReturn|primaryWeapon.*|secondaryWeapon.*)$/.test(key)));
function guns(c){return {depots:c.artilleryDepots,transfers:c.artilleryTransfers,scenes:Object.fromEntries(Object.entries(c.sectorStates).map(([id,s])=>[id,s.artillery??[]]))};}

test('the earned highest envoy can include the serving local officer through a zero-cost public squad order',()=>{
 const c=earned(),before=structuredClone(c),envoy=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp>=15&&r.location==='salta';
 }).sort((a,b)=>b.leadership-a.leadership||a.id-b.id)[0];
 assert.equal(envoy.id,114);assert.equal(envoy.leadership,95);assert.equal(c.operativeState[1].alive,true);assert.equal(c.operativeState[1].hp,88);
 assert.equal(c.recruited.includes(1),true);assert.equal(operativeLocation(c,1),'salta');assert.equal(operativeInTransit(c,1),false);
 for(const id of [0,8])assert.equal(c.recruited.includes(id),false,'Residents must still join through their real recruitment dialogue.');
 const squad=c.squads.find(q=>q.members.includes(envoy.id));assert.equal(squad.id,'squad-27');
 const selected=dispatchCampaign(c,{type:'selectSquad',id:squad.id});assert.equal(selected.lastError,null);
 const formed=dispatchCampaign(selected,{type:'squad',ids:[114,1]});assert.equal(formed.lastError,null);assert.deepEqual(formed.squad,meta.admittedPublicParty);
 assert.deepEqual([formed.hour,formed.secondOfHour,formed.resources],[c.hour,c.secondOfHour,c.resources]);
 for(const key of ['operativeState','contracts','recruited','hiringArrivals','serviceEquipmentReturns','artilleryDepots','artilleryTransfers'])assert.deepEqual(formed[key],c[key],`Party formation cannot change ${key}.`);
 for(const q of c.squads){
  const after=formed.squads.find(v=>v.id===q.id);assert.equal(after.location,q.location);assert.deepEqual(after.journey,q.journey);
  if(q.id!=='squad-27')assert.deepEqual(after,{...q,members:q.members.filter(id=>id!==1)});
 }
 // The original helper already detached these reserve members when it selected
 // a single envoy. Their living local records and belongings remain in Salta.
 for(const id of [137,124,125,146,1000])assert.equal(operativeLocation(formed,id),'salta');
 assert.deepEqual(c,before);assert.deepEqual(decodeSave(encodeSave(formed)).campaign,formed);
});

test('the actual Salta envoy and serving northern officer complete Yatasto together with exact official saved replay',t=>{
 const start=earned(),before=structuredClone(start),events=[];
 const c=finishFreshNorthernCampaign(start,{report:e=>events.push(e)});
 assert.deepEqual(start,before);assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const id of [1,0,8]){assert.equal(c.operativeState[id].alive,true);assert.ok(c.squad.includes(id),`The living northern officer ${id} must participate in the actual Yatasto handover.`);}
 assert.deepEqual(c.squad,[114,1,0,8]);assert.equal(c.squad.length<=6,true);assert.equal(c.location,'tucuman');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const formed=events.find(e=>e.event==='northernHandoverParty');assert.ok(formed);assert.equal(formed.envoy,114);assert.deepEqual(formed.action,{type:'squad',ids:[114,1]});
 assert.deepEqual(formed.campaign.squad,[114,1]);assert.equal(formed.campaign.recruited.includes(0),false);assert.equal(formed.campaign.recruited.includes(8),false);
 for(const id of c.squad){assert.equal(c.recruited.includes(id),true);assert.equal(operativeLocation(c,id),'tucuman');assert.equal(operativeInTransit(c,id),false);}
 for(const id of [0,8]){assert.equal(c.contracts[id].kind,'patriot');assert.equal(c.contracts[id].started,790);assert.ok(c.contracts[id].startedSecond>start.secondOfHour);}
 const travel=events.find(e=>e.event==='northernHandoverTravel'),arrived=events.find(e=>e.event==='northernHandoverArrived');assert.ok(travel&&arrived);
 assert.deepEqual(travel.campaign.squad,[114,1,0,8]);assert.equal(travel.envoy,114);assert.equal(travel.envoySquad,'squad-27');
 // The ordinary travel call can complete synchronously before its report.
 // Its real elapsed journey still precedes the arrival and mission clocks.
 assert.ok(clock(travel.campaign)>clock(formed.campaign));assert.ok(clock(arrived.campaign)>=clock(travel.campaign));assert.ok(clock(c)>=clock(arrived.campaign));
 for(const q of before.squads)if(q.id!=='squad-27')assert.deepEqual(c.squads.find(v=>v.id===q.id),{...q,members:q.members.filter(id=>id!==1)},'Other actual columns keep their members, locality and travel records.');
 const renewals=events.filter(e=>e.event==='northernHandoverRenewal');
 for(const id of before.recruited){
  const r=before.operativeState[id];assert.equal(c.operativeState[id].alive,r.alive);assert.equal(c.operativeState[id].captured,r.captured);
  if(id===meta.unchangedDiagnosticExpiry.operativeId){
   // This exact temporary service also expired in the unchanged diagnostic.
   // Prove its living patient and unique physical owner, rather than treating
   // an ordinary returned kit as lost gear or extending an unrelated duty.
   const expected=meta.unchangedDiagnosticExpiry,expiry=contractExpiresSeconds(before.contracts[id]);
   assert.equal(expiry,expected.clock[0]*3600+expected.clock[1]);assert.ok(expiry>clock(before)&&expiry<clock(c));
   assert.equal(c.recruited.includes(id),false);assert.equal(c.contracts[id],undefined);
   for(const key of ['alive','hp','maxHp','bleeding','bandaged','location'])assert.equal(c.operativeState[id][key],expected[key]);
   assert.equal(c.operativeState[id].deathMinute,r.deathMinute);assert.deepEqual(c.operativeState[id].inventory,{});assert.equal(c.operativeState[id].carriedLoaded,0);assert.equal(c.operativeState[id].carriedAmmo,0);
   const returned=c.sectorStates.salta.groundItems.filter(row=>row.id?.startsWith('service-return-3-'));
   assert.deepEqual(returned,expected.groundRows);assert.equal(new Set(returned.map(row=>row.id)).size,returned.length);
   assert.equal(c.operativeState[id].serviceEquipmentReturn,undefined);assert.equal(c.serviceEquipmentReturns.entries.length,0);
   continue;
  }
  assert.deepEqual(physical(c.operativeState[id]),physical(r),`The handover must not grant or discard ${id}'s carried equipment.`);
  if(!r.alive)assert.equal(c.operativeState[id].deathMinute,r.deathMinute);
  if(![114,1].includes(id))assert.equal(operativeLocation(c,id),operativeLocation(before,id));
  if(r.alive&&!r.captured){
   assert.equal(c.recruited.includes(id),true);const renewal=renewals.filter(e=>e.action.id===id).at(-1);
   if(!renewal)assert.deepEqual(c.contracts[id],before.contracts[id]);
   else assert.equal(contractExpiresSeconds(c.contracts[id]),renewal.quote.expiresAt*3600+(renewal.quote.expiresSecond??0));
   const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c));
  }
 }
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 for(const id of [114,1])for(const key of ['hp','maxHp','bleeding','bandaged'])assert.equal(c.operativeState[id][key],before.operativeState[id][key]);
 assert.deepEqual(guns(c),guns(before));assert.equal(c.serviceEquipmentReturns.nextId,before.serviceEquipmentReturns.nextId+1);assert.deepEqual(c.serviceEquipmentReturns.entries,before.serviceEquipmentReturns.entries);
 for(const row of renewals)assert.equal(row.cost,row.quote.price);
 const midnights=Math.floor(c.hour/24)-Math.floor(start.hour/24);assert.equal(midnights,1);
 assert.equal(c.resources.treasury,start.resources.treasury-300+dailyIncome(start)*midnights-renewals.reduce((sum,row)=>sum+row.cost,0),'The pact, real midnight income and actual quoted retention account for all cash.');
 const official=decodeSave(encodeSave(start)).campaign,replay=finishFreshNorthernCampaign(official);assert.deepEqual(replay,c,'The entire public handover must replay from the official saved earned input.');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 const out=process.env.GRANADEROS_YATASTO_PARTY_EVIDENCE;
 if(out){mkdirSync(out,{recursive:true});writeFileSync(`${out}/yatasto.save.json`,encodeSave(c));writeFileSync(`${out}/events.json`,JSON.stringify(events));}
 t.diagnostic(JSON.stringify({scope:'Complete earned Salta-to-Yatasto handover; not the whole fresh recovery or ending',fixtureSha256:meta.rawSha256,envoy:114,previouslyOmittedOfficer:1,publicParty:[114,1],finalParty:c.squad,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,renewals:renewals.map(e=>({id:e.action.id,cost:e.cost})),priorDeathsPreserved:true,physicalGunsUnchanged:true,officialWholeHandoverReplayExact:true}));
});
