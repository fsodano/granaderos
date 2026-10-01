import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,StrictMode,useEffect} from '../web/node_modules/react/index.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {createBattle,actBattle} from '../game/tactical.js';
const {useBattleExecutor}=await import('../web/lib/useBattleExecutor.ts');

test('effect replay cancels the old order and keeps the new worker order pending',async t=>{
 const battle=createBattle([{id:'p',x:1,y:2,weapon:1800}],{width:8,height:8,enemies:[{id:'e',x:6,y:2,weapon:1800}],seed:8});
 const action={type:'move',unitId:'p',x:2,y:2},results=[];let controller;
 function Controller(){
  controller=useBattleExecutor(battle);
  useEffect(()=>{controller.run(action).then(result=>results.push(result));},[]);
  return null;
 }
 const mounted=await mountBattlefield(t,()=>h(StrictMode,null,h(Controller)),{});
 assert.deepEqual(results,[null],'closed lifecycle must not compute a fallback result');
 assert.equal(mounted.jobs().length,1,'new lifecycle must accept its own order');
 assert.equal(controller.pending.current,true);
 assert.equal(controller.working,true);
 await mounted.act(async()=>assert.equal(await controller.run(action),null));
 assert.equal(mounted.jobs().length,1,'old cleanup must not unlock the new order');
 await mounted.deliver('action');
 assert.deepEqual(results,[null,actBattle(battle,action)]);
 assert.equal(controller.pending.current,false);
 assert.equal(controller.working,false);
});
