import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWeaponDefinition,weaponRecord} from '../game/weapon-definition.js';
import {equipmentKey,equipmentCatalog,armoryInventory,equipmentLabel} from '../game/equipment-catalog.js';
import {storeEquipment,takeEquipment,addEquipment,migrateEquipmentStorage,validateEquipmentStorage,storedEquipmentStack} from '../game/stored-equipment.js';
import {equipArmoryItem} from '../game/armory-items.js';
import {handRecord} from '../game/tactical-inventory.js';
import {migrateAmmunitionCustody,restockAmmunitionShops} from '../game/campaign-ammunition.js';
import {migrateEquipment,validateEquipment,validateEquipmentOwnership,resaleBreakdown,usedEquipmentBreakdown,advanceMerchants,deliverEquipmentShipments,validEquipmentShipments} from '../game/equipment.js';
import {stackAmmunitionByType} from '../game/physical-ammunition.js';
import {repairEquipmentQueue,repairEquipment} from '../game/equipment-repair.js';

const authored={id:'pistola-del-correo',template:1808,name:'Pistola del correo',damage:24,fireAP:18,readyAP:5,aimAP:0,reloadAP:54,range:14,capacity:3,weight:1.7,price:91,art:'/art/custom-pistol.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:19,range:20,pattern:'single'}]};
const definition=compileWeaponDefinition(authored);
const fresh=(content=true)=>({equipmentStorageVersion:1,armory:{},armoryItems:[],nextArmoryItemId:1,nextEquipmentInstanceId:1,operativeState:{},loadouts:{},...(content?{contentCampaign:{adapter:'character-weapons-v2',package:{weapons:[authored]}}}:{})});
const authoredGun=()=>({weapon:1808,count:1,loaded:2,reloadProgress:.5,ammunitionChoice:'ammoRifle',condition:61,jammed:true,instanceId:'courier-gun',itemMetadata:{contentWeapon:structuredClone(definition),id:'maker-mark',provenance:{owner:'Correo'}}});

test('one stored object keeps authored image, loading, selected ammunition and maker metadata',()=>{
 const s=fresh(),original=authoredGun();
 const row=storeEquipment(s,1808,original),stack=storedEquipmentStack(row);
 assert.equal(row.item,1808);assert.equal(row.weapon,undefined);assert.equal(equipmentKey(row),authored.id);assert.equal(s.armory[authored.id],1);assert.equal(s.armory[1808],undefined);
 assert.equal(stack.contentWeapon.art,authored.art);assert.equal(stack.id,'maker-mark');assert.equal(stack.ammunitionChoice,'ammoRifle');assert.equal(stack.loaded,2);assert.equal(stack.reloadProgress,.5);assert.equal(stack.instanceId,'courier-gun');
 assert.equal(equipmentLabel(row),authored.name);validateEquipmentStorage(s);
 assert.deepEqual(stackAmmunitionByType(row),{rifle_62:2});
 const restored=JSON.parse(JSON.stringify(s));validateEquipmentStorage(restored);
 assert.deepEqual(storedEquipmentStack(takeEquipment(restored,authored.id,row.id)),stack);assert.equal(restored.armory[authored.id],0);
});

test('old merchant ammunition moves once to the configured market without a second reserve',()=>{
 const ammunition={musket_75:2,rifle_62:4,pistol_69:3,shot_16:5};
 const s={merchants:{retiro:{ammunition,restockHours:7}}};migrateAmmunitionCustody(s);
 assert.equal(s.merchants.retiro.ammunition,undefined);assert.equal(s.ammunitionShops.retiro.restockHours,7);
 assert.deepEqual(s.ammunitionShops.retiro.stock,{ammoMusket:2,ammoPistol:3,ammoRifle:4,ammoShot:5});
 const copy=structuredClone(s);migrateAmmunitionCustody(s);assert.deepEqual(s,copy);
 s.merchants.retiro.ammunition=ammunition;const before=structuredClone(s);assert.throws(()=>migrateAmmunitionCustody(s),/dos reservas/);assert.deepEqual(s,before);
});

test('authored merchant catalog uses the same weapon definition and price as its stored item',()=>{
 const s=fresh();delete s.equipmentStorageVersion;delete s.armoryItems;delete s.nextArmoryItemId;
 migrateEquipment(s);validateEquipment(s,[]);
 assert.equal(s.merchants.retiro.stock[authored.id],3);assert.equal(s.merchants.retiro.stock[1808],undefined);
 const row=storeEquipment(s,1808,authoredGun());
 assert.equal(resaleBreakdown(row).items[0].name,authored.name);assert.equal(resaleBreakdown(row).total,Math.floor(authored.price*.4*.61));assert.equal(usedEquipmentBreakdown(row).total,Math.floor(authored.price*.8*.61));
 const before=structuredClone(s);migrateEquipment(s);assert.deepEqual(s,before);validateEquipment(s,[]);
 const duplicate=structuredClone(row);duplicate.id=`armory-${s.nextArmoryItemId++}`;s.merchants.retiro.usedItems.push(duplicate);assert.throws(()=>validateEquipmentOwnership(s,[]),/duplicada/);
});

test('legacy catalog restock arithmetic keeps the independent ammunition custody unchanged',()=>{
 const s={...fresh(false),location:'retiro',sectors:{retiro:{owner:'patriot'}},resources:{treasury:1000}};migrateEquipment(s);
 s.merchants.retiro.restockHours=23;s.merchants.retiro.stock[1808]=0;
 s.ammunitionShops.retiro={stock:{ammoMusket:2,ammoPistol:3,ammoRifle:4,ammoShot:5},restockHours:23};
 const before=structuredClone(s.ammunitionShops),merchant=structuredClone(s.merchants);advanceMerchants(s,()=>true);
 assert.deepEqual(s.ammunitionShops,before);assert.equal(s.merchants.retiro.stock[1808],1);assert.equal(s.merchants.retiro.restockHours,0);
 restockAmmunitionShops(s,()=>true);assert.deepEqual(s.ammunitionShops,before);
});

test('authored import shipments arrive once at the configured port with their image',()=>{
 const imported={...authored,id:'fusil-importado',template:1800},s=fresh();s.contentCampaign.package.weapons=[imported];s.contentCampaign.package.imports={port:'san_nicolas',minHours:1,maxHours:3};
 Object.assign(s,{hour:10,log:[],sectors:{san_nicolas:{owner:'patriot'}},equipmentShipments:[{item:imported.id,quantity:2,due:10}]});
 assert.equal(validEquipmentShipments(s),true);const deliveries=deliverEquipmentShipments(s);
 assert.equal(deliveries[0].sector,'san_nicolas');assert.equal(deliveries[0].quantity,2);assert.equal(s.equipmentShipments.length,0);assert.equal(s.armory[imported.id],2);assert.equal(storedEquipmentStack(s.armoryItems[0]).contentWeapon.art,imported.art);
 assert.deepEqual(deliverEquipmentShipments(s),[]);validateEquipmentStorage(s);
});

test('published armory rows migrate once without copying their stock',()=>{
 const s=fresh(),gun=weaponRecord({weapon:1808,loaded:0,condition:72,weaponMetadata:{contentWeapon:definition},ammunitionChoice:'ammoRifle'});
 delete s.equipmentStorageVersion;s.armory={[authored.id]:1};s.armoryItems=[{...gun,id:'armory-1'}];s.nextArmoryItemId=2;
 migrateEquipmentStorage(s);assert.equal(s.armoryItems.length,1);assert.equal(s.armoryItems[0].itemMetadata.contentWeapon.art,authored.art);assert.equal(s.armoryItems[0].ammunitionChoice,'ammoRifle');assert.equal(s.armory[authored.id],1);
 const before=structuredClone(s);migrateEquipmentStorage(s);assert.deepEqual(s,before);
});

test('advanced fitting stock migrates to separate finite keys without losing attachments',()=>{
 const s=fresh(false);delete s.equipmentStorageVersion;s.armory={1800:1,1811:2};
 s.armoryItems=[{id:'armory-1',item:1800,condition:72,jammed:false,loaded:1,fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'mounted-bayonet',condition:54}}},{id:'armory-2',item:1811,condition:100,jammed:false},{id:'armory-3',item:1811,condition:90,jammed:false,fittingPattern:'india_socket',instanceId:'loose-bayonet'}];s.nextArmoryItemId=4;
 migrateEquipmentStorage(s);assert.deepEqual(s.armory,{'1800':1,'1811':1,'1811:india_socket':1});assert.equal(s.armoryItems[0].fittings.bayonet.instanceId,'mounted-bayonet');
 assert.equal(armoryInventory(s).find(i=>i.stockKey==='1811:india_socket').quantity,1);validateEquipmentStorage(s);
});

