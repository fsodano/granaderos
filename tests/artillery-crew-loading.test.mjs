import {partiallyLoadedBattery} from './artillery-loading-fixture.mjs';
import {secondaryRetreat} from './secondary-loot-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,endTurn,artilleryReloadPreview} from '../game/tactical.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {crewField} from './artillery-crew-fixture.mjs';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
import {enterSector} from '../game/world.js';
const preview=b=>artilleryReloadPreview(b,b.units[0],b.artillery[0]);
const load=b=>actBattle(b,{type:'artilleryReload',unitId:b.units[0].id,artilleryId:b.artillery[0].id});

test('wounded crews complete an actual heavy reload across turns with 75 AP per person and one finite shot',()=>{
 let b=crewField('field8',{wounded:true}),steps=0;const spent=[0,0,0];
 while(!b.artillery[0].loaded&&steps<8){const p=preview(b),before=structuredClone(b);assert.equal(p.valid,true);b=load(b);assert.equal(b.lastError,null);for(let i=0;i<3;i++)spent[i]+=before.units[i].ap-b.units[i].ap;assert.equal(b.artillery[0].ammo+Number(b.artillery[0].loaded),3);b=validateBattleSnapshot(b);steps++;if(!b.artillery[0].loaded)b=endTurn(b);}
 assert.ok(steps>1&&steps<8);assert.deepEqual(spent,[75,75,75]);assert.equal(b.artillery[0].ammo,2);assert.equal(b.artillery[0].reloadProgress,undefined);
});
test('the least available assigned helper limits the shared UI quote and actual loading step',()=>{
 const b=crewField();[50,20,35].forEach((ap,i)=>b.units[i].ap=ap);const p=preview(b);assert.equal(p.pa,20);assert.equal(p.remainingPA,55);assert.equal(p.partial,true);const d=orderDescriptors(b,b.units[0],{cannonId:'gun'}).find(d=>d.id==='artilleryReload');assert.equal(d.pa,20);assert.equal(d.disabled,false);
 const next=load(b);assert.equal(next.lastError,null);assert.deepEqual(next.units.slice(0,3).map(u=>u.ap),[30,0,15]);assert.equal(next.artillery[0].ammo,3);assert.equal(next.artillery[0].reloadProgress,20/75);
});
test('spare helpers preserve the exhausted extra member and replacements retain actual work on the gun',()=>{
 let b=crewField('bronze4');b.units[0].ap=20;b.units[1].ap=1;assert.deepEqual(preview(b).crew,['20','22']);b=load(b);assert.equal(b.lastError,null);assert.equal(b.units[1].ap,1);assert.equal(b.artillery[0].reloadProgress,1/3);
 b=endTurn(b);const before=b.units.map(u=>u.ap),next=actBattle(b,{type:'artilleryReload',unitId:'21',artilleryId:'gun'});assert.equal(next.lastError,null);assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,2);assert.equal(before[1]-next.units[1].ap,40);assert.equal(next.artillery[0].reloadProgress,undefined);
});
test('a replacement specialist applies its authored ability to remaining work without resetting the fraction',()=>{
 let b=crewField('bronze4');b.units[0].abilities=[];b.units[1].abilities=['artillery_loading'];b.units[2].abilities=[];b.units[0].ap=20;b=load(b);assert.equal(b.artillery[0].reloadProgress,1/3);b=endTurn(b);
 const p=artilleryReloadPreview(b,b.units[1],b.artillery[0]);assert.equal(p.rate,48);assert.equal(p.pa,32);const next=actBattle(b,{type:'artilleryReload',unitId:'21',artilleryId:'gun'});assert.equal(next.lastError,null);assert.equal(next.artillery[0].loaded,true);assert.equal(next.artillery[0].ammo,2);
});
test('crew authority, stance, capacity and blocked contact agree between controls and all artillery orders',()=>{
 for(const change of [b=>b.units[1].militia=true,b=>b.units[1].energy=0,b=>b.units[1].hp=14,b=>b.units[1].mounted=true,b=>b.units[1].stance='prone',b=>b.units[1].knockedDown=true,b=>b.units[1].fled=true,b=>b.units[1].departure=true,b=>b.units[1].ap=0,b=>b.phase='enemy',b=>Object.assign(b.tiles.find(t=>t.x===2&&t.y===2),{blocked:true,blocksSight:true})]){
  const b=crewField();change(b);assert.equal(preview(b).valid,false);const d=orderDescriptors(b,b.units[0],{cannonId:'gun'}).find(d=>d.id==='artilleryReload');assert.equal(d.disabled,true);const n=load(b);assert.ok(n.lastError);assert.deepEqual(n.artillery,b.artillery);
 }
 const b=crewField('bronze4');b.units[1].militia=true;b.units[2].militia=true;b.artillery[0].loaded=true;
 for(const type of ['artillery','artilleryMove','artilleryPivot']){const n=actBattle(b,{type,unitId:'20',artilleryId:'gun',x:type==='artilleryMove'?3:8,y:3});assert.ok(n.lastError);assert.deepEqual(n.artillery,b.artillery);assert.deepEqual(n.units.map(u=>u.ap),b.units.map(u=>u.ap));}
});
test('dragging and pivoting retain unfinished work and only the assigned crew pays',()=>{
 let b=crewField('bronze4');b.units[0].ap=20;b=load(b);b=endTurn(b);const progress=b.artillery[0].reloadProgress,extra=b.units[2].ap;
 b=actBattle(b,{type:'artilleryMove',unitId:'20',artilleryId:'gun',x:3,y:3});assert.equal(b.lastError,null);assert.equal(b.artillery[0].reloadProgress,progress);assert.equal(b.units[2].ap,extra);
 b=actBattle(b,{type:'artilleryPivot',unitId:'20',artilleryId:'gun',x:8,y:3});assert.equal(b.lastError,null);assert.equal(b.artillery[0].reloadProgress,progress);assert.equal(b.units[2].ap,extra);assert.ok(actBattle(b,{type:'artillery',unitId:'20',artilleryId:'gun',x:8,y:3}).lastError);
});
test('peaceful simultaneous crew work spends elapsed seconds once without requiring or subtracting combat AP',()=>{
 let b=crewField('field8',{exploration:true});for(const u of b.units){u.ap=0;u.weaponReady=true;}const start=b.elapsedSeconds,p=preview(b);assert.equal(p.valid,true);assert.equal(p.pa,75);b=load(b);assert.equal(b.lastError,null);assert.equal(b.elapsedSeconds-start,5);assert.ok(b.units.every(u=>u.ap===0&&!u.weaponReady));assert.equal(b.artillery[0].ammo,2);assert.equal(b.artillery[0].loaded,true);
 const n=actBattle(b,{type:'artillery',unitId:'20',artilleryId:'gun',x:8,y:3});assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds-b.elapsedSeconds,3);assert.ok(n.units.every(u=>u.ap===0));assert.equal(n.artillery[0].loaded,false);
});
test('invalid saved work, loaded guns and exhausted ammunition reject without resetting existing work',()=>{
 for(const progress of [0,1,-.2,2,NaN,Infinity,'0.5',null,{}]){const b=crewField();b.artillery[0].reloadProgress=progress;assert.throws(()=>validateBattleSnapshot(b));}
 const b=crewField();b.artillery[0].reloadProgress=.5;b.artillery[0].loaded=true;assert.throws(()=>validateBattleSnapshot(b));b.artillery[0].loaded=false;b.artillery[0].ammo=0;assert.match(preview(b).reason,/municiones/);const n=load(b);assert.ok(n.lastError);assert.equal(n.artillery[0].reloadProgress,.5);
});
test('a real issued finite gun spends shots and partial work, saves the paired campaign and retains the fraction on withdrawal and reentry',()=>{
 let p=partiallyLoadedBattery();let s=p.campaign;const r=s.pendingBattle,id=p.battle.units[0].id,gun=p.battle.artillery[0].id,progress=p.battle.artillery[0].reloadProgress;assert.equal(p.battle.artillery[0].reloadProgress,progress);
 const resumed=endTurn(p.battle),quote=artilleryReloadPreview(resumed,resumed.units.find(u=>u.id===id),resumed.artillery[0]),complete=actBattle(resumed,{type:'artilleryReload',unitId:id,artilleryId:gun});assert.equal(complete.lastError,null);assert.ok(quote.pa<35);assert.equal(complete.artillery[0].ammo,4);assert.equal(complete.artillery[0].loaded,true);assert.ok(saved(sync({campaign:p.campaign,battle:complete})));
 p=secondaryRetreat(saved(sync({campaign:p.campaign,battle:endTurn(p.battle)})));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(s.sectorStates.san_nicolas.artillery[0].reloadProgress,progress);s=order(saved({campaign:s}).campaign,{type:'attack',sector:'san_nicolas'});const returned=enterSector(s.pendingBattle,s.sectorStates.san_nicolas);assert.equal(returned.artillery[0].reloadProgress,progress);assert.equal(returned.artillery[0].side,'enemy');assert.ok(saved({campaign:s,battle:returned}));
 for(const edit of [g=>delete g.reloadProgress,g=>g.reloadProgress=.99,g=>g.facing=Math.PI]){const bad=structuredClone(s);edit(bad.pendingBattle.artillery[0]);assert.throws(()=>saved({campaign:bad,battle:returned}));}
});
test('an actual emplaced gun exhausts its issued ammunition through seven peaceful shots and six reloads with synchronized saves',()=>{
 let p=visit(wonBattery());const initial=p.battle.artillery[0],identity=initial.id;assert.equal(initial.ammo,6);for(let shot=0;shot<7;shot++){
  p=fireStationed(p);assert.equal(p.battle.artillery[0].id,identity);assert.equal(p.battle.artillery[0].ammo,6-shot);
  if(shot<6){const gun=p.battle.artillery[0],actor=p.battle.units.find(u=>u.side==='player'&&u.hp>=15&&!u.routed&&Math.hypot(u.x-gun.x,u.y-gun.y)<=1.5),b=actBattle(p.battle,{type:'artilleryReload',unitId:actor.id,artilleryId:gun.id});assert.equal(b.lastError,null);p=saved(sync({campaign:p.campaign,battle:b}));}
 }
 const empty=p.battle.artillery[0];assert.equal(empty.ammo,0);assert.equal(empty.loaded,false);const returned=visit(saved({campaign:leave(p)}).campaign);assert.equal(returned.battle.artillery[0].id,identity);assert.equal(returned.battle.artillery[0].ammo,0);assert.equal(returned.battle.artillery[0].loaded,false);
});
