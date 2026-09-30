import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,weaponFor,actionCosts,artilleryCosts,ARTILLERY} from '../game/tactical.js';
import {compileWeaponDefinition,weaponRecord} from '../game/weapon-definition.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {ammoCount} from '../game/ammo-types.js';
import {civilianSuppliesFor} from '../game/civilian-supplies.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const tiles=(w,h,corridor=false)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w),type:corridor&&Math.floor(i/w)!==1?'wall':'grass',blocked:corridor&&Math.floor(i/w)!==1,cover:0}));
const bare={weapon:0,blade:0,ammo:0,loaded:0,rations:0,medkits:0,torches:0,boleadoras:0,activeSlot:'unarmed'};
const authored=compileWeaponDefinition({id:'gun-test',template:1808,name:'Arma del editor',damage:9,fireAP:20,aimAP:0,readyAP:5,reloadAP:18,range:16,capacity:3,weight:1.7,price:100,art:'/art/test.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:7,range:20,pattern:'single'}]});

test('living soldiers and residents block paths in every condition; corpses do not',()=>{
 for(const npc of [false,true])for(const status of [{hp:70},{hp:1},{hp:70,energy:0},{hp:70,routed:true},{hp:70,surrendered:true}]){
  const occupant={...bare,id:'block',name:'Ocupante',x:2,y:1,...status},b=createBattle([{...bare,id:'p',x:1,y:1},...(npc?[]:[occupant])],{width:6,height:4,tiles:tiles(6,4,true),exploration:true,enemies:[],npcs:npc?[occupant]:[]});
  assert.equal(getReachable(b,'p').some(p=>p.x===3&&p.y===1),false,JSON.stringify({npc,status}));
  const dead=structuredClone(b),body=npc?dead.npcs[0]:dead.units[1];body.hp=0;body.unconscious=false;body.ap=0;
  const path=getReachable(dead,'p').find(p=>p.x===3&&p.y===1);assert.ok(path);assert.ok(path.path.some(p=>p.x===2&&p.y===1));
 }
});

test('authored capacity, free aim, abilities and alternate reserves operate in the physical tactical model',()=>{
 let b=createBattle([{...bare,id:'p',activeSlot:'primary',weapon:1808,weaponMetadata:{contentWeapon:authored},ammunition:{ammoMusket:2,ammoRifle:4},ammo:6,loaded:0,abilities:['rapid_first_aid']}],{width:8,height:8,tiles:tiles(8,8),exploration:true,enemies:[]});
 assert.equal(weaponFor(b.units[0]).name,authored.name);assert.equal(actionCosts(b,b.units[0]).aim,0);assert.equal(actionCosts(b,b.units[0]).heal,18);
 b=actBattle(b,{type:'selectAmmunitionLoad',unitId:'p',family:'ammoRifle'});assert.equal(b.lastError,null);
 b=actBattle(b,{type:'reload',unitId:'p'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,3);assert.equal(ammoCount(b.units[0],'ammoRifle'),1);assert.equal(ammoCount(b.units[0],'ammoMusket'),2);
 assert.equal(weaponFor(b.units[0]).damage,7);assert.equal(weaponFor(b.units[0]).art,authored.art);
 assert.equal(validateBattleSnapshot(b).units[0].loaded,3);
 b=actBattle(b,{type:'unloadAmmunition',unitId:'p'});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,0);assert.equal(ammoCount(b.units[0],'ammoRifle'),4);
 assert.equal(weaponRecord(b.units[0]).ammunitionChoice,'ammoRifle');
});

test('a resident weapon and supplies are collected once with the authored identity intact',()=>{
 const weapon=weaponRecord({weapon:1808,weaponMetadata:{contentWeapon:authored},ammunitionChoice:'ammoRifle',loaded:2,condition:43,jammed:true});
 let b=createBattle([{...bare,id:'p',x:1,y:1}],{width:8,height:8,tiles:tiles(8,8),exploration:true,enemies:[],npcs:[{id:'resident',name:'Residente',hp:0,maxHp:70,x:2,y:1,civilianWeapons:{version:1,primary:weapon,blade:null},civilianSupplies:civilianSuppliesFor({...bare,medkits:2})}]});
 b=actBattle(b,{type:'loot',unitId:'p',targetId:'resident',targetKind:'npc',item:'all'});assert.equal(b.lastError,null);
 assert.equal(b.npcs[0].civilianWeapons.primary,null);assert.equal(b.npcs[0].civilianSupplies.medkits,0);assert.equal(b.units[0].medkits,2);
 const recovered=Object.values(b.units[0].inventory).find(r=>r.weapon===1808);assert.deepEqual(recovered.contentWeapon,authored);assert.equal(recovered.loaded,2);assert.equal(recovered.ammunitionChoice,'ammoRifle');
 const before=structuredClone(b.units);const denied=actBattle(b,{type:'loot',unitId:'p',targetId:'resident',targetKind:'npc',item:'all'});assert.ok(denied.lastError);assert.deepEqual(denied.units,before);
 assert.equal(validateBattleSnapshot(b).npcs[0].civilianWeapons.primary,null);
});

test('authored artillery setup survives battle creation and controls real crew costs',()=>{
 const profiles=structuredClone(ARTILLERY);Object.assign(profiles.bronze4,{crew:1,fireAP:17,moveAP:11,pivotAP:6,initialLoaded:false,initialAmmo:2});
 const b=createBattle([{...bare,id:'p',x:1,y:1,explosives:50,abilities:[]}],{width:8,height:8,tiles:tiles(8,8),exploration:true,enemies:[],artilleryDefinitions:profiles,artillery:[{id:'g',x:2,y:1,type:'bronze4'}]});
 assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].ammo,2);assert.equal(artilleryCosts(b,b.units[0],b.artillery[0]).crew,1);assert.equal(artilleryCosts(b,b.units[0],b.artillery[0]).fire,17);
 assert.deepEqual(validateBattleSnapshot(b).artilleryDefinitions,profiles);
});