test('finite catalog storage respects authored capacity and cannot create partial batches',()=>{
 const s=fresh();assert.equal(equipmentCatalog(s).find(w=>w.item===authored.id).art,authored.art);addEquipment(s,authored.id,2);validateEquipmentStorage(s);
 assert.equal(s.armoryItems.length,2);assert.equal(s.armoryItems[0].loaded,0);assert.equal(storedEquipmentStack(s.armoryItems[0]).contentWeapon.capacity,3);
 for(const quantity of [-1,.5,10001]){const before=structuredClone(s);assert.throws(()=>addEquipment(s,authored.id,quantity));assert.deepEqual(s,before);}
});

test('storage rejection cannot change sequences, stock, or existing objects',()=>{
 const s=fresh();storeEquipment(s,1808,authoredGun());
 for(const change of [{loaded:4},{ammunitionChoice:'ammoShot'},{itemMetadata:{loaded:0}},{itemMetadata:{weight:-1}},{itemMetadata:{contentWeapon:{...definition,template:1805}}}]){
  const before=structuredClone(s);assert.throws(()=>storeEquipment(s,1808,{...authoredGun(),...change}));assert.deepEqual(s,before);
 }
 const wrong=structuredClone(s);delete wrong.equipmentStorageVersion;wrong.armory[authored.id]=2;const before=structuredClone(wrong);assert.throws(()=>migrateEquipmentStorage(wrong));assert.deepEqual(wrong,before);
});

