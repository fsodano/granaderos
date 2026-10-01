import test from 'node:test';
import assert from 'node:assert/strict';
import {AMMUNITION_TYPES, ammunitionByType, totalReserveAmmunition} from '../game/ammunition-types.js';
import {AMMUNITION_VERSION, initializeUnitAmmunition, syncUnitAmmunition, consumeWeaponAmmunition} from '../game/tactical-ammunition.js';
const stack=(ammoType,count,extra={})=>({kind:'ammunition',ammoType,count,weight:.04,name:AMMUNITION_TYPES[ammoType].name,...extra});
const hint=(slotId,item,index,count)=>({slotId,item,index,...(count===undefined?{}:{count})});

test('fresh authorship issues the matching prepared load once and keeps weapon charges separate',()=>{
 for(const [weapon,type] of [[1800,'musket_75'],[1801,'musket_75'],[1802,'rifle_62'],[1805,'pistol_69'],[1808,'pistol_69']]){
  const u={weapon,loaded:1,reloadProgress:.25,condition:73};assert.equal(initializeUnitAmmunition(u),u);
  assert.equal(u.ammunitionVersion,AMMUNITION_VERSION);assert.deepEqual(ammunitionByType(u),{[type]:12});assert.equal(u.ammo,12);
  assert.equal(u.loaded,1);assert.equal(u.reloadProgress,.25);assert.equal(u.condition,73);
  const inventory=structuredClone(u.inventory);u.ammo=1000;initializeUnitAmmunition(u);assert.deepEqual(u.inventory,inventory);assert.equal(u.ammo,12);
 }
 const explicit={weapon:1806,loaded:0,ammo:3};initializeUnitAmmunition(explicit);assert.deepEqual(ammunitionByType(explicit),{pistol_69:3});
});

test('unarmed defaults create no ammunition and explicit old spare rounds use one fixed fallback',()=>{
 for(const weapon of [0,1809,65535]){
  const empty={weapon};initializeUnitAmmunition(empty);assert.equal(totalReserveAmmunition(empty),0);assert.equal(empty.ammo,0);
  const carrier={weapon,ammo:7};initializeUnitAmmunition(carrier);assert.deepEqual(ammunitionByType(carrier),{musket_75:7});assert.equal(carrier.ammo,0);
  carrier.weapon=1806;initializeUnitAmmunition(carrier);assert.deepEqual(ammunitionByType(carrier),{musket_75:7});assert.equal(carrier.ammo,0);
  carrier.weapon=1800;syncUnitAmmunition(carrier);assert.equal(carrier.ammo,7);
 }
});

test('legacy scalar reserves retain musket type independently of current and future guns',()=>{
 const u={weapon:1805,loaded:1,ammo:9,inventory:{cloth:{count:1,name:'Tela',weight:.1}}};
 const cloth=u.inventory.cloth;initializeUnitAmmunition(u,{legacy:true,defaultCount:0});
 assert.deepEqual(ammunitionByType(u),{musket_75:9});assert.equal(u.ammo,0);assert.equal(u.loaded,1);assert.equal(u.inventory.cloth,cloth);
 for(const weapon of [1806,1800,1802,1800]){u.weapon=weapon;initializeUnitAmmunition(u,{legacy:true,defaultCount:0});assert.equal(totalReserveAmmunition(u),9);assert.equal(u.ammo,weapon===1800?9:0);}
 const absent={weapon:1800};initializeUnitAmmunition(absent,{legacy:true,defaultCount:0});assert.equal(totalReserveAmmunition(absent),0);
});

test('existing typed inventory is authoritative even before its unit version is marked',()=>{
 for(const count of [0,4]){
  const u={weapon:1805,ammo:999,inventory:{personal:stack('pistol_69',count,{name:'Caja personal',lot:42})}};
  const original=structuredClone(u.inventory);initializeUnitAmmunition(u,{legacy:true,defaultCount:99});
  assert.deepEqual(u.inventory,original);assert.equal(totalReserveAmmunition(u),count);assert.equal(u.ammo,count);
 }
});

