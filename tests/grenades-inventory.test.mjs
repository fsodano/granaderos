import test from 'node:test';
import assert from 'node:assert/strict';
import {GRENADE_TYPES,isGrenadeStack,validateGrenadeStack,makeGrenadeStack} from '../game/grenades.js';
import {applyItemQuantity,extractItemQuantity,transferItemQuantity,inventoryUsage,itemDescriptor,readItemStack,validateItemStack,equipmentFingerprint,equipmentEndpoint} from '../game/tactical-inventory.js';
import {planEquipmentPickup,planEquipmentCursorPlacement} from '../game/equipment-cursor.js';

const bare=id=>({id,hp:80,weapon:0,weaponDropped:true,blade:0,activeSlot:'unarmed',inventory:{}});
const item='inventory:grenade:arsenal';
const payload=(count=1,extra={})=>({item,...makeGrenadeStack('arsenal',count,extra)});
const pick=(u,id,count=1)=>planEquipmentPickup(u,{sourceId:id,count,expectedSource:equipmentFingerprint(u,id)}).unit;
const place=(u,id)=>planEquipmentCursorPlacement(u,{destinationId:id,expectedSource:equipmentFingerprint(u,'cursor'),expectedDestination:equipmentFingerprint(u,id)}).unit;

test('arsenal grenades have one fixed schema, two per small pocket, and no scalar supply ownership',()=>{
 assert.deepEqual(Object.keys(GRENADE_TYPES),['arsenal']);assert.equal(isGrenadeStack(null),false);assert.equal(validateGrenadeStack({kind:'tool'}),false);
 const source=bare('p'),unit=applyItemQuantity(source,payload(5));assert.deepEqual(source.inventory,{});assert.equal(unit.grenades,undefined);
 assert.deepEqual(makeGrenadeStack(),{kind:'grenade',grenadeType:'arsenal',count:1,weight:1,name:'Granada de arsenal',condition:100});
 const slots=inventoryUsage(unit).slots.filter(p=>p.entry);assert.deepEqual(slots.map(p=>p.entry.count),[2,2,1]);assert.ok(slots.every(p=>p.id.startsWith('small-')));
 assert.equal(itemDescriptor(unit,item).stackLimit,2);assert.equal(itemDescriptor(unit,item).kind,'grenade');
 assert.throws(()=>makeGrenadeStack('modern'));assert.throws(()=>makeGrenadeStack('arsenal',2,{instanceId:'one'}));
});

test('grenade admission rejects malformed values, disguised kinds, hybrids and saved blast overrides',()=>{
 const valid=payload();
 for(const patch of [{grenadeType:'modern'},{grenadeType:null},{grenadeType:1},{count:-1},{count:.5},{count:1000001},{weight:0},{condition:null},{condition:NaN},{condition:101},{name:''},{name:'<img>'},
  ...['weapon','loaded','reloadProgress','loadedAmmoType','reloadAmmoType','ammoType','jammed','fittings','fittingPattern','toolKey','itemType','outfit','damage','radius','blastDamage','blastRadius','fuse','fuseSeconds'].map(key=>({[key]:key==='weapon'?1800:0})),
  {kind:'tool'},{kind:'ammunition'},{kind:'outfit'},{item:'torches'},{item:'ammo'},{instanceId:'bad\nname'}]){
  assert.throws(()=>validateItemStack({...valid,...patch}),JSON.stringify(patch));
  const unit=bare('p'),before=structuredClone(unit);assert.throws(()=>applyItemQuantity(unit,{...valid,...patch}));assert.deepEqual(unit,before);
 }
 for(const key of ['weight','condition','grenadeType']){const missing={...valid};delete missing[key];assert.throws(()=>validateItemStack(missing),key);}
 const malformed=applyItemQuantity(bare('p'),payload(3));malformed.pocketOrder=[{slotId:'small-1',item,index:0,count:3}];assert.throws(()=>inventoryUsage(malformed),/límite/);
});

test('exact grenade metadata survives physical hand, pocket, cursor and inter-unit transfers',()=>{
 const detail={name:'Remesa reservada',condition:74,proof:{arsenal:'Mendoza',batch:9}};
 let u=applyItemQuantity(bare('p'),payload(2,detail));const before=structuredClone(u),slot=inventoryUsage(u).slots.find(p=>p.entry?.item===item).id;
 u=pick(u,slot);assert.equal(u.equipmentCursor.stack.count,1);assert.equal(u.inventory['grenade:arsenal'].count,1);
 u=place(u,'hand:right');assert.equal(u.activeSlot,'item');assert.equal(u.activeItem,item);assert.deepEqual(readItemStack(u,item),payload(1,detail));
 u=pick(u,'hand:right');assert.equal(equipmentEndpoint(u,'hand:right').item,null);u=place(u,'small-7');
 assert.equal(equipmentEndpoint(u,'small-7').count,1);assert.deepEqual(readItemStack(u,item),payload(1,detail));
 const sent=transferItemQuantity(u,bare('q'),item,1);assert.deepEqual(readItemStack(sent.target,item),payload(1,detail));assert.equal(sent.source.inventory['grenade:arsenal'].count,1);
 const removed=extractItemQuantity(sent.target,item,1);assert.deepEqual(removed.stack,payload(1,detail));assert.deepEqual(removed.unit.inventory,{});
 assert.equal(before.inventory['grenade:arsenal'].count,2);
});

test('separate identified grenades and different conditions cannot merge or duplicate identity on the cursor',()=>{
 let u=applyItemQuantity(bare('p'),payload(1,{instanceId:'arsenal-1'}));u=applyItemQuantity(u,payload(1,{instanceId:'arsenal-2'}));
 assert.equal(Object.keys(u.inventory).length,2);assert.ok(inventoryUsage(u).slots.filter(p=>p.entry).every(p=>p.entry.count===1));
 const slot=inventoryUsage(u).slots.find(p=>p.entry).id;u=pick(u,slot);
 assert.throws(()=>applyItemQuantity(u,payload(1,{instanceId:u.equipmentCursor.stack.instanceId})),/identidad/);
 let mixed=applyItemQuantity(bare('q'),payload(1,{condition:80}));mixed=applyItemQuantity(mixed,payload(1,{condition:70}));assert.equal(Object.keys(mixed.inventory).length,2);
});
