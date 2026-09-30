import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWeaponDefinition,weaponSpecification,validateWeaponCarrier} from '../game/weapon-definition.js';
import {handRecord,itemDescriptor,extractItemQuantity,applyItemQuantity,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {planEquipmentPickup,planEquipmentCursorPlacement,planEquipmentUnload} from '../game/equipment-cursor.js';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {secondaryPistolView} from '../game/paired-fire.js';
const definition=compileWeaponDefinition({id:'pistola-de-prueba',template:1808,name:'Pistola del enlace',damage:24,fireAP:18,readyAP:5,aimAP:0,reloadAP:54,range:14,capacity:3,weight:1.7,price:91,art:'/art/custom-pistol.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:19,range:20,pattern:'single'}]});
const actor=()=>initializeUnitAmmunition({id:'p',weapon:1808,blade:0,activeSlot:'primary',hp:70,ap:100,loaded:3,condition:61,jammed:true,weaponMetadata:{contentWeapon:structuredClone(definition)},ammunitionChoice:'ammoRifle',ammo:0,inventory:{},rations:0,medkits:0,torches:0,boleadoras:0});
const pick=(u,sourceId)=>planEquipmentPickup(u,{sourceId,count:1,expectedSource:equipmentFingerprint(u,sourceId)}).unit;
const place=(u,destinationId)=>planEquipmentCursorPlacement(u,{destinationId,expectedSource:equipmentFingerprint(u,'cursor'),expectedDestination:equipmentFingerprint(u,destinationId)}).unit;

test('authored weapon identity and selected load survive hands, cursor, pockets, JSON and transfer',()=>{
 const original=actor();let u=place(pick(original,'hand:right'),'small-1');
 assert.equal(u.weapon,0);assert.equal(u.ammunitionChoice,undefined);
 const entry=inventoryUsage(u).slots.find(p=>p.id==='small-1').entry;
 assert.equal(entry.label,definition.name);assert.equal(entry.art,definition.art);
 u=place(pick(JSON.parse(JSON.stringify(u)),'small-1'),'hand:right');
 assert.deepEqual(handRecord(u,'primary'),handRecord(original,'primary'));validateWeaponCarrier(u);
 assert.equal(itemDescriptor(u,'primary').art,definition.art);
 const extracted=extractItemQuantity(u,'primary'),recipient=applyItemQuantity({id:'q',activeSlot:'unarmed',inventory:{}},extracted.stack);
 const stored=Object.values(recipient.inventory)[0];assert.deepEqual(stored.contentWeapon,definition);assert.equal(stored.ammunitionChoice,'ammoRifle');assert.equal(stored.loaded,3);assert.equal(stored.jammed,true);assert.equal(stored.condition,61);
 assert.equal(weaponSpecification(stored).damage,19);assert.equal(weaponSpecification(stored).capacity,3);
 assert.deepEqual(original,actor());
});

test('unloading an authored alternative gives back only that family and keeps the selected load',()=>{
 const u=actor(),plan=planEquipmentUnload(u,{hostId:'hand:right',expectedHost:equipmentFingerprint(u,'hand:right')});
 assert.equal(plan.count,3);assert.equal(plan.unit.loaded,0);assert.equal(plan.unit.ammunitionChoice,'ammoRifle');
 assert.deepEqual(ammunitionByType(plan.unit),{rifle_62:3});assert.equal(u.loaded,3);
 const secondary=secondaryPistolView({...u,ammunitionChoice:'ammoMusket'},{...handRecord(u,'primary')});
 assert.equal(weaponSpecification(secondary).name,definition.name);assert.equal(weaponSpecification(secondary).damage,19);
 assert.equal(weaponSpecification(secondary).capacity,3);
});


test('removing the primary weapon keeps the other pistol and its selected authored load',()=>{
 const secondary=handRecord(actor(),'primary');
 const unit=initializeUnitAmmunition({id:'pair',hp:100,weapon:1805,loaded:0,ammo:0,activeSlot:'primary',offHand:secondary,inventory:{}});
 const result=extractItemQuantity(unit,'primary',1);
 assert.equal(result.unit.weapon,secondary.weapon);assert.equal(result.unit.offHand,undefined);
 assert.equal(result.unit.ammunitionChoice,'ammoRifle');
 assert.deepEqual(handRecord(result.unit,'primary'),secondary);
 assert.equal(weaponSpecification(result.unit).damage,19);
 assert.equal(unit.weapon,1805);assert.deepEqual(unit.offHand,secondary);
});
