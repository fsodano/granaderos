import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {operativeLocation} from '../game/squads.js';
import {enterSector} from '../game/world.js';
import {artilleryContact} from '../game/tactical.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {prepareNorthernHospitalRear} from './northern-hospital-rear-readiness.mjs';
import {recoverFreshNorthernHospital,northernHospitalOrder} from './fresh-northern-recovery.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex'),clock=c=>c.hour*3600+(c.secondOfHour??0),saved=c=>decodeSave(encodeSave(c)).campaign;
const guards=[141,140,104,116],reserves=[147,135],patients=[114,137,124,125];
function stabilizedInput(){
 const meta=JSON.parse(readFileSync(new URL('./fixtures/earned-original-hospital-stabilized.provenance.json',import.meta.url))),packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const c=decodeSave(raw.toString()).campaign;assert.deepEqual([c.hour,c.secondOfHour],meta.clock);assert.equal(c.resources.treasury,meta.treasury);assert.deepEqual(saved(c),c);return c;
}
const retainedDeaths=(before,after)=>{for(const[id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(after.operativeState[id].alive,false);assert.equal(after.operativeState[id].deathMinute,r.deathMinute);}};

test('the earned hospital rear uses its serving reserve, finite linen and rounds, and real forward gun contact before evacuation',t=>{
 const start=stabilizedInput(),before=structuredClone(start),events=[];
 const prepare=input=>prepareNorthernHospitalRear(input,guards,{reserveIds:reserves,applyOrder:(c,a)=>northernHospitalOrder(c,a,{report:e=>events.push(e)}),report:e=>events.push(e)});
 const prepared=prepare(start),c=prepared.campaign,r=prepared.receipts[0];assert.deepEqual(start,before);assert.deepEqual(saved(c),c);
 assert.deepEqual(r.guards,[...guards,...reserves]);assert.deepEqual(prepared.ids,r.guards);assert.equal(new Set(r.guards).size,6);
 assert.equal(c.activeSquadId,start.activeSquadId);assert.ok(c.squads.length<=8&&c.squads.every(q=>q.members.length<=6));assert.ok(c.squads.some(q=>q.location==='tucuman'&&r.guards.every(id=>q.members.includes(id))));
 assert.equal(r.transfers.length,1);assert.deepEqual(r.transfers[0].ids,reserves);assert.equal(r.transfers[0].quote.valid,true);assert.equal(r.transfers[0].quote.action.mode,'march');assert.equal(r.transfers[0].quote.hours,20);
 assert.ok(!events.some(e=>e.action?.type==='recruitCivic'||e.event==='routeHireBooked'),'Existing serving reserves are not booked a second time.');
 const renewals=events.filter(e=>e.event==='northernHospitalRenewal');assert.ok(renewals.length);for(const row of renewals){assert.equal(row.cost,row.quote.price);assert.equal(contractExpiresSeconds(row.contract),row.quote.expiresAt*3600+(row.quote.expiresSecond??0));}
 const paidOrders=events.filter(e=>e.event==='northernHospitalOrder').reduce((n,e)=>n+e.cost,0),renewalCost=renewals.reduce((n,e)=>n+e.cost,0);assert.equal(c.resources.treasury,start.resources.treasury-paidOrders-renewalCost);
 assert.equal(r.fortCost,450);assert.equal(c.sectors.tucuman.fort,3);assert.deepEqual(r.donations.map(x=>[x.donor,x.recipient,x.count]),[[146,135,2]]);assert.equal(c.operativeState[146].medkits,start.operativeState[146].medkits-2);assert.equal(c.operativeState[135].medkits,2);
 assert.ok(r.ammunition.length>0);assert.ok(r.ammunition.every(row=>row.quantity>0&&row.cost===0));
 for(const id of r.guards){const op=rosterFor(c).find(op=>op.id===id),load=carriedAmmunition(op,c.operativeState[id]),family=ammoTypeFor({...load,activeSlot:'primary'});assert.ok(load.loaded+ammoCount(load,family)>=16);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].assignment,'rest');assert.equal(operativeLocation(c,id),'tucuman');}
 assert.deepEqual(r.battery.crewIds,[116,135]);assert.equal(r.battery.actions.length,138);assert.equal(r.battery.elapsedSeconds,1239);assert.ok(r.battery.actions.some(a=>a.type==='artilleryMove'));assert.ok(r.battery.actions.every(a=>!['artilleryFire','fire','useItem'].includes(a.type)));
 assert.equal(r.battery.gunAfter.id,r.battery.gunBefore.id);assert.equal(r.battery.gunAfter.loaded,true);assert.equal(r.battery.gunAfter.ammo,5);assert.deepEqual([r.battery.gunBefore.x,r.battery.gunBefore.y],[34,46]);assert.deepEqual([r.battery.gunAfter.x,r.battery.gunAfter.y],[41,24]);
 const roof=r.positions.filter(p=>p.tacticalLevel===1);assert.equal(roof.length,4);assert.equal(new Set(roof.map(p=>`${p.x},${p.y}`)).size,4);assert.ok(r.positions.filter(p=>r.battery.crewIds.includes(p.id)).every(p=>p.tacticalLevel===0));
 let visit=dispatchCampaign(c,{type:'selectSquad',id:c.squads.find(q=>r.guards.every(id=>q.members.includes(id))).id});for(const operativeId of r.guards)visit=dispatchCampaign(visit,{type:'assignCare',operativeId,assignment:'active'});visit=dispatchCampaign(visit,{type:'visitSector'});assert.equal(visit.lastError,null);
 const b=enterSector(visit.pendingBattle,visit.sectorStates.tucuman),gun=b.artillery.find(g=>g.id===r.battery.gunAfter.id);assert.ok(r.battery.crewIds.every(id=>artilleryContact(b,b.units.find(u=>u.id===String(id)),gun)));
 retainedDeaths(start,c);assert.ok(patients.every(id=>c.operativeState[id].alive));assert.deepEqual(prepare(saved(before)).campaign,c,'The complete preparation repeats exactly after official input save admission.');
 t.diagnostic(JSON.stringify({scope:'Exact earned374 rear preparation only',clock:[c.hour,c.secondOfHour],guards:r.guards,transferHours:20,fortCost:450,donations:r.donations,gun:r.battery.gunAfter,crew:r.battery.crewIds,nativeGunOrders:r.battery.actions.length,paidOrders,renewalCost}));
});

