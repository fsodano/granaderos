import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation} from '../game/squads.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
import {northernReunionDutyKeepers,northernHospitalReturnFunding,reuniteFreshNorthernSquad} from './fresh-northern-recovery.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),clock=c=>c.hour*3600+(c.secondOfHour??0),saved=c=>decodeSave(encodeSave(c)).campaign;
function earned(){
 const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-northern-reunion.provenance.json',import.meta.url)));
 const load=key=>{const row=meta.inputs[key],packed=readFileSync(new URL('./fixtures/'+row.file,import.meta.url)),raw=gunzipSync(packed);
  assert.equal(sha(packed),row.compressedSHA);assert.equal(sha(raw),row.rawSHA);assert.equal(raw.length,row.rawBytes);
  const observed=JSON.parse(raw);let campaign,battle;
  if(row.format==='official-save')({campaign,battle}=decodeSave(raw.toString()));
  else{battle=observed.campaign.pendingBattle?enterSector(observed.request,observed.previous??observed.campaign.sectorStates[observed.request.sector]):null;campaign=decodeSave(encodeSave(observed.campaign,battle)).campaign;assert.deepEqual(campaign,observed.campaign);}
  assert.deepEqual(decodeSave(encodeSave(campaign,battle)).campaign,campaign);assert.deepEqual([campaign.hour,campaign.secondOfHour],row.clock);return campaign;
 };
 const campaign=load('returned'),original=load('originalCohort'),prepared=load('preparedCohort');
 const originalIds=original.recruited.filter(id=>original.operativeState[id].alive&&!original.operativeState[id].captured);
 return {campaign,original,prepared,meta,keepers:northernReunionDutyKeepers(campaign,originalIds)};
}
function retainedDeaths(start,end){for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}}

test('the genuine returned681 duty cohort derives from its original paid survivors and the actual returned ward, rather than a price or ID exception',()=>{
 const {campaign:c,original,prepared,keepers}=earned();assert.deepEqual([c.hour,c.secondOfHour],[681,335]);assert.equal(c.resources.treasury,21878);
 assert.deepEqual([original.hour,original.secondOfHour,original.resources.treasury],[302,2571,95413]);assert.deepEqual([prepared.hour,prepared.secondOfHour],[368,2583]);
 const callerSurvivors=original.recruited.filter(id=>original.operativeState[id].alive&&!original.operativeState[id].captured),preparedSurvivors=prepared.recruited.filter(id=>prepared.operativeState[id].alive&&!prepared.operativeState[id].captured);
 assert.equal(callerSurvivors.length,16);assert.equal(preparedSurvivors.length,17);assert.deepEqual(preparedSurvivors.filter(id=>!callerSurvivors.includes(id)),[133]);assert.ok(callerSurvivors.every(id=>preparedSurvivors.includes(id)));
 assert.equal(c.operativeState[133].alive,false);assert.equal(c.operativeState[133].hp,0);assert.deepEqual(northernReunionDutyKeepers(c,preparedSurvivors),northernReunionDutyKeepers(c,callerSurvivors));
 assert.deepEqual(keepers,[114,137,124,141,125,146,1000,10,4]);assert.ok(c.squad.every(id=>keepers.includes(id)));
 const temporary=c.recruited.filter(id=>c.operativeState[id].alive&&!keepers.includes(id));assert.deepEqual(temporary,[135,147]);
 assert.ok(temporary.every(id=>!original.recruited.includes(id)));assert.ok(keepers.every(id=>c.contracts[id]));
 assert.equal(northernHospitalReturnFunding(c,48).total,32382);assert.ok(northernHospitalReturnFunding(c,48).total>c.resources.treasury);
 const before=structuredClone(c);assert.throws(()=>reuniteFreshNorthernSquad(c,{keepServing:[10]}),/Every actual returning soldier/);assert.deepEqual(c,before);
});

test('the established all-serving march policy still rejects its genuine unaffordable135 quote after actual rest and earlier quoted payments',()=>{
 const {campaign:start}=earned(),before=structuredClone(start),events=[];
 assert.throws(()=>reuniteFreshNorthernSquad(start,{report:e=>events.push(e)}),/7722/);
 assert.deepEqual(start,before);
 const stopped=events.find(e=>e.event==='northernReunionFundingRefused');assert.ok(stopped);
 assert.equal(stopped.id,135);assert.equal(stopped.quote.price,7722);assert.equal(stopped.quote.available,true);assert.ok(stopped.quote.price>stopped.campaign.resources.treasury);
 assert.deepEqual([stopped.campaign.hour,stopped.campaign.secondOfHour],[693,335]);assert.equal(stopped.campaign.resources.treasury,4387);
 assert.deepEqual(saved(stopped.campaign),stopped.campaign);assert.ok(events.every(e=>e.action?.type!=='travel'));
 assert.equal(events.filter(e=>e.event==='northernReunionRenewal').reduce((sum,e)=>sum+e.cost,0),17491);
});

