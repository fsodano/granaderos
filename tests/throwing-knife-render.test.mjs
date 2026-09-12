import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,getKnifeThrowVisual} from '../game/tactical.js';
import {targetPreview,knifeThrowInputAction} from '../game/ja2-hud.js';
import {heldThrowingKnife} from '../game/thrown-knife.js';
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:KnifeThrowEffect,KNIFE_EFFECT_DURATION}=await import('../web/app/KnifeThrowEffect.tsx');
const field=()=>createBattle([{id:'p',name:'Lanzador',x:1,y:1,facing:2,marksmanship:85,dexterity:85,agility:85,strength:85,weapon:1800,blade:1813,activeSlot:'blade'}],{width:8,height:8,seed:45,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',name:'Guardia',x:5,y:1,morale:100,overwatch:false,patrol:false}]});
const descendants=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(descendants)];
function hitFrame(s,callbacks={},hitLocation='torso',id='e'){
 const element=componentTree(TacticalScene,{state:s,selected:'p',unit:s.units[0],players:[s.units[0]],units:s.units,positions:{},poses:{},directions:{},hover:s.units[1],mode:'throwKnife',aim:2,hitLocation,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onTile:()=>{},onHover:()=>{},onTalk:()=>{},onCannon:()=>{},cannonId:'',...callbacks});
 const person=descendants(element).find(node=>node.props?.['data-unit-id']===id);return descendants(person).find(node=>node.props?.['data-person-hit-target']);
}
const pointer=fraction=>({clientY:100+200*fraction,currentTarget:{getBoundingClientRect:()=>({top:100,height:200})}});

test('knife sprite hit frames choose body regions and confirm one finite throw for each posture',()=>{
 for(const stance of ['standing','crouched','prone'])for(const [fraction,part] of [[.1,'head'],[.4,'torso'],[.9,'legs']]){
  const s=field();s.units[1].stance=stance;let pointed,clicked;
  const frame=hitFrame(s,{onHover:t=>pointed=t,onTile:t=>clicked=t},'legs');
  frame.props.onMouseMove(pointer(fraction));frame.props.onClick(pointer(fraction));
  assert.equal(pointed.aimLocation,stance==='prone'?'torso':part);assert.equal(clicked.aimLocation,pointed.aimLocation);
  const preview=targetPreview(s,s.units[0],clicked,{mode:'throwKnife',aim:2,hitLocation:clicked.aimLocation});
  const next=actBattle(s,{unitId:'p',...knifeThrowInputAction(s,s.units[0],clicked,{aim:2,hitLocation:clicked.aimLocation})});
  assert.equal(next.lastError,null);assert.equal(next.units[0].ap,s.units[0].ap-preview.pa);assert.equal(next.units[0].energy,s.units[0].energy-6);assert.equal(heldThrowingKnife(next.units[0]),null);assert.equal(next.units[0].loaded,s.units[0].loaded);
 }
});

test('keyboard knife aiming supports arrows and Enter/Space with a single prone region',()=>{
 for(const stance of ['standing','prone'])for(const key of ['Enter',' ']){
  const s=field();s.units[1].stance=stance;let target;
  let frame=hitFrame(s,{onHover:t=>target=t},'head');frame.props.onFocus();assert.equal(target.aimLocation,stance==='prone'?'torso':'head');
  frame.props.onKeyDown({key:'ArrowDown',preventDefault(){}});assert.equal(target.aimLocation,'torso');
  frame=hitFrame(s,{onHover:t=>target=t,onTile:t=>target=t},'torso');frame.props.onKeyDown({key:'ArrowDown',preventDefault(){}});assert.equal(target.aimLocation,stance==='prone'?'torso':'legs');
  frame=hitFrame(s,{onTile:t=>target=t},target.aimLocation);frame.props.onKeyDown({key,preventDefault(){}});
  assert.equal(actBattle(s,{unitId:'p',...knifeThrowInputAction(s,s.units[0],target,{hitLocation:target.aimLocation})}).lastError,null);
 }
});

test('NPC click and keyboard activation in knife mode reach point targeting without opening dialogue',()=>{
 const s=field();s.npcs=[{id:'civil',name:'Vecino',x:3,y:2,stance:'standing'}];let clicked,talked=false;
 const frame=hitFrame(s,{onTile:t=>clicked=t,onTalk:()=>talked=true},'head','civil');assert.ok(frame);assert.match(frame.props['aria-label'],/Lanzar a la casilla de Vecino/);
 for(const input of [()=>frame.props.onClick(pointer(.1)),()=>frame.props.onKeyDown({key:'Enter',preventDefault(){}})]){
  input();assert.equal(talked,false);assert.equal(clicked.id,'civil');
  assert.deepEqual(knifeThrowInputAction(s,s.units[0],clicked,{hitLocation:clicked.aimLocation}),{type:'throwKnife',aim:0,x:3,y:2,tacticalLevel:0,hitLocation:'torso'});
 }
});

test('knife cursor shows body aim, AP and energy and never displays firearm reload text',()=>{
 for(const situation of ['ready','missing','point','prone']){
  const s=field(),u=s.units[0];if(situation==='missing')u.blade=null;if(situation==='prone')s.units[1].stance='prone';const target=situation==='point'?{x:4,y:2}:s.units[1];
  const preview=targetPreview(s,u,target,{mode:'throwKnife',aim:2,hitLocation:situation==='prone'?'torso':'head'});
  const html=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:2,preview,target})));
  assert.match(html,/Facón/);assert.ok(html.includes(`${preview.pa} PA`));assert.match(html,/6 EN/);assert.doesNotMatch(html,/cartuchos|Recargar|recarga|aim-reload/);
  assert.match(html,situation==='missing'?/aim-cursor invalid/:/aim-cursor valid/);
  assert.match(html,situation==='point'?/Casilla/:situation==='prone'?/Cuerpo/:/Cabeza/);
 }
});

