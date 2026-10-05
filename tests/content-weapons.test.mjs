import {withStoredGear,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {storedEquipmentStack} from '../game/stored-equipment.js';
import {secondaryRetreat} from './secondary-loot-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {initialCampaign,dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {equipmentCatalog,armoryInventory} from '../game/equipment.js';
import {compileWeaponDefinition,weaponMetadata,weaponSpecification,contentWeaponOf} from '../game/weapon-definition.js';
import {createBattle,actBattle,weaponFor,actionCosts,carriedWeight,endTurn} from '../game/tactical.js';
import {inventoryModel} from '../game/ja2-hud.js';
import {sanLorenzoAlly} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const custom=(overrides={})=>({...defaultContentPackage().weapons.find(w=>w.template===1805),id:'pistola-del-sur',name:'Pistola del Sur',damage:37,fireAP:13,aimAP:0,reloadAP:30,range:24,capacity:3,weight:2,price:180,art:'/art/weapon-1806.png',...overrides});
const content=()=>{const d=defaultContentPackage();d.weapons.push(custom(),custom({id:'pistola-del-norte',name:'Pistola del Norte',damage:70,price:250,weight:4}));const c=d.characters.find(c=>c.id==='person-110');c.weapon='pistola-del-sur';c.arrivalHours=0;return d;};
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const save=(s,b=null)=>decodeSave(encodeSave(s,b));
const field=(definition=custom())=>createBattle([{id:'p',x:1,y:1,weapon:definition.template,weaponMetadata:weaponMetadata(definition),ammo:6,medkits:0,rations:0,torches:0,boleadoras:0,marksmanship:100}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:4,y:1,weapon:1800,overwatch:false,hp:100},{id:'other',x:11,y:7,weapon:1800,overwatch:false}]});

