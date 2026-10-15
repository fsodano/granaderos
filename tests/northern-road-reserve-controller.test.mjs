import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,climbPreview,actionCosts,artilleryCosts,artilleryCrewPlan} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {northernRoadReserveController} from './recovery-road-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {northernHospitalCoverOrder} from './fresh-northern-recovery.mjs';
import {openingControlWindow} from './opening-driver.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';

// Portable current declarations only. No retained campaign failure, fixed
// outcome, returned-state edits or additional stock is an action input.
const flat=(width=40,height=20)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const actor=(b,id)=>b.units.find(u=>u.id===id);
function roofArena({hold=false}={}){
 const upperSurfaces=hold
  ?Array.from({length:9},(_,i)=>({id:`hold:${i}`,x:7+i%3,y:3+Math.floor(i/3),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}))
  :Array.from({length:20},(_,i)=>({id:`lane:${i}`,x:4+i%4,y:4+Math.floor(i/4),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 return createBattle([
  {id:'guard',x:hold?8:5,y:hold?5:6,tacticalLevel:1,weapon:1800,loaded:hold?0:1,ammo:hold?0:5,blade:0,medical:0,medkits:0,marksmanship:90,stance:'standing',facing:hold?4:0,energy:100,morale:90},
  ...(!hold?[{id:'front',x:5,y:4,tacticalLevel:1,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90}]:[]),
 ],{id:'declared-road-spent-roof',width:40,height:20,tiles:flat(),upperSurfaces,hour:12,seed:45,
  climbLinks:hold?[{id:'roof-south-access',kind:'climb',from:{x:8,y:6,tacticalLevel:0},to:{x:8,y:5,tacticalLevel:1}}]:[],
  enemies:[{id:'target',x:hold?8:5,y:hold?7:2,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'spent-reserve-gun',side:'player',type:'bronze4',x:20,y:15,facing:0,loaded:false,ammo:0}],
 });
}
function groundArena({loaded=true,ammo=0,playerGun=true,extraSpent=false}={}){
 return createBattle([
  {id:'crew1',x:5,y:5,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',facing:2,energy:100,morale:90},
  {id:'crew2',x:5,y:6,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'crouched',facing:2,energy:100,morale:90},
 ],{id:'declared-road-charged-reserve',width:20,height:16,tiles:flat(20,16),hour:12,seed:45,
  enemies:[{id:'target',x:14,y:5,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:playerGun?[{id:'reserve-gun',type:'bronze4',side:'player',x:6,y:5,facing:0,loaded,ammo},
   ...(extraSpent?[{id:'other-spent-gun',type:'bronze4',side:'player',x:4,y:10,facing:0,loaded:false,ammo:0}]:[])]:[],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function retained(start,after){
 for(const key of ['tiles','upperSurfaces','climbLinks','artillery'])assert.deepEqual(after[key],start[key]);
 for(const u of start.units.filter(u=>u.side==='player'))for(const key of ['hp','maxHp','bleeding','medkits','inventory','weapon','blade','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(actor(after,u.id)[key],u[key],`${u.id}: ${key}`);
}

test('an initially spent reserve pays a same-roof lane and finite rifle shot instead of changing posture without useful work',()=>{
 const start=roofArena(),before=structuredClone(start),guard=actor(start,'guard'),policy=northernRoadReserveController(start);
 assert.equal(start.artillery[0].loaded,false);assert.equal(start.artillery[0].ammo,0);assert.equal(usefulRouteRifleShot(publicRouteView(start,guard),guard),null);
 const move=policy(start,guard);assert.equal(move?.type,'move');assert.ok(sameSurface(move,guard));
 const quote=getReachable(publicRouteView(start,guard),guard,{stopAt:p=>sameCell(p,move)})[0];assert.ok(quote.cost>0&&quote.cost<=20);
 const moved=replay(start,[move]),member=actor(moved,'guard');assert.equal(member.ap,guard.ap-quote.cost);assert.ok(member.energy<guard.energy);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const fire=policy(moved,member);assert.equal(fire?.type,'fire');const cost=actionCosts(moved,member,actor(moved,fire.targetId));
 const after=replay(start,[move,fire]);assert.equal(actor(after,'guard').ap,member.ap-cost.fire-(fire.aim??0)*cost.aim);assert.equal(actor(after,'guard').loaded,guard.loaded-1);assert.equal(after.elapsedSeconds,moved.elapsedSeconds);assert.equal(actor(after,'guard').stance,'standing');
 const total=u=>Object.values(unitAmmunitionByType(u)).reduce((a,b)=>a+b,0);assert.equal(total(actor(after,'guard')),total(guard)-1);retained(start,after);assert.deepEqual(start,before);
});

test('an initially spent reserve holds its actual roof role across idle callbacks rather than paying a descent or stance loop',()=>{
 const start=roofArena({hold:true}),before=structuredClone(start),guard=actor(start,'guard'),policy=northernRoadReserveController(start),ordinary=northernHospitalCoverOrder(start,guard);
 assert.deepEqual(ordinary,{type:'climb',unitId:guard.id,linkId:'roof-south-access'});const quote=climbPreview(start,guard,ordinary);assert.equal(quote.valid,true);assert.ok(quote.pa>0);
 for(let pass=0;pass<4;pass++){
  assert.equal(policy(start,guard),null);const window=openingControlWindow(start,{controller:policy});assert.deepEqual(window.orders,[]);assert.equal(window.actions,0);assert.deepEqual(window.battle,start);
 }
 assert.equal(policy.sharedFallback,undefined);assert.deepEqual(start,before);
});

test('any actual charged player piece retains the complete coastal crew policy and its finite Native cannon payment',()=>{
 for(const options of [{loaded:true,ammo:0},{loaded:false,ammo:1},{loaded:true,ammo:0,extraSpent:true}]){
  const start=groundArena(options),before=structuredClone(start),policy=northernRoadReserveController(start),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
  for(const u of start.units.filter(u=>u.side==='player'))assert.deepEqual(policy(start,u),ordinary(start,u));
  if(options.loaded&&!options.extraSpent){
   const leader=actor(start,'crew1'),action=policy(start,leader);assert.equal(action?.type,'artillery');const gun=start.artillery[0],cost=artilleryCosts(start,leader,gun).fire,crew=artilleryCrewPlan(start,leader,gun,cost);assert.equal(crew.reason,null);
   const after=replay(start,[action]);assert.equal(after.artillery[0].loaded,false);assert.equal(after.artillery[0].ammo,0);for(const id of crew.crew)assert.equal(actor(after,id).ap,actor(start,id).ap-cost);
   assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);for(const u of after.units.filter(u=>u.side==='player'))assert.deepEqual(policy(after,u),ordinary(after,u),'selection remains coastal after the real final charge');
  }
  assert.deepEqual(start,before);
 }
});

test('absence of a player battery retains the ordinary coastal policy instead of adding a hospital roof role',()=>{
 const start=groundArena({playerGun:false}),before=structuredClone(start),policy=northernRoadReserveController(start),ordinary=coastalBatteryController(start,{sharedArtillerySight:true});
 for(const u of start.units.filter(u=>u.side==='player')){const action=policy(start,u);assert.deepEqual(action,ordinary(start,u));if(action)replay(start,[action]);}
 assert.deepEqual(start,before);
});