test('finite knife overlay uses the observed physical flight and does not resolve hidden actors',()=>{
 const s=field(),next=actBattle(s,{type:'throwKnife',unitId:'p',targetId:'e',aim:2});const visual=getKnifeThrowVisual(s,next);assert.ok(visual);
 const project=(x,y)=>({x:x*26,y:y*14}),draw=value=>render(h('svg',null,h(KnifeThrowEffect,{state:s,visual:value,project})));
 const html=draw(visual);assert.match(html,/data-knife-flight/);assert.match(html,/data-knife-shadow/);assert.match(html,/animateMotion/);assert.match(html,/dur="0.35s"/);assert.match(html,/dur="0.55s"/);assert.match(html,/aria-hidden="true"/);assert.ok(KNIFE_EFFECT_DURATION>=550&&KNIFE_EFFECT_DURATION<1000);assert.doesNotMatch(html,/Guardia|Lanzador|Infinity|NaN/);
 s.units.push({id:'hidden',x:2,y:1,tacticalLevel:1,hp:100});assert.equal(draw(visual),html);
 assert.doesNotMatch(draw({...visual,visible:false}),/data-knife-flight/);assert.doesNotMatch(draw(null),/data-knife-flight/);
 const upstairs={...visual,source:{...visual.source,tacticalLevel:1,height:4.4},impact:{...visual.impact,height:4.1}};
 assert.notEqual(draw(upstairs),html);assert.doesNotMatch(draw({...visual,impact:{...visual.impact,height:Infinity}}),/data-knife-flight/);
});

test('exploration knife reticle keeps aim and energy while omitting AP counters',()=>{
 const s=field();s.mode='exploration';const target={x:4,y:2};
 const preview=targetPreview(s,s.units[0],target,{mode:'throwKnife',aim:2});
 const html=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:2,preview,target,exploring:true})));
 assert.match(html,/Facón/);assert.match(html,/6 EN/);assert.match(html,/Puntería 2 de 4/);assert.doesNotMatch(html,/\bPA\b/);
});
