import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {groupMovementStep,planGroupMove} from '../game/group-movement.js';
import {movementStep} from '../game/movement-step.js';
import {sameCell} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const field=(extra={})=>createBattle([{id:'a',x:1,y:2},{id:'b',x:1,y:3},{id:'c',x:2,y:3}],{width:24,height:10,seed:45,exploration:true,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[],...extra});
const request={unitIds:['a','b','c'],anchorId:'a',x:8,y:2};
function complete(state,action=request){
 let continuation=null,result,steps=0;
 do{
  const before=state,saved=structuredClone(before),prior=continuation;result=groupMovementStep(before,action,prior);
  assert.deepEqual(before,saved,'planning never mutates the paid snapshot');
  const moved=before.units.filter(unit=>unit.side==='player'&&!sameCell(unit,result.state.units.find(other=>other.id===unit.id)));
  assert.ok(moved.length<=1,'only one actor can pay a cell before its animation');
  if(moved.length){
   const entry=result.report.members.find(member=>member.unitId===result.unitId),expected=movementStep(before,{type:'move',unitId:result.unitId,...entry.destination,...(action.movement?{movement:action.movement}:{})},prior?.members[prior.index]?.unitId===result.unitId?prior.route:null);
   assert.deepEqual(result.state,expected.state,'each committed cell uses ordinary time, energy, AP, contact and collision rules');
   steps++;
  }
  assert.equal(new Set(result.state.units.filter(unit=>unit.hp>0).map(unit=>`${unit.x},${unit.y}`)).size,result.state.units.filter(unit=>unit.hp>0).length);
  assert.doesNotThrow(()=>validateBattleSnapshot(result.state));state=result.state;continuation=result.continuation;
  assert.ok(steps<100);
 }while(result.status==='moving');
 return {...result,steps};
}

test('a streamed formation pays only ordinary reached cells and retains its original formation destinations',()=>{
 const start=field(),plan=planGroupMove(start,request),result=complete(start);
 assert.equal(result.status,'completed');assert.ok(result.steps>request.unitIds.length);assert.equal(result.report.actions,result.steps);
 assert.equal(result.report.elapsedSeconds,result.state.elapsedSeconds-start.elapsedSeconds);
 for(const member of plan.members)assert.ok(sameCell(result.state.units.find(unit=>unit.id===member.unitId),member.destination));
 assert.ok(result.state.units.every((unit,index)=>unit.energy<start.units[index].energy));
});

test('an omitted ground level on an elevated map continues with the same paid costs as explicit level zero',()=>{
 const start=field({upperSurfaces:[{id:'platform',x:23,y:9,tacticalLevel:1,type:'floor',kind:'platform',elevation:3,cover:0,blocked:false}]});
 assert.doesNotThrow(()=>validateBattleSnapshot(start));const before=structuredClone(start);
 const first=groupMovementStep(start,request),malformed=groupMovementStep(first.state,{...request,tacticalLevel:null},first.continuation);assert.equal(malformed.status,'invalid');assert.strictEqual(malformed.state,first.state);
 const omitted=complete(start,request),explicit=complete(start,{...request,tacticalLevel:0});
 assert.equal(omitted.status,'completed');assert.equal(omitted.steps,explicit.steps);assert.ok(omitted.steps>request.unitIds.length);
 assert.deepEqual(omitted.state,explicit.state);assert.equal(omitted.state.elapsedSeconds,explicit.state.elapsedSeconds);assert.ok(omitted.state.elapsedSeconds>start.elapsedSeconds);
 for(const unit of omitted.state.units){const other=explicit.state.units.find(u=>u.id===unit.id),original=start.units.find(u=>u.id===unit.id);assert.equal(unit.ap,other.ap);assert.equal(unit.energy,other.energy);assert.ok(unit.energy<original.energy);}
 assert.deepEqual(start,before);
});

test('real contact stops the unpaid formation and leaves other members at their original cells',()=>{
 const start=field({enemies:[{id:'e',x:22,y:2,weapon:1800,marksmanship:0,facing:2}]}),result=complete(start,{...request,x:20});
 assert.equal(result.status,'contact');assert.equal(result.continuation,null);assert.equal(result.state.mode,'combat');
 for(const id of ['b','c'])assert.ok(sameCell(start.units.find(unit=>unit.id===id),result.state.units.find(unit=>unit.id===id)));
 assert.ok(result.report.members.slice(1).every(member=>member.status==='stopped'));
});

test('a member exhausted by paid running stops while the remaining capable formation can finish',()=>{
 const start=field();start.units[0].energy=5;const result=complete(start,{...request,movement:'run'});
 assert.equal(result.status,'partial');assert.equal(result.state.units[0].energy,0);assert.equal(result.state.units[0].unconscious,true);
 assert.equal(result.state.units[0].hp,start.units[0].hp);assert.ok(result.report.members.slice(1).every(member=>member.status==='arrived'));
});

test('discarding a formation continuation replans from paid cells and cannot reissue abandoned movement',()=>{
 const start=field(),first=groupMovementStep(start,request),changed={...request,x:2,y:7},next=groupMovementStep(first.state,changed);
 assert.equal(first.state.units[0].x,2);assert.equal(first.report.actions,1);assert.equal(next.report.actions,1);
 assert.ok(next.state.elapsedSeconds>first.state.elapsedSeconds);assert.ok(next.state.units[0].energy<first.state.units[0].energy);
 assert.equal(groupMovementStep(first.state,changed,first.continuation).status,'invalid');
 const invalid=structuredClone(first.continuation);invalid.members[0].unitId='enemy';const rejected=groupMovementStep(first.state,request,invalid);
 assert.equal(rejected.status,'invalid');assert.strictEqual(rejected.state,first.state);
});

test('unseen civilian and enemy occupancy cannot change formation plans or reveal a private route',()=>{
 const empty=field({night:true}),civilian=field({night:true,npcs:[{id:'hidden-civilian',x:20,y:2}]}),enemy=field({night:true,enemies:[{id:'hidden-enemy',x:20,y:2}]}),target={...request,x:20};
 const baseline=planGroupMove(empty,target);assert.deepEqual(planGroupMove(civilian,target),baseline);assert.deepEqual(planGroupMove(enemy,target),baseline);
 assert.deepEqual(groupMovementStep(civilian,target).report,groupMovementStep(empty,target).report);
 assert.deepEqual(groupMovementStep(enemy,target).report,groupMovementStep(empty,target).report);
});