test('rear preparation refuses a missing serving reserve instead of creating bodies or replacing paid stock',()=>{
 const start=stabilizedInput(),before=structuredClone(start);
 assert.throws(()=>prepareNorthernHospitalRear(start,guards,{applyOrder:northernHospitalOrder}),/actual serving reserve/);assert.deepEqual(start,before);
});

test('the complete genuine original368 hospital route earns the actual528 victory and all original clinical full-health gates',t=>{
 const proof=JSON.parse(readFileSync(new URL('./fixtures/earned-original-tucuman-hospital.provenance.json',import.meta.url))),meta=proof.fixtures.find(r=>r.stage==='input'),packed=readFileSync(new URL('./fixtures/'+meta.fixture,import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),meta.gzipSha256);assert.equal(sha(raw),meta.rawSha256);assert.equal(raw.length,meta.rawBytes);
 const actual=JSON.parse(raw),rawBefore=structuredClone(actual),start=saved(actual),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],[368,2667]);assert.equal(start.resources.treasury,114626);
 const hospital=recoverFreshNorthernHospital(start,{report:e=>events.push(e)}),c=hospital.campaign,defense=events.find(e=>e.event==='battleFinished'),ready=events.find(e=>e.event==='northernHospitalRearReady');assert.ok(defense&&ready);
 assert.equal(defense.status,'victory');assert.deepEqual([defense.turns,defense.actions,defense.elapsedSeconds],[7,146,137]);assert.ok(events.filter(e=>e.event==='battleFinished').every(e=>e.status==='victory'));
 const attack=events.find(e=>e.event==='hospitalCounterattack').campaign,won=events.find(e=>e.event==='hospitalDefended').campaign;assert.deepEqual([attack.hour,attack.secondOfHour],[528,1588]);assert.deepEqual([won.hour,won.secondOfHour],[528,1725]);
 const losses=start.recruited.filter(id=>start.operativeState[id].alive&&!c.operativeState[id].alive);assert.deepEqual(losses,[140]);assert.ok(defense.units.some(u=>u.id==='140'&&u.hp===0));assert.equal(c.operativeState[140].deathMinute,won.operativeState[140].deathMinute);retainedDeaths(start,c);
 const gun=ready.receipts[0].battery.gunAfter,shots=won.sectorStates.tucuman.artillery.find(g=>g.id===gun.id);assert.equal(gun.loaded+gun.ammo,6);assert.equal(shots.loaded+shots.ammo,3);assert.deepEqual(c.sectorStates.tucuman.artillery.find(g=>g.id===gun.id),shots);assert.equal(c.artilleryDepots.tucuman?.some(g=>g.id===gun.id)??false,false);
 for(const id of [...patients,1000,146]){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}assert.equal(hospital.sector,'cordoba');
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual([c.hour,c.secondOfHour],[646,1725]);assert.equal(c.resources.treasury,22572);
 assert.equal(c.enemyGroups.find(g=>g.id==='enemy-group-3').status,'defeated');assert.ok(c.encounterHistory.some(e=>e.groupId==='enemy-group-3'&&e.outcome==='victory'));
 for(const event of events.filter(e=>e.event==='northernHospitalCheckpoint'))assert.deepEqual(saved(event.campaign),event.campaign);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);assert.deepEqual(actual,rawBefore);
 const renewals=events.filter(e=>e.event==='northernHospitalRenewal');assert.ok(renewals.length);for(const row of renewals)assert.equal(row.cost,row.quote.price);
 t.diagnostic(JSON.stringify({scope:'Whole hospital helper from untouched original368 input, not complete original recovery or ending',native:{turns:7,actions:146,seconds:137,losses},patients,clinical:[1000,146],clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,gun:shots,officialNativeReplay:true}));
});
