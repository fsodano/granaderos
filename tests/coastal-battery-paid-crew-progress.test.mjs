import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,artilleryContact,medicalUsePreview,stanceCost,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {COMBAT_ROUND_SECONDS} from '../game/time.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {usefulRouteFiringPosture} from './route-infantry-progress.mjs';

// Portable declarations, before the Native constructor. No captured failure,
// earned state edit, synthetic AP/time or granted campaign resource is an input.
const member=(battle,id)=>battle.units.find(unit=>unit.id===id);
const flat=()=>Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false}));
function arena({stance='crouched',day=false,care=false,marksmanship=60}={}){
 const far={id:'far-crew',name:'Far crew',x:4,y:day?8:14,stance,facing:0,weapon:1801,blade:0,loaded:1,ammo:11,marksmanship,morale:47,medical:98,medkits:2,activeSlot:care?'medical':'primary',energy:100};
 const players=[{id:'leader',name:'Leader',x:8,y:3,stance:'crouched',facing:0,weapon:1800,blade:0,loaded:1,ammo:3,marksmanship:77,morale:47,medical:0,medkits:0},far];
 if(care)players.push({id:'patient',name:'Patient',x:4,y:9,weapon:0,blade:0,loaded:0,ammo:0,hp:8,maxHp:100,bleeding:2,bandaged:90,medical:0,medkits:0});
 return createBattle(players,{id:'declared-coastal-paid-crew',sector:'declared-coastal-paid-crew',width:20,height:16,tiles:flat(),hour:day?12:0,seed:45,exploration:false,
  artillery:[{id:'local-gun',type:'bronze4',side:'player',x:7,y:2,loaded:true,ammo:2,facing:0}],
  enemies:[{id:'contact',name:'Public contact',x:day?8:7,y:day?8:1,weapon:0,blade:0,loaded:0,ammo:0,hp:100,maxHp:100,patrol:false,overwatch:false}],
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
function heldGoods(start,end){for(const unit of start.units.filter(unit=>unit.side==='player')){const next=member(end,unit.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(unit));for(const key of ['inventory','weapon','blade','weaponInstanceId','weaponMetadata','outfit','headwear','legwear'])assert.deepEqual(next[key],unit[key]);}}
function contactDistance(battle,unit){const gun=battle.artillery[0];return Math.hypot(unit.x-gun.x,unit.y-gun.y);}
function paidMove(start,action){
 const unit=member(start,action.unitId),quote=getReachable(start,unit).find(point=>sameCell(point,action));assert.ok(quote&&quote.cost>0&&quote.cost<=unit.ap,'Actual Native route and AP, without a free reposition.');
 const result=replay(start,[action]);assert.equal(member(result,unit.id).ap,unit.ap-quote.cost);assert.ok(member(result,unit.id).energy<unit.energy);assert.ok(contactDistance(result,member(result,unit.id))<contactDistance(start,unit));assert.equal(result.elapsedSeconds,start.elapsedSeconds+(start.roundTimeCharged?0:COMBAT_ROUND_SECONDS));assert.equal(result.turn,start.turn);assert.equal(result.roundTimeCharged,true);
 assert.deepEqual(result.artillery,start.artillery);heldGoods(start,result);return result;
}

test('a useless ordinary prone proposal gives a supplied noncontact ground crew a real paid approach',()=>{
 const start=arena(),before=structuredClone(start),unit=member(start,'far-crew'),gun=start.artillery[0];assert.equal(sameSurface(unit,gun),true);assert.equal(artilleryContact(start,unit,gun),false);assert.equal(teamCanSee(start,'player',member(start,'contact')),true);
 const ordinary=tucumanCombatOrder(start,unit);assert.deepEqual(ordinary,{type:'stance',unitId:unit.id,stance:'prone'});assert.equal(usefulRouteFiringPosture(start,unit,ordinary),false);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,unit);assert.equal(action?.type,'move');assert.equal(action.unitId,unit.id);paidMove(start,action);assert.deepEqual(start,before);
});

test('after paying the real crouch cost, the same crew advances instead of returning immediately to a useless prone stance',()=>{
 const start=arena({stance:'prone',marksmanship:0}),before=structuredClone(start),unit=member(start,'far-crew'),controller=coastalBatteryController(start,{sharedArtillerySight:true});
 const first=controller(start,unit);assert.deepEqual(first,{type:'stance',unitId:unit.id,stance:'crouched'});
 const raised=replay(start,[first]);assert.equal(member(raised,unit.id).ap,unit.ap-stanceCost(unit,'crouched'));assert.deepEqual(raised.artillery,start.artillery);heldGoods(start,raised);
 const ordinary=tucumanCombatOrder(raised,member(raised,unit.id));assert.deepEqual(ordinary,{type:'stance',unitId:unit.id,stance:'prone'});assert.equal(usefulRouteFiringPosture(raised,member(raised,unit.id),ordinary),false);
 const next=controller(raised,member(raised,unit.id));assert.equal(next?.type,'move');const end=paidMove(raised,next);assert.deepEqual(replay(start,[first,next]),end);assert.deepEqual(start,before);
});

test('a currently useful finite personal rifle shot stays first for the same noncontact crew',()=>{
 const start=arena({day:true}),before=structuredClone(start),unit=member(start,'far-crew'),ordinary=tucumanCombatOrder(start,unit);assert.equal(ordinary?.type,'fire');
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,unit);assert.deepEqual(action,ordinary);
 const result=replay(start,[action]);assert.equal(Object.values(unitAmmunitionByType(member(result,unit.id))).reduce((sum,value)=>sum+value,0),Object.values(unitAmmunitionByType(unit)).reduce((sum,value)=>sum+value,0)-1);assert.ok(member(result,unit.id).ap<unit.ap);assert.deepEqual(result.artillery,start.artillery);assert.deepEqual(start,before);
});

test('actual adjacent finite aid stays first for an armed physician assigned to the noncontact crew',()=>{
 const start=arena({day:true,care:true}),before=structuredClone(start),unit=member(start,'far-crew'),patient=member(start,'patient'),preview=medicalUsePreview(start,unit,patient);assert.equal(preview.allowed,true);
 const action=coastalBatteryController(start,{sharedArtillerySight:true})(start,unit);assert.deepEqual(action,{type:'useItem',unitId:unit.id,targetId:patient.id});
 const result=replay(start,[action]);assert.equal(member(result,unit.id).ap,unit.ap-preview.cost);assert.equal(member(result,unit.id).medkits,unit.medkits-preview.treatment.dressingsUsed);assert.equal(member(result,patient.id).hp,preview.treatment.hpAfter);assert.equal(member(result,patient.id).bleeding,preview.treatment.bleedingAfter);assert.deepEqual(result.artillery,start.artillery);heldGoods(start,result);assert.deepEqual(start,before);
});
