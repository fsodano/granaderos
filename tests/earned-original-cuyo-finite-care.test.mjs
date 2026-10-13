import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,dailyIncome} from '../game/campaign.js';
import {operativeLocation} from '../game/squads.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {doctorRate} from '../game/medical-care.js';
import {collectKnownCuyoDressings} from './cuyo-known-medical-courier.mjs';
import {createFreshRouteOrders,prepareFreshCuyoDefense} from './fresh-cuyo-route.mjs';
import {finishFreshNorthernCampaign} from './fresh-northern-recovery.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-cuyo-finite-care.provenance.json',import.meta.url)));
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const medical=(c,at,id=10)=>sectorInventoryModel(c,at,rosterFor(c),id).entries.filter(row=>JSON.parse(row.expected).item==='medkits');
const pool=(c,at)=>medical(c,at).reduce((n,row)=>n+row.count,0);
const physical=r=>Object.fromEntries(Object.entries(r).filter(([key])=>/^(inventory|ammo|carriedAmmo|carriedLoaded|condition|headwear|outfit|legwear|weaponDropped|weaponFittings|weaponFittingPattern|bladeFittingPattern|bladeCondition|toolkitPoints|serviceEquipmentReturn|primaryWeapon.*|secondaryWeapon.*)$/.test(key)));
const guns=c=>({depots:c.artilleryDepots,transfers:c.artilleryTransfers,scenes:Object.fromEntries(Object.entries(c.sectorStates).map(([id,s])=>[id,s.artillery??[]]))});
function earned(){
 const packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const c=decodeSave(raw.toString()).campaign;
 assert.deepEqual([c.hour,c.secondOfHour],meta.clock);assert.equal(c.resources.treasury,meta.treasury);
 assert.equal(c.location,'cordoba');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.equal(c.operativeState[11].hp,18);assert.equal(c.operativeState[11].maxHp,78);assert.equal(c.operativeState[11].bleeding,0);
 assert.equal(c.operativeState[10].medkits,0);assert.equal(doctorRate(rosterFor(c).find(op=>op.id===10)),6);
 assert.equal(pool(c,'cordoba'),0);assert.equal(pool(c,'tucuman'),16);
 assert.equal(medical(c,'tucuman').find(row=>row.key===meta.observedFiniteSource.sourceKey).count,12);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
function runCourier(start,count,{care=false}={}){
 let c=decodeSave(encodeSave(start)).campaign;const events=[];
 const report=e=>events.push(e),retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 collectKnownCuyoDressings(()=>c,retained.order,10,count,{report});const supplied=structuredClone(c);
 if(care){retained.order({type:'assignCare',operativeId:10,assignment:'doctor'});retained.order({type:'assignCare',operativeId:11,assignment:'patient'});
  for(let h=0;c.operativeState[11].hp<c.operativeState[11].maxHp&&h<48;h++)retained.order({type:'wait',hours:1});
 }
 return {campaign:c,supplied,events};
}
function conserved(start,c){
 assert.deepEqual(guns(c),guns(start));assert.deepEqual(c.serviceEquipmentReturns,start.serviceEquipmentReturns);
 assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.hiringArrivals,start.hiringArrivals);
 for(const [id,r]of Object.entries(start.operativeState)){
  const after=c.operativeState[id];assert.equal(after.alive,r.alive);assert.equal(after.captured,r.captured);assert.equal(after.deathMinute,r.deathMinute);
  assert.deepEqual(physical(after),physical(r),`Only real dressings and ordinary care/travel may change ${id}'s equipment.`);
  if(Number(id)!==9)assert.equal(operativeLocation(c,Number(id)),operativeLocation(start,Number(id)));
 }
 assert.deepEqual(c.squads.filter(q=>q.members.length),start.squads.filter(q=>q.members.length),'The temporary carrier must return to every original occupied group.');
 for(const id of start.recruited){const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c));}
 assert.equal(c.location,start.location);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
}

