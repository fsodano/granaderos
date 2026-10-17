import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryContact,artilleryCrewPlan,artilleryCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {mountainBatteryOrder} from './mountain-battery-driver.mjs';

const member=(b,id)=>b.units.find(u=>u.id===id);
const advance={type:'artilleryMove',unitId:'leader',artilleryId:'battery',x:5,y:3};
const options={leaderId:'leader',helperId:'helper',crewIds:['leader','helper'],artilleryId:'battery',routeAroundObstacles:true};
function arena({endpoint=null,wall=false,terrain=null,missing=false,empty=false,combat=false,tired=false,cornerProp=false}={}){
 const squad=[
  {id:'leader',x:5,y:1,weapon:0,blade:0,medical:0,medkits:0,loaded:0,ammo:0,stance:'standing',hp:100,maxHp:100,morale:90},
  ...(!missing?[{id:'helper',x:4,y:1,weapon:0,blade:0,medical:0,medkits:0,loaded:0,ammo:0,stance:'standing',hp:100,maxHp:100,morale:90,...(tired?{agility:0,dexterity:0,experienceLevel:1,fatigue:100}:{})}]:[]),
  ...(!cornerProp?[{id:'screen',x:4,y:3,weapon:0,blade:0,medical:0,medkits:0,loaded:0,ammo:0,hp:100,maxHp:100,stance:'prone'}]:[]),
  ...(endpoint==='unit'?[{id:'blocking-body',x:5,y:3,hp:100,maxHp:100}]:[]),
 ];
 const tiles=Array.from({length:96},(_,i)=>{const x=i%8,y=Math.floor(i/8),blocked=(x!==4&&x!==5)||y===0||y===11;return {x,y,type:blocked?'wall':terrain&&x===5&&y===3?terrain:'grass',blocked:blocked||terrain==='blocked'&&x===5&&y===3,cover:0};});
 return createBattle(squad,{id:'declared-rigid-route',width:8,height:12,hour:12,seed:45,exploration:!combat,tiles,
  enemies:combat?[{id:'distant',x:5,y:10,hp:100,maxHp:100,weapon:0,blade:0,loaded:0,ammo:0,patrol:false}]:[],
  npcs:endpoint==='npc'?[{id:'blocking-civilian',x:5,y:3,hp:100,maxHp:100}]:[],
  props:endpoint==='prop'||cornerProp?[{id:'fixed-cart',type:'cart',x:cornerProp?4:5,y:3,footprint:{width:1,height:1},blocksMovement:true}]:[],
  wallEdges:wall?[{id:'crossing-wall',x:5,y:3,axis:'x',type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}]:[],
  artillery:[{id:'battery',type:'bronze4',side:'player',x:5,y:2,loaded:!empty,ammo:empty?0:2},...(endpoint==='gun'?[{id:'other-battery',type:'bronze4',side:'player',x:5,y:3,loaded:false,ammo:0}]:[])],
 });
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));
  shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);
  stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);
 }
 return direct;
}
function kept(start,after){
 for(const u of start.units){const actual=member(after,u.id);for(const key of ['hp','maxHp','bleeding','medkits','inventory','loaded','ammo','weapon','blade'])assert.deepEqual(actual[key],u[key],`${u.id}: ${key}`);}
 for(const key of ['props','wallEdges','tiles','npcs'])assert.deepEqual(after[key],start[key]);
 assert.deepEqual(after.artillery.map(({id,type,loaded,ammo})=>({id,type,loaded,ammo})),start.artillery.map(({id,type,loaded,ammo})=>({id,type,loaded,ammo})));
}