test('the same compiled definition drives live shots, free aiming, capacity, weight, HUD and reload',()=>{
 let s=field(),u=s.units[0];assert.equal(u.loaded,3);assert.equal(weaponFor(u).damage,37);assert.equal(actionCosts(s,u).fire,13);assert.equal(actionCosts(s,u).aim,0);
 assert.equal(carriedWeight(u),2+9*.04);assert.equal(inventoryModel(s,u).slots.primary.art,'/art/weapon-1806.png');
 s=actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:2});assert.equal(s.lastError,null);assert.equal(s.units[0].loaded,2);assert.equal(s.units[0].ap,87);
 s=actBattle(s,{type:'reload',unitId:'p'});assert.equal(s.lastError,null);assert.equal(s.units[0].loaded,3);assert.equal(s.units[0].ammo,5);assert.equal(s.units[0].ap,77);
 assert.deepEqual(contentWeaponOf(validateBattleSnapshot(s).units[0]),compileWeaponDefinition(custom()));
 s.units[0].activeSlot='blade';assert.equal(inventoryModel(s,s.units[0]).slots.primary.name,'Pistola del Sur');
});
test('authored variants own separate shop prices, stock and exact used armory instances',()=>{
 let s=initialCampaign(8,content());const funds=s.resources.treasury;
 s=withStoredGear(s,'pistola-del-sur',2);s=withStoredGear(s,'pistola-del-norte');
 assert.equal(s.resources.treasury,funds);assert.equal(armoryInventory(s).find(w=>w.item==='pistola-del-sur').quantity,2);
 s=order(s,{type:'recruitCivic',id:110,term:'week'});const first=s.armoryItems.find(w=>contentWeaponOf(storedEquipmentStack(w))?.id==='pistola-del-norte');
 s.operativeState[110].condition=55;s.operativeState[110].jammed=true;
 s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'pistola-del-norte',instanceId:first.id});
 s=save(s).campaign;assert.equal(weaponSpecification(rosterFor(s).find(o=>o.id===110)).damage,70);assert.equal(s.operativeState[110].condition,100);
 const worn=s.armoryItems.find(w=>contentWeaponOf(storedEquipmentStack(w))?.id==='pistola-del-sur'&&w.condition===55);assert.ok(worn);assert.equal(worn.jammed,true);
 const mismatch=dispatchCampaign(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'pistola-del-norte',instanceId:worn.id});assert.ok(mismatch.lastError);assert.deepEqual(mismatch.armoryItems,s.armoryItems);
 s=order(s,{type:'equip',operativeId:110,slot:'weapon',itemId:'pistola-del-sur',instanceId:worn.id});assert.equal(s.operativeState[110].condition,55);assert.equal(s.operativeState[110].jammed,true);
 assert.equal(save(s).campaign.armoryItems.length,3);assert.equal(initialCampaign().armoryItems.length,0);
});
test('already-paid edited imports retain identity through saved cargo and blockade delays',()=>{
 const d=content(),w=d.weapons.find(w=>w.id==='firearm-1800');w.damage=81;w.name='Fusil del puerto';w.price=450;
 let s=secureArea(initialCampaign(8,d),'buenos_aires','ensenada');s.equipmentShipments=[{item:w.id,quantity:1,due:72}];const money=s.resources.treasury;assertTradeRejected(s,{type:'purchaseEquipment',item:w.id});
 const due=s.equipmentShipments[0].due;s.blockade=true;s=order(save(s).campaign,{type:'wait',hours:due});assert.equal(s.equipmentShipments.length,1);assert.equal(s.armoryItems.length,0);
 s.blockade=false;s=order(s,{type:'wait',hours:1});assert.equal(s.equipmentShipments.length,0);assert.equal(contentWeaponOf(storedEquipmentStack(s.armoryItems[0])).damage,81);assert.equal(s.resources.treasury,money);assert.ok(save(s));
});
test('a hired character deploys the authored firearm and keeps its definition on campaign reentry',()=>{
 let s=order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'visitSector'});
 let b=enterSector(s.pendingBattle);assert.equal(b.units[0].loaded,3);assert.equal(weaponFor(b.units[0]).name,'Pistola del Sur');
 let pair=save(s,b);s=order(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=order(save(s).campaign,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates[s.location]);
 assert.equal(weaponFor(save(s,b).battle.units[0]).contentId,'pistola-del-sur');
});
test('loot and repeated swaps conserve both variants, their loads, condition and images',()=>{
 let s=field(custom({damage:100}));const opponent=s.units[1];Object.assign(opponent,{hp:10,weapon:1805,weaponMetadata:weaponMetadata(custom({id:'enemy-pistol',name:'Pistola enemiga',capacity:4,weight:3,art:'/art/weapon-1808.png'})),loaded:4,condition:63,x:2,y:1});
 s=actBattle(s,{type:'fire',unitId:'p',targetId:'e'});assert.equal(s.units[1].hp,0);
 s=actBattle(s,{type:'loot',unitId:'p',targetId:'e',item:'weapon'});assert.equal(s.lastError,null);
 let key=Object.keys(s.units[0].inventory).find(k=>s.units[0].inventory[k].weapon===1805);assert.equal(s.units[0].inventory[key].loaded,4);
 s=actBattle(s,{type:'equipLoot',unitId:'p',inventoryKey:key});assert.equal(s.lastError,null);assert.equal(weaponFor(s.units[0]).name,'Pistola enemiga');assert.equal(s.units[0].condition,63);assert.equal(weaponFor(s.units[0]).art,'/art/weapon-1808.png');
 const count=u=>(u.weaponDropped?0:1)+Object.values(u.inventory).filter(i=>i.weapon).reduce((n,i)=>n+i.count,0);
 const charges=u=>u.loaded+Object.values(u.inventory).filter(i=>i.weapon).reduce((n,i)=>n+i.count*i.loaded,0);
 assert.equal(count(s.units[0]),2);assert.equal(charges(s.units[0]),6);
 key=Object.keys(s.units[0].inventory).find(k=>contentWeaponOf(s.units[0].inventory[k])?.id==='pistola-del-sur');s=actBattle(s,{type:'equipLoot',unitId:'p',inventoryKey:key});assert.equal(s.lastError,null);
 assert.equal(weaponFor(s.units[0]).contentId,'pistola-del-sur');assert.equal(count(s.units[0]),2);assert.equal(charges(s.units[0]),6);assert.ok(validateBattleSnapshot(s));
});
test('a gun taken in combat survives retreat, campaign save and redeployment',()=>{
 const d=content();d.weapons.find(w=>w.id==='pistola-del-sur').damage=100;d.characters.find(c=>c.id==='person-110').attributes.marksmanship=100;
 let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});secureArea(s,'buenos_aires');s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});
 // A compact combat fixture uses the real campaign deployment and return handlers.
 const request=s.pendingBattle,north=d.weapons.find(w=>w.id==='pistola-del-norte');
 // Declare this compact encounter and its finite ammunition before any tactical order.
 request.enemies=[{id:'guard',x:2,y:6,hp:10,weapon:north.template,weaponMetadata:weaponMetadata(north),loaded:3,condition:44},{id:'other',x:11,y:0,weapon:1800}];
 request.enemies=createBattle([],{width:12,height:8,enemies:request.enemies}).units;
 let b=createBattle(request.squad.map(u=>({...u,x:1,y:6})),{...request,width:12,height:8,id:request.id,sector:request.sector,npcs:request.npcs,seed:45,tiles:field().tiles,enemies:request.enemies});
 b=actBattle(b,{type:'fire',unitId:'110',targetId:'guard'});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id==='guard').hp,0);
 b=actBattle(b,{type:'loot',unitId:'110',targetId:'guard',item:'weapon'});assert.equal(b.lastError,null);
 const key=Object.keys(b.units[0].inventory).find(k=>k.startsWith('weapon:'));
 b=actBattle(b,{type:'equipLoot',unitId:'110',inventoryKey:key});assert.equal(b.lastError,null);
 const synced=syncBattleTime(s,b);assert.equal(synced.error,null);const pair=secondaryRetreat(synced);s=order(pair.campaign,{type:'battleResult',outcome:'retreat',battleId:request.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 s=save(s).campaign;assert.equal(contentWeaponOf(s.operativeState[110]).id,'pistola-del-norte');assert.equal(s.operativeState[110].condition,44);
 assert.equal(Object.values(s.operativeState[110].inventory).filter(i=>i.weapon&&i.count>0).length,1);
 s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates[s.location]);assert.equal(weaponFor(b.units.find(u=>u.id==='110')).name,'Pistola del Norte');assert.ok(save(s,b));
});
test('AI consumes the authored cost and a routed enemy leaves the exact gun on the ground',()=>{
 let b=field(),enemy=b.units[1];Object.assign(enemy,{weapon:1805,weaponMetadata:weaponMetadata(custom({fireAP:70,damage:1,capacity:4})),loaded:4,ammo:0});
 const playerHealth=b.units.find(u=>u.id==='p').hp;b=endTurn(b);enemy=b.units.find(u=>u.id==='e');assert.equal(enemy.loaded,3);assert.ok(enemy.ap<70);assert.ok(b.units.find(u=>u.id==='p').hp<playerHealth,'the enemy spends its authored firing cost and causes a real hit');
 b=field();Object.assign(b.units[1],{x:2,y:1,morale:16,weapon:1805,weaponMetadata:weaponMetadata(custom({id:'routed-gun',capacity:4})),loaded:4,condition:61,jammed:true});
 b=actBattle(b,{type:'fire',unitId:'p',targetId:'e'});assert.equal(b.lastError,null);assert.equal(b.units[1].routed,true);
 assert.equal(b.droppedWeapons.length,1);assert.equal(b.droppedWeapons[0].loaded,4);
 b=actBattle(b,{type:'loot',unitId:'p',dropIndex:0});assert.equal(b.lastError,null);
 const record=Object.values(b.units[0].inventory).find(i=>contentWeaponOf(i)?.id==='routed-gun');assert.equal(contentWeaponOf(record).id,'routed-gun');assert.equal(record.condition,61);assert.equal(record.jammed,true);assert.equal(record.loaded,4);assert.ok(validateBattleSnapshot(b));
});
test('custom weapon pictures are stored once and restore across all weapon copies',()=>{
 const d=content(),gun=d.weapons.find(w=>w.id==='pistola-del-sur');gun.art='data:image/png;base64,'+'A'.repeat(320000);
 for(const c of d.characters)c.weapon=gun.id;
 let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});s=withStoredGear(s,gun.id,3);
 const serialized=serializeCampaign(s);assert.ok(serialized.length<600000);assert.equal(contentWeaponOf(storedEquipmentStack(restoreCampaign(serialized).armoryItems[0])).art,gun.art);
 s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle),encoded=encodeSave(s,b);assert.equal(encoded.split(gun.art).length-1,1,'the uploaded picture is stored once, including larger sector geometry');
 const restored=decodeSave(encoded);assert.equal(weaponFor(restored.battle.units[0]).art,gun.art);assert.equal(contentWeaponOf(storedEquipmentStack(restored.campaign.armoryItems[0])).art,gun.art);
 const invalid=JSON.parse(encoded);invalid.battle.units[0].weaponMetadata.contentWeapon.definitionRef='missing-gun';assert.throws(()=>decodeSave(JSON.stringify(invalid)),/arma/);
});
test('saved definitions cannot diverge from the pinned package in hands, inventory, stock or battles',()=>{
 let s=order(initialCampaign(8,content()),{type:'recruitCivic',id:110,term:'week'});s=withStoredGear(s,'pistola-del-sur');
 for(const mutate of [v=>v.operativeState[110].weaponMetadata.contentWeapon.damage++,v=>v.operativeState[110].weaponMetadata.contentWeapon.materialRangeSlope=.5,v=>v.armoryItems[0].itemMetadata.contentWeapon.materialRangeSlope=.5,v=>v.armoryItems[0].itemMetadata.contentWeapon.template=1800,v=>v.armory['pistola-del-sur']++,v=>v.armoryItems[0].loaded=4]){const altered=structuredClone(s);mutate(altered);assert.throws(()=>save(altered));}
 s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle),altered=structuredClone(b);altered.units[0].weaponMetadata.contentWeapon.name='Otra arma';assert.throws(()=>save(s,altered),/arma guardada/);
 assert.equal(campaignContentReport(content()).blocked.length,0);
 const prepared=content();prepared.weapons[0].readyAP=2;assert.equal(campaignContentReport(prepared).blocked.length,0);
 for(const id of ['bronze4','field8','swivel'])assert.throws(()=>compileWeaponDefinition(custom({id})),/identidad/);
});

test('a character without a firearm and the mission ally remain valid after deployment and save',()=>{
 const d=content();for(const id of ['person-110','person-57'])d.characters.find(c=>c.id===id).weapon=null;
 let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});
 s.missionAllies.san_lorenzo={...sanLorenzoAlly(s),hp:100};assert.equal(s.missionAllies.san_lorenzo.weapon,0);assert.equal(s.missionAllies.san_lorenzo.loaded,0);
 s=order(save(s).campaign,{type:'visitSector'});const b=enterSector(s.pendingBattle);assert.equal(b.units[0].weapon,0);assert.equal(b.units[0].loaded,0);assert.ok(save(s,b));
 const ordinary=initialCampaign();ordinary.operativeState[110].weaponMetadata=weaponMetadata(custom());assert.throws(()=>save(ordinary),/arma/);
});
