import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {defaultForceBlades,forceWeaponUsers} from '../game/content-force-equipment.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {contentWeaponOf} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,endTurn,bladeFor,weaponFor} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const tiles=Array.from({length:140},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0}));
function content(){const d=defaultContentPackage();d.weapons.push({id:'lanza-de-tropa',template:1812,name:'Lanza de tropa',damage:13,ap:70,reach:3,weight:2,price:55,art:'/art/weapon-1810.png'});d.oppositionEquipment.line='lanza-de-tropa';d.oppositionBlades={officer:'lanza-de-tropa',line:'blade-1813',veteran:null};d.militiaEquipment.green='lanza-de-tropa';d.militiaBlades={green:'blade-1813',regular:'lanza-de-tropa',veteran:null};for(const c of d.characters.filter(c=>Number(c.id.slice(7))>=100))c.arrivalHours=0;return d;}
function attack(d=content()){let s=secureArea(initialCampaign(8,d),'buenos_aires');for(const id of [110,111,112,113])s=order(s,{type:'recruitCivic',id,term:'week'});s=order(s,{type:'travel',sector:'buenos_aires'});return order(s,{type:'attack',sector:'san_nicolas'});}

test('troop primary and secondary blade selections validate and protect references independently',()=>{
 const malformed=content();malformed.weapons.push(null);assert.ok(validateContentPackage(malformed).length);
 const d=content();assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(forceWeaponUsers(d,'lanza-de-tropa'),['Oficiales enemigos · arma blanca','Infantería enemiga','Cívicos','Montoneros · arma blanca']);assert.deepEqual(defaultForceBlades('oppositionEquipment',[]),{officer:null,line:null,veteran:null});
 for(const field of ['oppositionBlades','militiaBlades'])for(const value of [null,[],{},'bad',{...d[field],extra:null},{...d[field],[Object.keys(d[field])[0]]:'missing'},{...d[field],[Object.keys(d[field])[0]]:'firearm-1800'}]){const bad=structuredClone(d);bad[field]=value;assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(8,bad));}
});

test('actual attacks issue authored blades without cartridges and AI chooses the configured secondary at its range',()=>{
 const s=attack(),b=enterSector(s.pendingBattle),enemies=save(s,b).battle.units.filter(u=>u.side==='enemy');
 for(const u of enemies.filter(u=>u.id==='enemy-1'||u.id==='enemy-2')){assert.equal(contentWeaponOf(u).id,'lanza-de-tropa');assert.equal(u.loaded,0);assert.equal(u.ammo,0);assert.equal(u.priming,undefined);assert.equal(contentWeaponOf(u,'blade').id,'blade-1813');}
 const officer=enemies.find(u=>u.id==='enemy-0');assert.equal(contentWeaponOf(officer,'blade').id,'lanza-de-tropa');assert.equal(officer.loaded+officer.ammo,13);assert.equal(enemies.find(u=>u.id==='enemy-3').bladeMetadata,undefined);
 let close=createBattle([{id:'p',x:1,y:1,weapon:1800}],{width:14,height:10,tiles,seed:45,enemies:[{...officer,x:3,y:1}]});close=endTurn(close);const switched=close.units.find(u=>u.side==='enemy');assert.equal(switched.activeSlot,'blade');assert.equal(switched.ap,26);assert.equal(switched.loaded,officer.loaded);assert.equal(close.units[0].hp,86);assert.equal(bladeFor(switched).id,1812);
 let far=createBattle([{id:'p',x:1,y:1,weapon:1800}],{width:14,height:10,tiles,seed:45,enemies:[{...officer,activeSlot:'blade',x:10,y:1}]});far=endTurn(far);const shooter=far.units.find(u=>u.side==='enemy');assert.equal(shooter.activeSlot,'primary');assert.ok(shooter.condition<officer.condition);assert.ok(shooter.loaded+shooter.ammo<13);
 let fallen=createBattle([{id:'p',x:1,y:1,weapon:1800}],{width:14,height:10,tiles,seed:45,enemies:[{...officer,x:3,y:1}]});fallen.units[1].knockedDown=true;fallen.units[1].stance='prone';fallen=endTurn(fallen);assert.equal(fallen.units[1].knockedDown,false);assert.equal(fallen.units[1].activeSlot,'blade');assert.equal(fallen.units[1].ap,14);
});

