import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {AMMUNITION_TYPES,ammunitionByType,totalReserveAmmunition} from '../game/ammunition-types.js';
import {LEGACY_AMMUNITION} from '../game/ammunition-families.js';
import {groupAmmunitionResources,groupAmmunitionCounts,groupSceneAmmunition} from '../game/ammunition-family-migration.js';
import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {migrateCampaignAmmunition,unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {rosterFor,dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
import {advanceMerchants} from '../game/equipment.js';
const oldStack=(ammoType,count,extra={})=>({kind:'ammunition',ammoType,count,name:LEGACY_AMMUNITION[ammoType].name,weight:.04,...extra});
const oldSave=()=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/ammunition-v1-save.json.gz',import.meta.url))).toString());

test('old lots, both hands, pocket partitions and cursor custody survive family grouping',()=>{
 const u={ammunitionVersion:1,weapon:1801,ammo:3,loaded:1,activeSlot:'item',activeItem:'inventory:lot-a',leftHandItem:'inventory:lot-a',pocketOrder:[{slotId:'small-4',item:'inventory:lot-a',index:0,count:1},{slotId:'small-6',item:'inventory:lot-b',index:0,count:5}],inventory:{'lot-a':oldStack('musket_69',3),'lot-b':oldStack('carbine_65',5,{name:'Lote de María',lot:{seal:9}}),'lot-c':oldStack('musket_75',2),'foreign':oldStack('pistol_50',4),musket_69:{name:'Documento',count:1,weight:0}},equipmentCursor:{sourceId:'small-7',stack:{item:'inventory:cursor',...oldStack('pistol_54',2)}}};
 const before=structuredClone(u);initializeUnitAmmunition(u);
 assert.equal(u.ammunitionVersion,2);assert.equal(u.loaded,1);assert.equal(u.ammo,10);assert.deepEqual(ammunitionByType(u),{musket_75:10,pistol_69:4});
 assert.deepEqual(Object.keys(u.inventory),Object.keys(before.inventory));assert.equal(u.inventory['lot-a'].name,AMMUNITION_TYPES.musket_75.name);assert.deepEqual(u.inventory['lot-b'],{...before.inventory['lot-b'],ammoType:'musket_75'});assert.deepEqual(u.inventory.musket_69,before.inventory.musket_69);
 assert.equal(u.activeItem,before.activeItem);assert.equal(u.leftHandItem,before.leftHandItem);assert.deepEqual(u.pocketOrder,before.pocketOrder);
 assert.equal(u.equipmentCursor.stack.item,before.equipmentCursor.stack.item);assert.equal(u.equipmentCursor.stack.ammoType,'pistol_69');assert.equal(u.equipmentCursor.stack.count,2);assert.equal(totalReserveAmmunition(u),14);
 const once=structuredClone(u);initializeUnitAmmunition(u);assert.deepEqual(u,once);
});

test('physical field lots and sparse settlement receipts group without moving owners or changing totals',()=>{
 const scene={groundItems:[{id:'ground',item:'inventory:ammo:carbine_65',...oldStack('carbine_65',4)}],props:[{contents:[oldStack('pistol_50',3)]}],tiles:[{questGifts:[oldStack('scatter',2)]}],npcs:[{questGifts:[oldStack('musket_69',5)]}],issuedAmmunition:{musket_75:4,musket_69:3,carbine_65:2},fieldAmmunition:{pistol_50:3,pistol_54:2},returnLedger:{creditedAmmunition:{shot_16:2,scatter:4}},ammunitionSources:[{ammunitionByType:{musket_69:2,carbine_65:1}}]};
 groupSceneAmmunition(scene);assert.equal(scene.groundItems[0].item,'inventory:ammo:carbine_65');assert.equal(scene.groundItems[0].count,4);assert.equal(scene.groundItems[0].ammoType,'musket_75');assert.equal(scene.props[0].contents[0].ammoType,'pistol_69');assert.equal(scene.tiles[0].questGifts[0].ammoType,'shot_16');assert.equal(scene.npcs[0].questGifts[0].count,5);
 assert.deepEqual(scene.issuedAmmunition,{musket_75:9});assert.deepEqual(scene.fieldAmmunition,{pistol_69:5});assert.deepEqual(scene.returnLedger.creditedAmmunition,{shot_16:6});assert.deepEqual(scene.ammunitionSources[0].ammunitionByType,{musket_75:3});
});

test('an actual version-one campaign and active sector migrate once with all finite stock intact',()=>{
 const wire=oldSave(),text=JSON.stringify(wire),loaded=decodeSave(text),s=loaded.campaign,b=loaded.battle;
 assert.equal(wire.campaign.ammunitionVersion,1);assert.equal(s.ammunitionVersion,2);assert.equal(b.ammunitionVersion,2);
 assert.equal(s.resources.cartridges,170);assert.equal(s.resources.ammo_rifle_62,30);assert.equal(s.resources.ammo_pistol_69,50);assert.equal(s.resources.ammo_shot_16,40);assert.equal(s.resources.ammo_musket_69,undefined);
 assert.equal(s.resources.treasury,wire.campaign.resources.treasury);assert.deepEqual(s.merchants.retiro.ammunition,{musket_75:180,rifle_62:60,pistol_69:180,shot_16:120});
 assert.deepEqual(unitAmmunitionByType(b.units[0]),{musket_75:10});assert.equal(b.units[0].loaded,wire.battle.units[0].loaded);
 assert.deepEqual(decodeSave(encodeSave(s,b)),loaded);assert.equal(JSON.stringify(wire),text);
 const stock=structuredClone(s.merchants.retiro.ammunition);for(let h=0;h<48;h++)advanceMerchants(s,()=>true);assert.deepEqual(s.merchants.retiro.ammunition,stock,'daily restock never truncates migrated stock');
});

test('campaign migration includes depots, paid work, transport and blocked delivery receipts',()=>{
 const {campaign:s}=oldSave();s.pendingBattle=null;
 s.depots.retiro={cartridges:2,ammo_musket_69:3,ammo_carbine_65:4};
 s.production=[{yield:{ammo_pistol_50:10}}];s.shipments=[{goods:{ammo_scatter:7}}];s.convoys=[{goods:{ammo_pistol_54:3,ammo_pistol_69:2}}];
 const event={kind:'shipment',sector:'ensenada',goods:{ammo_scatter:7}},binding=JSON.stringify([0,0,event,null]);s.logisticsAttention={version:1,reported:{[binding]:'blockade'}};s.logisticsNotice={events:[{...event,state:'blocked',code:'blockade'}]};
 const pinned={package:{item:'ammo_scatter',inventory:{pistol_50:'ordinary text'}}};s.contentCampaign=pinned;
 migrateCampaignAmmunition(s,rosterFor(s));assert.deepEqual(s.depots.retiro,{cartridges:9});assert.deepEqual(s.production[0].yield,{ammo_pistol_69:10});assert.deepEqual(s.shipments[0].goods,{ammo_shot_16:7});assert.deepEqual(s.convoys[0].goods,{ammo_pistol_69:5});
 assert.deepEqual(s.logisticsNotice.events[0].goods,{ammo_shot_16:7});assert.deepEqual(JSON.parse(Object.keys(s.logisticsAttention.reported)[0])[2].goods,{ammo_shot_16:7});assert.equal(s.contentCampaign,pinned);
 const once=structuredClone(s);migrateCampaignAmmunition(s,rosterFor(s));assert.deepEqual(s,once);
});

test('malformed old stock and missing versions cannot become valid by grouping',()=>{
 for(const mutate of [w=>delete w.campaign.resources.ammo_musket_69,w=>w.campaign.resources.ammo_pistol_50=-1,w=>delete w.campaign.merchants.retiro.ammunition.scatter,w=>w.campaign.merchants.retiro.ammunition.pistol_50=61,w=>w.campaign.operativeState[110].carriedAmmo=999,w=>delete w.campaign.pendingBattle.squad[0].ammunitionVersion,w=>w.battle.units[0].ammo=999,w=>delete w.battle.units[0].ammunitionVersion,w=>Object.assign(w.battle.units[0],{activeSlot:'item',activeItem:'inventory:missing'})]){
  const wire=oldSave();mutate(wire);assert.throws(()=>decodeSave(JSON.stringify(wire)));
 }
 const valid=decodeSave(JSON.stringify(oldSave())),bad=JSON.parse(encodeSave(valid.campaign,valid.battle));bad.battle.units[0].inventory.forged=oldStack('musket_69',3);assert.throws(()=>decodeSave(JSON.stringify(bad)),'version two cannot smuggle retired type aliases');
 const counts={pistol_50:3,pistol_69:-1},before=structuredClone(counts);assert.throws(()=>groupAmmunitionCounts(counts));assert.deepEqual(counts,before);assert.throws(()=>groupAmmunitionResources({ammo_scatter:Infinity}));
});


test('a migrated active sector can return, save and reenter without a second issue of cartridges',()=>{
 let {campaign:s,battle:b}=decodeSave(JSON.stringify(oldSave()));const stock=structuredClone(s.resources),reserve=unitAmmunitionByType(b.units[0]);
 const pair=syncBattleTime(s,b);assert.equal(pair.error,null);
 s=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(s.lastError,null);assert.deepEqual(s.resources,stock);
 s=decodeSave(encodeSave(s)).campaign;s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);
 b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.deepEqual(unitAmmunitionByType(b.units[0]),reserve);assert.deepEqual(s.resources,stock);assert.deepEqual(decodeSave(encodeSave(s,b)),{campaign:s,battle:b});
});

test('old battle source receipts remain totals and do not require or gain physical inventories',()=>{
 const {campaign:s}=oldSave();
 for(const key of ['ammunitionSources','garrisonLootSources','casualtyLootSources'])s.pendingBattle[key]=[{id:`source-${key}`,side:'enemy',weapon:1801,loaded:1,ammo:4,ammunitionByType:{musket_69:5,carbine_65:3}}];
 migrateCampaignAmmunition(s,rosterFor(s));
 for(const key of ['ammunitionSources','garrisonLootSources','casualtyLootSources']){const source=s.pendingBattle[key][0];assert.deepEqual(source.ammunitionByType,{musket_75:8});assert.equal(source.inventory,undefined);assert.equal(source.ammunitionVersion,undefined);}
});