test('repairs keep authored labels and cannot replace ammunition or the weapon definition',()=>{
 const record={weaponMetadata:{contentWeapon:structuredClone(definition)},condition:61,jammed:true,carriedLoaded:2,ammunitionChoice:'ammoRifle',inventory:{}};
 assert.equal(repairEquipmentQueue(record,{weapon:1808,blade:0})[0].label,authored.name);
 assert.equal(repairEquipment(record,{weapon:1808,blade:0},5),5);assert.equal(record.condition,65);assert.equal(record.jammed,false);assert.equal(record.carriedLoaded,2);assert.equal(record.ammunitionChoice,'ammoRifle');assert.deepEqual(record.weaponMetadata.contentWeapon,definition);
});

test('armory swaps preserve both weapons and their loaded ammunition through a round trip',()=>{
 const s=fresh(),op={id:7,weapon:1805,blade:0};
 s.operativeState[7]={carriedLoaded:1,condition:80,jammed:false,weaponInstanceId:'old-pistol',weaponMetadata:{id:'original-mark'},activeSlot:'primary',inventory:{},ammunitionVersion:2,ammo:0};
 const initial=handRecord({...op,...s.operativeState[7],loaded:1},'primary'),row=storeEquipment(s,1808,authoredGun()),incoming=storedEquipmentStack(row);
 equipArmoryItem(s,op,{slot:'weapon',itemId:authored.id,instanceId:row.id});
 let actor={...op,...s.loadouts[7],...s.operativeState[7],loaded:s.operativeState[7].carriedLoaded,reloadProgress:s.operativeState[7].carriedReloadProgress};
 assert.deepEqual(handRecord(actor,'primary'),incoming);assert.equal(s.armoryItems.length,1);assert.deepEqual(storedEquipmentStack(s.armoryItems[0]),initial);validateEquipmentStorage(s);
 const old=s.armoryItems[0];equipArmoryItem(s,actor,{slot:'weapon',itemId:1805,instanceId:old.id});
 actor={...op,...s.loadouts[7],...s.operativeState[7],loaded:s.operativeState[7].carriedLoaded,reloadProgress:s.operativeState[7].carriedReloadProgress};
 assert.deepEqual(handRecord(actor,'primary'),initial);assert.deepEqual(storedEquipmentStack(s.armoryItems[0]),incoming);assert.equal(s.operativeState[7].ammunitionChoice,undefined);validateEquipmentStorage(s);
});
