import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {ammoCount} from '../game/ammo-types.js';
import {enterSector} from '../game/world.js';
import {prepareCreatedRiverAssault} from './created-river-preparation.mjs';
import {deployRiverInfantry,riverInfantryOrder} from './created-river-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';

const sha=v=>createHash('sha256').update(v).digest('hex');
const living=c=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
const sorted=ids=>ids.slice().sort((a,b)=>a-b);
const saved=c=>decodeSave(encodeSave(c)).campaign;
function fixture(){
 const stem='./fixtures/earned-paid-coastal-care',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),blob=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(blob);
 assert.equal(sha(blob),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 const c=decodeSave(raw.toString()).campaign;assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...proof.clock,proof.treasury]);assert.deepEqual(living(c),proof.fieldIds);return c;
}
function retainedDeaths(start,end){for(const[id,u]of Object.entries(start.operativeState))if(!u.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,u.deathMinute);}}
function preparation(start,reinforcementCount=0){
 const before=structuredClone(start),events=[],c=prepareCreatedRiverAssault(start,{reinforcementCount,report:event=>events.push(event)}),field=c.pendingBattle.squad;
 assert.deepEqual(start,before);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle.origin,'cordoba');assert.equal(c.pendingBattle.sector,'santa_fe');
 assert.equal(field.length,living(start).length+reinforcementCount);assert.ok(field.length>=8);assert.equal(new Set(field.map(u=>u.id)).size,field.length);assert.ok(living(start).every(id=>field.some(u=>u.id===id)));
 assert.deepEqual([...new Set(field.map(u=>u.entryEdge))].sort(),['S','W']);assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));
 for(const u of field){assert.equal(u.hp,u.maxHp);assert.equal(u.bleeding,0);assert.ok(u.loaded+ammoCount(u)>=20);assert.ok(u.headwear.condition>0&&u.outfit.condition>0&&u.legwear.condition>0);assert.ok(u.morale>=65);}
 const ready=events.find(e=>e.event==='createdRiverAssaultReady');assert.equal(ready.doctors.length,2);assert.ok(ready.doctors.every(id=>c.operativeState[id].medkits>=10));
 const rifles=events.find(e=>e.event==='createdRiverRiflesPrepared');assert.deepEqual(rifles,{event:'createdRiverRiflesPrepared',rifleRoundsBefore:49,rifleRoundsTaken:38,rifleRoundsAfter:11,rifleLoads:[{id:6,loaded:1,rounds:19},{id:5,loaded:1,rounds:19}]});
 const guns=c.pendingBattle.artillery.filter(g=>!g.stationed);assert.equal(guns.length,3);assert.deepEqual(guns.map(g=>g.id).sort(),['arsenal:buenos_aires:1','arsenal:cordoba:1','arsenal:cordoba:2']);assert.ok(guns.every(g=>!g.loaded&&g.ammo===0));
 const dispatches=events.filter(e=>e.event==='createdRiverGunDispatched');assert.equal(dispatches.length,3);assert.ok(dispatches.every(e=>e.quote.available&&e.quote.hours===18));
 retainedDeaths(start,c);assert.deepEqual(decodeSave(encodeSave(c,enterSector(c.pendingBattle,c.sectorStates.santa_fe))),{campaign:c,battle:enterSector(c.pendingBattle,c.sectorStates.santa_fe)});
 return {campaign:c,events};
}

test('the original eight-person compatibility field uses real dismissals and retains the unchanged minimum and finite readiness gates',t=>{
 const source=fixture(),before=structuredClone(source);let start=source;
 for(const id of [101,117,121,102]){start=dispatchCampaign(start,{type:'dismiss',id});assert.equal(start.lastError,null);assert.equal(start.operativeState[id].alive,true);assert.ok(!start.recruited.includes(id));}
 const ids=living(start);assert.equal(ids.length,8);const {campaign:c}=preparation(start);
 assert.deepEqual(sorted(c.pendingBattle.squad.map(u=>u.id)),sorted(ids));assert.deepEqual(source,before);
 for(const id of [101,117,121,102]){assert.equal(c.operativeState[id].alive,true);assert.ok(!c.recruited.includes(id));}
 t.diagnostic('Actual eight-person compatibility preparation only; this dismissed control is not adopted as the complete ending route.');
});

test('all twelve genuine coastal-care survivors reach the native river request without added recruits or a reduced roster',t=>{
 const start=fixture(),{campaign:c}=preparation(start);assert.deepEqual(sorted(c.pendingBattle.squad.map(u=>u.id)),sorted(living(start)));
 t.diagnostic('Exact twelve-person admission, paid rest, finite rifles/dressings and three actual guns; no twelve-person native victory claim.');
});

test('four normally paid veterans join the genuine twelve survivors and win the exact native two-front river battle with commander withdrawal and saved settlement',t=>{
 const start=fixture(),{campaign:ready,events}=preparation(start,4),field=ready.pendingBattle.squad.map(u=>u.id),result=fightNorthernSector(ready,'santa_fe',{deploy:deployRiverInfantry,controller:riverInfantryOrder}),c=result.campaign;
 const bookings=events.find(e=>e.event==='createdRiverAssaultReady').events.filter(e=>e.action.type==='recruitCivic');assert.equal(bookings.length,4);assert.equal(bookings.reduce((sum,e)=>sum+e.cost,0),343);
 assert.equal(result.summary.status,'victory');assert.deepEqual([result.summary.turns,result.summary.actions,result.summary.elapsedSeconds],[10,275,355]);assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[1806,1057,198933]);
 assert.deepEqual(sorted(field.filter(id=>!c.operativeState[id].alive)),[5,9,121,127,133,146]);assert.equal(c.operativeState[57].alive,true);assert.equal(c.operativeState[57].hp,88);assert.equal(c.operativeState[57].location,'san_nicolas');
 assert.equal(c.sectors.santa_fe.owner,'patriot');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);retainedDeaths(start,c);
 assert.deepEqual(c.sectorStates.santa_fe.artillery.map(g=>g.id).sort(),ready.pendingBattle.artillery.map(g=>g.id).sort());assert.ok(c.sectorStates.santa_fe.artillery.every(g=>!g.loaded&&g.ammo===0));
 assert.deepEqual(saved(c),c);
 // Official save envelopes include a wall-clock savedAt timestamp. Pin the
 // complete deterministic campaign state after the required roundtrip.
 assert.equal(sha(JSON.stringify(c)),'29a7d1a2ea85307538ae56e55d8ee88ff180b0896ab307cbc8a79814d68f5fec');
 t.diagnostic(JSON.stringify({scope:'Genuine finite river preparation and exact native replay/settlement; full ending/48h remain open',field:16,wages:343,turns:10,orders:275,seconds:355,commander:'san_nicolas',priorDeathsRetained:true,officialSave:true}));
});
