import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,getReachable,transferPreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseSupplySharingAction} from '../game/tactical-ai-sharing.js';
import {handRecord} from '../game/tactical-inventory.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';

const by=(s,id)=>s.units.find(u=>u.id===id);
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const secondary={weapon:1806,count:1,weight:1.3,loaded:0,condition:100,jammed:false,instanceId:'receiver-other'};
const packed={weapon:1806,count:1,weight:1.3,loaded:1,condition:84,instanceId:'receiver-packed',name:'Pistola de reserva'};
function field(d={},e={},visible=true){
 const shared={facing:2,weapon:1805,ammo:0,medical:0,medkits:0,rations:0,torches:0,boleadoras:0,patrol:false,marksmanship:100,overwatch:false};
 const tiles=Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:!visible&&i%20===8?'wall':'grass',blocked:!visible&&i%20===8,blocksSight:!visible&&i%20===8,cover:0}));
 const s=createBattle([{...shared,id:'p',x:visible?12:1,y:3,facing:6,loaded:0,hp:250,maxHp:250,experienceLevel:1}],{width:20,height:8,seed:45,tiles,enemies:[
  {...shared,id:'d',x:visible?6:12,y:4,weaponInstanceId:'donor-primary',loaded:1,ammo:1,...d},
  {...shared,id:'e',x:visible?6:13,y:3,weaponInstanceId:'recipient-broken',loaded:0,condition:0,...e},
 ]});by(s,'p').ap=0;by(s,'d').ap=d.ap??4;by(s,'e').ap=e.ap??38;return s;
}
const choice=(s,targets=[])=>chooseSupplySharingAction({...s,phase:'enemy'},by(s,'d'),targets,()=>getReachable(s,by(s,'d')));
function paid(s){const before=structuredClone(s),n=endTurn(s);assert.equal(n.lastError,null);assert.deepEqual(s,before);assert.equal(n.elapsedSeconds,6);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));return n;}

test('a real broken-only recipient retains donor AP and finite cartridges without a useless gift',()=>{
 const s=field({}, {ap:0},false),before=structuredClone(s),d=handRecord(by(s,'d'),'primary'),e=handRecord(by(s,'e'),'primary');
 assert.equal(choice(s),null);assert.equal(chooseEnemyAction({...s,phase:'enemy'},by(s,'d')),null);
 const n=paid(s);assert.equal(by(n,'d').ap,4);assert.deepEqual(ammunitionByType(by(n,'d')),{pistol_69:1});assert.deepEqual(ammunitionByType(by(n,'e')),{});assert.deepEqual(handRecord(by(n,'d'),'primary'),d);assert.deepEqual(handRecord(by(n,'e'),'primary'),e);assert.equal(n.seed,s.seed);assert.deepEqual(s,before);
});

test('a healthy empty held secondary receives one real load and pays reload, swap and shot',()=>{
 const s=field({}, {offHand:secondary}),old=handRecord(by(s,'e'),'primary'),d=handRecord(by(s,'d'),'primary');
 const order=choice(s,[by(s,'p')]);assert.deepEqual(order,{type:'transfer',unitId:'d',targetId:'e',item:'inventory:ammo:pistol_69',count:1});assert.equal(transferPreview({...s,phase:'enemy'},by(s,'d'),by(s,'e'),order.item,1).pa,4);
 const n=paid(s);assert.equal(by(n,'d').ap,0);assert.deepEqual(handRecord(by(n,'d'),'primary'),d);assert.deepEqual(ammunitionByType(by(n,'d')),{});
 assert.equal(by(n,'e').weaponInstanceId,'receiver-other');assert.equal(by(n,'e').condition,99);assert.equal(by(n,'e').loaded,0);assert.equal(by(n,'e').ap,0);assert.deepEqual(handRecord(by(n,'e'),'offhand'),old);assert.deepEqual(ammunitionByType(by(n,'e')),{});assert.ok(by(n,'p').hp<250);
});

test('an authored secondary uses its own selected family and real capacity through paid reload and fire',()=>{
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1808),id:'shared-rifle-pistol',name:'Pistola de prueba',capacity:2,ammunitionFamily:'ammoRifle'};
 const other={...secondary,weapon:1808,...weaponMetadata(definition),ammunitionChoice:'ammoRifle',reloadProgress:.5};
 const s=field({}, {offHand:other,ap:100});setTestAmmunition(by(s,'d'),3,'rifle_62');const wrong=structuredClone(s);setTestAmmunition(by(wrong,'d'),3,'pistol_69');assert.equal(choice(wrong),null);
 assert.deepEqual(choice(s,[by(s,'p')]),{type:'transfer',unitId:'d',targetId:'e',item:'inventory:ammo:rifle_62',count:2});
 const old=handRecord(by(s,'e'),'primary'),n=paid(s),u=by(n,'e');assert.equal(by(n,'d').ap,0);assert.deepEqual(ammunitionByType(by(n,'d')),{rifle_62:1});assert.deepEqual(ammunitionByType(u),{});assert.equal(u.weaponInstanceId,'receiver-other');assert.equal(u.condition,98);assert.equal(u.loaded,0);assert.equal(u.ammunitionChoice,'ammoRifle');assert.deepEqual(u.weaponMetadata.contentWeapon,other.contentWeapon);assert.deepEqual(handRecord(u,'offhand'),old);assert.ok(by(n,'p').hp<250);
});

