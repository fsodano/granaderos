import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {santaFeBatteryOrder,humahuacaBatteryOrder} from './coastal-command-driver.mjs';

test('returning battery uses its living replacement and own cannon among persisted bodies and enemy guns',()=>{
 const battle=createBattle([{id:'1000',x:2,y:3},{id:'2',x:0,y:0,hp:0}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[
   {id:'captured',type:'swivel',side:'enemy',x:12,y:8,loaded:true,ammo:6},
   {id:'field-piece',type:'swivel',side:'player',x:3,y:3,loaded:true,ammo:6},
  ],
 });
 const officer=battle.units.find(u=>u.id==='1000');
 const action=santaFeBatteryOrder(battle,officer);
 assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'field-piece');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);
 assert.notDeepEqual(next.artillery.find(g=>g.id==='field-piece'),battle.artillery.find(g=>g.id==='field-piece'));
 assert.deepEqual(next.artillery.find(g=>g.id==='captured'),battle.artillery.find(g=>g.id==='captured'));
 assert.equal(next.units.find(u=>u.id==='2').hp,0);
});

test('heavy battery assistant stays with the gun through consecutive exploration steps',()=>{
 let battle=createBattle([{id:'1000',x:2,y:3},{id:'139',x:3,y:4},{id:'144',x:1,y:3}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:6}],
 });
 for(let step=0;step<2;step++){
  assert.equal(humahuacaBatteryOrder(battle,battle.units.find(u=>u.id==='139')),null);
  const action=humahuacaBatteryOrder(battle,battle.units.find(u=>u.id==='1000'));
  assert.equal(action?.type,'artilleryMove');
  const next=actBattle(battle,action);assert.equal(next.lastError,null);battle=next;
  const gun=battle.artillery[0],helper=battle.units.find(u=>u.id==='139');
  assert.ok(Math.hypot(helper.x-gun.x,helper.y-gun.y)<=1.5);
 }
});

test('a knocked-down gunner stands before the battery can issue gun orders',()=>{
 const battle=createBattle([{id:'1000',x:2,y:3,stance:'prone',knockedDown:true},{id:'139',x:3,y:4}],{
  width:20,height:12,exploration:true,enemies:[],artillery:[{id:'heavy',type:'bronze4',side:'player',x:3,y:3,loaded:true,ammo:6}],
 });
 const action=humahuacaBatteryOrder(battle,battle.units[0]);
 assert.equal(action?.type,'stance');assert.equal(action.stance,'standing');
 const next=actBattle(battle,action);assert.equal(next.lastError,null);assert.equal(Boolean(next.units[0].knockedDown),false);
});
