import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {operativeLocation} from '../game/squads.js';
import {artilleryTransportRules} from '../game/artillery-transport-rules.js';
import {prepareNorthernReunionColumns,reuniteFreshNorthernSquad} from './fresh-northern-recovery.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
function earnedInput(){
 const compressed=readFileSync(new URL('./fixtures/earned-seven-survivor-reunion.save.json.gz',import.meta.url)),raw=gunzipSync(compressed);
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-seven-survivor-reunion.provenance.json',import.meta.url)));
 assert.equal(sha(raw),metadata.sha256);assert.equal(raw.length,metadata.rawBytes);assert.equal(sha(compressed),metadata.compressedSha256);
 const campaign=decodeSave(raw.toString()).campaign;
 assert.deepEqual([campaign.hour,campaign.secondOfHour],metadata.clock);return {campaign,metadata};
}

test('earned seven-survivor reunion forms public six-plus-one columns without changing equipment, contracts or costs',t=>{
 const {campaign:start,metadata}=earnedInput(),before=structuredClone(start),events=[];
 const refused=dispatchCampaign(start,{type:'squad',ids:metadata.field});
 assert.match(refused.lastError,/uno y seis/);assert.deepEqual(refused.squads,start.squads);assert.deepEqual(refused.operativeState,start.operativeState);assert.deepEqual(refused.resources,start.resources);
 const result=prepareNorthernReunionColumns(start,{report:event=>events.push(event)}),s=result.campaign;
 assert.deepEqual(start,before);assert.deepEqual(result.field,metadata.field);assert.equal(result.groups.length,2);
 const columns=result.groups.map(id=>s.squads.find(q=>q.id===id));
 assert.deepEqual(columns.map(q=>q.members),[metadata.field.slice(0,6),metadata.field.slice(6)]);
 assert.ok(columns.every(q=>q.members.length<=6&&q.location==='buenos_aires'&&!q.journey));
 assert.deepEqual(columns.flatMap(q=>q.members),metadata.field);assert.deepEqual(s.squad,metadata.field.slice(0,6));
 for(const key of ['operativeState','contracts','resources','loadouts','armoryItems','ammunitionStores','artilleryDepots','artilleryTransfers','sectorStates'])assert.deepEqual(s[key],before[key],`Formation must preserve ${key}.`);
 assert.equal(s.hour,before.hour);assert.equal(s.secondOfHour,before.secondOfHour);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
 let replay=before;
 for(const [index,action]of events[0].actions.entries()){
  replay=dispatchCampaign(replay,action);assert.equal(replay.lastError,null);
  if(index===1)replay=decodeSave(encodeSave(replay)).campaign;
 }
 assert.deepEqual(replay,s,'The public formation continues exactly through an official midpoint save.');
 for(const id of metadata.actualReturnLosses)assert.equal(s.operativeState[id].alive,false);
 t.diagnostic(JSON.stringify({scope:metadata.scope,inputSha256:metadata.sha256,clock:metadata.clock,columns:columns.map(q=>({id:q.id,members:q.members})),cost:0,exactOfficialMidpointReplay:true}));
});

test('both earned reunion columns travel and join the actual road recapture with all survivors and an exact native saved replay',t=>{
 const {campaign:start,metadata}=earnedInput(),before=structuredClone(start),events=[];
 const report=event=>{
  if(event.campaign&&process.env.GRANADEROS_REUNION_CHECKPOINT_PREFIX&&['northernReturnRecaptureReady','northernReturnRecaptured','northernRoadRecovered','northernReturnReunited'].includes(event.event)){
   const campaign=event.campaign,battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):null;
   writeFileSync(`${process.env.GRANADEROS_REUNION_CHECKPOINT_PREFIX}-${event.event}.save.json`,encodeSave(campaign,battle));
  }
  if(['northernReunionColumns','northernReunionColumnArrived','northernReturnRecaptureReady','northernReturnRecaptured','northernReturnReunited'].includes(event.event))events.push(event);
  else if(['northernReunionRenewal','routeBatteryRenewal','routeBatteryShipment','northernReunionOrder','routeBatteryTravelOrder'].includes(event.event))events.push({...event,campaign:undefined});
 };
 const s=reuniteFreshNorthernSquad(start,{report});assert.deepEqual(start,before);
 const formed=events.find(event=>event.event==='northernReunionColumns'),arrived=events.find(event=>event.event==='northernReunionColumnArrived'),ready=events.find(event=>event.event==='northernReturnRecaptureReady'),won=events.find(event=>event.event==='northernReturnRecaptured');
 assert.ok(formed&&arrived&&ready&&won);assert.deepEqual(formed.field,metadata.field);assert.deepEqual(arrived.members,metadata.field.slice(6));assert.equal(arrived.campaign.location,'san_nicolas');
 for(const id of metadata.field){
  assert.equal(arrived.campaign.operativeState[id].alive,true);assert.equal(operativeLocation(arrived.campaign,id),'san_nicolas');
  assert.ok(ready.campaign.pendingBattle.squad.some(unit=>unit.id===id&&unit.hp>0),'Every field survivor must actually deploy, including the support officer.');
 }
 assert.equal(ready.campaign.pendingBattle.squad.length,12,'Seven returning soldiers and five real northern guards join the same native battle.');
 assert.equal(won.status,'victory');assert.equal(won.exactSavedReplay,true);assert.equal(won.campaign.sectors.cordoba.owner,'patriot');
 for(const id of ready.occupations)assert.equal(won.campaign.enemyGroups.find(group=>group.id===id).status,'defeated');
 for(const unit of won.units.filter(unit=>unit.side==='player'&&unit.hp<=0))assert.equal(s.operativeState[Number(unit.id)].alive,false,'Every native recapture loss remains dead after road care and return.');
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);}
 const renewals=events.filter(event=>event.event==='northernReunionRenewal');assert.ok(renewals.length);
 for(const row of renewals){assert.equal(row.cost,row.quote.price);assert.equal(row.quote.available,true);assert.equal(row.afterExpiry,row.quote.expiresAt*3600+(row.quote.expiresSecond??0));assert.equal(row.afterExpiry,row.beforeExpiry+24*3600);}
 const shipments=events.filter(event=>event.event==='routeBatteryShipment');assert.ok(shipments.length);
 // The current ordinary carts rule has a zero fee. Preserve its actual quote
 // instead of inventing a positive charge for this earned legacy campaign.
 for(const row of shipments)assert.equal(row.cost,artilleryTransportRules(start).cartsFee);
 assert.equal(s.location,'tucuman');assert.ok(s.squad.includes(1));assert.ok(s.resources.treasury>=0);assert.equal(s.completed,false);assert.equal(s.defeated,false);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
 if(process.env.GRANADEROS_REUNION_OUTPUT)writeFileSync(process.env.GRANADEROS_REUNION_OUTPUT,encodeSave(s));
 t.diagnostic(JSON.stringify({scope:'Earned seven-survivor reunion through real Córdoba recapture and northern-officer return; not a fresh whole campaign ending.',inputSha256:metadata.sha256,columns:formed.columns,actualDeployed:ready.campaign.pendingBattle.squad.map(unit=>unit.id),recapture:{turns:won.turns,actions:won.actions,elapsedSeconds:won.elapsedSeconds,exactSavedReplay:won.exactSavedReplay},renewalCost:renewals.reduce((sum,row)=>sum+row.cost,0),shipments:shipments.map(row=>({id:row.id,cost:row.cost,from:row.from,to:row.to})),finishClock:[s.hour,s.secondOfHour],treasury:s.resources.treasury}));
});
