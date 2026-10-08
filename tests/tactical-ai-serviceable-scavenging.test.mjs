import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,getReachable,canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseScavengingAction} from '../game/tactical-ai-scavenging.js';
import {handRecord} from '../game/tactical-inventory.js';
import {ammunitionByType,AMMUNITION_TYPES} from '../game/ammunition-types.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';

const by=(s,id)=>s.units.find(u=>u.id===id);
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const other={weapon:1806,count:1,weight:1.3,loaded:0,condition:100,jammed:false,instanceId:'healthy-secondary'};
function field(patch={}){
 const s=createBattle([{id:'p',x:12,y:3,facing:6,loaded:0,ammo:0,hp:250,maxHp:250,experienceLevel:1}],{width:20,height:8,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:6,y:3,facing:2,weapon:1800,weaponInstanceId:'old-musket',loaded:0,ammo:0,priming:20,medical:0,medkits:0,patrol:false,marksmanship:100,inventory:{},...patch}]});by(s,'p').ap=0;by(s,'e').ap=patch.ap??20;return s;
}
function source(s,kind,patch={}){
 const record={weapon:1806,loaded:1,condition:83,jammed:false,instanceId:'recovered-pistol',...patch};if(record.condition===undefined)delete record.condition;
 if(kind==='ground')s.groundItems=[{id:'pistol',type:'item',item:'weapon',x:7,y:3,count:1,weight:1.3,...record}];
 else if(kind==='drop')s.droppedWeapons=[{x:7,y:3,weight:1.3,taken:false,...record}];
 else {s.units.push({...structuredClone(by(s,'p')),id:'body',x:7,y:3,hp:0,ap:0,maxAP:0,overwatch:false,mounted:false,braced:false,bleeding:0,ammo:0,inventory:{},weaponInstanceId:record.instanceId,weapon:record.weapon,loaded:record.loaded,condition:record.condition,jammed:record.jammed});}
}
const ammo=(type='musket_75')=>({id:'round',type:'item',item:`inventory:ammo:${type}`,kind:'ammunition',ammoType:type,name:AMMUNITION_TYPES[type].name,x:7,y:3,count:1,weight:.04});
const choice=s=>chooseScavengingAction(s,by(s,'e'),[],()=>getReachable(s,by(s,'e')));
function paid(s){const before=structuredClone(s),n=endTurn(s);assert.equal(n.lastError,null);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.equal(n.elapsedSeconds,6);assert.doesNotThrow(()=>restored(n));return n;}
function untouchedSource(s,n,kind){const contents=items=>items.map(({knownToPlayer,...record})=>record);if(kind==='ground')assert.deepEqual(contents(n.groundItems),contents(s.groundItems));else if(kind==='drop')assert.deepEqual(contents(n.droppedWeapons),contents(s.droppedWeapons));else assert.deepEqual(handRecord(by(n,'body'),'primary'),handRecord(by(s,'body'),'primary'));}

test('broken ground, dropped and body guns never consume pickup AP or enter the inventory',()=>{
 for(const kind of ['ground','drop','body']){const s=field();source(s,kind,{condition:0});const old=handRecord(by(s,'e'),'primary');assert.equal(choice(s),null,kind);const n=paid(s);assert.equal(by(n,'e').ap,20);assert.deepEqual(handRecord(by(n,'e'),'primary'),old);assert.ok(!Object.values(by(n,'e').inventory).some(r=>r.instanceId==='recovered-pistol'));untouchedSource(s,n,kind);assert.equal(by(n,'p').hp,250);}
});

test('a broken loaded gun or its unusable jam/reserve cannot block a healthy paid recovery',()=>{
 for(const [kind,patch] of [['ground',{loaded:1}],['drop',{loaded:1,jammed:true,ammo:1}],['body',{loaded:0,reloadProgress:.375,ammo:1}]]){const s=field({condition:0,...patch});source(s,kind);const old=handRecord(by(s,'e'),'primary'),reserve=ammunitionByType(by(s,'e'));
 assert.equal(choice(s).type,'loot');const n=paid(s),u=by(n,'e');assert.equal(u.weaponInstanceId,'recovered-pistol');assert.equal(u.loaded,0);assert.equal(u.condition,82);assert.equal(u.ap,0);assert.ok(by(n,'p').hp<250);assert.deepEqual(Object.values(u.inventory).find(r=>r.instanceId==='old-musket'),old);assert.deepEqual(ammunitionByType(u),reserve);
 }
});

test('actual source condition includes the legacy healthy default independently of the broken seeker',()=>{
 for(const kind of ['ground','drop','body'])for(const condition of [undefined,1,100]){const s=field({condition:0,loaded:1});source(s,kind,{condition});assert.equal(choice(s)?.type,'loot',`${kind}/${condition}`);
  if(kind==='drop'&&condition===undefined){assert.throws(()=>restored(s),'current dropped snapshots require explicit condition');continue;}
  const n=paid(kind==='body'&&condition===undefined?restored(s):s);assert.equal(by(n,'e').weaponInstanceId,'recovered-pistol');assert.equal(by(n,'e').ap,0);assert.ok(Object.values(by(n,'e').inventory).some(r=>r.instanceId==='old-musket'&&r.condition===0&&r.loaded===1));}
});

