import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,lookPreview,actionCosts,shotChance} from '../game/tactical.js';
import {targetPreview,targetingHelp,tacticalInputAction} from '../game/ja2-hud.js';
import {TACTICAL_KEYS,tacticalShortcut} from '../game/hotkeys.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
const tiles=(w=16,h=8)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w),type:'grass',blocked:false,cover:0}));
const field=(unit={},options={})=>createBattle([{id:'p',x:1,y:1,weapon:1808,ammo:3,blade:1813,...unit}],{width:16,height:8,tiles:tiles(),seed:45,enemies:[{id:'e',x:14,y:6,weapon:1813,loaded:0,ammo:0,patrol:false}],...options});
const look=(s,point={x:5,y:1})=>{const n=actBattle(s,{type:'look',unitId:'p',...point});assert.equal(n.lastError,null,n.lastError);return n;};
const physical=s=>({...s,lastError:null,log:[]});

test('look turns first and a second confirmation prepares the weapon for the displayed cost',()=>{
 let s=field(),u=s.units[0];const point={x:1,y:4},before=structuredClone(s),turn=targetPreview(s,u,point,{mode:'look'});
 assert.equal(turn.actionLabel,'Mirar al S');assert.equal(turn.pa,4);s=look(s,point);assert.equal(s.units[0].ap,96);assert.equal(s.units[0].weaponReady,undefined);assert.deepEqual(before.units[0],u);
 const prepare=targetPreview(s,s.units[0],point,{mode:'look'});assert.equal(prepare.actionLabel,'Preparar el arma');assert.equal(prepare.pa,2);assert.equal(prepare.remaining,94);assert.equal(prepare.valid,true);assert.match(prepare.coverNote,/sin disparar/);
 s=look(s,point);assert.equal(s.units[0].ap,94);assert.equal(s.units[0].weaponReady,true);assert.equal(s.units[0].loaded,2);assert.equal(s.units[0].ammo,3);assert.deepEqual(s.smoke,[]);
 const invalid=actBattle(s,{type:'look',unitId:'p',...point});assert.match(invalid.lastError,/ya está en posición/);assert.deepEqual(physical(invalid),physical(s));
});

test('preparing and firing cost exactly as much as an unprepared first shot, for every stance',()=>{
 for(const stance of ['standing','crouched','prone']){
  const base=field({stance,weapon:1802}),firstCost=actionCosts(base,base.units[0]).fire;const raised=look(base),shot={type:'firePoint',unitId:'p',x:5,y:1};
  const fired=actBattle(raised,shot),direct=actBattle(base,shot);assert.equal(fired.lastError,null);assert.equal(direct.lastError,null);
  assert.equal(fired.units[0].ap,base.units[0].ap-firstCost);assert.equal(fired.units[0].ap,direct.units[0].ap);assert.equal(fired.units[0].loaded,direct.units[0].loaded);assert.equal(fired.units[0].ammo,direct.units[0].ammo);
  assert.equal(raised.units[0].stance,stance);assert.equal(raised.units[0].facing,base.units[0].facing);
 }
});

test('preparation does not spend extra aim, acquire a target, or improve hit chance',()=>{
 const s=field({}, {enemies:[{id:'e',x:5,y:1,weapon:1813,agility:0,overwatch:false}]}),before=shotChance(s,s.units[0],s.units[1],2);
 const n=actBattle(s,{type:'look',unitId:'p',x:5,y:1,aim:4});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,98);assert.equal(n.units[0].lastTargetId,undefined);assert.equal(n.units[0].lastShotPosition,undefined);assert.equal(shotChance(n,n.units[0],n.units[1],2),before);
});

test('the look preview depends on orientation and equipment, not hidden occupants or walls',()=>{
 const s=field(),point={x:6,y:1},copy=structuredClone(s);copy.units[1].x=6;copy.units[1].y=1;copy.tiles.find(t=>t.x===3&&t.y===1).blocked=true;
 assert.deepEqual(lookPreview(s,s.units[0],point),lookPreview(copy,copy.units[0],point));
 const n=look(copy,point);assert.equal(n.units[0].weaponReady,true);assert.equal(n.units[0].loaded,2);assert.equal(n.units[1].hp,100);
});

