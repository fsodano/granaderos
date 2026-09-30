import test from 'node:test';import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {actBattle,endTurn,createBattle,getReachable} from '../game/tactical.js';
import {createBattleExecutor} from '../web/lib/battle-executor.js';
import {executeGroupMove,planGroupMove} from '../game/group-movement.js';
import {movementGroupModel} from '../game/ja2-hud.js';
import {movementStep} from '../game/movement-step.js';
const fixture=()=>createBattle([{id:'p',x:1,y:2,weapon:1800}],{width:8,height:8,enemies:[{id:'e',x:6,y:2,weapon:1800}],seed:8});
async function withExecutor(check){
 const url=new URL('../game/battle-job.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');import(${JSON.stringify(url)}).then(({runBattleJob})=>parentPort.on('message',({id,job})=>{try{parentPort.postMessage({id,battle:runBattleJob(job)});}catch(e){parentPort.postMessage({id,error:e.message});}}));`,{eval:true});
 const bridge={postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate()};worker.on('message',data=>bridge.onmessage({data}));worker.on('error',()=>bridge.onerror());
 const executor=createBattleExecutor(bridge);
 try{await check(executor);}
 finally{executor.close();}
}
test('worker execution exactly matches movement, invalid orders and turn resolution',async()=>{
 await withExecutor(async executor=>{for(const action of [{type:'move',unitId:'p',x:2,y:2},{type:'move',unitId:'p',x:-1,y:2},null]){const battle=fixture(),before=structuredClone(battle),kind=action?'action':'turn';assert.deepEqual(await executor.run({battle,action,kind}),action?actBattle(battle,action):endTurn(battle));assert.deepEqual(battle,before);}});
});
test('movement-step worker preserves resumable plans and reached-cell costs across messages',async()=>{
 await withExecutor(async executor=>{
  let battle=createBattle([{id:'p',x:1,y:2}],{width:16,height:8,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]}),continuation;
  const action={type:'move',unitId:'p',x:12,y:2};let count=0;
  for(;;){
   const before=structuredClone(battle),expected=movementStep(battle,action,continuation),result=await executor.run({battle,action,kind:'movement-step',continuation});
   assert.deepEqual(result,expected);assert.deepEqual(battle,before);count++;
   if(result.status!=='moving'){assert.equal(result.status,'completed');assert.equal(result.state.units[0].x,12);assert.equal(result.state.units[0].energy,99.45);break;}
   battle=result.state;continuation=result.continuation;assert.ok(count<20);
  }
  assert.equal(count,11);
 });
});
test('worker group orders retain exact formation reports, partial moves and contact stops',async()=>{
 await withExecutor(async executor=>{
  for(const mode of ['complete','exhausted','contact','invalid']){
   const battle=createBattle([{id:'a',x:1,y:2,energy:mode==='exhausted'?2:100},{id:'b',x:1,y:3},{id:'c',x:2,y:3}],{width:24,height:10,seed:45,exploration:true,tiles:Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:mode==='contact'?[{id:'e',x:22,y:2,weapon:1800,marksmanship:0,facing:2}]:[]});
   const before=structuredClone(battle),action={unitIds:['a','b','c'],anchorId:'a',x:mode==='contact'?20:mode==='invalid'?-1:8,y:2,...(mode==='exhausted'?{movement:'run'}:{})};
   const expected=executeGroupMove(battle,action),result=await executor.run({battle,action,kind:'group'});
   assert.deepEqual(await executor.run({battle,action,kind:'group-preview'}),planGroupMove(battle,action));
   assert.deepEqual(result,expected);assert.deepEqual(battle,before);
   assert.equal(result.status,{complete:'completed',exhausted:'partial',contact:'contact',invalid:'invalid'}[mode]);
   let replay=battle;for(const order of result.orders)replay=actBattle(replay,order);assert.deepEqual(result.state,replay);
  }
 });
});
test('group dispatch builds the same request without calculating an unused preview',()=>{
 const battle=createBattle([{id:'a',x:1,y:1},{id:'b',x:2,y:1}],{width:8,height:8,exploration:true,enemies:[]});
 const preview=movementGroupModel(battle,['a','b'],'a',{x:4,y:4});
 const dispatch=movementGroupModel(battle,['a','b'],'a',{x:4,y:4},{preview:false});
 assert.deepEqual(dispatch.request,preview.request);assert.deepEqual(dispatch.members,preview.members);
 assert.ok(preview.preview);assert.equal(dispatch.preview,null);
});
test('executor rejects abandoned jobs and ignores their late messages',async()=>{
 const messages=[],worker={postMessage:m=>messages.push(m),terminate(){}};const executor=createBattleExecutor(worker);
 const first=executor.run({}),second=executor.run({});worker.onmessage({data:{id:messages[1].id,battle:'second'}});assert.equal(await second,'second');
 const rejected=assert.rejects(first,/closed/);executor.close();await rejected;worker.onmessage({data:{id:messages[0].id,battle:'late'}});await assert.rejects(executor.run({}),/closed/);
});

for(const event of ['onerror','onmessageerror'])test(`executor releases all pending orders after ${event}`,async()=>{
 const messages=[];let terminated=0;
 const worker={postMessage:message=>messages.push(message),terminate(){terminated++;}};
 const executor=createBattleExecutor(worker);
 const first=executor.run({action:{type:'move'}}),second=executor.run({kind:'turn'});
 const failures=[assert.rejects(first,/Battle worker failed/),assert.rejects(second,/Battle worker failed/)];
 worker[event]();await Promise.all(failures);
 assert.equal(terminated,1);
 // Late messages and repeated browser error events cannot revive a dead job.
 worker.onmessage({data:{id:messages[0].id,battle:{status:'active'}}});
 worker.onerror();worker.onmessageerror();assert.equal(terminated,1);
 await assert.rejects(executor.run({}),/Battle worker closed/);
 assert.equal(messages.length,2,'a failed worker never receives another order');
 executor.close();executor.close();assert.equal(terminated,1);
});

test('background reachable previews preserve routes and leave battle snapshots unchanged',async()=>{
 await withExecutor(async executor=>{
  for(const exploration of [false,true])for(const movementIntent of ['forward','preserveFacing']){
   const battle=fixture();if(exploration)battle.mode='exploration';
   const before=structuredClone(battle);
   for(const unitId of ['p','missing']){
    const result=await executor.run({battle,action:{unitId,movementIntent},kind:'reachable-preview'});
    assert.deepEqual(result,getReachable(battle,unitId,{movementIntent}));
    if(unitId==='p'&&movementIntent==='forward')assert.ok(result.length);
   }
   assert.deepEqual(battle,before);
  }
 });
});
