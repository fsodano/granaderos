import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {compileWeaponDefinition,weaponSpecification,weaponRecord,weaponMetadata} from '../game/weapon-definition.js';
import {AMMO_TYPES,ammoTypeFor,ammoCount,ammunitionLoadsFor} from '../game/ammo-types.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {initialCampaign,dispatchCampaign,deploymentCost,rosterFor} from '../game/campaign.js';
import {order,saved,visit,leave,tactical} from './local-contract-fixture.mjs';
const content=()=>{const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.rules.startingTreasury=9000;return d;};
const hire=(d=content())=>order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'month'});
const action=(s,type,extra={})=>order(s,{type,operativeId:110,...extra});
const choose=(s,family)=>action(s,'selectAmmunitionLoad',{family});
const unit=p=>p.battle.units.find(u=>u.id==='110');

test('default smoothbores offer separate ball and shot loads and authored alternatives validate strictly',()=>{
 for(const id of [1800,1801,1803,1804,1805,1806,1807,1808])assert.equal(ammunitionLoadsFor(id).length,2);
 assert.equal(ammunitionLoadsFor(1802).length,1);assert.deepEqual(ammunitionLoadsFor(1809),[]);
 const d=content(),w=d.weapons.find(w=>w.id==='firearm-1800');w.alternativeLoads=[{family:'ammoShot',damage:17,range:4,pattern:'cone'}];assert.deepEqual(validateContentPackage(d),[]);assert.doesNotThrow(()=>initialCampaign(8,d));
 for(const loads of [null,{},[{family:'ammoMusket',damage:17,range:4,pattern:'single'}],[{family:'bad',damage:17,range:4,pattern:'single'}],[{family:'ammoShot',damage:0,range:4,pattern:'cone'}],[{family:'ammoShot',damage:17,range:4.5,pattern:'cone'}],[{family:'ammoShot',damage:17,range:4,pattern:'bad'}],[...w.alternativeLoads,...w.alternativeLoads],[{...w.alternativeLoads[0],extra:true}]])assert.throws(()=>compileWeaponDefinition({...w,alternativeLoads:loads}));
 assert.throws(()=>compileWeaponDefinition({...d.weapons.find(w=>w.id==='blade-1809'),alternativeLoads:[]}));
 assert.equal(ammunitionLoadsFor({...w,alternativeLoads:[]}).length,1);
});