test('a rigid crew pays a legal corridor step while a noncrew body occupies only its gun-contact corner',()=>{
 const start=arena(),before=structuredClone(start),leader=member(start,'leader'),gun=start.artillery[0],plan=artilleryCrewPlan(start,leader,gun,artilleryCosts(start,leader,gun).move);
 assert.equal(plan.reason,null);assert.deepEqual(plan.crew,['leader','helper']);
 const native=replay(start,[advance]);
 assert.deepEqual([native.artillery[0].x,native.artillery[0].y],[5,3]);
 assert.deepEqual([member(native,'leader').x,member(native,'leader').y],[5,2]);assert.deepEqual([member(native,'helper').x,member(native,'helper').y],[4,2]);
 assert.deepEqual(member(native,'screen'),member(start,'screen'),'the screen is not a translated destination or borrowed crew member');
 for(const id of plan.crew){assert.equal(artilleryContact(native,member(native,id),native.artillery[0]),true);assert.equal(member(native,id).ap,member(start,id).ap);}
 assert.equal(native.elapsedSeconds,start.elapsedSeconds+Math.max(1,Math.ceil(artilleryCosts(start,leader,gun).move*.06)));kept(start,native);
 const action=mountainBatteryOrder(start,leader,options);assert.deepEqual(action,advance,'planning must not treat an unrelated corner body as a translated destination');
 assert.deepEqual(replay(start,[action]),native);assert.deepEqual(start,before);
});

test('actual translated unit, civilian, prop and cannon destinations remain blocked',()=>{
 for(const endpoint of ['unit','npc','prop','gun']){
  const start=arena({endpoint}),before=structuredClone(start),refused=actBattle(start,advance);
  assert.ok(refused.lastError,endpoint);assert.deepEqual(refused.artillery,start.artillery);assert.deepEqual(refused.units,start.units);
  assert.equal(mountainBatteryOrder(start,member(start,'leader'),options),null,endpoint);assert.deepEqual(start,before);
 }
});

test('orthogonal wall crossings, blocked terrain and water remain outside the planned rigid route',()=>{
 for(const declaration of [{wall:true},{terrain:'blocked'},{terrain:'water'}]){
  const start=arena(declaration),before=structuredClone(start),refused=actBattle(start,advance);assert.ok(refused.lastError);
  assert.deepEqual(refused.artillery,start.artillery);assert.deepEqual(refused.units,start.units);assert.equal(mountainBatteryOrder(start,member(start,'leader'),options),null);assert.deepEqual(start,before);
 }
});

test('an actual prop in the gun-contact corner does not become a usable post-move crew position',()=>{
 const start=arena({cornerProp:true}),before=structuredClone(start),native=actBattle(start,advance);assert.equal(native.lastError,null);
 assert.equal(artilleryContact(native,member(native,'helper'),native.artillery[0]),false);
 assert.equal(mountainBatteryOrder(start,member(start,'leader'),options),null,'retain real contact geometry rather than stranding the crew');assert.deepEqual(start,before);
});

test('a missing actual crew member or spent gun cannot manufacture a supplied crew advance',()=>{
 const short=arena({missing:true}),before=structuredClone(short);assert.ok(artilleryCrewPlan(short,member(short,'leader'),short.artillery[0],20).reason);assert.ok(actBattle(short,advance).lastError);assert.equal(mountainBatteryOrder(short,member(short,'leader'),options),null);assert.deepEqual(short,before);
 const empty=arena({empty:true}),held=structuredClone(empty);assert.equal(empty.artillery[0].loaded,false);assert.equal(empty.artillery[0].ammo,0);assert.notEqual(mountainBatteryOrder(empty,member(empty,'leader'),options)?.type,'artilleryMove');assert.deepEqual(empty,held);
});

test('Native combat translation debits every actual crew member and refuses a member below the move cost',()=>{
 const start=arena({combat:true}),before=structuredClone(start),leader=member(start,'leader'),cost=artilleryCosts(start,leader,start.artillery[0]).move,plan=artilleryCrewPlan(start,leader,start.artillery[0],cost);assert.equal(plan.reason,null);
 const paid=replay(start,[advance]);for(const id of plan.crew)assert.equal(member(paid,id).ap,member(start,id).ap-cost);assert.equal(paid.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);kept(start,paid);assert.deepEqual(start,before);
 const tired=arena({combat:true,tired:true}),unchanged=structuredClone(tired);assert.ok(member(tired,'helper').ap<cost);assert.ok(artilleryCrewPlan(tired,member(tired,'leader'),tired.artillery[0],cost).reason);const refused=actBattle(tired,advance);assert.ok(refused.lastError);assert.deepEqual(refused.artillery,tired.artillery);assert.deepEqual(refused.units,tired.units);assert.deepEqual(tired,unchanged);
});