test('trained militia retain both chosen slots through switching, save and real campaign return',()=>{
 const d=content();d.militiaEquipment.green='firearm-1805';d.militiaBlades.green='lanza-de-tropa';d.rules.militiaCartridges=0;
 let s=order(secureArea(initialCampaign(8,d),'buenos_aires','ensenada'),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 s=order(s,{type:'militia',trainerId:1000,rank:0});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});if(s.hour%24<6||s.hour%24>=20)s=order(s,{type:'wait',hours:(30-s.hour%24)%24});s=order(s,{type:'visitSector'});const r=s.pendingBattle;
 // Paid soldiers meet a declared nearby raider; switching is an actual AI decision.
 let b=createBattle([...r.squad.map((u,i)=>({...u,x:1,y:8+i})),...r.garrison.map((u,i)=>({...u,x:1,y:1+i*3}))],{...r,exploration:false,width:14,height:10,tiles,enemies:[{id:'raider',x:4,y:1,weapon:1813,blade:1813,hp:100,maxHp:100,fatigue:100,patrol:false}]}),u=b.units.find(u=>u.militia),id=u.id;
 assert.equal(contentWeaponOf(u).id,'firearm-1805');assert.equal(contentWeaponOf(u,'blade').id,'lanza-de-tropa');assert.deepEqual([u.loaded,u.ammo,u.priming],[0,0,undefined]);
 b=endTurn(b);assert.equal(b.lastError,null);u=b.units.find(u=>u.militia&&!u.routed&&u.activeSlot==='blade');assert.ok(u);id=u.id;assert.equal(weaponFor(u).contentId,'lanza-de-tropa');assert.ok(b.units.find(u=>u.id==='raider').hp<100);
 const pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});s=save(s).campaign;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);u=b.units.find(u=>u.id===id);assert.equal(contentWeaponOf(u).id,'firearm-1805');assert.equal(contentWeaponOf(u,'blade').id,'lanza-de-tropa');assert.equal(u.activeSlot,'blade');assert.ok(save(s,b));
});

test('secondary-only configuration preserves firearm defaults and original secondary choices remain compatible',()=>{
 const d=defaultContentPackage();delete d.oppositionEquipment;delete d.militiaEquipment;d.militiaBlades={green:'blade-1812',regular:null,veteran:null};const s=initialCampaign(8,d);s.sectors.retiro.militia=[1,1,1];
 const units=prepareGarrison(s,'retiro');assert.deepEqual(units.map(u=>[u.weapon,u.loaded,u.ammo]),[[1804,1,5],[1803,1,5],[1801,1,5]]);assert.equal(contentWeaponOf(units[0],'blade').id,'blade-1812');assert.ok(units.slice(1).every(u=>!u.bladeMetadata));assert.ok(save(s));
 // Retained soldiers keep their equipment; enabling or editing authoring never reissues them.
 units[0].bladeCondition=41;s.garrisons.retiro=units;const retained=prepareGarrison(s,'retiro');assert.equal(retained[0].bladeCondition,41);assert.equal(retained[0].id,units[0].id);
});

test('a generated primary blade can be recovered without cartridges and kept through retreat and a saved revisit',()=>{
 const d=content(),pistol=d.weapons.find(w=>w.id==='firearm-1805');Object.assign(pistol,{damage:100,fireAP:6,capacity:3});const person=d.characters.find(c=>c.id==='person-110');person.weapon=pistol.id;person.attributes.marksmanship=100;
 let s=attack(d);const request=s.pendingBattle;
 // Real issued soldiers on compact terrain isolate custody and campaign return.
 let b=createBattle(request.squad.map((u,i)=>({...u,x:1,y:1+i*2})),{...request,width:14,height:10,tiles,seed:45,weather:{rain:0,humidity:0},enemies:request.enemies.map((u,i)=>({...u,x:i===1?2:12,y:i===1?1:4+i}))});
 for(let i=0;i<3&&b.units.find(u=>u.id==='enemy-1').hp>0;i++){b=actBattle(b,{type:'fire',unitId:'110',targetId:'enemy-1',aim:2});assert.equal(b.lastError,null);}assert.equal(b.units.find(u=>u.id==='enemy-1').hp,0);
 b=actBattle(b,{type:'loot',unitId:'110',targetId:'enemy-1',item:'weapon'});assert.equal(b.lastError,null);const key=Object.keys(b.units[0].inventory).find(k=>k.startsWith('weapon:'));assert.equal(b.units[0].inventory[key].loaded,0);
 b=actBattle(b,{type:'equipLoot',unitId:'110',inventoryKey:key});assert.equal(b.lastError,null);assert.equal(weaponFor(b.units[0]).contentId,'lanza-de-tropa');
 const pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=order(pair.campaign,{type:'battleResult',outcome:'retreat',battleId:request.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});s=save(s).campaign;s=order(s,{type:'attack',sector:'san_nicolas'});b=enterSector(s.pendingBattle,s.sectorStates.san_nicolas);
 assert.equal(weaponFor(b.units.find(u=>u.id==='110')).contentId,'lanza-de-tropa');assert.equal(b.units.find(u=>u.id==='110').ammo,0);assert.equal(b.units.find(u=>u.id==='enemy-1').weaponDropped,true);assert.ok(save(s,b));
});
