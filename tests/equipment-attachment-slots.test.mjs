import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentAttachmentPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,readItemStack} from '../game/tactical-inventory.js';
import {equipmentAttachmentHost} from '../game/equipment-cursor.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const empty={ammo:0,priming:0,flints:0,medkits:0,rations:0,boleadoras:0,torches:0};
const blade=(id='socket',condition=71)=>({weapon:1811,count:1,weight:.5,loaded:0,jammed:false,condition,instanceId:id,fittingPattern:'india_socket',name:'Bayoneta de familia'});
const fitting=(id='socket-old',condition=62)=>({weapon:1811,fittingPattern:'india_socket',instanceId:id,condition});
const field=(extra={},exploration=false)=>createBattle([{...empty,id:'p',x:1,y:1,weapon:1800,loaded:1,condition:83,weaponInstanceId:'rifle-host',inventory:{socket:blade()},...extra}],{width:10,height:10,exploration,enemies:exploration?[]:[{...empty,id:'e',x:8,y:8,loaded:0,weapon:0,activeSlot:'unarmed',overwatch:false,patrol:false}]});
const actor=s=>s.units[0];
const slot=(s,item)=>inventoryUsage(actor(s)).slots.find(slot=>slot.entry?.item===item).id;
const attachment=(s,hostId='hand:right',operation=actor(s).equipmentCursor?'attach':'detach')=>({type:'attachment',unitId:'p',hostId,operation,expectedHost:equipmentFingerprint(actor(s),hostId),expectedCursor:equipmentFingerprint(actor(s),'cursor')});
function order(s,a){const before=structuredClone(s),n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;}
function reject(s,a){const before=structuredClone(s),n=actBattle(s,{unitId:'p',...a});assert.ok(n.lastError);const omit=({lastError,log,...rest})=>rest;assert.deepEqual(omit(n),omit(s));assert.deepEqual(s,before);return n;}
const pickup=(s,sourceId)=>order(s,{type:'pickupEquipment',sourceId,expectedSource:equipmentFingerprint(actor(s),sourceId)});
const place=(s,destinationId)=>order(s,{type:'placeEquipment',destinationId,expectedSource:equipmentFingerprint(actor(s),'cursor'),expectedDestination:equipmentFingerprint(actor(s),destinationId)});
const saved=s=>{const n=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));assert.deepEqual(n,s);return n;};

test('a cursor bayonet attaches to the inspected held rifle and detaches to durable cursor custody',()=>{
 let s=field();s=pickup(s,slot(s,'inventory:socket'));const original=structuredClone(actor(s).equipmentCursor.stack),start=structuredClone(s);
 const a=attachment(s),preview=equipmentAttachmentPreview(s,actor(s),a);assert.equal(preview.valid,true);assert.equal(preview.pa,12);
 s=order(saved(s),a);assert.equal(actor(s).ap,actor(start).ap-12);assert.equal(actor(s).equipmentCursor,undefined);assert.equal(actor(s).weaponFittings.bayonet.instanceId,original.instanceId);assert.equal(actor(s).weaponFittings.bayonet.condition,original.condition);assert.equal(actor(s).loaded,1);assert.equal(actor(s).ammo,0);assert.equal(actor(s).condition,83);assert.equal(s.elapsedSeconds,6);
 const detach=attachment(s);assert.equal(equipmentAttachmentPreview(s,actor(s),detach).pa,8);s=order(saved(s),detach);
 assert.equal(actor(s).ap,actor(start).ap-20);assert.deepEqual(actor(s).weaponFittings,{});assert.equal(actor(s).equipmentCursor.sourceId,'attachment:hand:right');assert.equal(actor(s).equipmentCursor.stack.name,original.name);assert.equal(actor(s).equipmentCursor.stack.instanceId,original.instanceId);assert.equal(actor(s).equipmentCursor.stack.condition,original.condition);assert.equal(s.elapsedSeconds,6);
 s=place(saved(s),'small-8');assert.equal(actor(s).equipmentCursor,undefined);assert.equal(readItemStack(actor(s),inventoryUsage(actor(s)).slots.find(slot=>slot.id==='small-8').entry.item,1).instanceId,original.instanceId);
});

test('stored guns can receive fittings without being equipped or changing other weapon loads',()=>{
 let s=field({weapon:1808,loaded:2,inventory:{socket:blade(),stored:{weapon:1800,count:1,weight:4,loaded:0,reloadProgress:.5,condition:53,jammed:true,instanceId:'stored-rifle'}}});
 const hostId=slot(s,'inventory:stored');s=pickup(s,slot(s,'inventory:socket'));const before=structuredClone(actor(s));
 s=order(s,attachment(s,hostId));const host=equipmentAttachmentHost(actor(s),hostId).stack;
 assert.equal(actor(s).weapon,1808);assert.equal(actor(s).loaded,2);assert.equal(actor(s).condition,before.condition);assert.equal(host.instanceId,'stored-rifle');assert.equal(host.loaded,0);assert.equal(host.reloadProgress,.5);assert.equal(host.jammed,true);assert.equal(host.condition,53);assert.equal(host.fittings.bayonet.instanceId,'socket');
 s=order(saved(s),attachment(s,hostId));assert.equal(actor(s).equipmentCursor.stack.instanceId,'socket');assert.equal(equipmentAttachmentHost(actor(s),hostId).stack.reloadProgress,.5);
});

