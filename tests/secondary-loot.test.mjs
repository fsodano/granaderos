import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryModel} from '../game/ja2-hud.js';
import {actBattle,createBattle,weaponFor} from '../game/tactical.js';
import {weaponMetadata,weaponRecord,contentWeaponOf} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {prepareGarrison,validGarrisons,returnGarrison} from '../game/garrison.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {order,saved,visit,leave,sync} from './local-contract-fixture.mjs';
import {secondaryLootField,secondaryOrder} from './secondary-loot-fixture.mjs';
const actor=p=>p.battle.units.find(u=>u.id==='110'),victim=p=>p.battle.units.find(u=>u.id===p.target);
const pieces=(p,id)=>p.battle.units.reduce((total,u)=>total+Number(u.blade&&contentWeaponOf(u,'blade')?.id===id)+Number(!u.weaponDropped&&contentWeaponOf(u)?.id===id)+Object.values(u.inventory).reduce((n,r)=>n+(contentWeaponOf(r)?.id===id?r.count:0),0),0);

test('a killed issued soldier gives up its authored secondary once, with identity, wear, saved swaps and reentry',()=>{
 let p=secondaryLootField(),before=weaponRecord(victim(p),'blade'),count=pieces(p,'blade-1809'),ap=actor(p).ap;assert.equal(before.contentWeapon.id,'blade-1809');
 p=secondaryOrder(p,{type:'loot',targetId:p.target,item:'blade'});assert.equal(actor(p).ap,ap-8);assert.equal(victim(p).blade,0);assert.equal(inventoryModel(p.battle,victim(p)).slots.blade,null);assert.equal(victim(p).bladeMetadata,undefined);assert.equal(pieces(p,'blade-1809'),count);
 const key=Object.keys(actor(p).inventory).find(k=>k.startsWith('blade:'));assert.deepEqual(actor(p).inventory[key],before);const repeated=actBattle(p.battle,{type:'loot',unitId:'110',targetId:p.target,item:'blade'});assert.ok(repeated.lastError);assert.deepEqual(repeated.units,p.battle.units);
 p=secondaryOrder(p,{type:'equipLoot',inventoryKey:key,slot:'blade'});assert.equal(weaponFor(actor(p)).contentId,'blade-1809');assert.equal(pieces(p,'blade-1809'),count);p={...saved(p),target:p.target};
 let s=order(p.campaign,{type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});s=saved({campaign:s}).campaign;assert.equal(contentWeaponOf(rosterFor(s).find(u=>u.id===110),'blade').id,'blade-1809');s=order(s,{type:'attack',sector:'buenos_aires'});p={campaign:s,battle:enterSector(s.pendingBattle,s.sectorStates.buenos_aires),target:p.target};assert.equal(victim(p).blade,0);assert.equal(victim(p).bladeMetadata,undefined);assert.equal(contentWeaponOf(actor(p),'blade').id,'blade-1809');assert.ok(saved(p));
});

test('ordinary collect-all takes both slots once and a secondary-only body remains collectible',()=>{
 let p=secondaryLootField(),count=pieces(p,'blade-1809');p=secondaryOrder(p,{type:'loot',targetId:p.target});assert.equal(victim(p).weaponDropped,true);assert.equal(victim(p).blade,0);assert.ok(Object.keys(actor(p).inventory).some(k=>k.startsWith('weapon:')));assert.ok(Object.keys(actor(p).inventory).some(k=>k.startsWith('blade:')));assert.equal(pieces(p,'blade-1809'),count);assert.ok(actBattle(p.battle,{type:'loot',unitId:'110',targetId:p.target}).lastError);assert.ok(saved(p));
 p=secondaryLootField();p=secondaryOrder(p,{type:'loot',targetId:p.target,item:'weapon'});for(const field of ['ammo','priming','flints','rations','boleadoras','medkits','torches'])victim(p)[field]=0;victim(p).inventory={};const blade=weaponRecord(victim(p),'blade');p=secondaryOrder(p,{type:'loot',targetId:p.target});assert.equal(victim(p).blade,0);assert.ok(Object.values(actor(p).inventory).some(r=>JSON.stringify(r)===JSON.stringify(blade)));assert.ok(saved(p));
});