test('chosen shot purchases, deployment, unload and reselection preserve both families and money through saves',()=>{
 let s=choose(hire(),'ammoShot'),cash=s.resources.treasury;assert.equal(deploymentCost(s),10);
 let p=visit(s);assert.equal(ammoTypeFor(unit(p)),'ammoShot');assert.equal(unit(p).loaded,0);assert.equal(ammoCount(unit(p),'ammoShot'),10);p=tactical(p,{type:'reload'});assert.equal(unit(p).loaded,1);assert.equal(ammoCount(unit(p),'ammoShot'),9);assert.equal(weaponSpecification(unit(p)).loadPattern,'cone');
 s=leave(saved(p));assert.equal(s.resources.treasury,cash-10);assert.equal(s.operativeState[110].ammunitionChoice,'ammoShot');
 assert.match(dispatchCampaign(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoMusket'}).lastError,/Vaciá/);
 s=action(s,'unloadAmmunition');assert.equal(ammoCount(s.operativeState[110],'ammoShot'),10);s=choose(s,'ammoMusket');p=visit(saved({campaign:s}).campaign);assert.equal(unit(p).loaded,0);assert.equal(ammoCount(unit(p),'ammoMusket'),10);p=tactical(p,{type:'reload'});assert.equal(ammoCount(unit(p),'ammoShot'),10);assert.equal(ammoCount(unit(p),'ammoMusket'),9);assert.equal(unit(p).loaded,1);assert.equal(p.campaign.resources.treasury,cash-20);assert.equal(weaponSpecification(unit(p)).loadPattern,undefined);
});

test('tactical unload, choice and reload retain physical load on packed and recovered weapons',()=>{
 let p=visit(choose(hire(),'ammoShot'));p=tactical(p,{type:'reload'});p=tactical(p,{type:'unloadAmmunition'});assert.equal(unit(p).loaded,0);assert.equal(ammoCount(unit(p),'ammoShot'),10);p=tactical(p,{type:'selectAmmunitionLoad',family:'ammoMusket'});assert.equal(ammoTypeFor(unit(p)),'ammoMusket');
 const denied=actBattle(p.battle,{type:'reload',unitId:'110'});assert.ok(denied.lastError);assert.equal(ammoCount(denied.units.find(u=>u.id==='110'),'ammoShot'),10);
 p=tactical(p,{type:'selectAmmunitionLoad',family:'ammoShot'});p=tactical(p,{type:'reload'});const gun=weaponRecord(unit(p));assert.equal(gun.ammunitionChoice,'ammoShot');assert.equal(gun.loaded,1);assert.equal(weaponSpecification(gun).loadPattern,'cone');
 p=tactical(p,{type:'drop',item:'primary'});p=saved(p);const dropped=p.battle.groundItems.find(g=>g.weapon===gun.weapon&&g.count===1);assert.equal(dropped.ammunitionChoice,'ammoShot');assert.equal(dropped.loaded,1);
});

test('invalid choices and partial reload changes reject without converting ammunition',()=>{
 const s=hire();assert.ok(dispatchCampaign(s,{type:'selectAmmunitionLoad',operativeId:110,family:'ammoRifle'}).lastError);
 for(const family of ['bad','ammoRifle']){const bad=structuredClone(s);bad.operativeState[110].ammunitionChoice=family;assert.throws(()=>saved({campaign:bad}));}
 const d=content(),w=d.weapons.find(w=>w.id==='firearm-1800');w.reloadAP=500;
 let b=createBattle([{id:'p',weapon:1800,weaponMetadata:weaponMetadata(w),loaded:0,ammunitionChoice:'ammoShot',ammunition:{ammoShot:3},ammo:3}],{width:8,height:8,enemies:[{id:'e',x:7,y:7,weapon:1813,patrol:false}]});
 b=actBattle(b,{type:'reload',unitId:'p'});assert.ok(b.units[0].reloadProgress>0);const before=structuredClone(b.units);
 b=actBattle(b,{type:'selectAmmunitionLoad',unitId:'p',family:'ammoMusket'});assert.ok(b.lastError);assert.deepEqual(b.units,before);
 b=actBattle(b,{type:'unloadAmmunition',unitId:'p'});assert.ok(b.lastError);assert.deepEqual(b.units,before);
});

test('ball hits one target while a selected shot load uses its authored damage, reach and cone',()=>{
 const field=choice=>createBattle([{id:'p',x:1,y:3,weapon:1800,loaded:1,ammo:0,...(choice?{ammunitionChoice:choice}:{}),marksmanship:100,dexterity:100,wisdom:100,condition:100}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:4,y:3,weapon:1813,hp:100,maxHp:100,patrol:false},{id:'other',x:5,y:4,weapon:1813,hp:100,maxHp:100,patrol:false},{id:'far',x:9,y:3,weapon:1813,hp:100,maxHp:100,patrol:false}]});
 const shoot=b=>actBattle(b,{type:'fire',unitId:'p',targetId:'e',aim:4});const ball=shoot(field()),shot=shoot(field('ammoShot'));
 assert.equal(ball.lastError,null);assert.equal(shot.lastError,null);assert.equal(ball.units[0].loaded,0);assert.equal(shot.units[0].loaded,0);assert.ok(ball.units[1].hp<shot.units[1].hp);assert.equal(ball.units[2].hp,100);assert.ok(shot.units[2].hp<100);assert.equal(shot.units[3].hp,100);
 const w=content().weapons.find(w=>w.id==='firearm-1800');w.alternativeLoads=[{family:'ammoShot',damage:12,range:3,pattern:'single'}];const custom=field('ammoShot');custom.units[0].weaponMetadata=weaponMetadata(w);const result=shoot(custom);assert.equal(result.lastError,null);assert.equal(weaponSpecification(result.units[0]).damage,12);assert.equal(weaponSpecification(result.units[0]).range,3);assert.equal(result.units[2].hp,100);
});

