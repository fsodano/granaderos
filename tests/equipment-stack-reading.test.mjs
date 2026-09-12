import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {readItemStack,readItemStacks,extractItemQuantity,inventoryUsage,equipmentFingerprint,validateHands} from '../game/tactical-inventory.js';
import {planEquipmentPickup,planEquipmentCursorPlacement} from '../game/equipment-cursor.js';
import {makeOutfit} from '../game/outfits.js';
const unit=extra=>createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,blade:0,ammo:3,medkits:3,priming:0,flints:0,rations:0,boleadoras:0,torches:0,...extra}],{width:8,height:8,exploration:true,enemies:[]}).units[0];

test('read-only stack payloads match removal payloads for every physical owner and retain nested metadata independently',()=>{
 const u=unit({offHand:{weapon:1808,count:1,weight:2.1,loaded:1,condition:61,instanceId:'pistol',name:'Pistola',mark:{owner:'a'}},outfit:{...makeOutfit('poncho',47),instanceId:'coat'},inventory:{note:{name:'Carta',count:3,weight:.1,condition:27,mark:{owner:'b'}},number:3,fitted:{weapon:1800,count:1,weight:4,loaded:0,reloadProgress:.5,condition:51,instanceId:'rifle',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:47,instanceId:'bayonet'}}}}});
 const requests=[{item:'primary'},{item:'offhand'},{item:'outfit'},{item:'ammo',count:2},{item:'medkits',count:3},{item:'inventory:note',count:2},{item:'number',count:2},{item:'inventory:fitted'}];
 const before=structuredClone(u),expected=requests.map(({item,count=1})=>extractItemQuantity(u,item,count,{keepOtherHand:false}).stack);
 assert.deepEqual(readItemStacks(u,requests),expected);
 requests.forEach(({item,count=1},i)=>assert.deepEqual(readItemStack(u,item,count),expected[i]));
 const values=readItemStacks(u,requests);values[1].mark.owner='changed';values[2].condition=0;values[5].mark.owner='changed';values[7].fittings.bayonet.condition=0;assert.deepEqual(u,before);
 const picked=planEquipmentPickup(u,{sourceId:'hand:right',expectedSource:equipmentFingerprint(u,'hand:right')}).unit;assert.deepEqual(readItemStack(picked,'cursor'),extractItemQuantity(picked,'cursor',1).stack);
});

test('stack reads do not inspect unrelated soldier state or clone the soldier, and reject unavailable quantities',()=>{
 const u=unit({inventory:{note:{name:'Carta',count:2,weight:.1}}});Object.defineProperty(u,'movementHistory',{enumerable:true,get(){throw Error('Read traversed unrelated soldier state');}});
 assert.deepEqual(readItemStack(u,'inventory:note',2),{item:'inventory:note',name:'Carta',count:2,weight:.1});
 assert.doesNotThrow(()=>readItemStacks(u,[{item:'inventory:note'},{item:'primary'},{item:'medkits'}]));assert.doesNotThrow(()=>equipmentFingerprint(u,'hand:right'));
 for(const count of [0,-1,1.5,3,NaN,'1',null])assert.throws(()=>readItemStack(u,'inventory:note',count));
 assert.throws(()=>readItemStack(u,'missing'));assert.throws(()=>readItemStacks(u,[{item:'inventory:note',count:1},{item:'ammo',count:4}]));
});

test('one usage pass admits pack keys once while retaining partial pockets, shared hands and overflow counts',()=>{
 const u=unit({weapon:0,loaded:0,activeSlot:'medical',medkits:9,leftHandItem:'medkits',ammo:0,inventory:{large:{count:5,weight:4,name:'Caja'}},pocketOrder:[{slotId:'small-1',item:'medkits',index:0,count:4},{slotId:'small-3',item:'medkits',index:1,count:3}]});
 let reads=0;u.inventory=new Proxy(u.inventory,{ownKeys(target){reads++;return Reflect.ownKeys(target);}});
 const usage=inventoryUsage(u);assert.ok(reads<=2,`pack was enumerated ${reads} times`);assert.equal(usage.slots.find(s=>s.id==='small-1').entry.count,4);assert.equal(usage.slots.find(s=>s.id==='small-3').entry.count,3);assert.equal(usage.items.find(i=>i.item==='medkits').count,7);assert.equal(usage.items.find(i=>i.item==='medkits').stacks,2);
 assert.equal(usage.overflow.find(i=>i.item==='inventory:large').count,1);assert.equal(usage.items.find(i=>i.item==='inventory:large').stacks,5);assert.equal(usage.used,7);assert.equal(usage.overloaded,true);
});

test('batch key admission and every inventory record remain validated, including depleted and late overflow records',()=>{
 const u=unit({inventory:Object.fromEntries(Array.from({length:1000},(_,i)=>[`crate${i}`,{count:1,weight:3}]))});
 for(const bad of [{count:1,weight:-1},{count:0,weight:NaN},{count:1,weight:1,weapon:1805,loaded:2},{count:2,weight:1,instanceId:'same'}]){
  const original=u.inventory.crate999;u.inventory.crate999=bad;assert.throws(()=>inventoryUsage(u));u.inventory.crate999=original;
 }
 u.inventory['bad\nkey']={count:1,weight:1};assert.throws(()=>inventoryUsage(u));assert.throws(()=>readItemStacks(u,[{item:'primary'}]));
});

test('large overflow cursor previews copy the soldier once while preserving every finite source record',()=>{
 const u=unit({inventory:Object.fromEntries(Array.from({length:1000},(_,i)=>[`crate${i}`,{name:`Caja ${i}`,count:1,weight:3,instanceId:`crate-${i}`,mark:{index:i}}]))});
 const source=inventoryUsage(u).slots.find(s=>s.entry?.item==='medkits').id,action={sourceId:source,count:1,expectedSource:equipmentFingerprint(u,source)},clone=globalThis.structuredClone;let soldierCopies=0;
 let next;try{globalThis.structuredClone=(value,...args)=>{if(value===u)soldierCopies++;return clone(value,...args);};next=planEquipmentPickup(u,action).unit;}finally{globalThis.structuredClone=clone;}
 assert.equal(soldierCopies,1);assert.equal(next.equipmentCursor.stack.count,1);assert.deepEqual(next.inventory,u.inventory);validateHands(next);
 const placed=planEquipmentCursorPlacement(next,{destinationId:'hand:left',expectedSource:equipmentFingerprint(next,'cursor'),expectedDestination:equipmentFingerprint(next,'hand:left')}).unit;assert.equal(placed.equipmentCursor,undefined);assert.deepEqual(placed.inventory,u.inventory);assert.equal(placed.medkits,u.medkits);assert.equal(u.medkits,3);
});
