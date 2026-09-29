import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {equipmentCatalog} from '../game/equipment.js';
import {weaponMetadata,weaponRecord,contentWeaponOf,compileWeaponDefinition} from '../game/weapon-definition.js';
import {createBattle,actBattle,bladeFor,weaponFor,actionCosts,carriedWeight,endTurn} from '../game/tactical.js';
import {inventoryModel} from '../game/ja2-hud.js';
import {sanLorenzoAlly} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const blade=(values={})=>({id:'lanza-del-sur',name:'Lanza del Sur',template:1812,damage:23,ap:17,reach:3,weight:5,price:91,art:'/art/weapon-1810.png',...values});
const content=()=>{const d=defaultContentPackage();d.weapons.push(blade(),blade({id:'lanza-del-norte',name:'Lanza del Norte',damage:41,weight:2,price:127}));const c=d.characters.find(c=>c.id==='person-110');c.arrivalHours=0;c.blade='lanza-del-sur';return d;};
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const act=(b,a)=>{const n=actBattle(b,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const field=(gear=blade(),secondary=true)=>createBattle([{id:'p',x:1,y:1,weapon:secondary?1805:gear.template,...(secondary?{blade:gear.template,bladeMetadata:weaponMetadata(gear),activeSlot:'blade'}:{weaponMetadata:weaponMetadata(gear)}),ammo:0}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:4,y:1,weapon:1800,ammo:0,overwatch:false,hp:100,morale:100},{id:'other',x:11,y:7,weapon:1800,overwatch:false}]});

test('authored melee cost, damage, reach, weight and picture drive both equipped slots',()=>{
 for(const secondary of [true,false]){
  let b=field(blade(),secondary),u=b.units[0];assert.equal(bladeFor(u).name,'Lanza del Sur');assert.equal(actionCosts(b,u).melee,17);
  assert.equal(weaponFor(u).art,'/art/weapon-1810.png');assert.equal(inventoryModel(b,u).slots[secondary?'blade':'primary'].contentId,'lanza-del-sur');
  const weight=carriedWeight(u);u.activeSlot=secondary?'primary':'blade';assert.equal(carriedWeight(u),weight);u.activeSlot=secondary?'blade':'primary';
  assert.equal(weight,secondary?9.04:5);
  const far=structuredClone(b);far.units[1].x=5;assert.match(actBattle(far,{type:'melee',unitId:'p',targetId:'e'}).lastError,/acercarte/);
  b=act(b,{type:'melee',unitId:'p',targetId:'e'});assert.equal(b.units[0].ap,83);assert.equal(b.units[1].hp,77);assert.equal(b.units[1].knockedDown,true);assert.ok(validateBattleSnapshot(b));
 }
});

test('authored bayonet interception and enemy melee use edited values while keeping family techniques',()=>{
 let b=field(blade({template:1811,ap:29,damage:31,reach:3}));b.units[0].x=4;b.units[1].x=1;b.units[1].weapon=1811;b.units[1].loaded=0;b.units[1].activeSlot='primary';
 b=act(b,{type:'brace',unitId:'p'});b=endTurn(b);assert.ok(b.log.some(l=>l.includes('bayoneta calada')));assert.equal(b.units[1].hp,69);assert.ok(b.units[0].ap<=71);
 b=field();b.units=b.units.filter(u=>u.id!=='other');Object.assign(b.units[1],{x:3,weapon:1812,weaponMetadata:weaponMetadata(blade({ap:70,damage:13})),loaded:0,ammo:0});
 b=endTurn(b);assert.equal(b.units[0].hp,86);assert.equal(b.units[0].bleeding,1);assert.equal(b.units[1].ap,30);
 const poor=field(blade({template:1811,ap:29}));poor.units[0].ap=28;assert.match(actBattle(poor,{type:'brace',unitId:'p'}).lastError,/29 PA/);
});

test('variants retain separate prices and stock through primary and secondary armory swaps',()=>{
 let s=order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'week'});const funds=s.resources.treasury;
 s=order(s,{type:'purchaseEquipment',item:'lanza-del-sur'});s=order(s,{type:'purchaseEquipment',item:'lanza-del-norte'});assert.equal(s.resources.treasury,funds-218);
 assert.equal(equipmentCatalog(s).find(w=>w.item==='lanza-del-sur').category,'blade');assert.equal(equipmentCatalog(s).some(w=>w.item===1812),false);
 const item=s.armoryItems.find(w=>contentWeaponOf(w)?.id==='lanza-del-norte');
 s=order(s,{type:'equip',operativeId:110,slot:'blade',itemId:'lanza-del-norte',instanceId:item.id});
 assert.equal(contentWeaponOf(rosterFor(s).find(o=>o.id===110),'blade').damage,41);assert.equal(s.armory['lanza-del-sur'],2);
 s=order(save(s).campaign,{type:'equip',operativeId:110,slot:'weapon',itemId:'lanza-del-sur'});
 assert.equal(contentWeaponOf(rosterFor(s).find(o=>o.id===110)).id,'lanza-del-sur');assert.ok(save(s));
});

