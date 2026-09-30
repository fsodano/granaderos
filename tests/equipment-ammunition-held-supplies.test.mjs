import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentCursorPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,equipmentEndpoint,readItemStack} from '../game/tactical-inventory.js';
import {weaponAmmoType,totalReserveAmmunition} from '../game/ammunition-types.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field({priming=1,bothHands=false,weapon=1805,combat=false}={}){
 return createBattle([{id:'p',x:1,y:1,weapon:0,weaponDropped:true,loaded:0,blade:0,ammo:0,ammunitionVersion:2,
  activeSlot:'item',activeItem:'priming',...(bothHands?{leftHandItem:'priming'}:{}),priming,
  medkits:0,flints:0,rations:0,boleadoras:0,torches:0,inventory:{
   cartridges:{kind:'ammunition',ammoType:weaponAmmoType(weapon),count:5,weight:.04,name:'Carga elegida'},
   stored:{weapon,count:1,loaded:0,condition:73,instanceId:'stored-gun',weight:1.2},
  }}],{width:32,height:8,exploration:!combat,seed:45,
  enemies:combat?[{id:'e',x:30,y:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}]:[],
  tiles:Array.from({length:256},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),
 });
}
const person=b=>b.units[0];
const pocket=(b,item)=>inventoryUsage(person(b)).slots.find(slot=>slot.entry?.item===item).id;
const storedGun=b=>readItemStack(person(b),equipmentEndpoint(person(b),pocket(b,'inventory:stored')).item,1);
const cartridges=b=>totalReserveAmmunition(person(b))+(person(b).equipmentCursor?.stack.count??0)+storedGun(b).loaded;
const saved=b=>{const copy=JSON.parse(JSON.stringify(b));assert.deepEqual(validateBattleSnapshot(copy),b);return copy;};
function loading(b,count=5){
 const u=person(b),sourceId=pocket(b,'inventory:cartridges'),destinationId=pocket(b,'inventory:stored');
 return {type:'dragEquipment',unitId:u.id,sourceId,destinationId,count,
  expectedSource:equipmentFingerprint(u,sourceId),expectedDestination:equipmentFingerprint(u,destinationId)};
}
function load(b,count){
 const before=structuredClone(b),a=loading(b,count),preview=equipmentCursorPreview(b,person(b),a);
 assert.equal(preview.valid,true,preview.reason);
 const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(b,before);
 assert.equal(cartridges(next),cartridges(b));assert.equal(storedGun(next).instanceId,'stored-gun');assert.equal(storedGun(next).condition,73);
 saved(next);assert.deepEqual(actBattle(saved(b),a),next);
 return {next,preview};
}

test('loading a stored pistol works after obsolete held powder is removed',()=>{
 const b=field(),{next,preview}=load(b);
 assert.equal(preview.rounds,1);assert.equal(person(next).priming,undefined);assert.equal(person(next).activeSlot,'unarmed');
 assert.equal(person(next).activeItem,undefined);assert.equal(person(next).leftHandItem,null);
 assert.equal(storedGun(next).loaded,1);assert.equal(person(next).equipmentCursor.stack.count,4);
 assert.equal(person(next).ap,person(b).ap);assert.equal(next.elapsedSeconds-b.elapsedSeconds,preview.seconds);
});

test('loading two barrels works after both obsolete hand references are removed',()=>{
 const b=field({priming:2,bothHands:true,weapon:1808}),{next,preview}=load(b);
 assert.equal(preview.rounds,2);assert.equal(person(next).priming,undefined);assert.equal(person(next).activeSlot,'unarmed');
 assert.equal(person(next).activeItem,undefined);assert.equal(person(next).leftHandItem,null);
 assert.equal(storedGun(next).loaded,2);assert.equal(person(next).equipmentCursor.stack.count,3);
});

test('partial loading preserves the entire cursor stack after implicit-kit migration',()=>{
 const b=field({priming:2,bothHands:true,weapon:1808,combat:true});person(b).ap=10;
 const {next,preview}=load(b);
 assert.equal(preview.rounds,0);assert.equal(preview.partial,true);assert.equal(person(next).ap,0);
 assert.equal(person(next).priming,undefined);assert.equal(person(next).activeSlot,'unarmed');assert.equal(person(next).activeItem,undefined);assert.equal(person(next).leftHandItem,null);
 assert.equal(storedGun(next).loaded,0);assert.ok(storedGun(next).reloadProgress>0);assert.equal(person(next).equipmentCursor.stack.count,5);
 assert.equal(next.elapsedSeconds-b.elapsedSeconds,6);
});

test('legacy powder quantities do not affect one-round loading',()=>{
 const b=field({priming:3,bothHands:true}),{next,preview}=load(b);
 assert.equal(preview.rounds,1);assert.equal(person(next).priming,undefined);assert.equal(person(next).activeSlot,'unarmed');
 assert.equal(person(next).activeItem,undefined);assert.equal(person(next).leftHandItem,null);
 assert.equal(inventoryUsage(person(next)).slots.some(slot=>slot.entry?.item==='priming'),false);
});
