import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {storeEquipment,takeEquipment,storedEquipmentMetadata} from '../game/equipment.js';
import {handRecord,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const fresh=()=>order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const personal=s=>sectorInventoryModel(s,'retiro',rosterFor(s),110).personal;
const save=s=>{const restored=decodeSave(encodeSave(s)).campaign;assert.deepEqual(restored,s);return restored;};
const equip=(s,itemId,slot,instanceId)=>order(s,{type:'equip',operativeId:110,itemId,slot,instanceId});
function placeCarried(s,key,destinationId){
 let u=personal(s),sourceId=inventoryUsage(u).slots.find(p=>p.entry?.item===`inventory:${key}`).id;
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'pickupEquipment',sourceId,expectedSource:equipmentFingerprint(u,sourceId)});
 u=personal(s);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'placeEquipment',destinationId,expectedSource:equipmentFingerprint(u,'cursor'),expectedDestination:equipmentFingerprint(u,destinationId)});
 if(s.operativeState[110].equipmentCursor)s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'returnEquipmentCursor',expectedSource:equipmentFingerprint(personal(s),'cursor')});
 return s;
}

for(const slot of ['weapon','blade'])test(`armory ${slot} exchange preserves exact custom ownership through sale, purchase, save and deployment`,()=>{
 let s=fresh();
 // An admitted recovered item has finite identity and extensions; every move
 // after this inventory precondition uses the same player-facing orders.
 const metadata={name:`Arma personal ${slot}`,weight:slot==='weapon'?1.9:.7,id:`maker-${slot}`,provenance:{workshop:'Retiro',marks:['A','B']}};
 const owned={...metadata,weapon:slot==='weapon'?1808:1813,count:1,loaded:slot==='weapon'?1:0,condition:63,jammed:slot==='weapon',instanceId:`custom-${slot}`,...(slot==='weapon'?{reloadProgress:.5}:{})};
 s.operativeState[110].inventory={recovered:owned};
 s=placeCarried(s,'recovered','hand:right');
 // Cursor equips a knife as the blade, and a firearm as the primary weapon.
 const before=handRecord(personal(s),slot==='weapon'?'primary':'blade');
 assert.equal(before.instanceId,owned.instanceId);assert.deepEqual(s.operativeState[110][`${slot}Metadata`],metadata);
 const replacement=slot==='weapon'?1805:1812;
 s=order(s,{type:'purchaseEquipment',item:replacement,quantity:1});const stock=structuredClone(s.ammunitionStores);
 s=equip(s,replacement,slot);assert.equal(s.operativeState[110][`${slot}Metadata`],undefined,'replacement must not inherit the previous owner data');
 let stored=s.armoryItems.find(i=>i.instanceId===owned.instanceId);assert.ok(stored);assert.deepEqual(stored.itemMetadata,metadata);assert.notEqual(stored.id,metadata.id);
 assert.equal(stored.loaded,owned.loaded);assert.equal(stored.reloadProgress,owned.reloadProgress);
 s=save(s);s=order(s,{type:'sellEquipment',instanceId:stored.id});assert.deepEqual(s.merchants.retiro.usedItems.find(i=>i.id===stored.id),stored);
 s=order(save(s),{type:'purchaseUsedEquipment',sector:'retiro',instanceId:stored.id});assert.deepEqual(s.armoryItems.find(i=>i.id===stored.id),stored);
 s=equip(save(s),owned.weapon,slot,stored.id);assert.deepEqual(handRecord(personal(s),slot==='weapon'?'primary':'blade'),before);assert.deepEqual(s.ammunitionStores,stock);
 s=order(save(s),{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro),u=b.units.find(u=>u.id==='110');
 assert.deepEqual(handRecord(u,slot==='weapon'?'primary':'blade'),before);assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.deepEqual(handRecord(personal(save(s)),slot==='weapon'?'primary':'blade'),before);
});

test('stored item extensions cannot override the replacement canonical fields or allocate storage on rejection',()=>{
 const s=fresh(),metadata={name:'Fusil marcado',id:'physical-mark',provenance:{owner:'Compañía 1'}};
 const row=storeEquipment(s,1800,{condition:72,loaded:1,instanceId:'fitted-gun',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'fitted-bayonet',condition:54}},itemMetadata:metadata});
 assert.deepEqual(storedEquipmentMetadata(row),metadata);save(s);
 const named=storeEquipment(s,1805,{id:'maker-id',name:'Pistola marcada'});assert.deepEqual(named.itemMetadata,{id:'maker-id',name:'Pistola marcada'});
 const taken=takeEquipment(s,1800,row.id);assert.deepEqual(taken,row);assert.deepEqual(taken.itemMetadata,metadata);assert.equal(s.armory[1800],0);
 for(const bad of [null,[],{weight:null},{weapon:1805},{instanceId:'duplicate'},{loaded:1},{count:2},{weight:Infinity},{weight:-1}]){
  const before=structuredClone(s);assert.throws(()=>storeEquipment(s,1805,{itemMetadata:bad}));assert.deepEqual(s,before);
 }
});

test('armory admission validates extensions and preserves older flat custom records',()=>{
 let s=fresh();s=order(s,{type:'purchaseEquipment',item:1805,quantity:1});const original=s.armoryItems[0];
 assert.equal(original.itemMetadata,undefined,'ordinary catalog records keep the legacy representation');
 Object.assign(original,{name:'Pistola heredada',weight:1.8,engraving:{initials:'AM'}});s=save(s);
 s=equip(s,1805,'weapon',original.id);assert.deepEqual(s.operativeState[110].weaponMetadata,{name:'Pistola heredada',weight:1.8,engraving:{initials:'AM'}});
 s=order(s,{type:'purchaseEquipment',item:1806,quantity:1});s=equip(s,1806,'weapon');const stored=s.armoryItems.find(i=>i.itemMetadata?.name==='Pistola heredada');assert.ok(stored);save(s);
 for(const bad of [null,[],{weight:null},{condition:0},{count:2},{weight:-1},{weight:'heavy'}]){const invalid=structuredClone(s);invalid.armoryItems.find(i=>i.id===stored.id).itemMetadata=bad;assert.throws(()=>decodeSave(encodeSave(invalid)));}
});