test('looted primary blades keep identity and condition through secondary swaps, campaign return and reentry',()=>{
 let s=order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);
 // Prepare recovered equipment; exercise the real tactical swap and campaign return.
 const u=b.units.find(u=>u.id==='110');u.inventory.recovered={...weaponRecord({weapon:1812,weaponMetadata:weaponMetadata(blade({id:'lanza-del-norte',name:'Lanza del Norte',damage:41,weight:2,price:127})),condition:63}),count:1};
 b=act(b,{type:'equipLoot',unitId:'110',inventoryKey:'recovered',slot:'blade'});assert.equal(bladeFor(b.units[0]).contentId,'lanza-del-norte');assert.equal(weaponRecord(b.units[0],'blade').condition,63);
 const previous=Object.keys(b.units[0].inventory).find(k=>k.startsWith('swap:'));assert.equal(inventoryModel(b,b.units[0]).backpack.find(i=>i.key===previous).name,'Lanza del Sur');
 let synced=syncBattleTime(s,b);assert.equal(synced.error,null);let pair=save(synced.campaign,synced.battle);s=order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=order(save(s).campaign,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates[s.location]);assert.equal(weaponRecord(b.units[0],'blade').condition,63);assert.equal(contentWeaponOf(b.units[0],'blade').id,'lanza-del-norte');
 b=act(b,{type:'equipLoot',unitId:'110',inventoryKey:previous,slot:'blade'});const recovered=Object.values(b.units[0].inventory).find(i=>i.count>0&&contentWeaponOf(i)?.id==='lanza-del-norte');assert.equal(recovered.condition,63);synced=syncBattleTime(s,b);assert.equal(synced.error,null);assert.ok(save(synced.campaign,synced.battle));
 // Actual corpse loot supplies the same record to the two-slot path.
 let f=field(blade({damage:100}),false);Object.assign(f.units[1],{x:2,weapon:1812,weaponMetadata:weaponMetadata(blade({id:'corpse-blade'})),loaded:0,condition:47,hp:10});
 f=act(f,{type:'melee',unitId:'p',targetId:'e'});f=act(f,{type:'loot',unitId:'p',targetId:'e',item:'weapon'});
 const key=Object.keys(f.units[0].inventory)[0];f=act(f,{type:'equipLoot',unitId:'p',inventoryKey:key,slot:'blade'});assert.equal(bladeFor(f.units[0]).contentId,'corpse-blade');assert.equal(weaponRecord(f.units[0],'blade').condition,47);
});

test('save validation pins blades in both slots, stock and inventory and compresses their images',()=>{
 const d=content(),w=d.weapons.find(w=>w.id==='lanza-del-sur');w.art='data:image/png;base64,'+'A'.repeat(320000);for(const c of d.characters)c.blade=w.id;
 let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'purchaseEquipment',item:w.id,quantity:5});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle),text=encodeSave(s,b);assert.ok(text.length<1000000);assert.equal(contentWeaponOf(decodeSave(text).battle.units[0],'blade').art,w.art);
 for(const mutate of [v=>v.operativeState[110].bladeMetadata.contentWeapon.damage++,v=>v.loadouts[110].blade=1813,v=>v.armoryItems[0].loaded=1,v=>v.operativeState[110].bladeCondition=-1]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>save(bad,b));}
 const bad=JSON.parse(text);bad.battle.units[0].bladeMetadata.contentWeapon.definitionRef='firearm-1800';assert.throws(()=>decodeSave(JSON.stringify(bad)),/arma/);
});

test('older packages retain their original blades and the mission ally accepts an explicit blade',()=>{
 const d=defaultContentPackage();d.weapons=d.weapons.filter(w=>w.template<1809);for(const c of d.characters)delete c.blade;
 assert.deepEqual(campaignContentReport(d).blocked,[]);const old=save(initialCampaign(8,d)).campaign;assert.equal(rosterFor(old).find(o=>o.id===110).blade,rosterFor(initialCampaign()).find(o=>o.id===110).blade);assert.equal(rosterFor(old).find(o=>o.id===110).bladeMetadata,undefined);assert.ok(equipmentCatalog(old).some(w=>w.item===1812));
 const authored=content();authored.characters.find(c=>c.id==='person-57').blade='lanza-del-sur';const s=initialCampaign(8,authored);s.missionAllies.san_lorenzo=sanLorenzoAlly(s);assert.equal(contentWeaponOf(save(s).campaign.missionAllies.san_lorenzo,'blade').id,'lanza-del-sur');assert.equal(s.missionAllies.san_lorenzo.blade,1812);
 for(const values of [{ap:0},{ap:101},{reach:.9},{reach:4.1},{damage:0},{weight:0},{price:-1}])assert.throws(()=>compileWeaponDefinition(blade(values)));
 const invalid=content();invalid.characters[0].blade='firearm-1800';assert.ok(validateContentPackage(invalid).length);invalid.characters[0].blade='blade-1813';invalid.oppositionBlades={officer:'firearm-1800',line:null,veteran:null};assert.ok(validateContentPackage(invalid).length);
});
