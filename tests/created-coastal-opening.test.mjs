import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './created-coastal-opening-driver.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,teamCanSee} from '../game/tactical.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';

test('the funded created squad earns its coastal opening through observed targets and replayable finite orders',()=>{
 const reachedOpening=new Error('verified opening checkpoint');let request,previous,result,settled;
 assert.throws(()=>freshCoastalRoute('created',{
  fightOpening:(deployment,prior)=>{request=structuredClone(deployment);previous=prior;return result=fight(deployment,prior);},
  onCheckpoint:(sector,campaign)=>{if(sector==='buenos_aires'){settled=campaign;throw reachedOpening;}},
 }),error=>error===reachedOpening);
 assert.equal(result.battle.status,'victory');assert.equal(settled.sectors.buenos_aires.owner,'patriot');assert.equal(settled.pendingBattle,null);
 const players=result.battle.units.filter(unit=>unit.side==='player');
 assert.equal(players.length,request.squad.length);assert.ok(players.some(unit=>unit.hp>0&&unit.hp<unit.maxHp));
 assert.ok(result.orders.some(order=>order.type==='move'));assert.ok(result.orders.some(order=>order.type==='reload'));
 let replay=enterSector(request,previous),shots=0;
 const beforeRounds=replay.units.filter(unit=>unit.side==='player').reduce((sum,unit)=>sum+Object.values(unitAmmunitionByType(unit)).reduce((total,count)=>total+count,0),0);
 for(const order of result.orders){
  if(order.type==='fire'){
   const target=replay.units.find(unit=>unit.id===order.targetId);assert.ok(target);assert.equal(target.side,'enemy');
   assert.equal(teamCanSee(replay,'player',target),true,'a hidden enemy cannot select the next shot');shots++;
  }
  replay=order.type==='endTurn'?endTurn(replay):actBattle(replay,order);assert.equal(replay.lastError,null,JSON.stringify(order));
 }
 assert.ok(shots>0);assert.deepEqual(replay.units,result.battle.units);assert.equal(replay.seed,result.battle.seed);assert.equal(replay.elapsedSeconds,result.battle.elapsedSeconds);
 const afterRounds=players.reduce((sum,unit)=>sum+Object.values(unitAmmunitionByType(unit)).reduce((total,count)=>total+count,0),0);
 assert.ok(afterRounds<beforeRounds,'the real assault consumes its finite ammunition');
});
