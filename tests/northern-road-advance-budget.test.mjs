import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,getReachable,lookPreview,canSee,teamCanSee,medicalUsePreview,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {northernHospitalCoverOrder} from './fresh-northern-recovery.mjs';
import {publicRouteView,usefulRouteRifleShot} from './route-infantry-progress.mjs';

const actor=(b,id)=>b.units.find(u=>u.id===id),spent=u=>u.maxAP+(u.carriedAP??0)-u.ap;
// A new mixed ground/roof reserve. The ground rifleman cannot see through
// the declared wall. A ground observer sees the contact; the roof role holds.
function arena({near=false,medical=false,charged=false}={}){
 const width=40,height=32,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false}));
 const upperSurfaces=Array.from({length:25},(_,i)=>({id:`observer-roof:${i}`,x:18+i%5,y:6+Math.floor(i/5),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 return createBattle([
  {id:'ground',x:5,y:22,weapon:1800,blade:0,loaded:1,ammo:5,medical:medical?70:0,medkits:medical?1:0,marksmanship:90,stance:'standing',facing:2,energy:100,morale:90,patrol:false},
  {id:'roof',x:20,y:8,tacticalLevel:1,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,marksmanship:0,stance:'crouched',facing:2,energy:100,morale:90,patrol:false},
  {id:'observer',x:22,y:8,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,marksmanship:0,stance:'crouched',facing:2,energy:100,morale:90,patrol:false},
  ...(medical?[{id:'patient',x:5,y:21,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,hp:9,maxHp:100,bleeding:2,bandaged:89,energy:100,morale:90,patrol:false}]:[]),
 ],{id:'declared-native-turn-reserve-advance',width,height,tiles,upperSurfaces,hour:12,seed:45,
  wallEdges:near?[]:Array.from({length:29},(_,i)=>({id:`public-wall:${i}`,x:10,y:i,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40})),
  enemies:[{id:'contact',x:near?5:24,y:near?18:8,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'spent-piece',side:'player',type:'bronze4',x:3,y:22,loaded:charged,ammo:0}],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=action.type==='endTurn'?endTurn(direct):actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=(action.type==='endTurn'?presentedEndTurn(shown):presentedActBattle(shown,JSON.parse(JSON.stringify(action)))).state;assert.deepEqual(shown,direct);
  saved=validateBattleSnapshot(JSON.parse(JSON.stringify(action.type==='endTurn'?endTurn(saved):actBattle(saved,JSON.parse(JSON.stringify(action))))));assert.deepEqual(saved,direct);
 }
 return direct;
}
function lookOrders(start,minimum){
 let b=start;const orders=[];
 for(let step=0;spent(actor(b,'ground'))<minimum&&step<32;step++){
  const u=actor(b,'ground'),point=step%2?{x:u.x,y:u.y-1}:{x:u.x+1,y:u.y},quote=lookPreview(b,u,point);assert.equal(quote.valid,true);assert.ok(quote.pa>0);
  const action={type:'look',unitId:u.id,...point};orders.push(action);b=actBattle(b,action);assert.equal(b.lastError,null);
 }
 assert.ok(spent(actor(b,'ground'))>=minimum);return {battle:b,orders};
}

test('repeated actual empty-reserve callbacks share one 20-AP advance allowance in the Native turn',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,ground=actor(start,'ground');
 assert.equal(canSee(start,ground,actor(start,'contact')),false);assert.equal(teamCanSee(start,'player',actor(start,'contact')),true);assert.equal(usefulRouteRifleShot(publicRouteView(start,ground),ground),null);
 assert.equal(ground.tacticalLevel??0,0);assert.equal(actor(start,'roof').tacticalLevel,1);assert.equal(start.artillery[0].loaded,false);assert.equal(start.artillery[0].ammo,0);
 assert.equal(policy(start,actor(start,'roof')),null,'The real roof role does not borrow the ground approach.');
 const orders=[];let b=start,advanceCost=0;
 for(let pass=0;pass<8;pass++){
  const u=actor(b,'ground'),input=structuredClone(b);assert.equal(northernHospitalCoverOrder(b,u),null);const action=policy(b,u);assert.deepEqual(b,input);if(!action)break;
  assert.equal(action.type,'move','This declared blind-contact lane must still be optional movement.');
  const route=getReachable(publicRouteView(b,u),u,{stopAt:p=>sameCell(p,action)})[0];assert.ok(route?.cost>0&&route.cost<=20&&route.path.length<=3);assert.ok(route.path.every(p=>(p.tacticalLevel??0)===0));
  orders.push(action);const after=replay(start,orders);assert.equal(actor(after,'ground').ap,u.ap-route.cost);assert.ok(actor(after,'ground').energy<u.energy);advanceCost+=route.cost;b=after;
 }
 assert.ok(orders.length>0);assert.ok(advanceCost<=20,`Repeated optional movement spent ${advanceCost} AP in Native turn ${b.turn}.`);assert.equal(spent(actor(b,'ground')),advanceCost);
 for(let call=0;call<3;call++)assert.equal(policy(b,actor(b,'ground')),null);
 assert.deepEqual(spacePoint(actor(b,'roof')),spacePoint(actor(start,'roof')));assert.deepEqual(b.artillery,start.artillery);assert.deepEqual(unitAmmunitionByType(actor(b,'ground')),unitAmmunitionByType(ground));assert.deepEqual(start,before);
});

test('other real paid orders reduce optional advance room without spending or mutating a planning copy',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,paid=lookOrders(start,20);
 assert.equal(actor(paid.battle,'ground').loaded,1);assert.equal(usefulRouteRifleShot(publicRouteView(paid.battle,actor(paid.battle,'ground')),actor(paid.battle,'ground')),null);
 const current=structuredClone(paid.battle);assert.equal(policy(paid.battle,actor(paid.battle,'ground')),null);assert.deepEqual(paid.battle,current);assert.deepEqual(replay(start,paid.orders),paid.battle);assert.deepEqual(start,before);
});

test('a partially spent Native turn offers only the real remaining optional movement allowance',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,paid=lookOrders(start,8),u=actor(paid.battle,'ground'),alreadySpent=spent(u);
 assert.ok(alreadySpent>0&&alreadySpent<20);assert.equal(northernHospitalCoverOrder(paid.battle,u),null);
 const action=policy(paid.battle,u);assert.equal(action?.type,'move');const route=getReachable(publicRouteView(paid.battle,u),u,{stopAt:p=>sameCell(p,action)})[0];assert.ok(route.cost>0&&route.cost<=20-alreadySpent);
 const after=replay(start,[...paid.orders,action]);assert.equal(spent(actor(after,'ground')),alreadySpent+route.cost);assert.ok(spent(actor(after,'ground'))<=20);assert.deepEqual(start,before);
});