test('broken-only cartridge sources stay finite while the existing useful same-family secondary load remains paid',()=>{
 for(const kind of ['ground','body']){
 const broken=field({weapon:1805,condition:0,loaded:0,ap:46});if(kind==='ground')broken.groundItems=[ammo('pistol_69')];else{source(broken,'body',{loaded:0,condition:0});setTestAmmunition(by(broken,'body'),1,'pistol_69');}
 assert.equal(choice(broken),null);const noNeed=paid(broken);assert.deepEqual(ammunitionByType(by(noNeed,'e')),{});if(kind==='ground')assert.equal(noNeed.groundItems[0].count,1);else assert.equal(by(noNeed,'body').ammo,1);
 const useful=field({weapon:1805,condition:0,loaded:0,offHand:other,ap:46});if(kind==='ground')useful.groundItems=[ammo('pistol_69')];else{source(useful,'body',{loaded:0,condition:0});setTestAmmunition(by(useful,'body'),1,'pistol_69');}
 const old=handRecord(by(useful,'e'),'primary');assert.equal(choice(useful).type,'loot');const n=paid(useful),u=by(n,'e');assert.equal(u.weaponInstanceId,'healthy-secondary');assert.equal(u.condition,99);assert.equal(u.loaded,0);assert.equal(u.ap,0);assert.deepEqual(handRecord(u,'offhand'),old);assert.deepEqual(ammunitionByType(u),{});assert.ok(by(n,'p').hp<250);
 }
 for(const patch of [{condition:0},{jammed:true},{loaded:1},{count:2}]){const s=field({weapon:1805,condition:0,offHand:{...other,...patch}});s.groundItems=[ammo('pistol_69')];assert.equal(choice(s),null,JSON.stringify(patch));}
 const pack=field({weapon:1805,condition:0,inventory:{spare:{...other,loaded:0}}});pack.groundItems=[ammo('pistol_69')];assert.equal(choice(pack),null,'a packed empty gun creates no new demand');
 const crossFamily=field({weapon:1805,condition:0,offHand:{...other,weapon:1808,...weaponMetadata({...defaultContentPackage().weapons.find(w=>w.template===1808),id:'rifle-secondary',ammunitionFamily:'ammoRifle'})}});crossFamily.groundItems=[ammo('rifle_62')];assert.equal(choice(crossFamily),null,'this correction does not widen secondary-family search');
});

test('paid recovery preserves actual fittings, authored identity and unfinished source work',()=>{
 const fitted=field({condition:0,loaded:1,ap:14});fitted.tiles.filter(t=>t.x===10).forEach(t=>{t.blocked=true;t.blocksSight=true;t.type='wall';});const old=handRecord(by(fitted,'e'),'primary');
 const fittings={bayonet:{weapon:1811,condition:47,instanceId:'socket',fittingPattern:'india_socket'}};source(fitted,'drop',{weapon:1800,condition:63,instanceId:'fitted-musket',fittings});fitted.droppedWeapons[0].weight=4;
 const n=paid(fitted),u=by(n,'e');assert.equal(u.weaponInstanceId,'fitted-musket');assert.equal(u.loaded,1);assert.equal(u.condition,63);assert.deepEqual(u.weaponFittings,fittings);assert.deepEqual(Object.values(u.inventory).find(r=>r.instanceId==='old-musket'),old);assert.equal(u.ap,0);
 const definition={...defaultContentPackage().weapons.find(w=>w.template===1808),id:'partial-found-pistol',name:'Pistola recuperada',capacity:2};const partial=field({condition:0,loaded:1,ap:22});source(partial,'ground',{weapon:1808,loaded:1,reloadProgress:.375,ammunitionChoice:'ammoPistol',...weaponMetadata(definition)});
 const after=paid(partial),record=handRecord(by(after,'e'),'primary');assert.equal(record.instanceId,'recovered-pistol');assert.equal(record.loaded,0);assert.equal(record.condition,82);assert.equal(record.reloadProgress,.375);assert.equal(record.ammunitionChoice,'ammoPistol');assert.deepEqual(record.contentWeapon,partial.groundItems[0].contentWeapon);assert.equal(by(after,'e').ap,0);
});

test('hidden source conditions, body contents and opposing private equipment never create a recovery',()=>{
 for(const kind of ['ground','drop','body']){const s=field({condition:0,loaded:1});source(s,kind);const item=kind==='ground'?s.groundItems[0]:kind==='drop'?s.droppedWeapons[0]:by(s,'body');item.x=9;s.tiles.filter(t=>t.x===8).forEach(t=>{t.type='wall';t.blocked=true;t.blocksSight=true;});assert.equal(canSee(s,by(s,'e'),item),false);assert.equal(choice(s),null);const before=structuredClone(s),baseline=chooseEnemyAction(s,by(s,'e'));item.condition=0;item.loaded=0;Object.assign(by(s,'p'),{condition:0,loaded:4});assert.deepEqual(chooseEnemyAction(s,by(s,'e')),baseline);assert.equal(choice(before),null);}
});

test('existing paid capacity, reach and search restrictions still reject impossible healthy pickups',()=>{
 for(const patch of [{condition:0,loaded:1,ap:13},{condition:0,loaded:1,rations:20}]){const s=field(patch);source(s,'ground');const before=structuredClone(s);assert.equal(choice(s),null);assert.deepEqual(s,before);}
 const ready=field({condition:0,loaded:1,inventory:{spare:{...other,loaded:1}}});source(ready,'ground');assert.equal(choice(ready),null,'existing owned healthy spare retains priority');
 const reaction=field({condition:0,loaded:1,ap:40});source(reaction,'ground');reaction.groundItems[0].x=9;reaction.phase='interrupt';assert.equal(choice(reaction),null,'reaction cannot begin a search trip');
});
