import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {prepareFreshLosPatosAssault,completeFreshAndesPreparation} from './fresh-mountain-route.mjs';
import {createdLosPatosBattery} from './created-los-patos-battery.mjs';
import {fightNorthernSector} from './northern-route.mjs';

const name='earned-stock-before-flanked-los-patos',file=suffix=>readFileSync(new URL(`./fixtures/${name}.${suffix}`,import.meta.url)),proof=JSON.parse(file('provenance.json')),gzip=file('save.json.gz'),raw=gunzipSync(gzip),sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
const input=()=>decodeSave(raw.toString()).campaign,batteryIds=['arsenal:ensenada:1','arsenal:ensenada:2'],fieldCount=16,clock=c=>c.hour*3600+(c.secondOfHour??0);
let prepared;

test('the earned stock army pays for three real mountain approaches and a supplied physician in every actual column',t=>{
 const start=input(),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour],proof.clock);assert.equal(start.resources.treasury,proof.treasury);
 const end=prepareFreshLosPatosAssault(start,{batteryIds,fieldCount,report:event=>{const{campaign,battle,...receipt}=event;events.push(receipt);}});prepared=end;
 const manifest=end.pendingBattle.assaultSquads;assert.deepEqual(manifest.map(q=>q.members.length),[6,6,4]);assert.deepEqual(manifest.map(q=>q.origin),['uspallata','cell-3-23','cell-3-25']);
 assert.equal(end.pendingBattle.squad.length,16);assert.equal(new Set(end.pendingBattle.squad.map(u=>u.id)).size,16);
 for(const[groupIndex,group]of manifest.entries()){
  const doctor=[146,107,122][groupIndex],issued=end.pendingBattle.squad.find(u=>u.id===doctor);assert.ok(group.members.includes(doctor));assert.ok(issued.medical>=60);assert.equal(issued.medkits,5);
  assert.ok(group.members.every(id=>end.pendingBattle.squad.find(u=>u.id===id).entryEdge===['E','N','S'][groupIndex]));
 }
 const flanks=events.filter(e=>e.event==='mountainFlankApproach');assert.equal(flanks.length,2);assert.deepEqual(flanks.map(e=>e.origin),['cell-3-23','cell-3-25']);
 assert.deepEqual(flanks.map(e=>(e.after.hour*3600+e.after.second-e.before.hour*3600-e.before.second)/3600),[14,12]);
 assert.equal(end.pendingBattle.squad.some(u=>u.id===2),false);assert.equal(end.operativeState[2].location,'mendoza');assert.equal(end.operativeState[2].alive,true);assert.equal(end.operativeState[2].hp,start.operativeState[2].hp);
 for(const gun of start.artilleryDepots.mendoza)assert.deepEqual(end.artilleryDepots.mendoza.find(g=>g.id===gun.id),gun,'The rear bronze battery keeps every actual remaining charge.');
 assert.deepEqual(end.pendingBattle.artillery.map(g=>({id:g.id,loaded:g.loaded,ammo:g.ammo})),[{id:batteryIds[0],loaded:false,ammo:4},{id:batteryIds[1],loaded:false,ammo:0}]);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}
 assert.ok(events.some(e=>e.event==='freshRouteRenewal'&&e.price>0));assert.ok(clock(end)>clock(start));assert.ok(end.resources.treasury>=0&&end.resources.treasury<start.resources.treasury);
 const battle=enterSector(end.pendingBattle,end.sectorStates.los_patos);assert.deepEqual(decodeSave(encodeSave(end,battle)),{campaign:end,battle});assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:proof.scope,fieldCount,origins:manifest.map(q=>q.origin),doctors:[146,107,122],flankHours:[14,12],engineerAtHome:2,clock:[end.hour,end.secondOfHour],treasury:end.resources.treasury,exactPaidArrivalSave:true}));
});

test('the actual flanked stock force wins Los Patos, preserves its casualty and completes finite care, return and the physical commander meeting',t=>{
 assert.ok(prepared);const before=structuredClone(prepared),events=[],report=event=>{const{campaign,battle,...receipt}=event;events.push(receipt);};
 const result=fightNorthernSector(prepared,'los_patos',{...createdLosPatosBattery({gunTypes:['field8','swivel'],fieldCount,report}),report}),won=result.campaign;
 assert.equal(result.summary.status,'victory');assert.equal(result.summary.turns,7);assert.equal(result.summary.actions,295);assert.equal(result.summary.elapsedSeconds,657);
 const losses=result.summary.units.filter(u=>u.side==='player'&&u.hp===0).map(u=>Number(u.id));assert.deepEqual(losses,[143]);assert.equal(won.operativeState[143].alive,false);assert.equal(won.sectors.los_patos.owner,'patriot');assert.equal(won.defeated,false);
 const end=completeFreshAndesPreparation(won,{report}),handover=events.find(e=>e.event==='andesCommandHandover');assert.ok(handover);assert.equal(handover.envoy,0);
 assert.equal(end.phase,4);assert.equal(end.sectors.los_patos.fort,1);assert.equal(end.operativeState[2].alive,true);assert.equal(end.operativeState[2].location,'mendoza');assert.ok(end.recruited.includes(57));assert.equal(end.operativeState[57].alive,true);assert.equal(end.operativeState[57].location,'mendoza');
 assert.equal(end.contracts[57].expiresAt,null);assert.equal(end.contracts[57].paid,0);assert.ok(end.squad.includes(57));
 for(const id of prepared.pendingBattle.squad.map(u=>u.id).filter(id=>!losses.includes(id))){assert.equal(end.operativeState[id].alive,true);assert.equal(end.operativeState[id].location,'mendoza');assert.ok(end.operativeState[id].hp>=15);assert.equal(end.operativeState[id].bleeding,0);}
 for(const[id,r]of Object.entries(prepared.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}
 for(const[id,index]of batteryIds.map((id,index)=>[id,index])){const gun=Object.values(end.sectorStates).flatMap(s=>s.artillery??[]).find(g=>g.id===id)??Object.values(end.artilleryDepots).flat().find(g=>g.id===id);assert.ok(gun);assert.equal(gun.loaded,index===0);assert.equal(gun.ammo,0);assert.equal(storedArtilleryRecord(gun).id,id);assert.equal(Number(prepared.pendingBattle.artillery[index].loaded)+prepared.pendingBattle.artillery[index].ammo-Number(gun.loaded)-gun.ammo,index===0?3:0,'The actual three field shots retain one unspent loaded charge.');}
 assert.equal(end.completed,false);assert.equal(end.pendingBattle,null);assert.equal(end.pendingEncounter,null);assert.equal(end.blockade,true,'The real later naval blockade is still an unresolved ending requirement.');
 assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);assert.deepEqual(prepared,before);assert.deepEqual([end.hour,end.secondOfHour],[1025,747]);assert.equal(end.resources.treasury,62713);
 t.diagnostic(JSON.stringify({scope:'Earned mountain assault/care/return/commander only; no fresh ending or blockade victory claim',turns:7,actions:295,fieldSeconds:657,losses,envoy:handover.envoy,clock:[end.hour,end.secondOfHour],treasury:end.resources.treasury,finiteChargesUsed:3,retainedCharges:1,exactNativeReplay:true}));
});