test('broken, jammed, loaded or unheld alternatives do not request cartridges for a broken main gun',()=>{
 for(const patch of [{condition:0},{jammed:true},{loaded:1},{count:0},{count:2},{weapon:1813},{weapon:99999}]){const s=field({}, {offHand:{...secondary,...patch}}),before=structuredClone(s);assert.equal(choice(s),null,JSON.stringify(patch));assert.deepEqual(s,before);}
 const blade=field({}, {activeSlot:'blade',blade:1813,offHand:secondary});assert.equal(choice(blade),null);
 for(const offHand of [undefined,secondary]){const s=field({}, {weaponDropped:true,offHand});assert.equal(choice(s),null);}
});

test('a loaded packed backup supplies its own shot while an empty packed gun creates no new ammunition demand',()=>{
 for(const loaded of [0,1]){const s=field({}, {inventory:{own:{...packed,loaded}},ap:loaded?14:38}),before=structuredClone(s);assert.equal(choice(s),null);const n=paid(s);assert.equal(by(n,'d').ap,4);assert.deepEqual(ammunitionByType(by(n,'d')),{pistol_69:1});assert.deepEqual(ammunitionByType(by(n,'e')),{});
  if(loaded){assert.equal(by(n,'e').weaponInstanceId,'receiver-packed');assert.equal(by(n,'e').loaded,0);assert.equal(by(n,'e').condition,83);assert.ok(by(n,'p').hp<250);}else{assert.equal(by(n,'e').weaponInstanceId,'recipient-broken');assert.deepEqual(by(n,'e').inventory.own,before.units.find(u=>u.id==='e').inventory.own);assert.equal(by(n,'p').hp,250);}
 }
});

test('healthy-primary donation and useful dressing demand retain their existing paid priority',()=>{
 for(const condition of [50,100]){const s=field({}, {condition,ap:40});assert.equal(choice(s).item,'inventory:ammo:pistol_69');const n=paid(s);assert.equal(by(n,'d').ap,0);assert.deepEqual(ammunitionByType(by(n,'d')),{});assert.equal(by(n,'e').condition,condition-1);assert.equal(by(n,'e').loaded,0);assert.ok(by(n,'p').hp<250);}
 const medical=field({medkits:1}, {medical:60,bleeding:2,hp:50,ap:100},false);assert.equal(choice(medical).item,'medkits');const n=paid(medical);assert.equal(by(n,'d').medkits,0);assert.equal(by(n,'e').medkits,0);assert.equal(by(n,'e').bleeding,0);assert.deepEqual(ammunitionByType(by(n,'d')),{pistol_69:1});
});

test('secondary demand stays observed, finite, deterministic and removed by a current compatible reserve',()=>{
 const s=field({ammo:3}, {offHand:secondary},false),order=choice(s);assert.equal(order.count,1);const before=structuredClone(s);
 Object.assign(by(s,'p'),{x:2,y:6,condition:0,loaded:4,ammo:999});assert.deepEqual(choice(s),order);assert.deepEqual(choice(before),order);s.units.reverse();assert.deepEqual(choice(s),order);
 setTestAmmunition(by(s,'e'),1,'pistol_69');assert.equal(choice(s),null);setTestAmmunition(by(s,'e'),0);by(s,'e').x=7;assert.equal(choice(s),null,'an unseen ally does not create a private request');
});

test('autonomous militia does not waste a cartridge on a broken hired ally',()=>{
 const s=field({}, {ap:0},false);by(s,'d').side='player';by(s,'d').militia=true;by(s,'e').side='player';by(s,'p').side='enemy';const n=paid(s);assert.deepEqual(ammunitionByType(by(n,'d')),{pistol_69:1});assert.deepEqual(ammunitionByType(by(n,'e')),{});assert.equal(by(n,'e').weaponInstanceId,'recipient-broken');assert.equal(by(n,'e').loaded,0);assert.equal(by(n,'e').x,by(s,'e').x);assert.equal(by(n,'e').y,by(s,'e').y);
});
