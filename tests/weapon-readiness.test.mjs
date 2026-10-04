import {changeAmmo} from '../game/ammo-types.js';
import {syncCarriedAmmunition} from '../game/physical-ammunition.js';
import {withCarriedAmmo} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts,WEAPONS,planEquipLoot} from '../game/tactical.js';
import {WEAPON_READY_AP} from '../game/weapon-readiness.js';
import {targetPreview,aimOptions,equippedItemHelp} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {extractItemQuantity,applyItemQuantity} from '../game/tactical-inventory.js';
import {refreshCondition} from '../game/tactical-condition.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const tiles=(w=32,h=8)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w),type:'grass',cover:0,blocked:false}));
const field=(unit={},options={})=>createBattle([{id:'p',name:'Tirador',x:1,y:1,weapon:1808,ammo:3,blade:1813,...unit}],{width:32,height:8,tiles:tiles(),seed:45,enemies:[{id:'e',x:30,y:6,patrol:false,weapon:1813,loaded:0,ammo:0}],...options});
const act=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const shoot=s=>act(s,{type:'firePoint',x:6,y:1});
const physical=s=>({...s,lastError:null,log:[]});

test('each firearm splits its existing first-shot total without increasing it',()=>{
 for(const [weapon,w] of Object.entries(WEAPONS)){
  const s=field({weapon:Number(weapon)}),u=s.units[0],c=actionCosts(s,u);
  assert.equal(c.fire,w.fireAP);assert.equal(c.ready,WEAPON_READY_AP[weapon]);assert.equal(c.discharge+c.ready,c.fire);
  u.weaponReady=true;const prepared=actionCosts(s,u);assert.equal(prepared.ready,0);assert.equal(prepared.fire,c.discharge);assert.ok(prepared.fire>0);
 }
});

test('two real shots pay the raising cost once, use two charges, and preserve the source',()=>{
 const s=field(),copy=structuredClone(s),first=shoot(s),second=shoot(first);
 assert.deepEqual(s,copy);assert.equal(first.units[0].ap,92);assert.equal(first.units[0].loaded,1);assert.equal(first.units[0].weaponReady,true);
 assert.equal(second.units[0].ap,86);assert.equal(second.units[0].loaded,0);assert.equal(second.units[0].ammo,3);
 assert.doesNotThrow(()=>validateBattleSnapshot(second));
});

test('the target preview and aim budget expose preparation and discharge separately',()=>{
 let s=field();const point={x:6,y:1},before=targetPreview(s,s.units[0],point,{mode:'fire',aim:2});
 assert.equal(before.pa,14);assert.match(before.coverNote,/Preparar: 2 PA · disparar: 6 PA/);
 assert.match(equippedItemHelp(s,s.units[0],{mode:'fire'}),/Preparar: 2 PA/);
 s=shoot(s);const u=s.units[0],after=targetPreview(s,u,point,{mode:'fire',aim:2});assert.equal(after.pa,12);assert.match(after.coverNote,/Arma en posición de tiro/);
 assert.equal(aimOptions(s,u)[2].pa,after.pa);assert.match(equippedItemHelp(s,u,{mode:'fire'}),/Arma en posición de tiro/);
});

test('changing cursor settings has no simulation effect and cannot grant a free ready weapon',()=>{
 const s=field(),copy=structuredClone(s);
 for(const aim of [0,1,4,0])for(const point of [null,{x:5,y:1},{x:2,y:4}]){targetPreview(s,s.units[0],point,{mode:'fire',aim});aimOptions(s,s.units[0],{aim});}
 assert.deepEqual(s,copy);assert.equal(s.units[0].weaponReady,undefined);assert.equal(actionCosts(s,s.units[0]).fire,8);
});

test('readiness survives a real turn boundary and permits an otherwise unaffordable second shot',()=>{
 let s=shoot(field());s=endTurn(s);assert.equal(s.turn,2);assert.equal(s.units[0].weaponReady,true);
 s.units[0].ap=6;assert.equal(targetPreview(s,s.units[0],{x:6,y:1},{mode:'fire'}).valid,true);
 s=shoot(s);assert.equal(s.units[0].ap,0);assert.equal(s.units[0].loaded,0);
});