test('a genuine Native end turn starts a new allowance including actual carried AP',()=>{
 const start=arena(),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,paid=lookOrders(start,20),orders=[...paid.orders];let next=paid.battle;
 for(let step=0;(next.turn===start.turn||next.phase!=='player')&&step<16;step++){orders.push({type:'endTurn'});next=replay(start,orders);assert.equal(next.status,'active');}
 const u=actor(next,'ground');
 assert.ok(next.turn>start.turn);assert.equal(next.phase,'player');assert.ok(u.carriedAP>0);assert.equal(u.ap,u.maxAP+u.carriedAP);assert.equal(spent(u),0);
 assert.equal(northernHospitalCoverOrder(next,u),null);const action=policy(next,u);assert.equal(action?.type,'move');const route=getReachable(publicRouteView(next,u),u,{stopAt:p=>sameCell(p,action)})[0];assert.ok(route.cost>0&&route.cost<=20,JSON.stringify({action,route}));
 const moved=replay(start,[...orders,action]);assert.equal(actor(moved,'ground').ap,u.ap-route.cost);assert.equal(spent(actor(moved,'ground')),route.cost);assert.deepEqual(start,before);
});

test('a real useful rifle shot remains payable after the optional approach allowance was already spent',()=>{
 const start=arena({near:true}),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,paid=lookOrders(start,20),b=paid.battle,u=actor(b,'ground');
 assert.ok(spent(u)>=20);const shot=usefulRouteRifleShot(publicRouteView(b,u),u);assert.equal(shot?.type,'fire');
 const action=policy(b,u);assert.equal(action?.type,'fire');const cost=actionCosts(b,u,actor(b,action.targetId)),after=replay(start,[...paid.orders,action]);
 assert.equal(actor(after,'ground').ap,u.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(actor(after,'ground').loaded,u.loaded-1);assert.deepEqual(start,before);
});

test('finite adjacent medicine and charged-battery defaults keep their existing priority',()=>{
 const start=arena({medical:true}),before=structuredClone(start),policy=coordinatedHospitalBattery(start,{coordinateEmptyGround:true}).controller,paid=lookOrders(start,20),hand=policy(paid.battle,actor(paid.battle,'ground'));
 assert.deepEqual(hand,{type:'weapon',unitId:'ground',slot:'medical'});const held=replay(start,[...paid.orders,hand]),medic=actor(held,'ground'),quote=medicalUsePreview(held,medic,actor(held,'patient')),aid=policy(held,medic);assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'ground',targetId:'patient'});
 const cared=replay(start,[...paid.orders,hand,aid]);assert.equal(actor(cared,'ground').medkits,0);assert.equal(actor(cared,'patient').hp,quote.treatment.hpAfter);assert.equal(actor(cared,'patient').bleeding,quote.treatment.bleedingAfter);assert.deepEqual(start,before);
 const charged=arena({charged:true}),unchanged=structuredClone(charged),ordinary=coordinatedHospitalBattery(charged).controller,enabled=coordinatedHospitalBattery(charged,{coordinateEmptyGround:true}).controller;
 for(const u of charged.units.filter(u=>u.side==='player'))assert.deepEqual(enabled(charged,u),ordinary(charged,u));assert.deepEqual(charged,unchanged);
});
