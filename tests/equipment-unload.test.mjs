import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentUnloadPreview} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {planEquipmentUnload} from '../game/equipment-cursor.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(extra={},exploration=true)=>createBattle([{id:'p',x:1,y:1,weapon:1808,loaded:2,blade:0,ammo:0,priming:0,flints:0,medkits:0,rations:0,boleadoras:0,torches:0,...extra}],{width:10,height:10,exploration,enemies:exploration?[]:[{id:'e',x:8,y:8,weapon:0,patrol:false}]});
const action=(s,hostId='hand:right')=>({type:'unloadEquipment',unitId:'p',hostId,expectedHost:equipmentFingerprint(s.units[0],hostId)});
test('unload button order returns all loaded rounds to a small pocket and survives save admission',()=>{
 const s=field(),before=structuredClone(s),n=actBattle(s,action(s)),u=n.units[0];
 assert.equal(n.lastError,null);assert.equal(u.loaded,0);assert.equal(u.ammo,2);assert.equal(u.ap,s.units[0].ap);
 assert.equal(inventoryUsage(u).slots.find(p=>p.entry?.ammoType==='pistol_69').size,'small');
 assert.deepEqual(s,before);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
 assert.ok(n.elapsedSeconds>s.elapsedSeconds);
});
test('unload merges compatible rounds before using another pocket',()=>{
 const s=field({ammo:18}),n=actBattle(s,action(s)),slots=inventoryUsage(n.units[0]).slots.filter(p=>p.entry?.ammoType==='pistol_69');
 assert.equal(n.lastError,null);assert.equal(slots.length,1);assert.equal(slots[0].entry.count,20);
});
test('full small pockets fall back to large pockets; full inventory rejects without mutation',()=>{
 const inventory=Object.fromEntries(Array.from({length:12},(_,i)=>[`item${i}`,{name:`Item ${i}`,count:1,weight:.1,instanceId:`unique${i}`} ]));
 const s=field({inventory}),before=structuredClone(s.units[0]);
 assert.throws(()=>planEquipmentUnload(s.units[0],action(s)),/espacio/);assert.deepEqual(s.units[0],before);
 delete inventory.item11;
 const room=field({inventory}),n=actBattle(room,action(room));assert.equal(n.lastError,null);
 assert.equal(inventoryUsage(n.units[0]).slots.find(p=>p.entry?.ammoType==='pistol_69').size,'large');
});
test('selected pocket gun unloads without changing the held gun or attachment metadata',()=>{
 const s=field({inventory:{gun:{weapon:1800,count:1,loaded:1,weight:4,condition:71,instanceId:'kept',fittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:63,instanceId:'bayonet-kept'}}}}});
 const slot=inventoryUsage(s.units[0]).slots.find(p=>p.entry?.weapon===1800).id,n=actBattle(s,action(s,slot));
 assert.equal(n.lastError,null);assert.equal(n.units[0].loaded,2);assert.equal(n.units[0].inventory.gun.loaded,0);
 assert.equal(n.units[0].inventory.gun.instanceId,'kept');assert.equal(n.units[0].inventory.gun.fittings.bayonet.condition,63);
});
test('stale and AP-short orders reject; combat unloading costs twelve AP',()=>{
 const s=field({},false),a=action(s);s.units[0].ap=11;
 assert.equal(equipmentUnloadPreview(s,s.units[0],a).valid,false);assert.ok(actBattle(s,a).lastError);
 s.units[0].ap=40;assert.ok(actBattle(s,{...a,expectedHost:'stale'}).lastError);
 const n=actBattle(s,a);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,28);
});