test('initialization remaps both hand singletons and exact pocket partitions to the created collision-safe record',()=>{
 const u={weapon:1805,ammo:25,activeSlot:'item',activeItem:'ammo',leftHandItem:'ammo',inventory:{
  'ammo:musket_75':{name:'Llave',kind:'tool',toolKey:'key',count:1,weight:.1}},
  pocketOrder:[hint('small-4','ammo',0,20),hint('small-7','ammo',1,3),hint('small-8','inventory:ammo:musket_75',0)]};
 initializeUnitAmmunition(u,{legacy:true});const item='inventory:ammo:musket_75:1';
 assert.equal(u.activeItem,item);assert.equal(u.leftHandItem,item);assert.equal(u.activeSlot,'item');assert.equal(u.ammo,0);
 assert.deepEqual(u.pocketOrder,[hint('small-4',item,0,20),hint('small-7',item,1,3),hint('small-8','inventory:ammo:musket_75',0)]);
 assert.equal(u.inventory['ammo:musket_75'].toolKey,'key');assert.equal(u.inventory['ammo:musket_75:1'].count,25);
});

test('legacy cursor rounds migrate as a separate physical owner with retained custom details',()=>{
 const u={weapon:1806,ammo:5,loaded:1,equipmentCursor:{sourceId:'small-3',stack:{item:'ammo',count:3,weight:.04,name:'Reserva del correo',lot:{number:9}}}};
 initializeUnitAmmunition(u,{legacy:true});
 assert.equal(totalReserveAmmunition(u),5);assert.equal(u.ammo,0);assert.equal(u.loaded,1);
 assert.deepEqual(u.equipmentCursor,{sourceId:'small-3',stack:{item:'inventory:ammo:musket_75',...stack('musket_75',3,{name:'Reserva del correo',lot:{number:9}})}});
 const before=structuredClone(u);initializeUnitAmmunition(u,{legacy:true});assert.deepEqual(u,before);
});

test('sync changes only the projection and stale placement hints, without funding from a scalar',()=>{
 const u={weapon:1805,loaded:1,ammo:900,activeSlot:'primary',leftHandItem:'inventory:a',inventory:{
  a:stack('pistol_69',5),p:stack('pistol_69',7),cloth:{name:'Tela',count:2,weight:.1}},
  pocketOrder:[hint('small-1','inventory:a',0,3),hint('small-2','inventory:a',1,3),hint('small-3','inventory:a',2,2),hint('small-4','inventory:cloth',0,2)],
  equipmentCursor:{sourceId:'small-6',stack:{item:'inventory:cursor',...stack('musket_75',4)}}};
 const inventory=u.inventory,cursor=u.equipmentCursor;syncUnitAmmunition(u);
 assert.equal(u.ammo,12);assert.equal(u.inventory,inventory);assert.equal(u.equipmentCursor,cursor);assert.equal(totalReserveAmmunition(u),12);
 assert.deepEqual(u.pocketOrder,[hint('small-1','inventory:a',0,3),hint('small-2','inventory:a',1,1),hint('small-4','inventory:cloth',0,2)]);
 assert.equal(u.loaded,1);assert.equal(u.leftHandItem,'inventory:a');assert.equal(u.ammunitionVersion,undefined);
 u.weapon=1806;syncUnitAmmunition(u);assert.equal(u.ammo,12);assert.equal(u.inventory,inventory);
});

test('consumption reconciles duplicate ammo hands and finally clears them without promoting a stowed gun',()=>{
 const u={weapon:1800,loaded:1,ammo:2,activeSlot:'item',activeItem:'inventory:custom',leftHandItem:'inventory:custom',
  inventory:{custom:stack('musket_75',2,{name:'Cartuchos elegidos',lot:{maker:'Taller'}})},ammunitionVersion:2};
 consumeWeaponAmmunition(u,1800,1);
 assert.equal(u.ammo,1);assert.equal(u.activeItem,'inventory:custom');assert.equal(u.leftHandItem,null);assert.equal(u.inventory.custom.count,1);
 assert.deepEqual(u.inventory.custom.lot,{maker:'Taller'});
 consumeWeaponAmmunition(u,1800,1);assert.equal(u.ammo,0);assert.equal(u.activeSlot,'unarmed');assert.equal(u.activeItem,undefined);
 assert.equal(u.leftHandItem,null);assert.equal(u.weapon,1800);assert.equal(u.loaded,1);assert.deepEqual(u.inventory,{});
});

