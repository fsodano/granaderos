import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {createBattle,actBattle,canSee} from '../game/tactical.js';
import {movementStep} from '../game/movement-step.js';
import {advanceNpc,hearNpcNoise} from '../game/npc-ai.js';
import {dialogueAvailability} from '../game/npc-dialogue.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {createMovementController} from '../web/lib/movement-controller.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:Scene}=await import('../web/app/TacticalSceneControls.tsx');
const {default:Conversation}=await import('../web/app/JA2Conversation.tsx');

const actor=b=>b.units.find(u=>u.id==='speaker'),resident=b=>b.npcs.find(n=>n.id==='brown');
const position=p=>({x:p.x,y:p.y});
const field=()=>createBattle([{id:'speaker',name:'Visitante',x:1,y:2,facing:2,weapon:1800}],{
 id:'declared-conversation-approach',width:20,height:8,hour:12,exploration:true,enemies:[],
 tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
 npcs:[{id:'brown',name:'Guillermo Brown',operativeId:8,x:8,y:2,hp:100,energy:100,ai:{cycle:0,homeId:null,activity:'roaming',wait:0,destination:{x:18,y:2}}},
 {id:'neighbour',name:'Vecina',x:10,y:6,hp:100,energy:100,ai:{cycle:0,homeId:null,activity:'roaming',wait:0,destination:{x:18,y:6}}}],
});
const approach={type:'move',unitId:'speaker',x:7,y:2,conversationTargetId:'brown'};
const ordinary={type:'move',unitId:'speaker',x:7,y:2};
function finish(start,action){
 let result={state:start,continuation:null,status:'moving'},count=0;
 while(result.status==='moving'&&count++<20){result=movementStep(result.state,action,result.continuation);assert.equal(Object.hasOwn(result.state,'approachingNpcIds'),false);}
 assert.ok(count<20);return result;
}

test('a paid conversation approach reaches a roaming resident without stopping other civilians or saving a hold',()=>{
 const start=field(),before=structuredClone(start);assert.equal(canSee(start,actor(start),resident(start)),true);
 const chased=finish(start,ordinary);assert.notDeepEqual(position(resident(chased.state)),position(resident(start)),'ordinary movement reproduces the chase');
 assert.equal(dialogueAvailability(chased.state,actor(chased.state),resident(chased.state)).code,'range');
 const result=finish(start,approach);assert.equal(result.status,'completed');assert.equal(result.state.lastError,null);
 assert.deepEqual(position(resident(result.state)),position(resident(start)));assert.deepEqual(resident(result.state).ai,resident(start).ai);
 assert.notDeepEqual(position(result.state.npcs[1]),position(start.npcs[1]),'unselected residents keep their normal routine');
 assert.equal(dialogueAvailability(result.state,actor(result.state),resident(result.state),{visible:canSee(result.state,actor(result.state),resident(result.state))}).reason,null);
 assert.deepEqual(actor(result.state),actor(chased.state),'the same path has the same finite movement costs');
 assert.equal(result.state.elapsedSeconds,chased.state.elapsedSeconds);assert.equal(result.state.seed,chased.state.seed);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result.state))),result.state);assert.deepEqual(start,before);
 const departed=actBattle(result.state,{type:'move',unitId:'speaker',x:1,y:2});
 assert.notDeepEqual(position(resident(departed)),position(resident(start)),'the completed approach leaves no permanent wait after the visitor leaves');
});

test('approach steps recheck personal sight, availability, safe mode and the target-adjacent destination',()=>{
 for(const change of [s=>{actor(s).facing=6;},s=>{resident(s).hp=0;},s=>{resident(s).unconscious=true;},s=>{s.mode='combat';s.sectorCleared=false;},s=>{resident(s).x=12;}]){
  const start=field();change(start);const before=structuredClone(start),result=movementStep(start,approach);
  assert.equal(result.status,'stopped');assert.ok(result.state.lastError);assert.deepEqual(result.state.units,start.units);assert.deepEqual(result.state.npcs,start.npcs);
  assert.equal(result.state.elapsedSeconds,start.elapsedSeconds);assert.equal(Object.hasOwn(result.state,'approachingNpcIds'),false);assert.deepEqual(start,before);
 }
 const first=movementStep(field(),approach),blocked=structuredClone(first.state);
 blocked.tiles.find(t=>t.x===first.continuation[0].x&&t.y===first.continuation[0].y).blocked=true;
 const failed=movementStep(blocked,approach,first.continuation);assert.equal(failed.status,'stopped');assert.ok(failed.state.lastError);
 assert.equal(Object.hasOwn(failed.state,'approachingNpcIds'),false);
 assert.notDeepEqual(position(resident(actBattle(failed.state,{type:'ambient'}))),position(resident(failed.state)),'a failed step leaves the resident free');
});