test('the genuine exhausted Cuyo clinic receives ten known dressings through paid physical postas and completes finite care with exact saved replay',t=>{
 const start=earned(),before=structuredClone(start),{campaign:c,supplied,events}=runCourier(start,10,{care:true});
 assert.deepEqual(start,before);assert.deepEqual([supplied.hour,supplied.secondOfHour],[830,3471]);assert.equal(supplied.operativeState[11].hp,18);assert.equal(supplied.operativeState[11].bleeding,0);
 assert.equal(supplied.operativeState[10].medkits,10);assert.equal(supplied.operativeState[9].medkits,0);
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[840,3471,71063]);
 assert.equal(c.operativeState[11].hp,78);assert.equal(c.operativeState[11].bleeding,0);assert.equal(c.operativeState[10].medkits,0);
 assert.equal(clock(c)-clock(supplied),10*3600);assert.equal(pool(c,'tucuman'),6);
 assert.equal(medical(c,'tucuman').find(row=>row.key===meta.observedFiniteSource.sourceKey).count,2);
 const pickup=events.filter(e=>e.event==='cuyoKnownCourierPickup');assert.equal(pickup.length,1);
 assert.deepEqual([pickup[0].carrier,pickup[0].source,pickup[0].sourceKey,pickup[0].count,pickup[0].knownBefore,pickup[0].knownAfter],[9,'tucuman',meta.observedFiniteSource.sourceKey,10,16,6]);
 const arrivals=events.filter(e=>e.event==='cuyoKnownCourierArrival');assert.deepEqual(arrivals.map(e=>e.destination),['tucuman','cordoba']);
 assert.ok(arrivals.every(e=>e.quote.valid&&e.quote.hours===4&&e.arrivedSeconds-e.departedSeconds===4*3600));
 const renewals=events.filter(e=>e.event==='freshRouteRenewal');assert.deepEqual(renewals.map(e=>[e.id,e.price]),[[124,219],[146,152],[114,185],[137,212]]);
 for(const e of renewals){const op=rosterFor(e.campaign).find(o=>o.id===e.id);assert.equal(e.price,contractQuote(start,op,'day').price);assert.equal(e.action.expectedExpiresAt,start.contracts[e.id].expiresAt);assert.equal(e.action.expectedExpiresSecond,start.contracts[e.id].expiresSecond??0);}
 assert.equal(c.resources.treasury,start.resources.treasury+dailyIncome(start)-renewals.reduce((n,e)=>n+e.price,0)-20,'One real midnight, exact renewal quotes and two10-peso posta legs account for all cash.');
 conserved(start,c);
 const actions=events.filter(e=>e.action).map(e=>e.action);assert.equal(actions.length,32);let replay=decodeSave(encodeSave(start)).campaign;
 for(let i=0;i<actions.length;i++){replay=dispatchCampaign(replay,actions[i]);assert.equal(replay.lastError,null,JSON.stringify(actions[i]));if(i===Math.floor(actions.length/2))replay=decodeSave(encodeSave(replay)).campaign;}
 assert.deepEqual(replay,c);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Earned known-source courier and complete actual patient care only',input:meta.rawSha256,carrier:9,source:pickup[0].sourceKey,dressingsTaken:10,clinicalDressingsSpent:10,clinicalSeconds:36000,postaSeconds:28800,postaFees:20,renewals:renewals.map(e=>[e.id,e.price]),clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,officialActionReplayExact:true}));
});

test('emptying the known chest and body rows debits the complete medical pool despite container index compaction',()=>{
 const start=earned(),before=structuredClone(start),{campaign:c,events}=runCourier(start,16);
 assert.deepEqual(start,before);assert.equal(pool(c,'tucuman'),0);assert.equal(c.operativeState[10].medkits,16);assert.equal(c.operativeState[9].medkits,0);
 assert.equal(c.operativeState[11].hp,18);assert.equal(c.operativeState[11].bleeding,0);assert.deepEqual([c.hour,c.secondOfHour],[830,3471]);
 const pickups=events.filter(e=>e.event==='cuyoKnownCourierPickup');assert.equal(pickups.reduce((sum,e)=>sum+e.count,0),16);assert.equal(pickups[0].count,12);
 for(const e of pickups)assert.equal(e.knownBefore-e.knownAfter,e.count);
 const chest=c.sectorStates.tucuman.props.find(p=>p.id==='tucuman:building:chest:14:7');assert.equal(chest.contents.some(item=>item.item==='medkits'),false);
 assert.equal(chest.contents[5].kind,'repair-kit','The next compacted tool is not an undepleted dressing source.');
 conserved(start,c);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
});

