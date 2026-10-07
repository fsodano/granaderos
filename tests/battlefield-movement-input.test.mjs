import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,reloadPlan} from '../game/tactical.js';
import {createElement as h} from '../web/node_modules/react/index.js';
import {tacticalGridLabel} from '../game/tactical-grid.js';
import {groupMovementStep} from '../game/group-movement.js';
import {movementStep} from '../game/movement-step.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const walkStep=movementStepDuration({weapon:1800},{x:1,y:1},{x:2,y:1}),runStep=movementStepDuration({weapon:1800,movementMode:'run'},{x:1,y:1},{x:2,y:1});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('actual R sets only the selected actor to run without loading or spending PA; Shift+R reloads',async t=>{
 let battle=createBattle([{id:'p',name:'Primero',x:1,y:1,loaded:0,ammo:3},{id:'q',name:'Segundo',x:1,y:2,loaded:0,ammo:3}],{width:24,height:8,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:23,y:7,patrol:false,overwatch:false}]}),commits=[];
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true});
 const key=async(key,extra={})=>mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,...extra})));
 await key('2');const before=structuredClone(battle),original=before.units[0],selected=before.units[1];
 await key('r');assert.equal(commits.length,1);assert.equal(battle.lastError,null);assert.equal(battle.units[1].movementMode,'run');assert.deepEqual(battle.units[0],original);
 for(const field of ['ap','loaded','ammo','jammed','energy','x','y'])assert.equal(battle.units[1][field],selected[field],`${field} is unchanged by selecting running`);
 assert.equal(battle.elapsedSeconds,before.elapsedSeconds+6,'the first action retains the existing combat round charge');assert.equal(mounted.jobs().length,0,'selecting a gait does not start an attack or a route');
 await mounted.render(props());await key('R');assert.equal(commits.length,2);assert.equal(battle.units[1].movementMode,'run','a second key press keeps running');assert.equal(battle.elapsedSeconds,before.elapsedSeconds+6,'another R does not charge the same round again');
 const running=battle,plan=reloadPlan(battle.units[1],battle);await mounted.render(props());await key('R',{shiftKey:true});await mounted.settle();
 assert.equal(battle.lastError,null);assert.equal(battle.units[1].movementMode,'run');assert.equal(battle.units[1].loaded,1);assert.equal(battle.units[1].ammo,2);assert.equal(battle.units[1].ap,running.units[1].ap-plan.pa);assert.equal(battle.elapsedSeconds,running.elapsedSeconds,'reload retains the already charged combat round');assert.deepEqual(battle.units[0],original);
});

test('run and reload keyboard chords retain editing, dialog and help guards',async t=>{
 const env=await actualInput(t,{combat:true,enemies:[{id:'e',x:23,y:7,patrol:false,overwatch:false}]}),{mounted}=env;
 const input=document.createElement('input');document.body.append(input);
 const key=async(key,extra={},target=document.body)=>mounted.act(async()=>target.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,...extra})));
 for(const chord of [{key:'r'},{key:'R',shiftKey:true}]){
  const {key:name,...extra}=chord;await key(name,extra,input);
  for(const guard of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true}])await key(name,{...extra,...guard});
 }
 const dialog=document.createElement('div');dialog.setAttribute('role','dialog');document.body.append(dialog);await key('r');await key('R',{shiftKey:true});dialog.remove();
 await key('h');await key('r');await key('R',{shiftKey:true});await key('Escape');assert.equal(env.commits.length,0);assert.equal(env.jobs('movement-step').length,0);
 await key('r');assert.equal(env.commits.length,1);assert.equal(env.battle.units[0].movementMode,'run');
});