test('an unconscious hired soldier returns with an empty secondary slot; reentry and armory replacement do not restore the stolen blade',()=>{
 const d=defaultContentPackage();for(const id of [110,111])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;d.characters.find(c=>c.id==='person-111').startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};
 let s=initialCampaign(45,d);for(const id of [110,111])s=order(s,{type:'recruitCivic',id,term:'week'});let p=visit(s),u=p.battle.units.find(u=>u.id==='110'),target=p.battle.units.find(u=>u.id==='111');
 // Declared adjacent opening positions isolate a carried-item transfer. The
 // wounded paid arrival and its inability to act are the authored game state.
 target.x=u.x+1;target.y=u.y;target.activeSlot='blade';const b=actBattle(p.battle,{type:'loot',unitId:'110',targetId:'111',item:'blade'});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id==='111').blade,0);assert.equal(b.units.find(u=>u.id==='111').activeSlot,'primary');p=sync({campaign:p.campaign,battle:b});s=leave(saved(p));assert.equal(s.loadouts[111].blade,0);s=saved({campaign:s}).campaign;p=visit(s);assert.equal(p.battle.units.find(u=>u.id==='111').blade,0);assert.equal(p.battle.units.find(u=>u.id==='111').bladeMetadata,undefined);s=leave(p);
 s=order(s,{type:'purchaseEquipment',item:'blade-1809'});s=order(s,{type:'equip',operativeId:111,slot:'blade',itemId:'blade-1809'});assert.equal(s.loadouts[111].blade,1809);assert.equal(s.armory['blade-1811']??0,0);assert.ok(saved({campaign:s}));
});

test('a wounded militia survivor keeps its empty secondary slot in finite garrison storage',()=>{
 const s=initialCampaign(45,defaultContentPackage());s.sectors.retiro.militia=[1,0,0];const issued=prepareGarrison(s,'retiro');
 // Prepared injury and close terrain isolate the settlement boundary for an
 // existing named soldier; the tactical collection itself is real.
 let b=createBattle([{id:110,x:1,y:1}, {...issued[0],hp:1,x:2,y:1,activeSlot:'blade'}],{width:8,height:8,exploration:true,enemies:[]});const target=b.units.find(u=>u.militia);b=actBattle(b,{type:'loot',unitId:'110',targetId:target.id,item:'blade'});assert.equal(b.lastError,null);returnGarrison(s,{sector:'retiro',garrison:issued},b);assert.equal(s.garrisons.retiro[0].blade,0);assert.ok(validGarrisons(s));assert.equal(prepareGarrison(saved({campaign:s}).campaign,'retiro')[0].blade,0);
});

test('secondary recovery preserves independent wear and definition and rejects distance, consciousness and insufficient AP',()=>{
 const w={id:'worn-sabre',template:1809,name:'Sable gastado',ap:12,damage:30,reach:1.5,weight:1.9,price:90,art:'/art/weapon-1810.png'};
 const fixture=()=>createBattle([{id:110,x:1,y:1}],{width:8,height:8,enemies:[{id:'wounded',x:2,y:1,hp:1,blade:1809,bladeMetadata:weaponMetadata(w),bladeCondition:37,bladeJammed:true,activeSlot:'blade'},{id:'far',x:7,y:7,patrol:false}]});
 for(const change of [b=>b.units[0].ap=7,b=>{b.units[1].hp=100;b.units[1].unconscious=false;},b=>b.units[1].x=4]){const b=fixture();change(b);const n=actBattle(b,{type:'loot',unitId:'110',targetId:'wounded',item:'blade'});assert.ok(n.lastError);assert.deepEqual(n.units,b.units);}
 let b=fixture();b=actBattle(b,{type:'loot',unitId:'110',targetId:'wounded',item:'blade'});assert.equal(b.lastError,null);const key=Object.keys(b.units[0].inventory)[0],r=b.units[0].inventory[key];assert.equal(r.condition,37);assert.equal(r.jammed,true);assert.equal(r.loaded,0);assert.equal(r.contentWeapon.name,w.name);assert.equal(b.units[1].activeSlot,'primary');assert.ok(validateBattleSnapshot(b));b=actBattle(b,{type:'equipLoot',unitId:'110',inventoryKey:key,slot:'blade'});assert.equal(b.lastError,null);assert.equal(b.units[0].bladeCondition,37);assert.equal(b.units[0].bladeJammed,true);assert.equal(b.units[0].bladeMetadata.contentWeapon.id,w.id);
});
