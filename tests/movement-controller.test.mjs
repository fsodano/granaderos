import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {movementStep} from '../game/movement-step.js';
import {unitCanAct} from '../game/ja2-hud.js';
import {createMovementController} from '../web/lib/movement-controller.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const field=()=>createBattle([{id:'p',x:1,y:1}],{width:16,height:8,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
const order=(x,y=1,extra={})=>({type:'move',unitId:'p',x,y,...extra});
function harness({deferred=false,commitAllowed=true}={}){
 let battle=field(),positions={p:{x:1,y:1,settled:true,moving:false}};
 const original=battle,commits=[],jobs=[];
 const controller=createMovementController({
  canMove:(state,id)=>unitCanAct(state,state.units.find(unit=>unit.id===id)),
  execute:(action,continuation)=>{
   const job={battle,action,continuation};jobs.push(job);
   if(deferred)return new Promise(resolve=>{job.finish=()=>resolve(movementStep(job.battle,action,continuation));});
   return movementStep(battle,action,continuation);
  },
  commit:next=>{if(!commitAllowed)return null;battle=next;commits.push(next);return next;},
 });
 controller.observe(battle,positions);
 return {controller,jobs,commits,original,get battle(){return battle;},
  observe(){controller.observe(battle,positions);},
  midStep(){const actor=battle.units[0];positions={p:{x:actor.x-.5,y:actor.y,settled:false,moving:true}};controller.observe(battle,positions);},
  arrive(){positions={p:{...battle.units[0],settled:true,moving:true}};controller.observe(battle,positions);},
  replace(next){battle=next;controller.observe(battle,positions);},
 };
}

test('the first click commits one paid step immediately and waits for its rendered endpoint',async()=>{
 const h=harness(),before=structuredClone(h.original);
 assert.equal(h.controller.request(order(7)),true);await flush();
 assert.equal(h.commits.length,1);assert.equal(h.battle.units[0].x,2);assert.equal(h.battle.elapsedSeconds,3);
 assert.deepEqual(h.original,before);h.observe();await flush();assert.equal(h.jobs.length,2,'one following step is prepared while the first tile animates');
 h.midStep();await flush();assert.equal(h.jobs.length,2);assert.equal(h.commits.length,1);assert.equal(h.battle.elapsedSeconds,3);
 h.arrive();await flush();assert.equal(h.commits.length,2);assert.equal(h.battle.units[0].x,3);
 assert.equal(h.jobs[1].continuation.length,5,'the already planned remainder is reused');
});

test('a new destination replaces unexecuted steps while retaining the current paid step',async()=>{
 const h=harness();h.controller.request(order(7));await flush();h.midStep();
 const paid=h.battle,redirect=order(2,5),expected=movementStep(paid,redirect);
 assert.equal(h.controller.request(redirect),true);await flush();assert.equal(h.commits.length,1);
 assert.equal(h.controller.getSnapshot().action.y,5,'the new goal is accepted during the current animation');
 h.arrive();await flush();assert.deepEqual(h.battle,expected.state);assert.equal(h.jobs.at(-1).continuation,null);
 assert.equal(h.battle.units[0].x,2);assert.equal(h.battle.units[0].y,2);
});

test('a run gesture changes only remaining steps and pays normal run time and energy',async()=>{
 const h=harness();h.controller.request(order(7));await flush();h.midStep();
 const paid=h.battle,run=order(7,1,{movement:'run'}),expected=movementStep(paid,run);
 h.controller.request(run);h.arrive();await flush();
 assert.deepEqual(h.battle,expected.state);assert.equal(h.battle.units[0].movementMode,'run');
 assert.equal(h.battle.elapsedSeconds,4,'the paid walking step keeps its three seconds and the next run step adds one');
 assert.ok(paid.units[0].energy-h.battle.units[0].energy>h.original.units[0].energy-paid.units[0].energy);
});

test('a goal changed during worker calculation discards only the uncommitted pure result',async()=>{
 const h=harness({deferred:true});h.controller.request(order(7));await flush();
 h.controller.request(order(1,5));h.jobs[0].finish();await flush();
 assert.equal(h.commits.length,0);assert.equal(h.jobs.length,2);assert.equal(h.jobs[1].battle,h.original);
 assert.equal(h.jobs[1].action.y,5);h.jobs[1].finish();await flush();assert.equal(h.commits.length,1);
 assert.equal(h.battle.units[0].x,1);assert.equal(h.battle.units[0].y,2);
});

