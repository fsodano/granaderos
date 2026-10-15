import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {blankMap} from '../game/map-schema.js';
import {DEFAULT_MAPS,DEFAULT_WORLD} from '../campaigns/default.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,actionCosts,stanceCost,firearmShotOptions} from '../game/tactical.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {fight} from './cuyo-route-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {knownRouteShotSafety} from './route-fire-safety.mjs';

// A new declared tactical request, not a campaign checkpoint or a route win.
// All equipment and geometry are defined before the normal native entry.
function declaredRequest({sector='san_nicolas',civilian=false}={}){
 const content=defaultContentPackage(),map=blankMap({id:sector});content.maps=structuredClone(DEFAULT_MAPS);content.world=structuredClone(DEFAULT_WORLD);
 map.spawns=[{id:'field',side:'player',x:2,y:8},{id:'opposition',side:'enemy',x:8,y:8}];
 content.maps[sector]=map;
 content.world.deployment={...content.world.deployment,[sector]:{playerAnchors:[{x:2,y:8}],enemyAnchor:{x:8,y:8}}};
 return {id:'declared-current-cuyo-controller',sector,seed:45,hour:12,compactLayout:true,upperSurfaces:[],climbLinks:[],regionalWeather:false,weather:{rain:0,humidity:0},campaignPackage:content,
  squad:[{id:'p',name:'Declared rifleman',hp:100,maxHp:100,energy:100,morale:100,facing:2,weapon:1800,activeSlot:'primary',loaded:1,ammo:2,marksmanship:90,condition:100,medical:0,medkits:0,stance:'standing'}],
  enemies:[{id:'e',name:'Declared opponent',hp:100,maxHp:100,energy:100,morale:100,weapon:0,blade:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false}],
  npcs:civilian?[{id:'civil',name:'Visible resident',x:5,y:8,hp:100,energy:100,stance:'standing',ai:{cycle:0,homeId:null,activity:'roaming',wait:100}}]:[],artillery:[],garrison:[],missionAllies:[]};
}
const actor=b=>b.units.find(u=>u.id==='p');
const finite=u=>Object.fromEntries(['hp','maxHp','bleeding','ammo','medkits','inventory','weapon','condition'].map(key=>[key,u[key]]));
function replay(request,result){
 let ordinary=enterSector(request),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(ordinary)));
 for(const order of result.orders){
  ordinary=order.type==='endTurn'?endTurn(ordinary):actBattle(ordinary,order);assert.equal(ordinary.lastError,null,JSON.stringify(order));
  restored=order.type==='endTurn'?endTurn(restored):actBattle(restored,order);restored=validateBattleSnapshot(JSON.parse(JSON.stringify(restored)));assert.deepEqual(restored,ordinary);
 }
 assert.deepEqual(ordinary,result.battle);return ordinary;
}

test('a supplied hired policy pays its useful posture and one finite fire attempt, then retains its explicit hold',()=>{
 const request=declaredRequest(),before=structuredClone(request),initial=enterSector(request);assert.equal(initial.mode,'combat');
 const initialActor=actor(initial);assert.deepEqual(hiredAssaultOrder(initial,initialActor),{type:'stance',unitId:'p',stance:'prone'});
 let fired=false;
 const result=fight(request,null,{avoidCivilians:true,fallbackOrders:true,controller:(b,u)=>{
  if(fired)return null;const order=hiredAssaultOrder(b,u);if(order?.type==='fire')fired=true;return order;
 }});
 const paid=result.orders.filter(order=>order.type!=='endTurn');assert.equal(paid.length,2);assert.equal(paid[0].type,'stance');assert.equal(paid[0].stance,'prone');assert.equal(paid[1].type,'fire');
 const posed=actBattle(initial,paid[0]);assert.equal(posed.lastError,null);assert.equal(actor(posed).ap,initialActor.ap-stanceCost(initialActor,'prone'));assert.deepEqual(finite(actor(posed)),finite(initialActor));
 const target=posed.units.find(u=>u.id===paid[1].targetId),cost=actionCosts(posed,actor(posed),target),shot=firearmShotOptions(posed,actor(posed),target,paid[1].aim).find(option=>option.aim===paid[1].aim&&option.hitLocation===(paid[1].hitLocation??'torso'));
 assert.ok(shot&&knownRouteShotSafety(posed,actor(posed),target)(shot));
 const shotResult=actBattle(posed,paid[1]);assert.equal(shotResult.lastError,null);assert.equal(actor(shotResult).loaded,actor(posed).loaded-Number(!actor(shotResult).jammed),'an actual ignition failure retains its finite barrel load');assert.equal(actor(shotResult).ap,actor(posed).ap-cost.fire-(paid[1].aim??0)*cost.aim);assert.deepEqual(finite(actor(shotResult)),{...finite(actor(posed)),condition:actor(posed).condition-Number(!actor(shotResult).jammed)});
 assert.equal(posed.elapsedSeconds,initial.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.equal(shotResult.elapsedSeconds,posed.elapsedSeconds,'the same combat round is charged once');
 assert.ok(result.battle.turn<=81);assert.ok(result.orders.filter(order=>order.type==='endTurn').length<=600);replay(request,result);assert.deepEqual(request,before);
});

test('the supplied policy cannot bypass a visible resident, and a null policy cannot invoke the old automatic fallback',()=>{
 const request=declaredRequest({civilian:true}),before=structuredClone(request),initial=enterSector(request),unit=actor(initial),target=initial.units.find(u=>u.id==='e'),unsafe={type:'fire',unitId:unit.id,targetId:target.id,aim:0,hitLocation:'torso'};
 const shot=firearmShotOptions(initial,unit,target,0).find(option=>option.aim===0&&option.hitLocation==='torso');assert.ok(shot);assert.equal(knownRouteShotSafety(initial,unit,target)(shot),false,'the declared visible resident blocks this current public shot');
 const blocked=fight(request,null,{avoidCivilians:true,fallbackOrders:true,controller:b=>b.turn===initial.turn?unsafe:null});assert.equal(blocked.actions,0);assert.ok(blocked.orders.every(order=>order.type==='endTurn'));replay(request,blocked);
 const held=fight(declaredRequest(),null,{fallbackOrders:true,controller:()=>null});assert.equal(held.actions,0);assert.ok(held.orders.every(order=>order.type==='endTurn'));assert.deepEqual(request,before);
});

test('omitting the new policy preserves the Cuyo default and the existing capital policy',()=>{
 for(const sector of ['san_nicolas','buenos_aires']){
  const request=declaredRequest({sector}),before=structuredClone(request),options={avoidCivilians:true,fallbackOrders:true};
  const original=fight(request,null,options),explicit=fight(request,null,{...options,controller:undefined});assert.deepEqual(explicit,original);assert.deepEqual(request,before);replay(request,original);
  if(sector==='buenos_aires')assert.deepEqual(fight(request,null,{...options,controller:()=>{throw Error('The existing capital policy must remain unchanged.');}}),original);
  assert.ok(original.battle.turn<=81);assert.ok(original.orders.filter(order=>order.type==='endTurn').length<=600);
 }
});

test('a supplied noncapital policy error retains its exact identity',()=>{
 const request=declaredRequest(),before=structuredClone(request),marker={reason:'declared caller failure'};
 assert.throws(()=>fight(request,null,{controller:()=>{throw marker;}}),error=>error===marker);assert.deepEqual(request,before);
});