for(const delivery of ['early','late'])test(`real map input redirects and runs with ${delivery} speculative worker delivery`,async t=>{
 let now=1000,sequence=0;const frames=new Map(),commits=[];
 const clock={now:()=>now,request:callback=>{frames.set(++sequence,callback);return sequence;},cancel:id=>frames.delete(id)};
 let battle=createBattle([{id:'p',name:'Caminante',x:1,y:1}],{width:16,height:8,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(),{clock});
 const get=type=>nodes(mounted.tree()).find(node=>node.type===type),svg=()=>nodes(mounted.tree()).find(node=>node.props?.className?.startsWith('tactical-field'));
 const click=async(point,detail=1)=>mounted.act(async()=>{svg().props.onClickCapture({detail,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false});get(TacticalSceneControls).props.onTile(point);});
 const frame=async elapsed=>{now+=elapsed;const callbacks=[...frames.values()];frames.clear();await mounted.act(async()=>{for(const callback of callbacks)callback(now);});};
 const jobs=()=>mounted.jobs().filter(message=>message.job.kind==='movement-step');
 await click({x:7,y:1});assert.equal(jobs().length,1,'the first click starts immediately');
 assert.equal(jobs()[0].job.action.x,7);
 await mounted.deliver('movement-step');await mounted.render(props());
 assert.equal(commits.length,1);assert.equal(battle.units[0].x,2);assert.equal(battle.elapsedSeconds,3);
 assert.equal(jobs().length,1);assert.equal(jobs()[0].job.battle,battle,'the next pure calculation uses the accepted paid state');
 await frame(walkStep/2);close(get(TacticalSceneControls).props.positions['unit:p'].x,1.5);assert.equal(get(TacticalSceneControls).props.positions['unit:p'].moving,true);
 await click({x:2,y:6});assert.equal(jobs().length,1,'a redirect never starts a second simultaneous worker');
 await click({x:2,y:6},2);await click({x:2,y:6},3);
 await mounted.deliver('movement-step');assert.equal(commits.length,1,'the abandoned speculative result has no effect');assert.equal(jobs().length,1);
 assert.equal(jobs()[0].job.action.x,2);assert.equal(jobs()[0].job.action.y,6);assert.equal(jobs()[0].job.action.movement,'run');
 assert.equal(jobs()[0].job.continuation,undefined,'the abandoned destination cannot supply the next route');
 if(delivery==='early'){await mounted.deliver('movement-step');assert.equal(commits.length,1,'a prepared result cannot spend the next step before the endpoint');}
 await frame(walkStep/2);
 assert.equal(get(TacticalSceneControls).props.positions['unit:p'].moving,true,'the sprite keeps its gait between committed cells');
 if(delivery==='late'){assert.equal(commits.length,1);await frame(50);assert.equal(get(TacticalSceneControls).props.positions['unit:p'].x,2);close(get(TacticalSceneControls).props.positions['unit:p'].elapsedMs,walkStep);await mounted.deliver('movement-step');}
 else assert.equal(commits.length,2,'the prepared step commits at the endpoint without waiting for a worker');
 await mounted.render(props());
 assert.equal(battle.units[0].x,2);assert.equal(battle.units[0].y,2);assert.equal(battle.elapsedSeconds,4);assert.equal(battle.units[0].movementMode,'run');
 await frame(runStep/2);close(get(TacticalSceneControls).props.positions['unit:p'].y,1.5);close(get(TacticalSceneControls).props.positions['unit:p'].elapsedMs,walkStep+runStep/2);
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 await frame(runStep/2);assert.equal(get(TacticalSceneControls).props.positions['unit:p'].y,2);assert.equal(get(TacticalSceneControls).props.positions['unit:p'].moving,false);
 assert.equal(jobs().length,1);await mounted.deliver('movement-step');assert.equal(jobs().length,0);
 assert.equal(commits.length,2,'cancelled future steps never spend time or energy');
});

const renderScene=tree=>{const svg=nodes(tree).find(node=>node.props?.className?.startsWith('tactical-field')),scene=nodes(tree).find(node=>node.type===TacticalSceneControls);return h('svg',{onClickCapture:svg.props.onClickCapture,onKeyDownCapture:svg.props.onKeyDownCapture},h(TacticalSceneControls,scene.props));};
async function actualInput(t,{group=false,combat=false,enemies=[]}={}){
 let now=1000,sequence=0;const frames=new Map(),commits=[];
 const clock={now:()=>now,request:callback=>{frames.set(++sequence,callback);return sequence;},cancel:id=>frames.delete(id)};
 let battle=createBattle([{id:'p',name:'Caminante',x:1,y:1},...(group?[{id:'q',name:'Compañero',x:1,y:2}]:[])],{width:24,height:8,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),exploration:!combat,enemies});
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(),{clock,virtualTimers:true,renderTree:renderScene});
 const click=async(node,extra={})=>{assert.ok(node,'the actual scene contains the clicked target');await mounted.act(async()=>node.dispatchEvent(new window.MouseEvent('click',{bubbles:true,detail:1,...extra})));};
 const tile=(x,y)=>document.querySelector(`[data-surface-level="0"][aria-label="${tacticalGridLabel(x,y)}, accesible"]`),person=id=>document.querySelector(`[data-unit-id="${id}"] [data-person-hit-target]`);
 const frame=async elapsed=>{now+=elapsed;const callbacks=[...frames.values()];frames.clear();await mounted.act(async()=>{for(const callback of callbacks)callback(now);});};
 return {mounted,commits,props,click,tile,person,frame,get battle(){return battle;},jobs:kind=>mounted.jobs().filter(message=>message.job?.kind===kind)};
}

