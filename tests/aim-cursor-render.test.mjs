import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const field=()=>createBattle([{id:'p',x:1,y:1,marksmanship:85,weapon:1800,blade:1810}],{width:8,height:8,seed:45,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:5,y:1,morale:100,overwatch:false}]});
const descendants=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(descendants)];
function hitFrame(s,callbacks={},hitLocation='torso'){
 const element=componentTree(TacticalScene,{state:s,selected:'p',unit:s.units[0],players:[s.units[0]],units:s.units,positions:{},poses:{},directions:{},hover:s.units[1],mode:'fire',aim:2,hitLocation,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onTile:()=>{},onHover:()=>{},onTalk:()=>{},onCannon:()=>{},cannonId:'',...callbacks});
 const person=descendants(element).find(node=>node.props?.['data-unit-id']==='e');return descendants(person).find(node=>node.props?.['data-person-hit-target']);
}
test('reticle shows the body part, full AP cost, remaining AP and four bounded aim indicators',()=>{
 const s=field(),preview=targetPreview(s,s.units[0],s.units[1],{mode:'fire',aim:2,hitLocation:'head'});const html=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:2,preview,target:s.units[1],scale:.5})));
 assert.match(html,/Cabeza/);assert.ok(html.includes(`${preview.pa} PA`));assert.ok(html.includes(`${preview.remaining} PA restantes`));assert.equal((html.match(/class="aim-step filled"/g)||[]).length,2);assert.equal((html.match(/class="aim-step"/g)||[]).length,2);assert.match(html,/pointer-events="none"/);assert.match(html,/scale\(0.5\)/);
});
test('actual sprite pointer handlers select and fire the point clicked instead of a stale menu setting',()=>{
 for(const stance of ['standing','crouched','prone'])for(const [fraction,part] of [[.1,'head'],[.4,'torso'],[.9,'legs']]){
  const s=field();s.units[1].stance=stance;let pointed,clicked;const frame=hitFrame(s,{onHover:target=>pointed=target,onTile:target=>clicked=target},'legs');
  const event={clientY:100+200*fraction,currentTarget:{getBoundingClientRect:()=>({top:100,height:200})}};frame.props.onMouseMove(event);frame.props.onClick(event);assert.equal(pointed.aimLocation,stance==='prone'?'torso':part);assert.equal(clicked.aimLocation,pointed.aimLocation);
  const shot=actBattle(s,{type:'fire',unitId:'p',targetId:clicked.id,hitLocation:clicked.aimLocation,aim:2});assert.equal(shot.lastError,null);
 }
});
test('keyboard focus preserves the current aim region and arrow keys cannot subdivide prone targets',()=>{
 const s=field();let target;let frame=hitFrame(s,{onHover:t=>target=t},'head');frame.props.onFocus();assert.equal(target.aimLocation,'head');frame.props.onKeyDown({key:'ArrowDown',preventDefault(){}});assert.equal(target.aimLocation,'torso');
 s.units[1].stance='prone';frame=hitFrame(s,{onHover:t=>target=t,onTile:t=>target=t},'head');frame.props.onFocus();assert.equal(target.aimLocation,'torso');frame.props.onKeyDown({key:'ArrowUp',preventDefault(){}});assert.equal(target.aimLocation,'torso');frame.props.onKeyDown({key:'Enter',preventDefault(){}});assert.equal(target.aimLocation,'torso');
 const preview=targetPreview(s,s.units[0],s.units[1],{mode:'fire'});assert.match(render(h('svg',null,h(AimCursor,{point:{x:0,y:0},aim:0,preview,target:s.units[1]}))),/Cuerpo/);
});

test('a point shot over an ally reports a tile, not a selectable body part',()=>{
 const s=field(),preview=targetPreview(s,s.units[0],s.units[0],{mode:'fire',aim:0});const html=render(h('svg',null,h(AimCursor,{point:{x:0,y:0},aim:0,preview,target:s.units[0]})));assert.match(html,/Casilla/);assert.doesNotMatch(html,/Torso|Cabeza|Piernas/);
});

test('cursor AP labels stay inside the right edge and above the lower combat log',()=>{
 const s=field(),preview=targetPreview(s,s.units[0],s.units[1],{mode:'fire',aim:1});const html=render(h('svg',null,h(AimCursor,{point:{x:490,y:280},aim:1,preview,target:s.units[1],scale:.5,bounds:{x:0,y:0,width:500,height:300}})));assert.match(html,/<text x="-68" y="-50"/);assert.match(html,/<text x="-68" y="-36"/);
});

test('empty firearm cursor shows a reload arrow and cost, then an X when no cartridges remain',()=>{
 const s=field(),u=s.units[0];u.loaded=0;setTestAmmunition(u,2);
 const draw=()=>render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:4,preview:targetPreview(s,u,s.units[1],{mode:'fire',aim:4}),target:s.units[1]})));
 let html=draw();assert.match(html,/aim-reload/);assert.match(html,/Recargar · \d+ PA/);assert.doesNotMatch(html,/aim-step|Cabeza|Torso|Puntería/);
 setTestAmmunition(u,0);html=draw();assert.match(html,/class="aim-empty"/);assert.match(html,/Sin munición/);assert.match(html,/aim-cursor invalid/);assert.doesNotMatch(html,/aim-reload|aim-step/);
});

test('partial reload reticle shows the immediate cost and the remaining work',()=>{
 const s=field(),u=s.units[0];Object.assign(u,{weapon:1802,loaded:0,ap:20});setTestAmmunition(u,2);
 const preview=targetPreview(s,u,null,{mode:'fire'});
 const html=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:4,preview,target:null})));
 assert.match(html,/Recarga parcial · 20 PA/);assert.match(html,/Faltan 50 PA de recarga/);assert.match(html,/aim-cursor valid/);assert.doesNotMatch(html,/aim-step|Puntería/);
});