test('a left-hand reference blocked by a long gun does not remove a round from its actual pocket partition',()=>{
 const u={weapon:1800,activeSlot:'primary',leftHandItem:'inventory:a',inventory:{a:stack('musket_75',2)},
  pocketOrder:[hint('small-5','inventory:a',0,2)]};
 syncUnitAmmunition(u);assert.deepEqual(u.pocketOrder,[hint('small-5','inventory:a',0,2)]);
 consumeWeaponAmmunition(u,1800,1);assert.deepEqual(u.pocketOrder,[hint('small-5','inventory:a',0,1)]);
 assert.equal(u.inventory.a.count,1);assert.equal(u.activeSlot,'primary');assert.equal(u.weapon,1800);
});

test('weapon consumption preserves other calibers, cursor rounds and valid remaining stack partitions',()=>{
 const u={weapon:1800,loaded:1,ammo:9,inventory:{a:stack('musket_75',9),p:stack('pistol_69',2)},
  pocketOrder:[hint('small-2','inventory:a',0,3),hint('small-6','inventory:a',1,6),hint('small-8','inventory:p',0)],
  equipmentCursor:{sourceId:'small-1',stack:{item:'inventory:cursor',...stack('musket_75',3)}}};
 const cursor=u.equipmentCursor,pistol=u.inventory.p;consumeWeaponAmmunition(u,1800,5);
 assert.equal(u.ammo,4);assert.equal(u.inventory.p,pistol);assert.equal(u.equipmentCursor,cursor);
 assert.deepEqual(u.pocketOrder,[hint('small-2','inventory:a',0,3),hint('small-6','inventory:a',1,1),hint('small-8','inventory:p',0)]);
 consumeWeaponAmmunition(u,1806,1);assert.equal(u.ammo,4,'the scalar projects the actual primary, not the gun just supplied');assert.equal(u.inventory.p.count,1);
 consumeWeaponAmmunition(u,1800,4);assert.deepEqual(u.pocketOrder,[hint('small-8','inventory:p',0)]);assert.equal(u.loaded,1);
});

test('invalid initialization and late cleanup failures reject atomically',()=>{
 const base={weapon:1800,ammo:3,activeSlot:'item',activeItem:'ammo'};
 for(const patch of [{ammunitionVersion:3},{ammo:-1},{ammo:.5},{ammo:'3'},{ammo:1000001},
  {inventory:{bad:stack('musket_75',1,{ammoType:'missing',name:'Inválida'})}},
  {pocketOrder:[hint('small-1','ammo',0,21)]},
  {equipmentCursor:{sourceId:'small-1',stack:{item:'ammo',count:0,weight:.04}}},
  {equipmentCursor:{sourceId:'small-1',stack:{item:'ammo',count:1,weight:.04,weapon:1800}}}]){
  const u={...structuredClone(base),...patch},before=structuredClone(u),inventory=u.inventory;
  assert.throws(()=>initializeUnitAmmunition(u,{legacy:true}));assert.deepEqual(u,before);assert.equal(u.inventory,inventory);
 }
 const u={weapon:1800,inventory:{a:stack('musket_75',5)},pocketOrder:[hint('small-1','inventory:a',0,21)]},before=structuredClone(u),inventory=u.inventory;
 assert.throws(()=>consumeWeaponAmmunition(u,1800,1));assert.deepEqual(u,before);assert.equal(u.inventory,inventory);
});

test('missing compatible rounds reject despite unrelated stock or a stale scalar projection',()=>{
 const u={weapon:1800,ammo:100,inventory:{p:stack('pistol_69',2)},equipmentCursor:{sourceId:'small-1',stack:{item:'inventory:c',...stack('musket_75',3)}}};
 for(const weapon of [1800,0,65535]){const before=structuredClone(u);assert.throws(()=>consumeWeaponAmmunition(u,weapon,1));assert.deepEqual(u,before);}
});