for(const delivery of ['early','late'])test(`actual group scene clicks redirect a follower's walk at its paid boundary with ${delivery} worker delivery`,async t=>{
 const env=await actualInput(t,{group:true}),{mounted}=env;
 await env.click(env.person('q'),{shiftKey:true});await env.click(env.tile(7,1));
 assert.equal(env.jobs('group-step').length,1);assert.deepEqual(env.jobs('group-step')[0].job.action.unitIds,['p','q']);
 // Reach the first follower step through ordinary visible cell boundaries.
 for(let i=0;i<10;i++){
  await mounted.deliver('group-step');await mounted.render(env.props());
  if(env.battle.units.find(unit=>unit.id==='q').x>1)break;
  await env.frame(walkStep);
 }
 const paid=env.battle;assert.equal(paid.units.find(unit=>unit.id==='p').x,7);assert.equal(paid.units.find(unit=>unit.id==='q').x,2);
 await env.frame(walkStep/2);close(nodes(mounted.tree()).find(node=>node.type===TacticalSceneControls).props.positions['unit:q'].x,1.5);
 const count=env.commits.length;await env.click(env.tile(2,6));await mounted.deliver('group-step');
 assert.equal(env.commits.length,count,'the abandoned speculative follower step is unpaid');assert.equal(env.jobs('group-step').length,1);
 const job=env.jobs('group-step')[0].job;assert.equal(job.action.x,2);assert.equal(job.action.y,6);assert.equal(job.continuation,undefined);
 const expected=groupMovementStep(paid,job.action).state;
 if(delivery==='early'){await mounted.deliver('group-step');assert.equal(env.commits.length,count);}
 await env.frame(walkStep/2);
 if(delivery==='late'){assert.equal(env.commits.length,count);await mounted.deliver('group-step');}
 await mounted.render(env.props());assert.deepEqual(env.battle,expected,'redirect retains paid follower time/energy and pays one legal replacement cell');
 assert.equal(new Set(env.battle.units.map(unit=>`${unit.x},${unit.y}`)).size,2);
 // Clicking the selected actor stops the remaining formation; it does not
 // undo the replacement cell whose sprite is still visibly approaching it.
 const stopped=env.battle,stoppedCount=env.commits.length;await env.click(env.person('p'));await env.frame(walkStep*2);
 if(env.jobs('group-step').length)await mounted.deliver('group-step');
 assert.equal(env.commits.length,stoppedCount);assert.strictEqual(env.battle,stopped);
});

test('actual combat scene clicks redirect with normal PA costs and stop at the last paid cell',async t=>{
 const env=await actualInput(t,{combat:true,enemies:[{id:'e',x:23,y:7,weapon:1800}]});await env.click(env.tile(5,1));await env.mounted.deliver('movement-step');await env.mounted.render(env.props());
 const paid=env.battle,paidAP=paid.units[0].ap;assert.ok(paidAP<100);await env.frame(walkStep/2);
 await env.click(env.tile(2,4));await env.mounted.deliver('movement-step');assert.equal(env.commits.length,1);
 const job=env.jobs('movement-step')[0].job,expected=movementStep(paid,job.action).state;await env.mounted.deliver('movement-step');assert.equal(env.commits.length,1);
 await env.frame(walkStep/2);await env.mounted.render(env.props());assert.deepEqual(env.battle,expected);assert.ok(env.battle.units[0].ap<paidAP);
 const stopped=env.battle,count=env.commits.length;await env.click(env.person('p'));await env.frame(walkStep);
 if(env.jobs('movement-step').length)await env.mounted.deliver('movement-step');assert.equal(env.commits.length,count);assert.strictEqual(env.battle,stopped);
});

test('actual map movement clicks remain blocked throughout enemy action playback',async t=>{
 const env=await actualInput(t,{combat:true,enemies:[{id:'e',name:'Guardia',x:7,y:1,weapon:1809,morale:100}]}),turn=nodes(env.mounted.tree()).find(node=>node.props?.onEndTurn);
 await env.mounted.act(async()=>turn.props.onEndTurn());await env.click(env.tile(2,4));assert.equal(env.jobs('movement-step').length,0);assert.equal(env.jobs('group-step').length,0);
 await env.mounted.deliver('presentation');assert.ok(nodes(env.mounted.tree()).some(node=>node.props?.['data-enemy-frame']));
 await env.mounted.act(async()=>{document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'r',bubbles:true}));document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'R',shiftKey:true,bubbles:true}));});
 await env.click(env.tile(2,4));assert.equal(env.jobs('movement-step').length,0);assert.equal(env.commits.length,0);
 await env.mounted.settle();assert.equal(env.commits.length,1,'only the actual enemy-turn result commits');
});
