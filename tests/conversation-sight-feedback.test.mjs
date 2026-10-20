import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {createBattle,actBattle,canSee} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {makeOutfit} from '../game/outfits.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:Scene}=await import('../web/app/TacticalSceneControls.tsx');
const {default:Conversation}=await import('../web/app/JA2Conversation.tsx');
const {default:Strip}=await import('../web/app/JA2Strip.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
const find=(tree,type)=>nodes(tree).find(n=>n.type===type);
const renderControls=tree=>h('div',null,h('svg',null,find(tree,Scene)),nodes(tree).find(n=>n.props?.className==='tactical-feedback-popup'),find(tree,Conversation));
const actor=(battle,id)=>battle.units.find(u=>u.id===id);

for(const mode of ['move','talk','gift'])test(`a contact seen only by a teammate explains personal sight for ${mode} and remains accessible after turning to look`,async t=>{
 let battle=createBattle([
  {id:'speaker',name:'Interlocutor',x:2,y:2,facing:6,weapon:1800,...(mode==='gift'?{activeSlot:'item',activeItem:'inventory:coat',inventory:{coat:{...makeOutfit('poncho'),instanceId:'conversation-sight:coat'}}}:{})},
  {id:'observer',name:'Compañera',x:6,y:3,facing:0,weapon:1800},
 ],{id:'conversation-sight',width:12,height:8,hour:12,exploration:true,enemies:[],
  tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),
  npcs:[{id:'paroissien',name:'James Paroissien',operativeId:10,x:6,y:2,hp:72,maxHp:72,greeting:'Te escucho.'}],
 });
 const npc=()=>battle.npcs.find(n=>n.id==='paroissien'),before=structuredClone(battle),commits=[],conversations=[];
 assert.equal(canSee(battle,actor(battle,'speaker'),npc()),false);
 assert.equal(canSee(battle,actor(battle,'observer'),npc()),true);
 assert.ok(playerKnownBattle(battle).npcs.some(n=>n.id===npc().id));
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onTalk:(...args)=>conversations.push(args),onFinish(){}});
 const m=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true,renderTree:renderControls});
 await m.act(async()=>find(m.tree(),Strip).props.onMode(mode==='gift'?'useItem':mode));
 const click=async element=>{assert.ok(element);await m.act(async()=>element.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));};
 const contact=()=>document.querySelector('[data-unit-id="paroissien"] [data-person-hit-target]');
 assert.match(contact().getAttribute('aria-label'),mode==='gift'?/^Entregar objeto a James Paroissien/:/^Hablar con James Paroissien/);
 await click(contact());
 assert.match(document.querySelector('[role="status"]')?.textContent??'',/El combatiente seleccionado no ve a esta persona/);
 assert.match(document.querySelector('[role="status"]').textContent,/Mirar/);
 assert.doesNotMatch(document.querySelector('[role="status"]').textContent,/hablar|conversar/,'the shared sight guard also receives non-conversation clicks');
 assert.equal(document.querySelector('[role="dialog"]'),null);
 assert.deepEqual(commits,[]);assert.deepEqual(conversations,[]);assert.deepEqual(battle,before,'the explanation does not turn, approach or spend time for the speaker');
 // Use the real look order through the mounted controller, then click the
 // same visible contact. The normal distance/approach gate still applies.
 await m.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'l',bubbles:true})));
 await m.act(async()=>find(m.tree(),Scene).props.onTile({x:6,y:2}));
 await m.render(props());
 assert.equal(commits.length,1);assert.equal(battle.lastError,null);
 assert.deepEqual(battle,actBattle(before,{type:'look',unitId:'speaker',x:6,y:2,aim:0,hitLocation:'torso'}));
 assert.equal(canSee(battle,actor(battle,'speaker'),npc()),true);
 await m.act(async()=>find(m.tree(),Strip).props.onMode('talk'));
 await click(contact());
 assert.ok(document.querySelector('[role="dialog"][aria-label="Conversación con James Paroissien"]'));
 assert.match(document.querySelector('[role="dialog"]').textContent,/Acercate a una casilla contigua/);
 await m.deliver('reachable-preview');
 const approach=[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Acercarse para conversar');
 assert.ok(approach);assert.equal(approach.disabled,false);
 assert.equal([...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Saludar').disabled,true);
 assert.deepEqual(conversations,[],'squad sight cannot bypass personal sight or adjacency');
});
