import test from 'node:test';
import assert from 'node:assert/strict';
import {unitAmmunitionByType,stackAmmunitionByType} from '../game/physical-ammunition.js';
import {prepareGarrison,returnGarrison} from '../game/garrison.js';
import {createBattle} from '../game/tactical.js';
import {stockAmmunitionLedger} from './created-cuyo-route.mjs';

test('a living scene-only player unit without a global or retained owner keeps its actual ammunition',()=>{
 // This is an ownership-model control, not a campaign victory or funded route.
 const militiaModel={sectors:{cordoba:{owner:'patriot',militia:[1,0,0]}}},[issued]=prepareGarrison(militiaModel,'cordoba');
 const scene=createBattle([{...issued,x:2,y:2}],{width:12,height:8,enemies:[]}),unit=scene.units[0];
 const c={recruited:[],operativeState:{},sectorStates:{cordoba:scene},sceneStates:{},ammunitionStores:{}};
 assert.equal(unit.side,'player');assert.ok(unit.hp>0&&unit.militia);assert.equal(Object.hasOwn(c.operativeState,unit.id),false);
 const counts=unitAmmunitionByType(unit),expected={musket_75:0,rifle_62:0,pistol_69:0,shot_16:0,...counts};assert.ok(Object.values(counts).some(n=>n>0));
 assert.deepEqual(stockAmmunitionLedger(c),expected);
 const corrupted=structuredClone(c);corrupted.sectorStates.cordoba.units[0].loaded--;
 const family=Object.keys(stackAmmunitionByType(unit))[0];assert.ok(family);
 assert.deepEqual(stockAmmunitionLedger(corrupted),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(corrupted),expected),'a sole scene owner cannot be excluded as operative history');
});

test('retained garrison records own rounds once and a dead garrison body keeps its remaining rounds',()=>{
 // Exercise the real garrison issue/return data model. This does not claim a
 // native battle, a militia casualty or a funded campaign outcome.
 const c={sectors:{cordoba:{owner:'patriot',militia:[2,0,0]}},recruited:[],operativeState:{},sectorStates:{},sceneStates:{},ammunitionStores:{},log:[],hour:0};
 const issued=prepareGarrison(c,'cordoba'),scene=createBattle(issued.map((u,i)=>({...u,x:2+i,y:2})),{width:12,height:8,enemies:[]});
 const request={sector:'cordoba',garrison:issued};returnGarrison(c,request,scene);c.sectorStates.cordoba=scene;
 assert.deepEqual(c.garrisons.cordoba.map(u=>String(u.id)),scene.units.map(u=>u.id));assert.ok(c.garrisons.cordoba.every(u=>u.hp>0&&u.militia));
 const expected={musket_75:0,rifle_62:0,pistol_69:0,shot_16:0};
 for(const u of c.garrisons.cordoba)for(const[type,n]of Object.entries(unitAmmunitionByType(u)))expected[type]+=n;
 const family=Object.keys(stackAmmunitionByType(c.garrisons.cordoba[0]))[0];assert.ok(family&&expected[family]>0);assert.deepEqual(stockAmmunitionLedger(c),expected,'the live scene cannot issue another copy of retained garrison rounds');
 const oldMirror=structuredClone(c);oldMirror.sectorStates.cordoba.units[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(oldMirror),expected,'retained garrison gear is authoritative over an old living scene copy');
 const lost=structuredClone(c);lost.garrisons.cordoba[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(lost),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(lost),expected),'a missing retained garrison charge must fail conservation');
 const withBody=structuredClone(c);withBody.sectorStates.cordoba.units[0].hp=0;returnGarrison(withBody,request,withBody.sectorStates.cordoba);
 assert.equal(withBody.garrisons.cordoba.length,1);assert.equal(withBody.garrisons.cordoba[0].id,issued[1].id);
 assert.equal(withBody.sectorStates.cordoba.units[0].id,String(issued[0].id));assert.deepEqual(stockAmmunitionLedger(withBody),expected,'the removed garrison record does not erase the real body ammunition');
 withBody.sectorStates.cordoba.units[0].loaded--;
 assert.deepEqual(stockAmmunitionLedger(withBody),{...expected,[family]:expected[family]-1});
 assert.throws(()=>assert.deepEqual(stockAmmunitionLedger(withBody),expected),'a missing corpse charge must fail conservation');
});