test('the temporary approach hold never overrides danger, combat, scripted meetings or escorts',()=>{
 for(const kind of ['danger','combat','scripted','escort']){
  const normal=field(),n=resident(normal);
  if(kind==='danger')hearNpcNoise(normal,{x:7,y:2},'fire',18);
  if(kind==='combat')normal.mode='combat';
  if(kind==='scripted')n.scriptedMove={target:{x:18,y:2}};
  if(kind==='escort')n.escort={leaderId:'speaker',waiting:false};
  const held=structuredClone(normal);held.approachingNpcIds=['brown'];
  advanceNpc(normal,resident(normal));advanceNpc(held,resident(held));
  assert.deepEqual(resident(held),resident(normal),kind);
  assert.ok(resident(held).lastMovePath.length||['hiding','fleeing'].includes(resident(held).ai.activity),`${kind} continues its ordinary behavior`);
 }
});

test('an ordinary redirect to the same cell replaces the conversation intent',async()=>{
 const start=field(),controller=createMovementController({canMove:()=>true,execute:()=>new Promise(()=>{}),commit:()=>assert.fail('an unfinished calculation cannot commit')});
 controller.observe(start,{});assert.equal(controller.request(approach),true);
 assert.equal(controller.getSnapshot().action.conversationTargetId,'brown');
 assert.equal(controller.request(ordinary),true);assert.equal(controller.getSnapshot().action.conversationTargetId,undefined);
 controller.cancel();assert.equal(controller.getSnapshot(),null);
});

const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
const find=(tree,type)=>nodes(tree).find(n=>n.type===type);
const renderControls=tree=>h('div',null,h('svg',null,find(tree,Scene)),find(tree,Conversation));
async function mountedApproach(t){
 let battle=field(),now=1000,sequence=0;const frames=new Map(),commits=[],conversations=[];
 const clock={now:()=>now,request:callback=>{frames.set(++sequence,callback);return sequence;},cancel:id=>frames.delete(id)};
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onTalk:(...args)=>conversations.push(args),onFinish(){}});
 const m=await mountBattlefield(t,Battlefield,props(),{clock,virtualTimers:true,renderTree:renderControls});
 const click=async element=>{assert.ok(element);await m.act(async()=>element.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));};
 const button=label=>[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent===label);
 const frame=async()=>{now+=1000;const callbacks=[...frames.values()];frames.clear();await m.act(async()=>{for(const callback of callbacks)callback(now);});};
 const jobs=()=>m.jobs().filter(message=>message.job.kind==='movement-step');
 await click(document.querySelector('[data-unit-id="brown"] [data-person-hit-target]'));
 assert.ok(document.querySelector('[role="dialog"]'));await m.deliver('reachable-preview');
 await click(button('Acercarse para conversar'));assert.equal(jobs().length,1);
 return {m,props,click,button,frame,jobs,commits,conversations,get battle(){return battle;}};
}

test('the real conversation button reaches the roaming resident and enables the normal dialogue choices',async t=>{
 const env=await mountedApproach(t);
 for(let i=0;i<12&&env.jobs().length;i++){
  await env.m.deliver('movement-step');await env.m.render(env.props());await env.frame();
 }
 assert.equal(env.jobs().length,0);assert.equal(env.battle.lastError,null);
 assert.deepEqual(position(actor(env.battle)),{x:7,y:2});assert.deepEqual(position(resident(env.battle)),{x:8,y:2});
 assert.equal(env.button('Saludar').disabled,false);await env.click(env.button('Saludar'));
 assert.equal(env.conversations.length,1);assert.deepEqual(env.conversations[0].slice(0,3),['brown','friendly','speaker']);
 assert.ok(env.commits.length>1);assert.ok(env.commits.every(state=>!Object.hasOwn(state,'approachingNpcIds')));
});

for(const cancel of ['close','escape'])test(`closing the real conversation with ${cancel} cancels unpaid steps and releases the NPC`,async t=>{
 const env=await mountedApproach(t);await env.m.deliver('movement-step');await env.m.render(env.props());
 assert.equal(env.commits.length,1);assert.equal(env.jobs().length,1,'the next paid step is still speculative');
 if(cancel==='close')await env.click(env.button('Listo'));
 else await env.m.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(document.querySelector('[role="dialog"]'),null);
 await env.m.deliver('movement-step');await env.frame();assert.equal(env.commits.length,1);assert.equal(env.jobs().length,0);
 assert.equal(Object.hasOwn(env.battle,'approachingNpcIds'),false);
 assert.notDeepEqual(position(resident(actBattle(env.battle,{type:'ambient'}))),position(resident(env.battle)));
});
