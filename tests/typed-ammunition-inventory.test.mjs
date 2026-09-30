import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,reloadPlan,carriedWeight} from '../game/tactical.js';
import {AMMUNITION_TYPES,addAmmunition,ammunitionByType,availableAmmunition} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {inventoryUsage,equipmentFingerprint,transferItemQuantity,validateItemStack} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview,tacticalInputAction,inventoryModel,nearbyLootOptions} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
const grid=Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}));
const field=(patch={})=>createBattle([{id:'p',x:2,y:2,weapon:1800,loaded:0,ammo:3,blade:0,priming:20,flints:0,rations:0,medkits:0,torches:0,boleadoras:0,...patch}],{width:10,height:8,tiles:grid,exploration:true,enemies:[]});
const act=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const physical=s=>({...s,log:[],lastError:null});
const pistol=weapon=>({weapon,loaded:0,condition:100,jammed:false,weight:1.2,count:1});

test('swapping to a rifle preserves musket rounds and the empty cursor names the missing load',()=>{
 let b=field({inventory:{baker:{weapon:1802,loaded:0,condition:100,jammed:false,weight:4,count:1}}});
 const before=ammunitionByType(b.units[0]);b=act(b,{type:'equipLoot',inventoryKey:'baker'});
 assert.deepEqual(ammunitionByType(b.units[0]),before);assert.equal(availableAmmunition(b.units[0]),0);
 const p=targetPreview(b,b.units[0],null,{mode:'fire'});assert.equal(p.cursor,'empty');assert.equal(p.valid,false);assert.match(p.reason,/fusil/);
 const rejected=actBattle(b,{type:'reload',unitId:'p'});assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(b));
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));assert.deepEqual(ammunitionByType(saved.units[0]),before);assert.equal(reloadPlan(saved.units[0],saved).available,0);
 const key=Object.keys(saved.units[0].inventory).find(k=>saved.units[0].inventory[k].weapon===1800);
 b=act(saved,{type:'equipLoot',inventoryKey:key});b=act(b,{type:'reload'});assert.equal(b.units[0].loaded,1);assert.deepEqual(ammunitionByType(b.units[0]),{musket_75:2});
});

test('different pistols consume a shared compatible pool without duplicating rounds',()=>{
 for(const firstCount of [0,2]){
  let b=field({weapon:1805,ammo:firstCount,offHand:pistol(1806)});addAmmunition(b.units[0],'pistol_69',3);syncUnitAmmunition(b.units[0]);
  const plan=reloadPlan(b.units[0],b);assert.deepEqual(plan.hands.map(h=>h.hand),['primary','offhand']);
  b=act(b,{type:'reload'});assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].offHand.loaded,1);
  assert.deepEqual(ammunitionByType(b.units[0]),{pistol_69:firstCount+1});
 }
});

test('empty shooting clicks load only matching cartridges and never fire during loading',()=>{
 let b=field({weapon:1802,ammo:0});addAmmunition(b.units[0],'musket_75',8);addAmmunition(b.units[0],'rifle_62',1);syncUnitAmmunition(b.units[0]);
 const order=tacticalInputAction(b,b.units[0],{type:'firePoint',x:6,y:2});assert.equal(order.type,'reload');
 b=act(b,order);assert.equal(b.units[0].loaded,1);assert.deepEqual(ammunitionByType(b.units[0]),{musket_75:8});assert.deepEqual(b.smoke,[]);
 b=act(b,{type:'firePoint',x:6,y:2});assert.equal(b.units[0].loaded,0);assert.equal(targetPreview(b,b.units[0],null,{mode:'fire'}).cursor,'empty');
});

test('typed cartridges use twenty-round pockets and physical weight is counted once',()=>{
 const b=field({ammo:0}),u=b.units[0],weight=carriedWeight(u);addAmmunition(u,'musket_75',41);syncUnitAmmunition(u);
 const slots=inventoryUsage(u).slots.filter(s=>s.entry?.kind==='ammunition');assert.deepEqual(slots.map(s=>s.entry.count),[20,20,1]);assert.ok(Math.abs(carriedWeight(u)-weight-41*.04)<1e-8);
 const inv=inventoryModel(b,u);assert.equal(inv.items.filter(i=>i.kind==='ammunition').length,1);assert.equal(inv.items.some(i=>i.item==='ammo'),false);assert.match(inv.items.find(i=>i.kind==='ammunition').label,/mosquete/);
});

