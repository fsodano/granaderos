import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,Fragment,useState} from '../web/node_modules/react/index.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {createBattle} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
const {useBattlePreview}=await import('../web/lib/useBattlePreview.ts');
const field=()=>createBattle([{id:'p',x:1,y:2,weapon:1800}],{width:8,height:8,enemies:[{id:'e',x:6,y:2,weapon:1800}],seed:8});
for(const kind of ['reachable-preview','group-preview'])test(`${kind} recovers on the next request after worker failure`,async t=>{
 const battle=field(),first=kind==='reachable-preview'?{unitId:'p',movementIntent:'walk'}:{unitIds:['p'],anchorId:'p',x:2,y:2};
 let view,update;
 function Controller(){const [request,setRequest]=useState(first);update=setRequest;view=useBattlePreview(battle,request,kind);return null;}
 const mounted=await mountBattlefield(t,()=>h(Fragment,null,h(Controller)),{});
 assert.equal(view.working,true);await mounted.fail(kind);
 assert.equal(view.failed,true);assert.equal(view.working,false);assert.equal(view.preview,null);
 const next=kind==='reachable-preview'?{...first,movementIntent:'run'}:{...first,x:3};
 await mounted.act(async()=>update(next));
 assert.equal(mounted.jobs().length,1,'a fresh worker must accept the next request');
 assert.equal(view.working,true);await mounted.deliver(kind);
 assert.equal(view.failed,false);assert.equal(view.working,false);
 assert.deepEqual(view.preview,runBattleJob({battle,action:next,kind}));
});
test('a replaced battle cannot publish its route while the new preview waits',async t=>{
 const old=field(),next=field();next.units[0].x=2;
 const request={unitId:'p',movementIntent:'walk'};let view,update;
 function Controller(){const [battle,setBattle]=useState(old);update=setBattle;view=useBattlePreview(battle,request,'reachable-preview');return null;}
 const mounted=await mountBattlefield(t,()=>h(Fragment,null,h(Controller)),{});
 await mounted.act(async()=>update(next));
 await mounted.deliver('reachable-preview');assert.equal(view.preview,null);assert.equal(view.working,true);
 assert.equal(mounted.jobs().length,1);await mounted.deliver('reachable-preview');
 assert.deepEqual(view.preview,runBattleJob({battle:next,action:request,kind:'reachable-preview'}));
});