test('the whole earned reunion uses paid simultaneous postas, normal completed-service expiry and the unchanged native northern road to reach Tucumán',t=>{
 const {campaign:start,keepers,meta}=earned(),before=structuredClone(start),events=[];
 const report=e=>{events.push(e);if(process.env.GRANADEROS_REUNION_DIAGNOSTIC_PREFIX&&e.campaign)writeFileSync(`${process.env.GRANADEROS_REUNION_DIAGNOSTIC_PREFIX}-${e.event}.save.json`,encodeSave(e.campaign));};
 const c=reuniteFreshNorthernSquad(start,{keepServing:keepers,mode:'posta',report});
 assert.deepEqual(start,before);assert.deepEqual(saved(c),c);assert.equal(c.location,'tucuman');assert.ok(c.squad.includes(1));assert.ok(c.squad.every(id=>c.operativeState[id].alive));
 assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.completed,false);assert.equal(c.defeated,false);assert.ok(c.resources.treasury>=0);retainedDeaths(start,c);
 const formed=events.find(e=>e.event==='northernReunionColumns'),arrived=events.find(e=>e.event==='northernReunionColumnsArrived');assert.ok(formed&&arrived);assert.deepEqual(formed.columns.map(q=>q.members.length),[6,2]);assert.deepEqual(formed.field,[10,4,114,137,124,125,146,1000]);
 for(const id of formed.field){assert.equal(operativeLocation(arrived.campaign,id),'cordoba');assert.ok(arrived.campaign.recruited.includes(id));assert.equal(arrived.campaign.operativeState[id].alive,true);assert.equal(arrived.campaign.operativeState[id].hp,start.operativeState[id].hp);assert.equal(arrived.campaign.operativeState[id].bleeding,0);}
 const quotes=events.filter(e=>e.event==='northernReunionTravelQuote');assert.equal(quotes.length,2);assert.ok(quotes.every(e=>e.quote.valid&&e.quote.hours===4&&e.quote.action.mode==='posta'&&e.quote.action.queue===true));
 const departures=events.filter(e=>e.event==='northernReunionOrder'&&e.action.type==='travel');assert.equal(departures.length,2);assert.ok(departures.every(e=>e.elapsedSeconds===0&&e.cost===0));
 const network=events.filter(e=>e.event==='northernReunionOrder'&&e.action.type==='transport');assert.equal(network.length,1);assert.equal(network[0].action.mode,'posta');assert.equal(network[0].cost,150);
 const expired=events.filter(e=>e.event==='northernReunionServiceExpired');assert.deepEqual(expired.flatMap(e=>e.rows.map(r=>r.id)),[135,147]);
 let priorPool=sectorInventoryModel(start,'tucuman',rosterFor(start),141).entries;
 for(const event of expired){
  assert.deepEqual(saved(event.campaign),event.campaign);
  const pool=sectorInventoryModel(event.campaign,'tucuman',rosterFor(event.campaign),141).entries,oldKeys=new Set(priorPool.map(row=>row.key)),returned=pool.filter(row=>!oldKeys.has(row.key));
  assert.ok(returned.length,'Normal expiry must retain actual returned physical property.');assert.equal(new Set(returned.map(row=>row.key)).size,returned.length);
  const id=event.rows[0].id,marker=id===135?1:2,expected=id===135?
   [['weapon',1,1805,92],['weapon',1,1813,100],['headwear',1,null,100],['outfit',1,null,100],['legwear',1,null,100],['inventory:ammo:pistol_69',8],['rations',2],['boleadoras',1],['torches',2]]:
   [['weapon',1,1800,92],['weapon',1,1813,100],['headwear',1,null,100],['outfit',1,null,87],['legwear',1,null,100],['inventory:weapon:1804',1,1804,78],['inventory:weapon:1800',1,1800,77],['inventory:weapon:1802',1,1802,89],['inventory:ammo:musket_75',5],['rations',2],['boleadoras',1],['torches',2]];
  assert.equal(returned.length,expected.length);
  for(const [index,row]of returned.entries()){
   const item=JSON.parse(row.expected),[kind,count,weapon,condition]=expected[index];
   assert.equal(row.key,`ground:service-return-${marker}-${index}`);assert.equal(row.count,count);assert.equal(item.item,kind);assert.equal(item.count,count);
   if(weapon!=null){assert.equal(item.weapon,weapon);assert.equal(item.loaded,0);}if(condition!=null)assert.equal(item.condition,condition);
  }
  for(const row of event.rows){
   assert.equal(row.after.alive,true);assert.equal(row.after.hp,row.before.hp);assert.equal(row.after.bleeding,row.before.bleeding);assert.equal(row.after.deathMinute,row.before.deathMinute);assert.equal(row.after.location,row.before.location);assert.ok(contractExpiresSeconds(row.contract)<=clock(event.campaign));
   assert.equal(event.campaign.recruited.includes(row.id),false);assert.equal(event.campaign.contracts[row.id],undefined);assert.equal(event.campaign.operativeState[row.id].medkits,0);assert.equal(event.campaign.operativeState[row.id].captured,row.before.captured);
  }
  priorPool=pool;
 }
 const renewals=events.filter(e=>['northernReunionRenewal','northernRoadRenewal'].includes(e.event));assert.ok(renewals.length);assert.ok(renewals.every(e=>keepers.includes(e.id)));
 for(const e of renewals){assert.equal(e.cost,e.quote.price);assert.equal(e.quote.available,true);assert.ok(e.action.expectedExpiresAt*3600+(e.action.expectedExpiresSecond??0)>e.hour*3600+(e.second??0));}
 const native=events.filter(e=>e.event==='battleFinished');assert.ok(native.length);assert.ok(native.every(e=>e.status==='victory'));
 const nativeDead=new Set(native.flatMap(e=>e.units.filter(u=>u.side==='player'&&u.hp<=0&&start.operativeState[Number(u.id)]?.alive).map(u=>Number(u.id))));
 assert.equal(native.length,1);assert.deepEqual(native.map(e=>[e.sector,e.turns,e.actions,e.elapsedSeconds]),[['tucuman',19,240,331]]);assert.deepEqual([...nativeDead],[141]);
 const defended=events.find(e=>e.event==='northernRoadDefended'),care=events.find(e=>e.event==='northernRoadCareCompleted');
 assert.equal(c.operativeState[141].alive,false);assert.equal(c.operativeState[141].hp,0);assert.equal(c.operativeState[141].deathMinute,defended.campaign.operativeState[141].deathMinute);
 assert.deepEqual(c.operativeState[141],care.campaign.operativeState[141]);
 const corpse=defended.campaign.sectorStates.tucuman.units.find(u=>Number(u.id)===141);assert.equal(corpse.hp,0);
 // A normal scene revisit clears contact memory; it retains the actual body,
 // wounds, pockets, weapon, position and every other native casualty field.
 const {lastKnownEnemy:oldContact,...nativeBody}=corpse,{lastKnownEnemy:nextContact,...retainedBody}=c.sectorStates.tucuman.units.find(u=>Number(u.id)===141);assert.deepEqual(retainedBody,nativeBody);
 const controlled=events.find(e=>e.event==='northernRoadControlledReturn'),shipment=events.find(e=>e.event==='northernOfficerGunDispatched'),wardArrival=events.find(e=>e.event==='northernOfficerColumnsArrived');
 assert.ok(controlled&&shipment&&wardArrival);assert.deepEqual(controlled.ward,[137,124,125,146]);assert.equal(controlled.source,'depot');assert.equal(controlled.campaign.pendingEncounter,null);assert.equal(controlled.campaign.sectors.cordoba.owner,'patriot');
 const record={id:'arsenal:cordoba:2',type:'bronze4',side:'player',loaded:true,ammo:6};
 assert.deepEqual(controlled.gun,record);assert.deepEqual(shipment.gun,record);assert.equal(shipment.source,'depot');assert.deepEqual(shipment.crew,controlled.ward);
 assert.equal(shipment.quote.available,true);assert.equal(shipment.quote.cost,0);assert.equal(shipment.treasuryAfter,shipment.treasuryBefore-shipment.quote.cost);
 const carts=events.filter(e=>e.event==='northernOfficerOrder'&&e.action.type==='transport');assert.equal(carts.length,1);assert.equal(carts[0].action.mode,'carts');assert.equal(carts[0].cost,180);
 assert.deepEqual(shipment.beforeCampaign.artilleryDepots.cordoba.map(storedArtilleryRecord),[record]);assert.deepEqual(shipment.campaign.artilleryDepots.cordoba,[]);
 const transfer=shipment.campaign.artilleryTransfers.find(g=>g.id===record.id);assert.deepEqual(transfer.gun,record);assert.deepEqual([transfer.from,transfer.to,transfer.mode,transfer.departedAt,transfer.dueAt],['cordoba','tucuman','carts',768,786]);
 const replay=dispatchCampaign(saved(shipment.beforeCampaign),shipment.action);assert.equal(replay.lastError,null);assert.deepEqual(saved(replay),shipment.campaign,'The same physical gun dispatch replays exactly through an official save.');
 const wardDeparture=events.filter(e=>e.event==='northernOfficerOrder'&&e.action.type==='travel');assert.equal(wardDeparture.length,1);assert.equal(wardDeparture[0].action.queue,true);assert.equal(wardDeparture[0].action.mode,'posta');assert.equal(wardDeparture[0].elapsedSeconds,0);
 const moving=wardDeparture[0].campaign.squads.find(q=>q.members.includes(137));assert.deepEqual(moving.members,controlled.ward);assert.ok(moving.journey);assert.deepEqual([wardArrival.campaign.hour,wardArrival.campaign.secondOfHour],[772,1386]);
 for(const id of controlled.ward){assert.equal(operativeLocation(shipment.campaign,id),'cordoba');assert.equal(operativeLocation(wardArrival.campaign,id),'tucuman');assert.equal(operativeLocation(c,id),'tucuman');assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 assert.deepEqual(c.artilleryDepots.tucuman.map(storedArtilleryRecord),[record]);assert.deepEqual(c.artilleryTransfers,[]);
 const spent=care.campaign.sectorStates.tucuman.artillery.find(g=>g.id==='arsenal:cordoba:1');assert.equal(spent.loaded,false);assert.equal(spent.ammo,0);assert.deepEqual(c.sectorStates.tucuman.artillery.find(g=>g.id===spent.id),spent);
 const allGunIds=[...Object.values(c.artilleryDepots).flat(),...Object.values(c.sectorStates).flatMap(s=>s.artillery??[])].filter(g=>g.side==='player').map(g=>g.id);assert.equal(allGunIds.filter(id=>id===record.id).length,1);
 for(const id of keepers){const r=c.operativeState[id];if(r.alive){assert.ok(c.recruited.includes(id));assert.ok(contractExpiresSeconds(c.contracts[id])===null||contractExpiresSeconds(c.contracts[id])>clock(c));assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);}else assert.ok(nativeDead.has(id),'A required paid cohort loss must be native, never an expiry or discarded patient.');}
 for(const id of [135,147]){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].deathMinute,start.operativeState[id].deathMinute);}
 const returnedKeys=new Map(priorPool.filter(r=>r.key.startsWith('ground:service-return-')).map(r=>[r.key,r.expected]));assert.equal(returnedKeys.size,21);
 const finalReturns=sectorInventoryModel(c,'tucuman',rosterFor(c),10).entries.filter(r=>returnedKeys.has(r.key));assert.equal(finalReturns.length,returnedKeys.size);
 for(const row of finalReturns)assert.equal(row.expected,returnedKeys.get(row.key));
 assert.deepEqual([c.hour,c.secondOfHour],[786,1527]);assert.equal(c.resources.treasury,48739);
 const officerRenewals=events.filter(e=>e.event==='northernOfficerRenewal');for(const e of officerRenewals){assert.equal(e.cost,e.quote.price);assert.equal(e.quote.available,true);assert.equal(e.afterExpiry,e.quote.expiresAt*3600+(e.quote.expiresSecond??0));assert.ok(![135,147].includes(e.id));}
 assert.equal(renewals.reduce((sum,e)=>sum+e.cost,0),3661);assert.equal(officerRenewals.reduce((sum,e)=>sum+e.cost,0),858);
 assert.ok(events.filter(e=>e.action).every(e=>!['dismiss','dismissCivic','releaseService','expireContract'].includes(e.action.type)));
 t.diagnostic(JSON.stringify({scope:'Whole earned681 reunion to native Tucumán only; complete original recovery and ending remain unproved',inputSHA:meta.inputs.returned.rawSHA,keepers,columns:formed.columns,postaSetup:150,arrival:[arrived.campaign.hour,arrived.campaign.secondOfHour],arrivalTreasury:arrived.campaign.resources.treasury,expired:expired.flatMap(e=>e.rows.map(r=>({id:r.id,hp:r.after.hp,bleeding:r.after.bleeding,clock:[e.campaign.hour,e.campaign.secondOfHour]}))),returnedPropertyRows:returnedKeys.size,native:native.map(e=>({sector:e.sector,status:e.status,turns:e.turns,orders:e.actions,seconds:e.elapsedSeconds})),newDeaths:[...nativeDead],ward:controlled.ward,wardArrival:[wardArrival.campaign.hour,wardArrival.campaign.secondOfHour],returnedGun:record,cartsNetwork:180,cartsQuote:shipment.quote.cost,exactSavedGunReplay:true,finish:[c.hour,c.secondOfHour],treasury:c.resources.treasury,renewalCost:renewals.reduce((s,e)=>s+e.cost,0),officerRenewalCost:officerRenewals.reduce((s,e)=>s+e.cost,0)}));
});