test('wrong hands and missing guns do not invent a preparation action',()=>{
 for(const patch of [{activeSlot:'blade'},{activeSlot:'medical'},{activeSlot:'unarmed'},{weaponDropped:true},{weapon:1813,loaded:0}]){
  const s=field(patch),preview=targetPreview(s,s.units[0],{x:5,y:1},{mode:'look'});assert.equal(preview.valid,false);assert.equal(preview.pa,0);
  const n=actBattle(s,{type:'look',unitId:'p',x:5,y:1});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
  const turned=look(s,{x:1,y:4});assert.equal(turned.units[0].facing,4);assert.equal(turned.units[0].weaponReady,undefined);
 }
});

test('empty and jammed firearms can be raised without loading, unjamming or gaining a free shot',()=>{
 for(const patch of [{loaded:0,ammo:0},{loaded:0,ammo:2},{jammed:true}]){
  const s=field(patch),n=look(s);assert.equal(n.units[0].loaded,s.units[0].loaded);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.equal(n.units[0].jammed,s.units[0].jammed);
  if(!n.units[0].loaded){assert.equal(tacticalInputAction(n,n.units[0],{type:'firePoint',x:5,y:1}).type,'reload');assert.equal(targetPreview(n,n.units[0],{x:5,y:1},{mode:'fire'}).cursor,n.units[0].ammo?'reload':'empty');}
 }
});

test('unaffordable, invalid-position, incapacitated and wrong-turn orders retain physical state',()=>{
 for(const change of [s=>s.units[0].ap=1,s=>s.units[0].knockedDown=true,s=>{s.units[0].energy=0;s.units[0].unconscious=true;},s=>s.phase='enemy',s=>s.units[0].militia=true]){
  const s=field();change(s);const n=actBattle(s,{type:'look',unitId:'p',x:5,y:1});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
 for(const point of [{x:1,y:1},{x:-1,y:1},{x:1.5,y:1},{x:16,y:2},{x:NaN,y:1},{x:5}]){const s=field();assert.equal(lookPreview(s,s.units[0],point).valid,false);const n=actBattle(s,{type:'look',unitId:'p',...point});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));}
});

test('the last preparation AP can be paid without a remaining shot budget',()=>{
 const s=field();s.units[0].ap=2;const n=look(s);assert.equal(n.units[0].ap,0);assert.equal(n.units[0].weaponReady,true);assert.equal(targetPreview(n,n.units[0],{x:5,y:1},{mode:'fire'}).valid,false);
 const next=endTurn(n);assert.equal(next.units[0].weaponReady,true);assert.equal(actionCosts(next,next.units[0]).ready,0);
});

test('a player can prepare during a real interrupt and resume its saved parent turn',()=>{
 const s=createBattle([{id:'p',x:5,y:2,facing:0,agility:100,weapon:1808}],{width:12,height:8,tiles:tiles(12),seed:45,enemies:[{id:'e',x:5,y:5,facing:0,loaded:0,ammo:2}]});
 const window=endTurn(s);assert.equal(window.phase,'interrupt');const elapsed=window.elapsedSeconds,ap=window.units[0].ap;
 const prepared=look(window,{x:5,y:1});assert.equal(prepared.phase,'interrupt');assert.equal(prepared.units[0].ap,ap-2);assert.equal(prepared.elapsedSeconds,elapsed);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(prepared)));assert.deepEqual(endTurn(restored),endTurn(prepared));
});

test('exploration preparation uses real time and a complete campaign save retains readiness',()=>{
 let c=initialCampaign(45);c.hour=12;c=dispatchCampaign(c,{type:'visitSector'});assert.equal(c.lastError,null);const r=c.pendingBattle;
 let b=createBattle(r.squad.map((u,i)=>({...u,x:1,y:1+i})),{...r,width:16,height:8,tiles:tiles(),enemies:[],props:[],npcs:r.npcs.map((npc,i)=>({...npc,x:14-i,y:6}))});
 const u=b.units.find(u=>u.id==='4'),point={x:5,y:u.y},cost=actionCosts(b,u).ready;
 b=actBattle(b,{type:'look',unitId:u.id,...point});assert.equal(b.lastError,null);assert.equal(b.units.find(v=>v.id===u.id).ap,u.ap);assert.equal(b.elapsedSeconds,Math.max(1,Math.ceil(cost*.06)));
 const pair=syncBattleTime(c,b);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle,pair.battle);assert.equal(saved.battle.units.find(v=>v.id===u.id).weaponReady,true);
});

test('L and the help text describe the existing contextual control without adding another command',()=>{
 assert.equal(tacticalShortcut({key:'l'}),'look');assert.match(TACTICAL_KEYS.find(([key])=>key==='L')[1],/preparar el arma sin disparar/);assert.match(targetingHelp('look',field().units[0]),/misma dirección/);
});
