import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,canSee,teamCanSee,actionCosts,medicalUsePreview,lookPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {knownRouteBystanderShotSafety} from './route-fire-safety.mjs';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {northernRoadReserveController} from './recovery-road-route.mjs';

const actor=(b,id)=>b.units.find(u=>u.id===id);
// Current declarations only: a blind ground rifleman, an actual observer and
// an already empty piece. No returned campaign or recorded failure is an input.
function arena({blocked=false,hidden=0,kits=0,patient=false,charged=false}={}){
 const tiles=Array.from({length:800},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',cover:0,
  blocked:blocked&&Math.abs(i%40-5)<=1&&Math.abs(Math.floor(i/40)-5)<=1&&i!==205}));
 return createBattle([
  {id:'guard',x:5,y:5,weapon:1800,blade:0,loaded:1,ammo:5,medical:kits?70:0,medkits:kits,marksmanship:90,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  {id:'observer',x:12,y:8,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,marksmanship:0,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  ...(patient?[{id:'patient',x:5,y:4,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,hp:9,maxHp:100,bleeding:2,bandaged:89,energy:100,morale:90}]:[]),
 ],{id:'declared-initial-empty-ground-reserve',width:40,height:20,tiles,hour:12,seed:45,
  wallEdges:Array.from({length:4},(_,i)=>({id:`known-wall:${i}`,x:8,y:2+i,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40})),
  enemies:[{id:'target',x:12,y:5,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false},
   ...(hidden?[{id:'hidden',x:hidden===1?35:38,y:18,weapon:0,blade:0,loaded:0,ammo:0,patrol:false,overwatch:false}]:[])],
  artillery:[{id:'reserve-piece',side:'player',type:'bronze4',x:3,y:5,loaded:charged,ammo:0},
   ...(hidden?[{id:'hidden-piece',side:'enemy',type:'swivel',x:hidden===1?35:38,y:19,loaded:true,ammo:2}]:[])],
  npcs:hidden?[{id:'hidden-resident',name:'Vecino distante',x:hidden===1?35:38,y:17,hp:100}]:[],
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

test('a fresh initial-empty ground noncrew has a real paid public lane and finite rifle discharge',()=>{
 const start=arena(),before=structuredClone(start),guard=actor(start,'guard'),target=actor(start,'target');
 assert.equal(canSee(start,guard,target),false);assert.equal(teamCanSee(start,'player',target),true);
 const old=coordinatedHospitalBattery(start);assert.deepEqual(old.roles,{physicianId:null,crews:[]});assert.equal(old.controller(start,guard),null);
 assert.equal(usefulRouteRifleShot(publicRouteView(start,guard),guard),null);
 const move={type:'move',unitId:guard.id,x:5,y:6,tacticalLevel:0},point=getReachable(publicRouteView(start,guard),guard,{stopAt:p=>sameCell(p,move)})[0];
 assert.ok(point&&point.cost>0&&point.cost<=20&&point.path.length<=3,JSON.stringify(point));assert.ok(point.path.every(p=>sameSurface(p,guard)));
 const moved=replay(start,[move]),member=actor(moved,guard.id);assert.equal(member.ap,guard.ap-point.cost);assert.ok(member.energy<guard.energy);assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const fire=usefulRouteRifleShot(publicRouteView(moved,member),member);assert.equal(fire?.type,'fire');assert.equal(fire.targetId,target.id);
 const cost=actionCosts(moved,member,actor(moved,fire.targetId)),after=replay(start,[move,fire]);assert.equal(actor(after,guard.id).ap,member.ap-cost.fire-fire.aim*cost.aim);assert.equal(actor(after,guard.id).loaded,guard.loaded-1);
 const count=u=>Object.values(unitAmmunitionByType(u)).reduce((a,b)=>a+b,0);assert.equal(count(actor(after,guard.id)),count(guard)-1);assert.equal(after.elapsedSeconds,moved.elapsedSeconds);assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('only the initial-empty road opt-in pays a ground move and then its actual useful shot',()=>{
 const start=arena(),before=structuredClone(start),guard=actor(start,'guard'),ordinary=coordinatedHospitalBattery(start),explicit=coordinatedHospitalBattery(start,{coordinateEmptyGround:false}),policy=northernRoadReserveController(start);
 assert.equal(ordinary.controller(start,guard),null);assert.equal(explicit.controller(start,guard),null);assert.equal(policy.sharedFallback,undefined);
 const move=policy(start,guard);assert.equal(move?.type,'move');assert.equal(move.unitId,guard.id);
 const quote=getReachable(publicRouteView(start,guard),guard,{stopAt:p=>sameCell(p,move)})[0];assert.ok(quote.cost>0&&quote.cost<=20&&quote.path.length<=3);assert.ok(quote.path.every(p=>sameSurface(p,guard)));
 const moved=replay(start,[move]),member=actor(moved,guard.id);assert.ok(sameCell(member,move));assert.equal(member.ap,guard.ap-quote.cost);assert.ok(member.energy<guard.energy);assert.equal(moved.elapsedSeconds,COMBAT_ROUND_SECONDS);
 const fire=policy(moved,member);assert.equal(fire?.type,'fire');assert.equal(fire.targetId,'target');assert.ok(usefulRouteRifleShot(publicRouteView(moved,member),member,{shotSafety:knownRouteBystanderShotSafety}));assert.deepEqual(firearmBystanderRisk(moved,member,actor(moved,'target'),fire.hitLocation??'torso'),{direct:[],scatter:[]});const cost=actionCosts(moved,member,actor(moved,'target'));
 const after=replay(start,[move,fire]);assert.equal(actor(after,guard.id).ap,member.ap-cost.fire-fire.aim*cost.aim);assert.equal(actor(after,guard.id).loaded,0);assert.equal(actor(after,guard.id).ammo,guard.ammo);assert.equal(after.elapsedSeconds,moved.elapsedSeconds);
 for(const unit of start.units.filter(u=>u.side==='player'))for(const key of ['hp','maxHp','bleeding','medkits','weapon','blade','outfit','headwear','legwear'])assert.deepEqual(actor(after,unit.id)[key],unit[key]);
 assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(after.tiles,start.tiles);assert.deepEqual(start,before);
});

test('unknown people and pieces do not select or price the initial-empty ground route',()=>{
 const first=arena({hidden:1}),second=arena({hidden:2}),beforeA=structuredClone(first),beforeB=structuredClone(second);
 for(const start of [first,second])for(const object of [actor(start,'hidden'),start.artillery[1],start.npcs[0]])assert.equal(teamCanSee(start,'player',object),false);
 const a=northernRoadReserveController(first)(first,actor(first,'guard')),b=northernRoadReserveController(second)(second,actor(second,'guard'));assert.equal(a?.type,'move');assert.deepEqual(b,a);
 for(const [start,action]of [[first,a],[second,b]]){const after=replay(start,[action]);assert.ok(actor(after,'guard').ap<actor(start,'guard').ap);assert.deepEqual(after.artillery,start.artillery);}
 assert.deepEqual(first,beforeA);assert.deepEqual(second,beforeB);
});

test('a blocked ground lane and a spent real AP reserve authorize no speculative movement',()=>{
 const blocked=arena({blocked:true}),before=structuredClone(blocked),guard=actor(blocked,'guard');assert.equal(teamCanSee(blocked,'player',actor(blocked,'target')),true);
 assert.equal(getReachable(publicRouteView(blocked,guard),guard).filter(p=>p.cost>0).length,0);assert.equal(northernRoadReserveController(blocked)(blocked,guard),null);assert.deepEqual(blocked,before);
 const start=arena(),policy=northernRoadReserveController(start),orders=[];let paid=start;
 for(let pass=0;pass<30&&actor(paid,'guard').ap>=4;pass++){
  const u=actor(paid,'guard'),point=pass%2?{x:4,y:5}:{x:6,y:5},quote=lookPreview(paid,u,point);if(!quote.valid||quote.pa<=0)break;
  const action={type:'look',unitId:u.id,...point};orders.push(action);paid=actBattle(paid,action);assert.equal(paid.lastError,null);
 }
 assert.ok(orders.length>0);assert.ok(actor(paid,'guard').ap<actionCosts(paid,actor(paid,'guard')).fire);assert.equal(policy(paid,actor(paid,'guard')),null);assert.deepEqual(replay(start,orders),paid);
});

test('adjacent finite aid and charged-battery defaults remain ahead of empty-ground progress',()=>{
 const start=arena({kits:1,patient:true}),before=structuredClone(start),policy=northernRoadReserveController(start),guard=actor(start,'guard'),hand=policy(start,guard);assert.deepEqual(hand,{type:'weapon',unitId:guard.id,slot:'medical'});
 const held=replay(start,[hand]),medic=actor(held,guard.id),patient=actor(held,'patient'),quote=medicalUsePreview(held,medic,patient);assert.equal(quote.allowed,true);
 const aid=policy(held,medic);assert.deepEqual(aid,{type:'useItem',unitId:guard.id,targetId:'patient'});const after=replay(start,[hand,aid]);assert.equal(actor(after,guard.id).medkits,0);assert.equal(actor(after,'patient').hp,quote.treatment.hpAfter);assert.equal(actor(after,'patient').bleeding,quote.treatment.bleedingAfter);assert.ok(sameCell(actor(after,guard.id),guard));assert.deepEqual(start,before);
 const charged=arena({charged:true}),old=coordinatedHospitalBattery(charged),enabled=coordinatedHospitalBattery(charged,{coordinateEmptyGround:true});assert.deepEqual(old.roles,enabled.roles);
 for(const u of charged.units.filter(u=>u.side==='player'))assert.deepEqual(enabled.controller(charged,u),old.controller(charged,u));
});