test('cursor custody excludes cartridges from reload reserves and restores their exact lot',()=>{
 let b=field({ammo:0,inventory:{lot:{kind:'ammunition',ammoType:'musket_75',name:'Lote de Retiro',weight:.04,count:3,lot:'ret-17'}}}),u=b.units[0];
 const slot=inventoryUsage(u).slots.find(s=>s.entry?.item==='inventory:lot');
 b=act(b,{type:'pickupEquipment',sourceId:slot.id,count:3,expectedSource:equipmentFingerprint(u,slot.id)});u=b.units[0];
 assert.equal(availableAmmunition(u),0);assert.equal(u.equipmentCursor.stack.lot,'ret-17');assert.equal(u.equipmentCursor.stack.ammoType,'musket_75');
 b=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));u=b.units[0];
 b=act(b,{type:'placeEquipment',destinationId:slot.id,count:3,expectedSource:equipmentFingerprint(u,'cursor'),expectedDestination:equipmentFingerprint(u,slot.id)});
 assert.equal(availableAmmunition(b.units[0]),3);assert.equal(b.units[0].inventory.lot.lot,'ret-17');
});

test('canonical cursor admission rejects an old untyped stack before placement can erase it',()=>{
 const b=field({ammo:0}),u=b.units[0];u.equipmentCursor={sourceId:'small-8',stack:{item:'ammo',count:3,weight:.04}};
 // These are the exact old-format fingerprints, so rejection is due to the
 // unsupported custody record rather than an unrelated stale selection.
 const legacyOwner={...u,ammunitionVersion:undefined},order={type:'placeEquipment',unitId:u.id,destinationId:'small-8',expectedSource:equipmentFingerprint(legacyOwner,'cursor'),expectedDestination:equipmentFingerprint(legacyOwner,'small-8')},before=structuredClone(b);
 assert.throws(()=>validateBattleSnapshot(b),/munición del cursor/);
 const rejected=actBattle(b,order);assert.match(rejected.lastError,/munición del cursor/);assert.deepEqual(physical(rejected),physical(b));assert.deepEqual(b,before);
});

test('a genuine legacy cursor migrates once and places the same finite musket cartridge lot',()=>{
 const old=field({ammo:0}),u=old.units[0];delete old.ammunitionVersion;delete u.ammunitionVersion;
 u.equipmentCursor={sourceId:'small-8',stack:{item:'ammo',count:3,weight:.04,name:'Cartuchos antiguos',lot:'legacy-7'}};
 const before=structuredClone(old),migrated=validateBattleSnapshot(old),owner=migrated.units[0];assert.deepEqual(old,before);
 assert.equal(owner.ammunitionVersion,2);assert.deepEqual(owner.equipmentCursor.stack,{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',count:3,weight:.04,name:'Cartuchos antiguos',lot:'legacy-7'});assert.equal(availableAmmunition(owner),0);
 const again=validateBattleSnapshot(JSON.parse(JSON.stringify(migrated)));assert.deepEqual(again,migrated);
 const placed=act(again,{type:'placeEquipment',destinationId:'small-8',expectedSource:equipmentFingerprint(owner,'cursor'),expectedDestination:equipmentFingerprint(owner,'small-8')});assert.equal(placed.units[0].equipmentCursor,undefined);assert.deepEqual(ammunitionByType(placed.units[0]),{musket_75:3});assert.equal(placed.units[0].inventory['ammo:musket_75'].lot,'legacy-7');assert.doesNotThrow(()=>validateBattleSnapshot(placed));
});

test('transfers and ground loot retain type, custom lot data and visible caliber labels',()=>{
 let b=field({ammo:0,inventory:{lot:{kind:'ammunition',ammoType:'rifle_62',name:'Carga Baker de Salta',weight:.04,count:4,lot:7}}});
 const recipient=field({id:'q',weapon:1805,ammo:0}).units[0],plan=transferItemQuantity(b.units[0],recipient,'inventory:lot',2);
 assert.deepEqual(ammunitionByType(plan.source),{rifle_62:2});assert.deepEqual(ammunitionByType(plan.target),{rifle_62:2});assert.equal(availableAmmunition(plan.target),0);assert.equal(plan.target.inventory.lot.lot,7);
 b=act(b,{type:'drop',item:'inventory:lot',count:4});assert.match(nearbyLootOptions(b,b.units[0])[0].label,/Baker/);
 const known=playerKnownBattle(b).groundItems[0];assert.equal(known.ammoType,'rifle_62');
 b=act(b,{type:'loot',groundId:b.groundItems[0].id,count:4});assert.deepEqual(ammunitionByType(b.units[0]),{rifle_62:4});assert.equal(b.units[0].inventory.lot.lot,7);
});

test('save admission rejects unknown ammunition and cannot turn the display total into stock',()=>{
 const b=field({ammo:1});b.units[0].ammo=99999;
 const restored=validateBattleSnapshot(b);assert.equal(availableAmmunition(restored.units[0]),1);assert.equal(restored.units[0].ammo,1);
 for(const patch of [{ammoType:'universal'},{kind:'other'},{weight:0},{weapon:1800},{reloadProgress:.5}]){
  const stack={item:'inventory:rounds',kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,weight:.04,count:1,...patch};assert.throws(()=>validateItemStack(stack));
 }
});
