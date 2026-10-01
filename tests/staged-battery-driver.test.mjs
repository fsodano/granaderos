import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController} from './stable-crew-driver.mjs';

test('three crowded arrival guns advance with real crews without overlapping living bodies',()=>{
 const initial=createBattle([
  {id:'5',x:12,y:0},{id:'120',x:11,y:0},{id:'123',x:13,y:0},
  {id:'111',x:10,y:0},{id:'133',x:14,y:0},{id:'3',x:9,y:0},
 ],{
  width:24,height:20,exploration:true,enemies:[],
  tiles:Array.from({length:480},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass'})),
  artillery:[12,11,13].map((x,i)=>({id:`piece-${i}`,type:'bronze4',side:'player',x,y:1,loaded:true,ammo:6})),
 });
 const before=structuredClone(initial),controller=stagedBatteryController();
 let battle=initial;const actions=[];
 for(let step=0;step<12;step++){
  const action=battle.units.map(unit=>controller(battle,unit)).find(Boolean);
  assert.ok(action,'a legal crew must clear the crowded arrival lane');
  const next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);
  const cells=next.units.filter(u=>u.hp>0).map(u=>`${u.x},${u.y}`);
  assert.equal(new Set(cells).size,cells.length,'living crew members cannot occupy the same cell');
  actions.push(action);battle=next;
 }
 assert.ok(battle.artillery.every(g=>g.y>1),'all three guns leave the arrival row');
 assert.ok(battle.artillery.every(g=>g.loaded&&g.ammo===6),'movement does not invent or spend shells');
 let replay=initial;const replayController=stagedBatteryController();
 for(const action of actions){
  assert.deepEqual(replay.units.map(unit=>replayController(replay,unit)).find(Boolean),action);
  replay=actBattle(replay,action);
 }
 assert.deepEqual(replay,battle);assert.deepEqual(initial,before);
});

test('a gun crew keeps a usable stance while waiting instead of spending AP in a stance loop',()=>{
 let battle=createBattle([{id:'3',x:4,y:5},{id:'5',x:5,y:5}],{
  width:40,height:16,enemies:[{id:'distant',x:37,y:8}],
  tiles:Array.from({length:640},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass'})),
  artillery:[{id:'gun',type:'bronze4',side:'player',x:4,y:4,loaded:true,ammo:6}],
 });
 const controller=stableCrewController();
 for(const id of ['3','5']){
  const unit=battle.units.find(u=>u.id===id),action=controller(battle,unit);
  assert.deepEqual(action,{type:'stance',unitId:id,stance:'crouched'});
  battle=actBattle(battle,action);assert.equal(battle.lastError,null);
 }
 const before=structuredClone(battle);
 for(const unit of battle.units.filter(u=>u.side==='player'))assert.equal(controller(battle,unit),null);
 assert.deepEqual(battle,before);
});
