import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,artilleryContact} from '../game/tactical.js';
import {recoveryMendozaCrew,recoveryMendozaOrder} from './recovery-mendoza-driver.mjs';

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

test('Mendoza routes the gun and both crew around a closed native edge without repeating a rejected advance',()=>{
 const initial=crewScene([{id:'1',x:4,y:3},{id:'0',x:5,y:2}]);
 initial.wallEdges=Array.from({length:5},(_,y)=>({id:`crew-wall-${y}`,x:6,y,axis:'y',type:'wall',blocked:true,blocksSight:true}));
 const before=structuredClone(initial),direct={type:'artilleryMove',unitId:'1',artilleryId:'finite-gun',x:6,y:3};
 assert.ok(actBattle(initial,direct).lastError,'all three open destination cells still require legal edge crossings');
 let battle=initial;
 for(let step=0;step<12&&battle.artillery[0].x<7;step++){
  const action=recoveryMendozaOrder(battle,battle.units.find(unit=>unit.id==='1'));
  assert.equal(action?.type,'artilleryMove');
  const gun=battle.artillery[0],offsets=battle.units.map(unit=>[unit.id,unit.x-gun.x,unit.y-gun.y]),next=actBattle(battle,action);
  assert.equal(next.lastError,null);assert.equal(next.elapsedSeconds,battle.elapsedSeconds+2);
  assert.deepEqual(next.units.map(unit=>[unit.id,unit.x-next.artillery[0].x,unit.y-next.artillery[0].y]),offsets);
  assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,1);battle=next;
 }
 assert.ok(battle.artillery[0].x>=7,'the finite battery must complete its physical detour');
 assert.deepEqual(battle.wallEdges,initial.wallEdges);assert.deepEqual(initial,before);
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
