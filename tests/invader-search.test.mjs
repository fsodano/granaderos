import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,canSee} from '../game/tactical.js';
import {choosePatrolAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
const field=()=>createBattle([{id:'defender',x:0,y:0}],{width:32,height:32,seed:45,enemies:[{id:'invader',x:24,y:16,patrolOrigin:{x:31,y:16},assaultPatrol:true}],tiles:Array.from({length:1024},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}))});
test('invaders can search beyond their arrival post without reading unseen defender locations',()=>{
 const a=field(),u=a.units.find(u=>u.side==='enemy');assert.equal(canSee(a,u,a.units[0]),false);
 const before=structuredClone(a),order=choosePatrolAction(a,u);assert.equal(order?.type,'move');assert.equal(order.patrol,true);
 const b=structuredClone(a);b.units[0].y=31;assert.equal(canSee(b,u,b.units[0]),false);
 assert.deepEqual(choosePatrolAction(b,b.units.find(u=>u.side==='enemy')),order);assert.deepEqual(a,before);
 assert.ok(Math.hypot(order.x-u.patrolOrigin.x,order.y-u.patrolOrigin.y)>6);
});
test('an invasion search survives saves and still respects a disabled patrol and one bound per turn',()=>{
 const b=validateBattleSnapshot(JSON.parse(JSON.stringify(field()))),u=b.units.find(u=>u.side==='enemy');assert.equal(u.assaultPatrol,true);
 assert.equal(choosePatrolAction(b,{...u,patrol:false}),null);assert.equal(choosePatrolAction(b,{...u,patrolTurn:b.turn}),null);
 const bad=structuredClone(b);bad.units[1].assaultPatrol='yes';assert.throws(()=>validateBattleSnapshot(bad));
});
test('only incoming strategic attackers receive the sector search order',()=>{
 const request={sector:'tucuman',squad:[{id:1000}],enemies:[{id:'test-invader'}]};
 const defense=enterSector({...request,defenseGroupId:'test-group'}),ordinary=enterSector({...request,enemies:[{id:'test-invader',assaultPatrol:true}]});
 assert.equal(defense.units.find(u=>u.side==='enemy').assaultPatrol,true);
 assert.equal(ordinary.units.find(u=>u.side==='enemy').assaultPatrol,undefined);
 assert.ok(defense.units.filter(u=>u.side==='player').every(u=>u.assaultPatrol===undefined));
});
