import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts,pointFirePreview,contextualAttack,canSee} from '../game/tactical.js';
import {targetPreview,aimOptions,tacticalInputAction} from '../game/ja2-hud.js';
import {rightClickAim} from '../game/aim-cursor.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const tiles=Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const field=(unit={},options={})=>createBattle([{id:'p',x:10,y:5,weapon:1808,ammo:3,facing:2,...unit}],{width:24,height:12,tiles,seed:45,enemies:[{id:'e',x:23,y:11,weapon:1813,patrol:false}],...options});
const act=(s,a)=>{const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,next.lastError);return next;};
const physical=s=>({...s,log:[],lastError:null});
const north={x:10,y:1},east={x:15,y:5},west={x:5,y:5},northeast={x:14,y:1};

test('shot preparation combines turning and raising by stance, including angular limits for ready weapons',()=>{
 for(const [stance,ready,point,turn,raise,total] of [
  ['standing',false,east,0,2,8],['standing',false,north,4,2,10],['standing',true,north,4,0,10],['standing',true,west,8,2,14],
  ['crouched',true,northeast,2,0,8],['crouched',true,north,4,2,10],['crouched',false,north,4,2,10],
  ['prone',true,east,0,0,6],['prone',true,northeast,4,2,12],['prone',false,north,8,2,16]]){
  const s=field({stance}),u=s.units[0];u.weaponReady=ready;
  const c=actionCosts(s,u,point);assert.equal(c.turn,turn);assert.equal(c.ready,raise);assert.equal(c.fire,total);
  const preview=targetPreview(s,u,point,{mode:'fire',aim:2});assert.equal(preview.pa,total+6);
  const n=act(s,{type:'firePoint',...point,aim:2});assert.equal(n.units[0].ap,u.ap-preview.pa);assert.equal(n.units[0].loaded,u.loaded-1);assert.equal(n.units[0].ammo,u.ammo);assert.equal(n.units[0].weaponReady,true);
 }
});

test('a second shot in the same direction has no turn cost, while reversing direction does',()=>{
 const s=field(),turned=act(s,{type:'firePoint',...north});assert.equal(turned.units[0].facing,0);assert.equal(turned.units[0].ap,90);
 const follow=act(turned,{type:'firePoint',...north});assert.equal(follow.units[0].ap,84);
 assert.equal(actionCosts(turned,turned.units[0],{x:10,y:9}).fire,14);
});

test('a visible named target and ground point use the same cost without inspecting hidden occupants',()=>{
 const s=field({}, {enemies:[{id:'e',...north,weapon:1813,agility:0,overwatch:false}]}),u=s.units[0],e=s.units[1];
 assert.equal(canSee(s,u,e),true);
 for(const type of ['fire','useItem']){const p=targetPreview(s,u,e,{mode:type,aim:1});assert.equal(p.pa,13);assert.equal(contextualAttack(s,u,e,{type,aim:1}).pa,p.pa);const n=act(s,{type,targetId:'e',aim:1});assert.equal(n.units[0].ap,87);}
 const base=pointFirePreview(s,u,north,1);s.units[1].x=23;s.units[1].y=11;assert.deepEqual(pointFirePreview(s,u,north,1),base);
 const empty=targetPreview(s,u,north,{mode:'fire',aim:1});s.units[1].x=north.x;s.units[1].y=north.y;s.night=true;u.facing=4;
 const hidden=pointFirePreview(s,u,north,1);s.units[1].hp=15;s.units[1].stance='prone';assert.deepEqual(pointFirePreview(s,u,north,1),hidden);assert.equal(empty.pa,base.pa);
});

