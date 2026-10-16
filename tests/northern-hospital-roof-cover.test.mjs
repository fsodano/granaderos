import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,stanceCost,hasLineOfSight,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {coordinatedHospitalBattery,paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';
import {northernHospitalCoverOrder} from './fresh-northern-recovery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';
import {knownRouteBystanderShotSafety} from './route-fire-safety.mjs';

const actor=(battle,id='guard')=>battle.units.find(unit=>unit.id===id);
const strict={shotSafety:knownRouteBystanderShotSafety};
const flat=(width,height,cover=0)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover}));

// Portable declarations only. Cover, people, finite equipment and geometry
// precede the Native factory. No retained campaign or returned body is input.
function roofArena(kind='safe'){
 const width=40,height=20,start={x:5,y:6,tacticalLevel:1};
 const players=[
  {id:'guard',name:'Roof rifle',...start,weapon:1800,blade:0,loaded:1,ammo:5,medical:0,medkits:0,marksmanship:90,stance:'standing',facing:0,energy:100,morale:90},
  {id:'front',name:'Roof observer',x:7,y:4,tacticalLevel:1,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:0,energy:100,morale:90},
 ];
 const upperSurfaces=Array.from({length:20},(_,i)=>{
  const x=4+i%4,y=4+Math.floor(i/4),covered=kind==='safe'||x===start.x&&y===start.y||kind==='gap'&&x===5&&y===4;
  return {id:`declared-roof:${i}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:covered?30:0};
 });
 const options={id:'declared-hospital-roof-cover',width,height,tiles:flat(width,height),upperSurfaces,hour:12,seed:45,
  enemies:[{id:'target',x:5,y:2,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'clinic-gun',type:'bronze4',side:'player',x:6,y:15,facing:0,loaded:true,ammo:2}],
 };
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);
 assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

// Exact former optional roof-leaf choice: <=20 PA, radius3, same-floor Native
// reachability, paid movement forecast, then a useful current safe shot. This
// is a fresh source-derived baseline, never a captured battle continuation.
function formerRoofApproach(battle,unit){
 const view=publicRouteView(battle,unit),points=getReachable(view,unit)
  .filter(point=>point.cost>0&&point.cost<=20&&point.cost<unit.ap&&sameSurface(point,unit)&&Math.hypot(point.x-unit.x,point.y-unit.y)<=3)
  .sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);
 for(const point of points){
  const preview=paidHospitalRoofWalkPreview(view,unit,point);
  if(preview&&usefulRouteRifleShot(preview.view,preview.actor,strict))return {action:{type:'move',unitId:unit.id,...spacePoint(point)},point,preview};
 }
 return null;
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
function stableGoods(start,after,{fired=false}={}){
 for(const key of ['tiles','upperSurfaces','climbLinks','artillery'])assert.deepEqual(after[key],start[key]);
 for(const unit of start.units.filter(unit=>unit.side==='player')){
  const next=actor(after,unit.id);
  for(const key of ['weapon','blade','inventory','medkits','outfit','headwear','legwear','hp'])assert.deepEqual(next[key],unit[key]);
  assert.equal(next.condition,unit.condition-(fired&&unit.id==='guard'?1:0));
 }
 const total=unit=>Object.values(unitAmmunitionByType(unit)).reduce((sum,n)=>sum+n,0);
 assert.equal(total(actor(after)),total(actor(start))-(fired?1:0));
}
function exposedBaseline(start,{equalEndpoint=false}={}){
 const guard=actor(start),target=actor(start,'target'),view=publicRouteView(start,guard);
 assert.equal(teamCanSee(start,'player',target),true);assert.equal(hasLineOfSight(start,guard,target),false);
 assert.equal(northernHospitalCoverOrder(start,guard),null,'the ordinary held-roof policy must leave the optional leaf to decide');
 assert.equal(usefulRouteRifleShot(view,guard,strict),null);
 const old=formerRoofApproach(start,guard);assert.ok(old,'the former leaf must offer a genuinely payable useful lane');
 const cover=surfaceAt(start,guard).cover;
 assert.ok(old.point.path.some(point=>surfaceAt(start,point).cover<cover),'the actual quoted path must lose current cover');
 if(equalEndpoint)assert.equal(surfaceAt(start,old.point).cover,cover,'the complete endpoint retains cover while its intermediate cell loses it');
 else assert.ok(surfaceAt(start,old.point).cover<cover);
 const moved=replay(start,[old.action]),member=actor(moved);
 assert.ok(sameCell(member,old.point));assert.equal(member.ap,guard.ap-old.point.cost);assert.ok(member.energy<guard.energy);
 const fire=usefulRouteRifleShot(publicRouteView(moved,member),member,strict);assert.equal(fire?.type,'fire');
 const cost=actionCosts(moved,member,actor(moved,fire.targetId)),after=replay(start,[old.action,fire]);
 assert.equal(actor(after).ap,member.ap-cost.fire-(fire.aim??0)*cost.aim);assert.equal(actor(after).loaded,guard.loaded-1);
 assert.deepEqual(firearmBystanderRisk(moved,member,actor(moved,fire.targetId),fire.hitLocation??'torso'),{direct:[],scatter:[]});
 stableGoods(start,after,{fired:true});return old;
}

test('the hospital refuses a former useful paid roof approach that abandons current fort cover',()=>{
 const start=roofArena('exposed'),before=structuredClone(start),guard=actor(start),old=exposedBaseline(start),policy=coordinatedHospitalBattery(start);
 assert.equal(surfaceAt(start,guard).cover,30);assert.equal(policy.roles.physicianId,null);assert.deepEqual(policy.roles.crews,[{gunId:'clinic-gun',ids:[]}]);
 for(let callback=0;callback<3;callback++)assert.equal(policy.controller(start,guard),null,'the useful exposed step is optional, so the defended post holds');
 assert.notEqual(old.action,null);assert.deepEqual(start,before);
});

test('a same-cover roof approach keeps the former choice and pays a real finite follow-up shot',()=>{
 const start=roofArena(),before=structuredClone(start),guard=actor(start),old=formerRoofApproach(start,guard),policy=coordinatedHospitalBattery(start);
 assert.ok(old);const action=policy.controller(start,guard);assert.deepEqual(action,old.action);
 assert.ok(old.point.path.every(point=>sameSurface(point,guard)&&surfaceAt(start,point).cover>=surfaceAt(start,guard).cover));
 const moved=replay(start,[action]),member=actor(moved);assert.equal(member.ap,guard.ap-old.point.cost);assert.ok(member.energy<guard.energy);
 assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.ok(sameCell(member,old.point));
 const fire=policy.controller(moved,member);assert.equal(fire?.type,'fire');assert.deepEqual(fire,usefulRouteRifleShot(publicRouteView(moved,member),member,strict));
 const cost=actionCosts(moved,member,actor(moved,fire.targetId)),after=replay(start,[action,fire]);
 assert.equal(actor(after).ap,member.ap-cost.fire-(fire.aim??0)*cost.aim);assert.equal(actor(after).loaded,guard.loaded-1);assert.equal(after.elapsedSeconds,moved.elapsedSeconds);
 assert.deepEqual(firearmBystanderRisk(moved,member,actor(moved,fire.targetId),fire.hitLocation??'torso'),{direct:[],scatter:[]});
 stableGoods(start,after,{fired:true});assert.deepEqual(replay(start,[action,fire]),after);assert.deepEqual(start,before);
});

test('equal endpoint cover cannot hide an exposed intermediate cell on the former useful route',()=>{
 const start=roofArena('gap'),before=structuredClone(start),guard=actor(start),old=exposedBaseline(start,{equalEndpoint:true});
 assert.ok(old.point.path.length>=2);assert.ok(old.point.path.slice(0,-1).some(point=>surfaceAt(start,point).cover<surfaceAt(start,guard).cover));
 const policy=coordinatedHospitalBattery(start);for(let callback=0;callback<3;callback++)assert.equal(policy.controller(start,guard),null);
 assert.deepEqual(start,before);
});

test('real paid preparation without an affordable useful shot keeps the safe roof post without a movement cycle',()=>{
 const start=roofArena(),before=structuredClone(start),orders=[];let ready=start;
 for(let attempt=0;attempt<20;attempt++){
  const guard=actor(ready),down=stanceCost(guard,'prone'),up=stanceCost({...guard,stance:'prone'},'standing');
  assert.ok(down>0&&up>0);if(guard.ap<down+up)break;
  orders.push({type:'stance',unitId:guard.id,stance:'prone'},{type:'stance',unitId:guard.id,stance:'standing'});ready=replay(start,orders);
 }
 const guard=actor(ready),snapshot=structuredClone(ready),policy=coordinatedHospitalBattery(ready);
 assert.ok(orders.length>0);assert.equal(guard.stance,'standing');assert.ok(guard.ap<actor(start).ap);assert.equal(formerRoofApproach(ready,guard),null);
 for(let callback=0;callback<3;callback++)assert.equal(policy.controller(ready,guard),null);
 stableGoods(start,ready);assert.deepEqual(ready,snapshot);assert.deepEqual(replay(start,orders),ready);assert.deepEqual(start,before);
});

test('ordinary safe ground movement stays identical and pays its current Native route cost',()=>{
 const players=[{id:'guard',x:5,y:6,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:2,energy:100,morale:90}],
  options={id:'declared-ordinary-safe-ground',width:20,height:12,tiles:flat(20,12,30),hour:12,seed:45,enemies:[{id:'target',x:10,y:6,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}]},
  declaration=structuredClone({players,options}),start=createBattle(players,options),before=structuredClone(start),guard=actor(start),policy=coordinatedHospitalBattery(start);
 assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(start))),start);
 const normal=northernHospitalCoverOrder(start,guard),action=policy.controller(start,guard);assert.equal(normal?.type,'move');assert.deepEqual(action,normal);
 const route=getReachable(publicRouteView(start,guard),guard,{stopAt:point=>sameCell(point,action)})[0];assert.ok(route?.cost>0);assert.ok(route.path.every(point=>surfaceAt(start,point).cover>=surfaceAt(start,guard).cover));
 const after=replay(start,[action]);assert.ok(sameCell(actor(after),action));assert.equal(actor(after).ap,guard.ap-route.cost);assert.ok(actor(after).energy<guard.energy);
 assert.equal(after.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);stableGoods(start,after);assert.deepEqual(start,before);
});