test('repeated clicks do not restart an unchanged route and completion clears the queue',async()=>{
 const h=harness();h.controller.request(order(3));await flush();h.observe();
 h.controller.request(order(3));await flush();assert.equal(h.jobs.length,2,'an unchanged goal keeps the single prepared result');
 h.arrive();await flush();assert.equal(h.controller.getSnapshot().finishing,true);assert.equal(h.commits.length,2);
 h.arrive();await flush();assert.equal(h.controller.getSnapshot(),null);assert.equal(h.jobs.length,2);
});

test('a delayed precomputation never spends its step before the visual endpoint or starts another worker',async()=>{
 const h=harness({deferred:true});h.controller.request(order(7));await flush();h.jobs[0].finish();await flush();
 const paid=h.battle;h.observe();await flush();assert.equal(h.jobs.length,2);assert.equal(h.jobs[1].battle,paid);
 h.midStep();h.observe();await flush();assert.equal(h.jobs.length,2);assert.equal(h.commits.length,1);
 h.arrive();await flush();assert.equal(h.commits.length,1,'an unfinished worker cannot commit a guessed step');
 h.jobs[1].finish();await flush();assert.equal(h.commits.length,2);assert.equal(h.battle.units[0].x,3);assert.equal(h.battle.elapsedSeconds,6);
 assert.equal(h.jobs.length,2,'the following request waits for the accepted snapshot to reach the view');
});

test('a redirect discards a ready speculative step and replacement costs start from the paid cell',async()=>{
 const h=harness();h.controller.request(order(7));await flush();h.midStep();await flush();
 const paid=h.battle;assert.equal(h.jobs.length,2);assert.equal(h.commits.length,1);
 const redirect=order(2,5,{movement:'run'}),expected=movementStep(paid,redirect).state;
 h.controller.request(redirect);await flush();assert.equal(h.jobs.length,3);assert.equal(h.commits.length,1);assert.equal(h.battle,paid);
 h.arrive();await flush();assert.deepEqual(h.battle,expected);assert.equal(h.commits.length,2);
});

test('redirecting an in-flight speculative step waits for that worker and then prepares only the latest goal',async()=>{
 const h=harness({deferred:true});h.controller.request(order(7));await flush();h.jobs[0].finish();await flush();h.midStep();await flush();
 const paid=h.battle;h.controller.request(order(2,5));h.controller.request(order(2,6,{movement:'run'}));await flush();
 assert.equal(h.jobs.length,2);h.jobs[1].finish();await flush();assert.equal(h.commits.length,1);assert.equal(h.jobs.length,3);
 assert.equal(h.jobs[2].battle,paid);assert.equal(h.jobs[2].action.y,6);assert.equal(h.jobs[2].action.movement,'run');
 h.jobs[2].finish();await flush();assert.equal(h.commits.length,1);h.arrive();await flush();assert.equal(h.commits.length,2);
 assert.deepEqual(h.battle,movementStep(paid,order(2,6,{movement:'run'})).state);
});

test('cancel, unrelated state and unmount discard both ready and in-flight speculative results',async()=>{
 for(const deferred of [false,true])for(const mode of ['cancel','replacement','unmount']){
  const h=harness({deferred});h.controller.request(order(7));await flush();if(deferred){h.jobs[0].finish();await flush();}h.midStep();await flush();
  const paid=h.battle;assert.equal(h.jobs.length,2);assert.equal(h.commits.length,1);
  if(mode==='cancel')h.controller.cancel();else if(mode==='unmount')h.controller.setEnabled(false);else h.replace({...paid,log:[...paid.log,'Estado externo.']});
  if(deferred){h.jobs[1].finish();await flush();}h.arrive();await flush();
  assert.equal(h.commits.length,1);assert.equal(h.jobs.length,2);assert.equal(h.controller.getSnapshot(),null);
 }
});

test('cancel, replacement, rejected commit, and unmount cannot spend remaining route costs',async()=>{
 for(const mode of ['cancel','replacement','unmount']){
  const h=harness();h.controller.request(order(7));await flush();const paid=h.battle;
  if(mode==='cancel')h.controller.cancel();else if(mode==='unmount')h.controller.setEnabled(false);else h.replace({...paid,log:[...paid.log,'Cambio externo.']});
  h.arrive();await flush();assert.equal(h.jobs.length,1);assert.equal(h.controller.getSnapshot(),null);
 }
 const rejected=harness({commitAllowed:false});rejected.controller.request(order(7));await flush();assert.equal(rejected.commits.length,0);assert.equal(rejected.controller.getSnapshot(),null);
 const closed=harness({deferred:true});closed.controller.request(order(7));await flush();closed.controller.setEnabled(false);closed.jobs[0].finish();await flush();assert.equal(closed.commits.length,0);
});