test('an unobserved or insufficient finite supply request cannot create a courier or change its caller',()=>{
 const start=earned(),before=structuredClone(start),orders=[];
 assert.throws(()=>collectKnownCuyoDressings(()=>start,a=>orders.push(a),10,17),/No known controlled finite medical source/);
 assert.deepEqual(orders,[]);assert.deepEqual(start,before);
});

test('the actual earned Yatasto caller completes all Cuyo preparation with finite courier care, native paid defender and whole official replay',t=>{
 const parent=JSON.parse(readFileSync(new URL('./fixtures/earned-original-yatasto-party.provenance.json',import.meta.url))),packed=readFileSync(new URL('./fixtures/'+parent.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),parent.gzipSha256);assert.equal(sha(raw),parent.rawSha256);
 const yatasto=finishFreshNorthernCampaign(decodeSave(raw.toString()).campaign);
 assert.deepEqual([yatasto.hour,yatasto.secondOfHour,yatasto.resources.treasury],[799,3471,56669]);
 assert.equal(sha(JSON.stringify(yatasto)),'5ec7104f2c065cadc463ccc7dc5fcea3f47c4b094485cbf3e1782e60efd933ce');
 const before=structuredClone(yatasto),events=[],c=prepareFreshCuyoDefense(yatasto,{report:e=>events.push(e)});
 assert.deepEqual(yatasto,before);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[840,3471,63323]);
 assert.equal(c.location,'cordoba');assert.deepEqual(c.squad,[1,0,8,137,114,142]);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const returned=events.find(e=>e.event==='cuyoKnownCourierReturned');assert.ok(returned);assert.equal(returned.count,10);assert.equal(returned.carrier,9);assert.equal(returned.elapsedSeconds,8*3600);
 const funded=events.find(e=>e.event==='cuyoFunding');assert.ok(funded);assert.equal(funded.hour,840);assert.equal(funded.treasury,71063);
 const defender=events.find(e=>e.event==='cuyoPaidDefender');assert.deepEqual([defender.id,defender.price,defender.arrivalHour],[142,7740,840]);
 assert.equal(c.contracts[142].kind,'paid');assert.equal(c.contracts[142].term,'day');assert.equal(c.contracts[142].paid,7740);assert.equal(c.operativeState[142].medkits,2,'The real paid defender receives only his original physical kit.');
 for(const id of before.recruited){const r=before.operativeState[id],after=c.operativeState[id];assert.equal(after.alive,r.alive);assert.equal(after.captured,r.captured);assert.equal(after.deathMinute,r.deathMinute);if(r.alive&&!r.captured){assert.equal(c.recruited.includes(id),true);assert.equal(operativeLocation(c,id),'cordoba');assert.equal(after.hp,after.maxHp);assert.equal(after.bleeding,0);}}
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(guns(c),guns(before));assert.equal(pool(c,'tucuman'),6);assert.equal(c.operativeState[10].medkits,0);
 const replay=prepareFreshCuyoDefense(decodeSave(encodeSave(yatasto)).campaign);assert.deepEqual(replay,c);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 const out=process.env.GRANADEROS_CUYO_FINITE_CARE_EVIDENCE;if(out){mkdirSync(out,{recursive:true});writeFileSync(`${out}/ready.save.json`,encodeSave(c));writeFileSync(`${out}/events.json`,JSON.stringify(events));}
 t.diagnostic(JSON.stringify({scope:'Complete earned Yatasto-to-Cuyo preparation caller only; no Cuyo native battle or whole original completion',clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,field:c.squad,courier:9,knownDressingsTaken:10,allLocalPatientsFull:true,paidDefender:[142,7740],priorDeathsPreserved:true,physicalGunsUnchanged:true,officialWholePreparationReplayExact:true}));
});