test('a loaded alternative survives held transfer, recipient equip and tactical restoration',async()=>{
 const {validateBattleSnapshot:validateBattle}=await import('../game/validate-battle.js');
 let b=createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:1,ammunitionChoice:'ammoShot',ammo:0},{id:'q',x:2,y:1,weapon:1802,loaded:0,ammo:0}],{width:8,height:8,exploration:true,enemies:[]});
 b=actBattle(b,{type:'transfer',unitId:'p',targetId:'q',slot:'primary'});assert.equal(b.lastError,null);const key=Object.keys(b.units[1].inventory)[0];assert.equal(b.units[1].inventory[key].ammunitionChoice,'ammoShot');assert.equal(b.units[1].inventory[key].loaded,1);
 b=validateBattle(JSON.parse(JSON.stringify(b)));b=actBattle(b,{type:'equipLoot',unitId:'q',inventoryKey:key});assert.equal(b.lastError,null);assert.equal(b.units[1].weapon,1800);assert.equal(b.units[1].ammunitionChoice,'ammoShot');assert.equal(b.units[1].loaded,1);assert.equal(weaponSpecification(b.units[1]).loadPattern,'cone');assert.doesNotThrow(()=>validateBattle(JSON.parse(JSON.stringify(b))));
});

test('unloading requires pocket capacity and combat AP, and cannot clear a jam for free',()=>{
 const field=()=>createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:1,ammunitionChoice:'ammoShot',ammo:0,ap:3}],{width:8,height:8,enemies:[{id:'e',x:7,y:7,weapon:1813,patrol:false}]});
 let b=field();b.units[0].ap=3;const before=structuredClone(b.units);let n=actBattle(b,{type:'unloadAmmunition',unitId:'p'});assert.match(n.lastError,/12 PA/);assert.deepEqual(n.units,before);
 b=field();b.units[0].jammed=true;b.units[0].ap=20;n=actBattle(b,{type:'unloadAmmunition',unitId:'p'});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,8);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].jammed,true);assert.equal(ammoCount(n.units[0],'ammoShot'),1);
 b=field();b.units[0].ap=20;b.units[0].inventory=Object.fromEntries(Array.from({length:12},(_,i)=>['full'+i,{name:'Objeto '+i,count:1,weight:.1,instanceId:'full-'+i}]));const full=structuredClone(b.units);n=actBattle(b,{type:'unloadAmmunition',unitId:'p'});assert.ok(n.lastError);assert.deepEqual(n.units,full);
});

test('an empty AI firearm selects owned compatible shot and closes distance instead of discarding it',async()=>{
 const {endTurn,shotChance}=await import('../game/tactical.js');
 const b=createBattle([{id:'p',x:1,y:1,weapon:1800,ammo:0,loaded:0}],{seed:45,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:8,y:5,weapon:1800,loaded:0,ammo:2,ammunition:{ammoShot:2},patrol:false,overwatch:false}]});
 assert.equal(shotChance(b,{...b.units[1],ammunitionChoice:'ammoShot'},b.units[0]),0);let n=endTurn(b);for(let i=0;n.phase==='interrupt'&&i<8;i++)n=endTurn(n);const enemy=n.units.find(u=>u.id==='e');assert.equal(enemy.ammunitionChoice,'ammoShot');assert.equal(enemy.loaded,0);assert.equal(ammoCount(enemy,'ammoShot'),1);assert.match(n.log.join(' '),/recarga/);assert.match(n.log.join(' '),/dispara una carga de perdigones/);assert.ok(n.units[0].hp<b.units[0].hp);assert.ok(Math.hypot(enemy.x-1,enemy.y-1)<6);assert.equal(n.lastError,null);
});