test('authored spread loads work in either pistol and keep direct civilian targeting distinct from collateral harm',()=>{
 const spread={...authored,alternativeLoads:[{family:'ammoRifle',damage:20,range:20,pattern:'cone'}]};
 for(const dual of [false,true]){
  const s=createBattle([{...bare,id:'p',x:1,y:3,activeSlot:'primary',weapon:1808,weaponMetadata:{contentWeapon:spread},ammunitionChoice:'ammoRifle',loaded:1,condition:100,marksmanship:100,...(dual?{offHand:{count:1,weapon:1808,loaded:1,condition:100,jammed:false,weight:spread.weight,contentWeapon:spread,ammunitionChoice:'ammoRifle'}}:{})}],{width:12,height:8,seed:127,tiles:tiles(12,8),exploration:true,enemies:[],npcs:[{id:'target',name:'Objetivo',hp:100,maxHp:100,x:7,y:3},{id:'bystander',name:'Testigo',hp:100,maxHp:100,x:7,y:4}]});
  const n=actBattle(s,{type:'fire',unitId:'p',targetId:'target',targetKind:'npc',aim:4});assert.equal(n.lastError,null);
  assert.equal(n.units[0].loaded,0);if(dual)assert.equal(n.units[0].offHand.loaded,0);
  assert.ok(n.npcs.every(n=>n.hp<100));assert.equal(n.npcs[0].civilianHarm.incidents[0].intentional,true);assert.equal(n.npcs[1].civilianHarm.incidents[0].intentional,false);
  assert.doesNotThrow(()=>validateBattleSnapshot(n));
 }
});

test('the inventory view retains authored weapon art and names and one physical ammo stack',async()=>{
 const {inventoryModel,orderDescriptors,isMovementGround}=await import('../game/ja2-hud.js');
 const weapon=weaponRecord({weapon:1808,weaponMetadata:{contentWeapon:authored},loaded:1});
 const s=createBattle([{...bare,id:'p',x:1,y:1,inventory:{named:weapon},ammunition:{ammoRifle:4},ammo:4}],{width:8,height:8,tiles:tiles(8,8),exploration:true,enemies:[]});
 const model=inventoryModel(s,s.units[0]),stored=model.backpack.find(r=>r.key==='named');assert.equal(stored.name,authored.name);assert.equal(stored.art,authored.art);
 assert.equal(model.items.filter(item=>item.ammoType==='rifle_62').length,1);assert.equal(model.supplies.some(s=>s.id.startsWith('ammo')),false);
 assert.doesNotThrow(()=>orderDescriptors(s,null));
 const body={...s.units[0],id:'body',hp:0,x:2,y:1};s.units.push(body);assert.equal(isMovementGround(s,s.units[0],body),true);body.hp=1;assert.equal(isMovementGround(s,s.units[0],body),false);
});

test('authored ground ammunition becomes one physical family and can be collected in finite portions',()=>{
 const types={ammo:'musket_75',ammoMusket:'musket_75',ammoRifle:'rifle_62',ammoPistol:'pistol_69',ammoShot:'shot_16'};
 for(const [type,family] of Object.entries(types)){
  const source={id:'authored-ammo',type,count:5,x:2,y:1},original=structuredClone(source);
  const state=createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:0,ammo:0}],{width:6,height:6,exploration:true,enemies:[],artillery:[],tiles:Array.from({length:36},(_,i)=>({x:i%6,y:Math.floor(i/6),type:'grass',blocked:false,cover:0})),groundItems:[source]});
  assert.deepEqual(source,original);assert.equal(state.groundItems[0].type,'item');assert.equal(state.groundItems[0].ammoType,family);
  let next=actBattle(state,{type:'loot',unitId:'p',groundId:source.id,count:2});assert.equal(next.lastError,null);assert.equal(next.groundItems[0].count,3);
  assert.deepEqual(ammunitionByType(next.units[0]),{[family]:2});
  next=actBattle(next,{type:'loot',unitId:'p',groundId:source.id,count:3});assert.equal(next.lastError,null);assert.equal(next.groundItems[0].count,0);assert.deepEqual(ammunitionByType(next.units[0]),{[family]:5});
  const repeat=actBattle(next,{type:'loot',unitId:'p',groundId:source.id,count:1});assert.ok(repeat.lastError);assert.deepEqual(ammunitionByType(repeat.units[0]),{[family]:5});
 }
});
