import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave} from '../game/save.js';
import {createBattle,actBattle,artilleryContact} from '../game/tactical.js';
import {recoveryMendozaCrew,recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';
import {prepareFreshCuyoDefense,prepareFreshMendozaAssault} from './fresh-cuyo-route.mjs';
import {enterSector} from '../game/world.js';

// Declared flat unit scenarios isolate crew assignment and paid movement.
// They do not claim a campaign victory or create a campaign casualty.
const crewScene=units=>createBattle(units,{
 width:20,height:12,tiles:Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass'})),
 exploration:true,enemies:[],artillery:[{id:'finite-gun',type:'bronze4',side:'player',x:5,y:3,loaded:true,ammo:1}],
});

test('Mendoza retains the original capable commander and helper instead of replacing them with a closer infantryman',()=>{
 const battle=crewScene([{id:'1',x:4,y:3},{id:'0',x:5,y:2},{id:'8',x:6,y:3}]);
 const before=structuredClone(battle);
 assert.deepEqual(recoveryMendozaCrew(battle,battle.units[0],battle.artillery[0]),{leaderId:'1',helperId:'0'});
 const action=recoveryMendozaOrder(battle,battle.units[0]);assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'finite-gun');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);assert.ok(next.elapsedSeconds>battle.elapsedSeconds);
 assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,1);assert.deepEqual(battle,before);
});

test('a real missing commander role is replaced by living local crew while a declared dead body remains unchanged',()=>{
 const battle=crewScene([{id:'1',x:2,y:1,hp:0},{id:'0',x:4,y:3},{id:'8',x:5,y:2},{id:'100',x:2,y:6}]);
 const lead=battle.units.find(u=>u.id==='0'),before=structuredClone(battle);
 assert.deepEqual(recoveryMendozaCrew(battle,lead,battle.artillery[0]),{leaderId:'0',helperId:'8'});
 const action=recoveryMendozaOrder(battle,lead);assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'finite-gun');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 for(const id of ['0','8'])assert.equal(artilleryContact(next,next.units.find(u=>u.id===id),next.artillery[0]),true);
 assert.deepEqual(next.units.find(u=>u.id==='1'),battle.units.find(u=>u.id==='1'));
 assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,1);
 assert.equal(next.elapsedSeconds,battle.elapsedSeconds+2,'the engine charges the ordinary exploration crew-work time');assert.deepEqual(battle,before);
 assert.deepEqual(actBattle(structuredClone(battle),action),next,'the exact paid order replays without mutable crew jobs');
});

test('Mendoza assignment excludes incapacitated or non-ground crew without changing their bodies',()=>{
 const battle=crewScene([{id:'1',x:4,y:3,hp:14},{id:'0',x:5,y:2},{id:'8',x:6,y:3},{id:'100',x:2,y:6}]);
 const before=structuredClone(battle),lead=battle.units.find(u=>u.id==='0');
 assert.deepEqual(recoveryMendozaCrew(battle,lead,battle.artillery[0]),{leaderId:'0',helperId:'8'});
 // A declared selection-only roof/rout state has no applied tactical orders.
 const unavailable={...battle,units:battle.units.map(u=>u.id==='8'?{...u,tacticalLevel:1}:u.id==='100'?{...u,routed:true}:u)};
 assert.deepEqual(recoveryMendozaCrew(unavailable,lead,battle.artillery[0]),{leaderId:'0',helperId:'none'});
 assert.deepEqual(battle,before);
});

test('the earned Mendoza preparation with permanent Salta losses selects only its actual living crew',()=>{
 const raw=gunzipSync(readFileSync(new URL('./fixtures/cuyo-northern-real-losses.save.json.gz',import.meta.url)));
 const proof=JSON.parse(readFileSync(new URL('./fixtures/cuyo-northern-real-losses.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),proof.sha256);
 const original=decodeSave(raw.toString()).campaign,start=structuredClone(original);
 const ready=prepareFreshMendozaAssault(prepareFreshCuyoDefense(start));
 const battle=enterSector(ready.pendingBattle,ready.sectorStates.mendoza),before=structuredClone(battle);
 assert.deepEqual(battle.units.filter(u=>u.side==='player').map(u=>Number(u.id)).sort((a,b)=>a-b),[0,8,10,11,100,102,130,142]);
 assert.equal(ready.operativeState[1].alive,false);assert.equal(battle.units.some(u=>u.id==='1'&&u.hp>=15),false);
 const gun=battle.artillery.find(g=>g.side==='player'),leader=battle.units.find(u=>u.id==='0');
 assert.deepEqual(recoveryMendozaCrew(battle,leader,gun),{leaderId:'0',helperId:'8'});
 for(const id of proof.priorDeadIds)assert.equal(ready.operativeState[id].alive,false);
 assert.deepEqual(battle,before);assert.deepEqual(start,original);
 // This is preparation and assignment evidence. No native battle, health
 // patch, ammunition refill or victory outcome is applied by this test.
});