test('a full pack can remove an attachment; explicit return uses the ground and does not refit or displace the gun',()=>{
 const inventory=Object.fromEntries(Array.from({length:12},(_,i)=>[`pack-${i}`,{name:`Equipo ${i}`,count:1,weight:i<4?3:.2,instanceId:`pack-${i}`}]))
 let s=field({inventory,weaponFittings:{bayonet:fitting()}});assert.equal(inventoryUsage(actor(s)).slots.filter(slot=>slot.entry).length,12);
 s=order(s,attachment(s));assert.equal(actor(s).equipmentCursor.stack.instanceId,'socket-old');assert.equal(inventoryUsage(actor(s)).slots.filter(slot=>slot.entry).length,12);const before=structuredClone(s);
 s=order(saved(s),{type:'returnEquipmentCursor',expectedSource:equipmentFingerprint(actor(s),'cursor')});
 assert.equal(actor(s).equipmentCursor,undefined);assert.equal(actor(s).weaponInstanceId,'rifle-host');assert.equal(actor(s).weapon,1800);assert.deepEqual(actor(s).weaponFittings,{});assert.equal(s.groundItems.length,before.groundItems.length+1);assert.equal(s.groundItems.at(-1).instanceId,'socket-old');assert.equal(actor(s).ap,actor(before).ap);
});

test('an occupied fitting slot exchanges exact bayonets on the cursor and previews both costs',()=>{
 let s=field({weaponFittings:{bayonet:fitting()}});s=pickup(s,slot(s,'inventory:socket'));const a=attachment(s),preview=equipmentAttachmentPreview(s,actor(s),a);assert.equal(preview.valid,true);assert.equal(preview.swapped,true);assert.equal(preview.pa,20);
 const short=structuredClone(s);actor(short).ap=19;reject(short,{...a});assert.equal(equipmentAttachmentPreview(short,actor(short),a).valid,false);
 actor(s).ap=20;s=order(s,a);assert.equal(actor(s).ap,0);assert.equal(actor(s).equipmentCursor.stack.instanceId,'socket-old');assert.equal(actor(s).equipmentCursor.stack.condition,62);assert.equal(actor(s).weaponFittings.bayonet.instanceId,'socket');assert.equal(actor(s).weaponFittings.bayonet.condition,71);saved(s);
});

test('stale or incompatible attachment actions preserve all equipment, AP, clocks and random state',()=>{
 const base=field(),picked=pickup(base,slot(base,'inventory:socket')),a=attachment(picked);
 for(const patch of [{expectedHost:'stale'},{expectedCursor:'stale'},{expectedCursor:undefined},{hostId:'small-8'},{operation:'other'},{hostId:'cursor'}])reject(picked,{...a,...patch});
 const changed=structuredClone(picked);actor(changed).condition--;reject(changed,a);
 for(const extra of [{weapon:1801},{weapon:1805},{activeSlot:'unarmed',weaponDropped:true},{knockedDown:true},{unconscious:true,energy:0},{departure:{destination:'elsewhere'}}]){
  const s=structuredClone(picked);Object.assign(actor(s),extra);reject(s,{...a,expectedHost:equipmentFingerprint(actor(s),'hand:right')});
 }
 const short=structuredClone(picked);actor(short).ap=11;reject(short,a);
 const broken=structuredClone(picked);actor(broken).equipmentCursor.stack.condition=0;reject(broken,attachment(broken));
 reject(picked,attachment(picked,'hand:right','detach'));reject(base,attachment(base,'hand:right','attach'));reject(base,attachment(base,'hand:right','detach'));
 const interrupt=structuredClone(picked);interrupt.phase='interrupt';interrupt.interrupt={unitIds:[]};reject(interrupt,a);
});

test('exploration fitting uses ordinary action time without spending or refilling AP',()=>{
 let s=field({},true);actor(s).ap=7;s=pickup(s,slot(s,'inventory:socket'));const a=attachment(s);assert.equal(equipmentAttachmentPreview(s,actor(s),a).pa,0);s=order(s,a);assert.equal(actor(s).ap,7);assert.equal(s.elapsedSeconds,1);
 s=order(s,attachment(s));assert.equal(actor(s).ap,7);assert.equal(s.elapsedSeconds,2);saved(s);
});

test('handling a fitted assembly lowers readiness and clears old attack guards',()=>{
 let s=field();s=pickup(s,slot(s,'inventory:socket'));Object.assign(actor(s),{weaponReady:true,braced:true,overwatch:true,momentum:3,lastTargetId:'e',lastShotPosition:'1,1'});
 s=order(s,attachment(s));for(const key of ['weaponReady','lastTargetId','lastShotPosition'])assert.equal(actor(s)[key],undefined);assert.equal(actor(s).braced,false);assert.equal(actor(s).overwatch,false);assert.equal(actor(s).momentum,0);
});