test('turning cannot spend an unavailable AP, charge ammunition, or change facing on a rejected shot',()=>{
 for(const type of ['firePoint','fire','useItem']){
  const s=field({ap:9},{enemies:[{id:'e',...north,weapon:1813,overwatch:false}]}),u=s.units[0];u.ap=9;
  const a=type==='firePoint'?{type,...north}:{type,targetId:'e'};const p=targetPreview(s,u,north,{mode:type==='firePoint'?'fire':type});assert.equal(p.valid,false);assert.equal(p.pa,10);
  const n=actBattle(s,{unitId:'p',...a});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
});

test('aim limits and right-click cycling reserve the target-specific turn cost',()=>{
 const s=field({}, {enemies:[{id:'e',...north,weapon:1813,overwatch:false}]}),u=s.units[0],target=s.units[1];u.ap=14;
 assert.deepEqual(aimOptions(s,u,{target}).filter(o=>!o.disabled).map(o=>o.level),[0,1]);
 assert.equal(rightClickAim(s,u,{mode:'fire',aim:1,target}).aim,0);
 assert.equal(rightClickAim(s,u,{mode:'fire',aim:0,target}).aim,1);
 const n=act(s,{type:'fire',targetId:'e',aim:1});assert.equal(n.units[0].ap,1);
});

test('manual looking applies the same readiness limits without charging raising until requested',()=>{
 for(const [stance,point,ready] of [['standing',north,true],['standing',west,false],['crouched',northeast,true],['crouched',north,false],['prone',northeast,false]]){
  const s=field({stance});s.units[0].weaponReady=true;const turn=actionCosts(s,s.units[0],point).turn;
  const n=act(s,{type:'look',...point});assert.equal(n.units[0].ap,s.units[0].ap-turn);assert.equal(Boolean(n.units[0].weaponReady),ready);
  const fire=actionCosts(n,n.units[0],point);assert.equal(fire.turn,0);assert.equal(fire.ready,ready?0:2);
 }
});

test('reloading an empty firearm never pays a target turn cost or changes its facing',()=>{
 const s=field(),u=s.units[0];u.loaded=0;setTestAmmunition(u,1);
 const a=tacticalInputAction(s,u,{type:'firePoint',...west,aim:4}),p=targetPreview(s,u,west,{mode:'fire',aim:4});assert.equal(a.type,'reload');assert.equal(p.pa,28);
 const n=act(s,a);assert.equal(n.units[0].ap,72);assert.equal(n.units[0].facing,2);assert.equal(n.units[0].ammo,0);assert.equal(n.units[0].loaded,1);
});

test('AI cannot choose an unaffordable shot by omitting its turn cost',()=>{
 const s=field({}, {enemies:[{id:'e',x:14,y:5,facing:4,weapon:1808,agility:0,overwatch:false}]}),e=s.units[1];e.weaponReady=true;e.ap=9;
 assert.notEqual(chooseEnemyAction(s,e)?.type,'fire');
 e.ap=10;const order=chooseEnemyAction(s,e);assert.equal(order.type,'fire');assert.equal(order.aim,0);assert.equal(order.targetId,'p');
});

test('exploration uses the full combined shot duration without spending combat AP',()=>{
 const s=field({stance:'prone'},{exploration:true,enemies:[]}),u=s.units[0];u.ap=3;
 const p=pointFirePreview(s,u,north,4);assert.equal(p.pa,28);const n=act(s,{type:'firePoint',...north,aim:4});
 assert.equal(n.units[0].ap,3);assert.equal(n.elapsedSeconds-s.elapsedSeconds,2);assert.equal(n.units[0].facing,0);
});

test('a saved real interrupt retains the turned facing and exact follow-up shot budget',()=>{
 const s=createBattle([{id:'p',x:5,y:2,facing:0,agility:100,hp:200,maxHp:200,marksmanship:0}],{width:24,height:12,tiles,seed:45,enemies:[{id:'e',x:5,y:5,facing:2,weapon:1808,loaded:2,ammo:0,marksmanship:100,agility:0,overwatch:false}]});s.units[1].ap=16;
 const interrupted=endTurn(s);assert.equal(interrupted.phase,'interrupt');const e=interrupted.units[1];assert.equal(e.facing,0);assert.equal(e.ap,6);assert.equal(e.loaded,1);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(interrupted)));assert.deepEqual(endTurn(saved),endTurn(interrupted));assert.equal(endTurn(saved).units[1].loaded,0);
});
