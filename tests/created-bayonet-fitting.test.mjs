import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../campaigns/granaderos/manifest.json' with {type:'json'};
import assets from '../campaigns/granaderos/assets.json' with {type:'json'};
import {DEFAULT_WORLD,DEFAULT_MAPS,DEFAULT_PRESENTATION} from '../campaigns/default.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {validateOfficerCreation} from '../game/campaign-officer-creation.js';
import {actBattle,carriedWeight} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {fittingInventoryModel} from '../game/ja2-hud.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const answers={origin:'estancia',doctrine:'line_marksman',crisis:'rally',specialty:'night',temperament:'steady'};
const installed=(presentation=DEFAULT_PRESENTATION)=>compileCampaignPackage(manifest,{content:defaultContentPackage(),world:DEFAULT_WORLD,maps:DEFAULT_MAPS,presentation,assets});
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(battle,action)=>{const next=actBattle(battle,{unitId:'1000',...action});assert.equal(next.lastError,null,next.lastError);return next;};
const create=(content=null,classId='soldado')=>order(initialCampaign(1812,content),{type:'createOfficer',name:'Manuel Rojas',answers,profile:{...defaultProfile(content),classId}});
const officer=battle=>battle.units.find(unit=>unit.id==='1000');
function saveAction(campaign,battle){
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null,synced.error);
 return decodeSave(encodeSave(synced.campaign,synced.battle));
}

test('a newly created line soldier receives one matched bayonet that can fit, save, return and be removed',()=>{
 for(const content of [null,installed()]){
  let campaign=create(content);
  const issued=campaign.operativeState[1000],identity=issued.bladeInstanceId;
  assert.equal(issued.bladeFittingPattern,'india_socket');assert.ok(identity);assert.equal(campaign.nextEquipmentInstanceId,2);
  assert.equal(campaign.resources.treasury,initialCampaign(1812,content).resources.treasury);
  campaign=order(campaign,{type:'visitSector'});let battle=enterSector(campaign.pendingBattle);
  const unit=officer(battle),weight=carriedWeight(unit),ammunition={loaded:unit.loaded,ammo:unit.ammo};
  assert.equal(unit.weapon,1800);assert.equal(unit.blade,1811);
  const source=fittingInventoryModel(battle,unit).sources.find(item=>item.item==='blade');
  assert.equal(source.label,'Bayoneta para Brown Bess India');assert.equal(source.preview.valid,true,source.preview.reason);
  battle=act(battle,{type:'fitBayonet',item:'blade'});
  assert.equal(officer(battle).blade,undefined);assert.equal(officer(battle).weaponFittings.bayonet.instanceId,identity);
  assert.equal(carriedWeight(officer(battle)),weight);assert.deepEqual({loaded:officer(battle).loaded,ammo:officer(battle).ammo},ammunition);
  ({campaign,battle}=saveAction(campaign,battle));
  campaign=order(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
  campaign=decodeSave(encodeSave(campaign)).campaign;
  assert.equal(campaign.operativeState[1000].weaponFittings.bayonet.instanceId,identity);
  assert.equal(rosterFor(campaign).find(u=>u.id===1000).blade,0);
  campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
  battle=act(battle,{type:'removeBayonet',destination:'blade'});
  ({campaign,battle}=saveAction(campaign,battle));
  assert.equal(officer(battle).bladeInstanceId,identity);assert.equal(officer(battle).bladeFittingPattern,'india_socket');
  assert.deepEqual(officer(battle).weaponFittings,{});assert.equal(carriedWeight(officer(battle)),weight);
  assert.equal(campaign.nextEquipmentInstanceId,2,'fit, remove and re-entry do not issue another item');
 }
});

test('old officers, unmarked authored classes and ordinary recruits do not gain matching fittings',()=>{
 const old=create();old.operativeState[1000].bladeFittingPattern=null;delete old.operativeState[1000].bladeInstanceId;old.nextEquipmentInstanceId=1;
 let restored=decodeSave(encodeSave(old)).campaign;
 assert.equal(restored.operativeState[1000].bladeFittingPattern,null);assert.equal(restored.operativeState[1000].bladeInstanceId,undefined);
 restored=order(restored,{type:'visitSector'});const battle=enterSector(restored.pendingBattle),denied=actBattle(battle,{type:'fitBayonet',unitId:'1000',item:'blade'});
 assert.match(denied.lastError,/no corresponde/);assert.deepEqual(denied.units,battle.units);
 const presentation=structuredClone(DEFAULT_PRESENTATION);delete presentation.officerCreation.classes.find(c=>c.id==='soldado').bladeFittingPattern;
 assert.equal(create(installed(presentation)).operativeState[1000].bladeFittingPattern,null);
 for(const classId of ['gaucho','baqueano','artesano'])assert.equal(create(null,classId).operativeState[1000].bladeFittingPattern,null);
 const stock=initialCampaign(1812,installed());for(const id of [114,123])assert.equal(stock.operativeState[id].bladeFittingPattern,null);
});

test('authored starting patterns require the correct blade and host and do not weaken tactical matching',()=>{
 for(const patch of [{bladeFittingPattern:'unknown'},{bladeFittingPattern:'__proto__'},{weapon:'firearm-1802'},{blade:'blade-1813'}]){
  const presentation=structuredClone(DEFAULT_PRESENTATION);Object.assign(presentation.officerCreation.classes.find(c=>c.id==='soldado'),patch);
  assert.ok(validateOfficerCreation(presentation.officerCreation,defaultContentPackage()).length>0);
  assert.throws(()=>installed(presentation),/clases|equipo/i);
 }
 let campaign=create();campaign=order(campaign,{type:'visitSector'});const battle=enterSector(campaign.pendingBattle);
 officer(battle).weapon=1802;syncUnitAmmunition(officer(battle));
 const denied=actBattle(battle,{type:'fitBayonet',unitId:'1000',item:'blade'});
 assert.match(denied.lastError,/no corresponde/);assert.deepEqual(denied.units,battle.units);
});

test('loose authored packages can remap default weapon IDs without inheriting a stock fitting',()=>{
 for(const presentation of [undefined,{version:1,title:'Equipo propio',officerCreation:{registry:'Mis combatientes'}}]){
  const content=defaultContentPackage();if(presentation)content.presentation=presentation;else delete content.presentation;
  content.weapons.find(w=>w.id==='firearm-1800').template=1801;
  assert.deepEqual(validateContentPackage(content),[]);
  const campaign=create(content),record=campaign.operativeState[1000];
  assert.equal(rosterFor(campaign).find(unit=>unit.id===1000).weapon,1801);
  assert.equal(record.bladeFittingPattern,null);assert.equal(record.bladeInstanceId,undefined);
  assert.equal(campaign.nextEquipmentInstanceId,1);assert.doesNotThrow(()=>decodeSave(encodeSave(campaign)));
 }
});
