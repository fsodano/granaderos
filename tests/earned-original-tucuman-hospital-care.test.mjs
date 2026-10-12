import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {stabilizeNorthernHospitalPatients} from './fresh-northern-recovery.mjs';

const proof=JSON.parse(readFileSync(new URL('./fixtures/earned-original-tucuman-hospital.provenance.json',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
const saved=c=>decodeSave(encodeSave(c)).campaign;
function load(stage){
 const f=proof.fixtures.find(f=>f.stage===stage),packed=readFileSync(new URL('./fixtures/'+f.fixture,import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),f.gzipSha256);assert.equal(sha(raw),f.rawSha256);assert.equal(raw.length,f.rawBytes);
 const input=JSON.parse(raw),before=structuredClone(input),c=saved(input);assert.deepEqual(input,before);assert.deepEqual(saved(c),c);return c;
}
const patients=[114,137,124,125],clock=c=>c.hour*3600+(c.secondOfHour??0);
const localLinen=c=>sectorInventoryModel(c,'cordoba',rosterFor(c),1000).entries.filter(row=>JSON.parse(row.expected).item==='medkits');
const physicalLinen=c=>Object.values(c.operativeState).reduce((n,r)=>n+(r.medkits??0),0)+Object.values(c.sectorStates).reduce((n,b)=>n+(b.units??[]).filter(u=>u.side!=='player').reduce((m,u)=>m+(u.medkits??0),0)+(b.props??[]).reduce((m,p)=>m+(p.contents??[]).filter(x=>x.item==='medkits').reduce((a,x)=>a+x.count,0),0),0);
let stabilized;

test('the original complete recovery supplies exact routed native patients at Córdoba and proves real local linen exhaustion',()=>{
 const input=load('input'),failure=load('failure');
 assert.deepEqual([input.hour,input.secondOfHour],[368,2667]);assert.deepEqual([failure.hour,failure.secondOfHour],[370,2667]);
 assert.deepEqual(patients.map(id=>({id,hp:input.operativeState[id].hp,bleeding:input.operativeState[id].bleeding,location:input.operativeState[id].location})),[
  {id:114,hp:25,bleeding:4,location:'cordoba'},{id:137,hp:32,bleeding:0,location:'tucuman'},{id:124,hp:20,bleeding:5,location:'cordoba'},{id:125,hp:2,bleeding:4,location:'cordoba'}]);
 assert.equal(failure.contracts[1000].paid,300);assert.equal(failure.operativeState[1000].medkits,0);
 assert.equal(sectorInventoryModel(failure,'cordoba',rosterFor(failure),1000).reason,null);assert.deepEqual(localLinen(failure),[]);
 assert.ok(!failure.sectorStates.cordoba.props.some(p=>p.contents?.some(x=>x.item==='medkits'&&x.count>0)),'the exhausted source is not an undiscovered full cache');
 assert.equal(failure.operativeState[114].bleeding,4);assert.equal(failure.operativeState[125].hp,2);assert.equal(failure.operativeState[125].bleeding,0);
 assert.deepEqual([137,146].map(id=>failure.operativeState[id].medkits),[8,8],'existing distant linen is retained at Tucumán');
 assert.ok(input.sectorStates.tucuman.sectorCleared,'the actual Tucumán victory precedes this hospital boundary');
});

test('two actual immediate day hires and finite public donations stabilize the earned critical patients in four paid care hours',t=>{
 const start=load('failure'),before=structuredClone(start),physical=physicalLinen(start),events=[];
 stabilized=stabilizeNorthernHospitalPatients(start,patients,[1000,146],{report:e=>events.push(e)});const {campaign:c,receipt:r}=stabilized;
 assert.deepEqual(r.hires.map(h=>h.id),[135,147]);assert.equal(r.hires.reduce((sum,h)=>sum+h.debited,0),13860);assert.equal(start.resources.treasury-c.resources.treasury,13860);
 for(const h of r.hires){assert.equal(h.debited,h.quote.total);assert.equal(h.quote.hours,24);assert.equal(h.arrival.travelHours,0);assert.equal(c.recruited.filter(id=>id===h.id).length,1);assert.equal(contractExpiresSeconds(c.contracts[h.id]),h.arrival.dueAt*3600+h.arrival.dueSecond+24*3600);assert.ok(c.squads.some(q=>q.location==='cordoba'&&q.members.includes(h.id)),'every actual relief hire belongs to a legal local squad');}
 assert.ok(c.squads.length<=8&&c.squads.every(q=>q.members.length<=6));
 assert.equal(clock(c)-clock(start),4*3600);assert.equal(r.ticks.reduce((sum,tick)=>sum+tick.dressingsSpent,0),8);assert.equal(physicalLinen(c),physical-8);
 assert.deepEqual(r.doctors,[135,146]);assert.equal(r.donations.reduce((n,row)=>n+row.count,0),2);assert.ok(r.donations.every(row=>row.donor===147&&row.recipient===135));
 assert.deepEqual(patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding})),[{id:114,hp:23,bleeding:0},{id:137,hp:68,bleeding:0},{id:124,hp:18,bleeding:0},{id:125,hp:20,bleeding:0}]);
 assert.ok(patients.every(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),'stable native wounds still require later full clinical care');
 for(const id of start.recruited){assert.equal(c.recruited.includes(id),true);assert.equal(c.operativeState[id].alive,start.operativeState[id].alive);assert.equal(c.operativeState[id].captured,start.operativeState[id].captured);if(!start.operativeState[id].alive)assert.equal(c.operativeState[id].deathMinute,start.operativeState[id].deathMinute);}
 assert.deepEqual(c.encounterHistory,start.encounterHistory);assert.deepEqual(c.sectors,start.sectors);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(localLinen(c),[]);assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Exact370 partial hospital boundary through native four-hour stabilization only',hires:r.hires.map(h=>({id:h.id,cost:h.debited,due:h.arrival.dueAt})),donations:r.donations,clock:[c.hour,c.secondOfHour],patients:r.ticks.at(-1).patients,allClinicAndFieldDressingsSpent:8}));
});

test('all actual booking, finite donation, care and wait orders replay exactly across an official midpoint save',()=>{
 assert.ok(stabilized);let c=load('failure');
 for(let i=0;i<stabilized.receipt.orders.length;i++){
  const a=stabilized.receipt.orders[i];c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+': '+c.lastError);
  if(i===Math.floor(stabilized.receipt.orders.length/2))c=saved(c);
 }
 assert.deepEqual(c,stabilized.campaign);assert.deepEqual(saved(c),c);
});
