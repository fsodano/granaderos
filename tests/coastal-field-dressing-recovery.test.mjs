import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,hasLineOfSight} from '../game/tactical.js';
import {sameSurface} from '../game/tactical-space.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {firstAidPlan} from '../game/first-aid.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {recoverCoastalFieldDressing} from './fresh-coastal-fixture.mjs';

// Prepared postcombat controls. The separate earned-state receipt uses the
// untouched seed-8 route capture; these small cases exercise source selection.
function field({friendlyDressings=0,enemyDressings=1,carried=0,wall=false}={}){
 const width=12,height=7;
 return createBattle([
  {id:'57',name:'Comandante',x:1,y:2,facing:2,hp:33,bleeding:4,bandaged:0,medical:50,medkits:carried,missionAlly:true},
  {id:'fallen-patriot',x:8,y:3,hp:0,medkits:friendlyDressings},
 ],{width,height,seed:8,exploration:true,props:[],enemies:[{id:'fallen-defender',x:8,y:2,hp:0,medkits:enemyDressings}],
  tiles:Array.from({length:width*height},(_,index)=>({x:index%width,y:Math.floor(index/width),type:wall&&index%width===4?'wall':'grass',blocked:wall&&index%width===4,blocksSight:wall&&index%width===4,cover:0})),
 });
}
const actor=battle=>battle.units.find(unit=>unit.id==='57');
const pool=battle=>battle.units.reduce((sum,unit)=>sum+unit.medkits,0);
const restored=battle=>validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
const replay=(start,orders)=>orders.reduce((battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action));return next;},start);

test('postcombat care recovers one finite enemy dressing when friendly remains have none, then replays saved treatment',()=>{
 const start=field(),input=structuredClone(start),source=start.units.find(unit=>unit.id==='fallen-defender'),before=actor(start),deaths=start.units.filter(unit=>unit.hp===0).map(unit=>unit.id).sort();
 const recovered=recoverCoastalFieldDressing(start);assert.deepEqual(start,input);
 assert.deepEqual(recovered.recovery,{doctorId:'57',sourceId:source.id,sourceSide:'enemy',dressings:1});
 assert.equal(recovered.orders.length,2);assert.equal(recovered.orders[0].type,'move');
 assert.deepEqual(recovered.orders[1],{type:'loot',unitId:'57',targetId:source.id,item:'medkits',count:1});
 const point=getReachable(start,before).find(point=>point.x===recovered.orders[0].x&&point.y===recovered.orders[0].y&&sameSurface(point,source));
 assert.ok(point?.cost>0);assert.ok(hasLineOfSight(start,point,source));
 assert.equal(pool(recovered.battle),pool(start),'pickup transfers the existing dressing without adding one');
 assert.equal(recovered.battle.units.find(unit=>unit.id===source.id).medkits,source.medkits-1);assert.equal(actor(recovered.battle).medkits,1);
 assert.ok(actor(recovered.battle).energy<before.energy);assert.ok(recovered.battle.elapsedSeconds>start.elapsedSeconds);assert.equal(actor(recovered.battle).ap,before.ap,'exploration charges elapsed time instead of combat AP');
 const checkpoint=restored(recovered.battle),plan=firstAidPlan(actor(checkpoint),actor(checkpoint)),aid=autoBandageBattle(checkpoint);
 assert.equal(plan.valid,true);assert.equal(plan.dressingsUsed,1);assert.equal(aid.stoppedReason,null);assert.deepEqual(aid.treatedIds,['57']);
 assert.equal(actor(aid.battle).hp,plan.hpAfter);assert.equal(actor(aid.battle).hp,actor(checkpoint).hp,'ordinary bandaging cannot restore health lost during the actual approach');
 assert.ok(actor(checkpoint).hp<before.hp,'the bleeding survivor pays the real approach time before treatment');
 assert.equal(actor(aid.battle).bleeding,0);assert.equal(actor(aid.battle).medkits,0);assert.equal(pool(aid.battle),pool(start)-1);
 assert.deepEqual(aid.battle.units.filter(unit=>unit.hp===0).map(unit=>unit.id).sort(),deaths);
 assert.deepEqual(restored(aid.battle),restored(replay(start,[...recovered.orders,...aid.steps])),'all approach, pickup and finite care orders replay through the tactical save');
 assert.deepEqual(start,input);
});

test('friendly remains still supply an actual finite dressing through the same ordinary orders',()=>{
 const start=field({friendlyDressings:1,enemyDressings:0}),recovered=recoverCoastalFieldDressing(start);
 assert.equal(recovered.recovery.sourceId,'fallen-patriot');assert.equal(recovered.recovery.sourceSide,'player');
 assert.equal(actor(recovered.battle).medkits,1);assert.equal(recovered.battle.units.find(unit=>unit.id==='fallen-patriot').medkits,0);assert.equal(pool(recovered.battle),pool(start));
 assert.deepEqual(recovered.battle,replay(start,recovered.orders));
});

test('an already supplied medic keeps the original issue without collecting an extra dressing',()=>{
 const start=field({carried:1}),result=recoverCoastalFieldDressing(start);
 assert.equal(result.battle,start);assert.deepEqual(result.orders,[]);assert.equal(result.recovery,null);assert.equal(pool(result.battle),2);
});

test('missing or inaccessible remains cannot grant dressings or move the input state',()=>{
 for(const start of [field({enemyDressings:0}),field({wall:true})]){
  const input=structuredClone(start);assert.throws(()=>recoverCoastalFieldDressing(start),/physically reach an actual remaining field dressing/);assert.deepEqual(start,input);
 }
});