test('movement, loading, stance, handling supplies and changing hands lower the weapon',()=>{
 const base=shoot(field({medical:80,hp:80,bandaged:20}));
 for(const a of [{type:'move',x:2,y:1},{type:'reload'},{type:'stance',stance:'crouched'},{type:'weapon',slot:'medical'},{type:'drop',item:'inventory:ammo:pistol_69',count:1},{type:'repair'}]){
  const s=structuredClone(base);s.units[0].ap=100;const n=act(s,a);assert.equal(n.units[0].weaponReady,undefined,JSON.stringify(a));
  if(n.units[0].activeSlot==='primary')assert.equal(actionCosts(n,n.units[0]).ready,2);
 }
});

test('a quarter-turn retains readiness standing but lowers it crouched or prone',()=>{
 for(const stance of ['standing','crouched','prone']){
  let s=shoot(field({stance}));const before=s.units[0].ap;s=act(s,{type:'look',x:1,y:4});
  assert.ok(s.units[0].ap<before);assert.equal(s.units[0].weaponReady,stance==='standing'?true:undefined);
 }
});

test('free stealth, movement-mode and overwatch controls do not change readiness',()=>{
 for(const prepared of [false,true]){
  let s=prepared?shoot(field()):field();const ap=s.units[0].ap;
  for(const a of [{type:'stealth',enabled:true},{type:'overwatch'},{type:'overwatch'},{type:'movement',movement:'run'}])s=act(s,a);
  assert.equal(s.units[0].weaponReady,prepared?true:undefined);assert.equal(s.units[0].ap,ap);
 }
});

