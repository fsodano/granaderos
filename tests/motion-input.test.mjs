import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {actBattle,createBattle} from '../game/tactical.js';
import {orderDescriptors} from '../game/ja2-hud.js';
const {motionActivity}=await import('../web/app/useUnitMotion.ts');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');

const walking=(actor)=>({x:actor.x-.25,y:actor.y,direction:3,frame:2,moving:true});
function field(){
 const tiles=Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}));
 return createBattle([{id:'scout',x:1,y:5},{id:'partner',x:2,y:5}],{width:8,height:8,tiles,exploration:true,enemies:[],
  npcs:[{id:'civilian',name:'Vecina',x:4,y:2,ai:{cycle:0,wait:0,activity:'roaming',destination:{x:6,y:2}}}]});
}
const movementEnabled=(battle,positions)=>!orderDescriptors(battle,battle.units[0],{busy:motionActivity(battle,positions).blocking}).find(a=>a.id==='move').disabled;

test('a real civilian routine stays animated while exploration orders remain available',()=>{
 const before=field(),battle=actBattle(before,{type:'ambient'}),npc=battle.npcs[0];
 assert.equal(battle.lastError,null);assert.equal(battle.mode,'exploration');
 assert.ok(npc.lastMovePath.length>0);assert.notDeepEqual([npc.x,npc.y],[before.npcs[0].x,before.npcs[0].y]);
 const positions={[npc.id]:walking(npc)},saved=structuredClone(positions);
 assert.deepEqual(motionActivity(battle,positions),{moving:true,blocking:false});
 assert.equal(movementEnabled(battle,positions),true);
 const html=render(h('svg',null,h(TacticalScene,{state:battle,players:battle.units,units:battle.units,positions,poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14})})));
 assert.match(html,/data-unit-id="civilian"[^>]*data-moving="true"/);
 assert.deepEqual(positions,saved,'input availability must not stop or snap civilian animation');
 const moved=actBattle(battle,{type:'move',unitId:'partner',x:2,y:4});
 assert.equal(moved.lastError,null);assert.equal(moved.units[1].ap,battle.units[1].ap);assert.ok(moved.units[1].energy<battle.units[1].energy);
 positions.partner=walking(moved.units[1]);
 assert.deepEqual(motionActivity(moved,positions),{moving:true,blocking:true});
 assert.equal(movementEnabled(moved,positions),false,'squad movement must still block another order');
 positions.partner.moving=false;
 assert.deepEqual(motionActivity(moved,positions),{moving:true,blocking:false},'orders resume when the squad stops, even if the civilian is still walking');
});

test('exploration blocks movement from every player actor, including another mercenary, militia and mission allies',()=>{
 for(const extra of [{},{militia:true},{missionAlly:true}]){
  const battle=field();Object.assign(battle.units[1],extra);
  const positions={partner:walking(battle.units[1]),civilian:walking(battle.npcs[0])};
  assert.equal(motionActivity(battle,positions).blocking,true);assert.equal(movementEnabled(battle,positions),false);
 }
});

test('contact immediately blocks ongoing enemy or civilian animation and exploration releases it',()=>{
 const battle=field();battle.units.push({...battle.units[1],id:'patrol',side:'enemy',x:7,y:7});
 for(const actor of [battle.units.at(-1),battle.npcs[0]]){
  const positions={[actor.id]:walking(actor)};
  assert.deepEqual(motionActivity(battle,positions),{moving:true,blocking:false});
  assert.deepEqual(motionActivity({...battle,mode:'combat'},positions),{moving:true,blocking:true});
  assert.deepEqual(motionActivity({...battle,mode:'combat',phase:'interrupt'},positions),{moving:true,blocking:true});
  assert.deepEqual(motionActivity(battle,positions),{moving:true,blocking:false});
 }
});

test('finished tracks and actors no longer on the field cannot leave input locked',()=>{
 for(const change of [u=>u.departure={exitId:'west'},u=>u.fled=true,u=>u.hp=0,u=>u.unconscious=true]){
  const battle=field(),positions={partner:walking(battle.units[1])};change(battle.units[1]);
  assert.deepEqual(motionActivity(battle,positions),{moving:false,blocking:false});
 }
 const battle=field(),positions={absent:walking({x:3,y:3}),partner:{...walking(battle.units[1]),moving:false}};
 assert.deepEqual(motionActivity(battle,positions),{moving:false,blocking:false});
 assert.deepEqual(motionActivity({...battle,mode:'combat'},positions),{moving:false,blocking:false});
 assert.deepEqual(motionActivity(battle,{}),{moving:false,blocking:false});
});