test('rejected actions retain readiness, AP, ammunition and physical state',()=>{
 const base=shoot(field());
 for(const a of [{type:'move',x:-1,y:0},{type:'weapon',slot:'missing'},{type:'reload'},{type:'firePoint',x:1,y:1},{type:'fire',targetId:'missing'}]){
  const s=structuredClone(base);s.units[0].ap=0;const n=actBattle(s,{unitId:'p',...a});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
});

test('a misfire has raised the gun, but paid repriming lowers it',()=>{
 const s=field({}, {weather:{rain:100,humidity:100},seed:1}),failed=shoot(s);assert.equal(failed.units[0].jammed,true);assert.equal(failed.units[0].loaded,2);assert.equal(failed.units[0].weaponReady,true);
 const fixed=act(failed,{type:'reprime'});assert.equal(fixed.units[0].weaponReady,undefined);assert.equal(actionCosts(fixed,fixed.units[0]).ready,2);assert.equal(fixed.units[0].loaded,2);
});

test('readiness belongs to the actor and cannot be packed, passed, or inherited with a gun',()=>{
 const s=shoot(field()),u=s.units[0],out=extractItemQuantity(u,'primary');assert.equal(out.unit.weaponReady,undefined);assert.equal(out.stack.weaponReady,undefined);
 const receiver=applyItemQuantity({...u,id:'r',weaponReady:true},out.stack),equipped=planEquipLoot(receiver,Object.keys(receiver.inventory).find(key=>receiver.inventory[key].weapon));
 assert.equal(equipped.weaponReady,undefined);assert.equal(actionCosts(s,equipped).ready,2);assert.equal(equipped.loaded,1);
});

test('collapse and knockdown remove readiness, and malformed ready states cannot load',()=>{
 for(const change of [u=>u.hp=0,u=>u.hp=14,u=>u.energy=0,u=>u.knockedDown=true]){const u=shoot(field()).units[0];change(u);refreshCondition(u);assert.equal(u.weaponReady,undefined);}
 for(const change of [u=>u.weaponReady='true',u=>u.activeSlot='blade',u=>u.weaponDropped=true,u=>u.knockedDown=true,u=>u.routed=true,u=>u.surrendered=true,u=>u.weapon=1813]){
  const s=shoot(field());change(s.units[0]);assert.throws(()=>validateBattleSnapshot(s));
 }
});

test('AI and player-known state use the ready cost without exposing enemy readiness',()=>{
 const s=field({}, {enemies:[{id:'e',x:6,y:1,weapon:1808}]}),e=s.units[1];e.weaponReady=true;e.ap=6;
 assert.equal(chooseEnemyAction(s,e).type,'fire');
 s.units[0].weaponReady=true;const known=playerKnownBattle(s);assert.equal(known.units.find(u=>u.id==='p').weaponReady,true);assert.equal(known.units.find(u=>u.id==='e').weaponReady,undefined);
});

test('a named shot and a point shot share the same ready state',()=>{
 let s=field({}, {enemies:[{id:'e',x:6,y:1,weapon:1813,agility:0,overwatch:false}]});
 s=act(s,{type:'fire',targetId:'e'});const ap=s.units[0].ap;assert.equal(s.units[0].weaponReady,true);
 const n=shoot(s);assert.equal(n.units[0].ap,ap-6);assert.equal(n.units[0].loaded,0);
});

test('a complete campaign save preserves the cheaper follow-up shot',()=>{
 let c=initialCampaign(45);c.hour=12;c.loadouts[3]={weapon:1808,blade:1813};c=withCarriedAmmo(c,3,'ammoPistol',9);changeAmmo(c.operativeState[3],'ammoPistol',-1);c.operativeState[3].carriedLoaded=2;syncCarriedAmmunition(c.operativeState[3],1808);c=dispatchCampaign(c,{type:'visitSector'});assert.equal(c.lastError,null);const r=c.pendingBattle;
 let b=createBattle(r.squad.map((u,i)=>({...u,x:1,y:1+i})),{...r,width:32,height:8,tiles:tiles(),enemies:[],props:[],npcs:r.npcs.map((npc,i)=>({...npc,x:28-i,y:6}))});
 b=actBattle(b,{type:'firePoint',unitId:'3',x:6,y:1});assert.equal(b.lastError,null);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle)),u=saved.battle.units.find(u=>u.id==='3');assert.equal(u.weaponReady,true);assert.equal(actionCosts(saved.battle,u).fire,6);
 const shot={type:'firePoint',unitId:'3',x:6,y:1};assert.deepEqual(actBattle(saved.battle,shot),actBattle(pair.battle,shot));
 const fresh=createBattle([{...u,x:1,y:1}],{width:32,height:8,tiles:tiles(),enemies:[],exploration:true});assert.equal(fresh.units[0].weaponReady,undefined,'new deployments begin with lowered weapons');
});

test('an enemy interrupted after its first shot keeps readiness when its saved turn resumes',()=>{
 const s=createBattle([{id:'p',x:5,y:2,facing:0,agility:100,hp:200,maxHp:200,marksmanship:0}],{width:12,height:8,tiles:tiles(12),seed:45,enemies:[{id:'e',x:5,y:5,facing:0,weapon:1808,loaded:2,ammo:0,marksmanship:100,agility:0,overwatch:false}]});s.units[1].ap=14;
 const interrupted=endTurn(s);assert.equal(interrupted.phase,'interrupt');const e=interrupted.units[1];assert.equal(e.weaponReady,true);assert.equal(e.loaded,1);assert.equal(e.ap,6);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(interrupted))),continued=endTurn(restored);assert.deepEqual(continued,endTurn(interrupted));
 assert.equal(continued.units[1].loaded,0);assert.equal(continued.units[1].ap,0);assert.equal(continued.units[1].weaponReady,true);
});

test('a real paid handoff lowers both the giver and receiver weapons',()=>{
 let s=field();s.units.push({...structuredClone(s.units[0]),id:'r',x:2,y:1,weaponReady:true});s.units[0].weaponReady=true;
 const n=act(s,{type:'transfer',targetId:'r',item:'inventory:ammo:pistol_69',count:1});assert.equal(n.units[0].weaponReady,undefined);assert.equal(n.units[2].weaponReady,undefined);assert.equal(n.units[0].ammo,2);assert.equal(n.units[2].ammo,4);
});
