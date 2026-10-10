import {ROUTE_STARTING_TREASURY} from './funded-route-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {enterSector} from '../game/world.js';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,deploymentCost} from '../game/campaign.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {fight as cautiousFight} from './cuyo-route-driver.mjs';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint,tacticalLevel} from '../game/tactical-space.js';
import {doctorRate} from '../game/medical-care.js';
import {careRules} from '../game/campaign-care-rules.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {worldOwner} from '../game/world-cells.js';
import {collectPhysicalCacheItems} from './finite-care-cache.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {visit as visitLocalRoute} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {collectRouteItems,collectRouteMedicalSupplies,discoverRouteCache,recoverRouteFirearm} from './finite-route-equipment.mjs';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {travelLegHours} from '../game/squad-travel.js';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';

// Starts from a declared funded Retiro-only campaign. Checkpoints are outputs of
// ordinary orders, never authored victories or granted territory.
export function beginFreshCampaign({seed=8,report=()=>{}}={}){
 let campaign=initialCampaign(seed);campaign.resources.treasury=ROUTE_STARTING_TREASURY;const orders=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;orders.push(action);};
 assert.deepEqual(campaign.recruited,[]);
 assert.deepEqual(Object.keys(campaign.sectors).filter(id=>campaign.sectors[id].owner==='patriot'),['retiro']);
 for(const id of [110,114,115,123,137,107])order({type:'recruitCivic',id,term:'week'});
 campaign=collectPhysicalCacheItems(campaign,107,{item:'medkits'},6).campaign;
 campaign=supplyRouteAmmunition(campaign,campaign.squad).campaign;
 // The fresh acceptance route is a daylight assault. Cache work can retain
 // seconds, so spend the precise remaining wait through the normal clock.
 const departure=12*3600-travelLegHours(campaign.location,'buenos_aires')*3600;
 const waitSeconds=departure-campaign.hour*3600-(campaign.secondOfHour??0);
 assert.ok(Number.isSafeInteger(waitSeconds)&&waitSeconds>=0);
 while(campaign.hour*3600+(campaign.secondOfHour??0)<departure){
  const remaining=departure-campaign.hour*3600-(campaign.secondOfHour??0);
  if(remaining>=3600)order({type:'wait',hours:Math.floor(remaining/3600)});
  else order({type:'advanceStrategicTime',seconds:remaining});
 }
 order({type:'attack',sector:'buenos_aires'});
 assert.equal(campaign.hour*3600+(campaign.secondOfHour??0),12*3600);
 const request=structuredClone(campaign.pendingBattle);
 report({event:'battleStarted',sector:request.sector,hour:campaign.hour,treasury:campaign.resources.treasury});
 // Advance in short bounds, keep available cover and select observed body
 // regions through the actual cursor previews before spending a loaded shot.
 let {battle,actions}=cautiousFight(request,undefined,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true});
 assert.equal(battle.status,'victory','The fresh route must earn Buenos Aires through legal combat.');
 battle=actBattle(battle,{type:'explore'});assert.equal(battle.lastError,null);
 const aid=autoBandageBattle(battle);battle=aid.battle;
 const synchronized=syncBattleTime(campaign,battle);assert.equal(synchronized.error,null);
 const saved=decodeSave(encodeSave(synchronized.campaign,synchronized.battle));campaign=saved.campaign;battle=saved.battle;
 order({type:'battleResult',battleId:request.id,outcome:battle.status==='active'?'victory':battle.status,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 const casualties=battle.units.filter(u=>u.side==='player'&&!u.militia&&u.hp<=0).map(u=>Number(u.id));
 for(const id of casualties)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.sectors.buenos_aires.owner,'patriot');assert.ok(campaign.resources.treasury>=0);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshCapitalCaptured',hour:campaign.hour,actions,casualties,untreated:aid.untreated,treasury:campaign.resources.treasury});
 return {campaign,orders,casualties,actions};
}

export function recoverFreshCapital(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;};
 const dead=Object.entries(campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 assert.equal(campaign.location,'buenos_aires');
 // The opening can kill its original medic. Hire a living replacement rather
 // than resurrecting that fixed ID or assuming the previous route's survivors.
 const doctor=[107,116].find(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].hp>=15);
 assert.ok(doctor,'a living physician must be available for paid recovery');
 if(!campaign.recruited.includes(doctor))order({type:'recruitCivic',id:doctor,term:'week'});
 const rate=doctorRate(rosterFor(campaign).find(unit=>unit.id===doctor));
 const requiredDressings=Math.max(10,campaign.squad.reduce((total,id)=>{
  const patient=campaign.operativeState[id];
  return total+(id!==doctor&&patient.alive?Math.ceil((patient.maxHp-patient.hp)/rate):0);
 },0));
 // Recover the finite dressings left with the fallen squad in this secured
 // sector, then open its real finite cache if those dressings are insufficient.
 const dressings=sectorInventoryModel(campaign,'buenos_aires',rosterFor(campaign),doctor).entries;
 for(const source of dressings.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(source.count,requiredDressings-campaign.operativeState[doctor].medkits);if(count<=0)break;
  order({type:'sectorInventory',sector:'buenos_aires',operativeId:doctor,direction:'take',sourceKey:source.key,expected:source.expected,count});
 }
 if(campaign.operativeState[doctor].medkits<requiredDressings){
  campaign=collectPhysicalCacheItems(campaign,doctor,{item:'medkits'},requiredDressings-campaign.operativeState[doctor].medkits).campaign;
 }
 // A sole surviving medic still needs another person to treat her wounds.
 let treatingDoctor=doctor;
 if(campaign.operativeState[doctor].hp<campaign.operativeState[doctor].maxHp){
  treatingDoctor=116;
  if(!campaign.recruited.includes(treatingDoctor))order({type:'recruitCivic',id:treatingDoctor,term:'week'});
  // The wounded doctor's collected stock remains real personal equipment.
  // Hand it to the treating physician before drawing another finite cache.
  if(treatingDoctor!==doctor&&campaign.operativeState[doctor].medkits){
   const count=campaign.operativeState[doctor].medkits,before=campaign.operativeState[treatingDoctor].medkits;
   order({type:'sectorInventory',sector:'buenos_aires',operativeId:doctor,direction:'drop',item:'medkits',count});
   let remaining=count;
   while(remaining){const row=sectorInventoryModel(campaign,'buenos_aires',rosterFor(campaign),treatingDoctor).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'the treating physician can collect the donated finite dressings');const quantity=Math.min(remaining,row.count);order({type:'sectorInventory',sector:'buenos_aires',operativeId:treatingDoctor,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity});remaining-=quantity;}
   assert.equal(campaign.operativeState[doctor].medkits,0);assert.equal(campaign.operativeState[treatingDoctor].medkits,before+count);
   report({event:'freshCapitalMedicalDonation',donor:doctor,doctor:treatingDoctor,count});
  }
  const treatingRate=doctorRate(rosterFor(campaign).find(unit=>unit.id===treatingDoctor),campaign),needed=Math.max(10,campaign.squad.reduce((sum,id)=>{const patient=campaign.operativeState[id];return sum+(id!==treatingDoctor&&patient.alive?Math.ceil((patient.maxHp-patient.hp)/treatingRate)+Number(patient.bleeding>0):0);},0));
  if(campaign.operativeState[treatingDoctor].medkits<needed)campaign=collectPhysicalCacheItems(campaign,treatingDoctor,{item:'medkits'},needed-campaign.operativeState[treatingDoctor].medkits).campaign;
 }
 const patients=campaign.squad.filter(id=>id!==treatingDoctor&&campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 const before=campaign.operativeState[treatingDoctor].medkits;
 order({type:'assignCare',operativeId:treatingDoctor,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let hours=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&hours<48;hours++){
  assert.equal(campaign.pendingEncounter,null,'an actual encounter must be resolved before continuing recovery');
  if(!campaign.operativeState[treatingDoctor].medkits)campaign=collectPhysicalCacheItems(campaign,treatingDoctor,{item:'medkits'},1).campaign;
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 assert.ok(!patients.length||campaign.operativeState[treatingDoctor].medkits<before);
 for(const operativeId of [treatingDoctor,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 // Reuse recovered veterans and their finite clothing before buying more
 // replacements. The chosen doctor occupies the sixth field position.
 const field=[...[110,115,123,131,113,124,136,134].filter(id=>id!==doctor&&campaign.operativeState[id].alive).slice(0,5),doctor],cash=campaign.resources.treasury;
 for(const id of field)if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});
 order({type:'squad',ids:field});
 if(!campaign.flags.academy)order({type:'academy'});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const until=campaign.hour+6;while(campaign.hour<until)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires),field);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 const support=[114,116,119,127,141,104,121,110,115,123,124,136,134].filter(id=>campaign.operativeState[id].alive&&!field.includes(id)).slice(0,6),clothingTransfers=[],clothingRecoveries=[];
 for(const operativeId of field.filter(id=>!campaign.operativeState[id].outfit)){
  const model=()=>sectorInventoryModel(campaign,'buenos_aires',rosterFor(campaign),operativeId);
  const available=()=>model().entries.find(row=>{const item=JSON.parse(row.expected);return row.reachable&&item.item==='outfit'&&item.outfit==='poncho';});
  let outfit=available();
  if(!outfit){
   // Fewer opening casualties leave more garments with living veterans. Move
   // an actual support recruit's poncho through the sector's finite ground pool.
   const donor=support.find(id=>campaign.recruited.includes(id)&&campaign.operativeState[id].location==='buenos_aires'&&campaign.operativeState[id].outfit?.outfit==='poncho');
   if(donor!==undefined){
    const garment=structuredClone(campaign.operativeState[donor].outfit);
    order({type:'sectorInventory',sector:'buenos_aires',operativeId:donor,direction:'drop',item:'outfit',count:1});
    outfit=available();assert.ok(outfit,'the donated garment must be physically reachable');
    clothingTransfers.push({sourceId:donor,receiverId:operativeId,garment});
   }
  }
  if(!outfit)continue;
  clothingRecoveries.push({sourceKey:outfit.key,expected:outfit.expected,receiverId:operativeId});
  order({type:'sectorInventory',sector:'buenos_aires',operativeId,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});
  const carried=model().carried.find(row=>row.equip?.some(option=>option.slot==='outfit'));
  assert.ok(carried);order({type:'sectorInventory',sector:'buenos_aires',operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});
 }
 report({event:'freshEquipmentRecovery',transfers:salvage.transfers,unfilled:salvage.unfilled,clothingTransfers,clothingRecoveries});
 const fieldSquad=campaign.activeSquadId;
 assert.equal(support.length,6,'six living recruits must be available for the paid support squad');
 for(const id of support)if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});
 order({type:'createSquad',name:'Apoyo de la marcha',ids:support});const supportSquad=campaign.activeSquadId;
 for(const operativeId of support)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'visitSector'});
 const supportSalvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires),support);
 const supportTime=syncBattleTime(campaign,supportSalvage.battle);assert.equal(supportTime.error,null);campaign=supportTime.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:supportTime.battle,survivors:supportTime.battle.units.filter(u=>u.side==='player')});
 order({type:'selectSquad',id:fieldSquad});
 campaign=meetLocalIncomeRepresentative(campaign,{sourceId:'buenos_aires',report});
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshCapitalRecovery',hour:campaign.hour,patients,field,treasury:campaign.resources.treasury,paid:cash-campaign.resources.treasury});
 return {campaign,patients,field,support,fieldSquad,supportSquad};
}

export function prepareFreshNorthernAssault(prepared,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(prepared.campaign)).campaign;
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;};
 const squads=[prepared.fieldSquad,prepared.supportSquad];
 const ids=new Set(squads.flatMap(id=>campaign.squads.find(squad=>squad.id===id).members));
 // The current local provider supplies the actual recovered guns of both squads.
 campaign=supplyRouteAmmunition(campaign,[...ids],{report}).campaign;
 for(const id of squads){order({type:'selectSquad',id});campaign=finishReloadsBeforeMarch(campaign,{report});}
 const departureDelay=(6-((campaign.hour+12)%24)+24)%24;
 for(let i=0;i<departureDelay;i++)order({type:'wait',hours:1});
 for(const id of squads){order({type:'selectSquad',id});order({type:'attack',sector:'san_nicolas',queue:true});}
 const ready=()=>squads.every(id=>campaign.squads.find(q=>q.id===id)?.journey?.status==='ready');
 for(let i=0;i<24&&!ready();i++)order({type:'wait',hours:1});
 assert.ok(ready());assert.equal(campaign.pendingEncounter,null);
 order({type:'beginAssault',sector:'san_nicolas'});
 assert.equal(campaign.pendingBattle.squad.length,12);
 report({event:'freshJointAssault',hour:campaign.hour,sector:campaign.pendingBattle.sector,treasury:campaign.resources.treasury});
 return campaign;
}

// Replace actual northern losses with affordable paid hires and recover only
// equipment physically left on the cleared battlefield.
export function prepareFreshSanLorenzo(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const dead=Object.entries(campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;};
 assert.equal(campaign.sectors.san_nicolas.owner,'patriot');
 const field=[120,111,125,103,140,112],cash=campaign.resources.treasury;
 // Book the surviving clinic physician through the next northern operation
 // before signing her authored rival. Later renewal keeps its real refusal.
 let retainedPhysicianExtension=0;
 if(campaign.recruited.includes(107)&&campaign.operativeState[107].alive&&!campaign.recruited.includes(112)){
  const contract=campaign.contracts[107],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===107),'fortnight'),before=campaign.resources.treasury,expiry=contractExpiresSeconds(contract);
  assert.ok(quote.available,quote.reason);assert.ok(expiry>campaign.hour*3600+(campaign.secondOfHour??0));
  order({type:'renewContract',id:107,term:'fortnight',expectedExpiresAt:contract.expiresAt});
  retainedPhysicianExtension=before-campaign.resources.treasury;assert.equal(retainedPhysicianExtension,quote.price);
  assert.equal(contractExpiresSeconds(campaign.contracts[107]),expiry+quote.hours*3600);
 }
 for(const id of field){assert.ok(campaign.operativeState[id].alive);if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});}
 order({type:'squad',ids:field});const ammunitionCost=deploymentCost(campaign);order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),field);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 let recovered=0;
 const inventory=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),112);
 for(const row of inventory.entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(row.count,10-recovered);if(!count)break;
  order({type:'sectorInventory',sector:'san_nicolas',operativeId:112,direction:'take',sourceKey:row.key,expected:row.expected,count});recovered+=count;
 }
 // Share the real recovered cartridge stock between both mission squads.
 // Six total rounds per firearm fit this field plan without buying a shortage.
 campaign=supplyRouteAmmunition(campaign,field,{target:6,report}).campaign;
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshSanLorenzoPreparation',hour:campaign.hour,field,paid:cash-campaign.resources.treasury,retainedPhysicianExtension,ammunitionCost,recoveredDressings:recovered,transfers:salvage.transfers,unfilled:salvage.unfilled});
 return campaign;
}

export function prepareFreshMissionSupport(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const dead=Object.entries(campaign.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;};
 const main=campaign.activeSquadId,cash=campaign.resources.treasury;
 // San Nicolás can leave paid veterans available. Reuse conscious local
 // survivors before recruiting a second set of soldiers we cannot afford.
 const support=rosterFor(campaign).filter(unit=>{
  const record=campaign.operativeState[unit.id];
  return campaign.recruited.includes(unit.id)&&!campaign.squad.includes(unit.id)&&record.alive&&!record.captured&&!record.unconscious&&!record.routed&&record.hp>=15&&record.location===campaign.location&&campaign.contracts[unit.id]?.expiresAt>campaign.hour;
 }).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).slice(0,6).map(unit=>unit.id);
 for(const id of [136,100,101,102,108,130]){
  if(support.length===6)break;
  if(!support.includes(id)&&!campaign.squad.includes(id)&&campaign.operativeState[id].alive&&!campaign.operativeState[id].captured)support.push(id);
 }
 assert.equal(support.length,6,'six living soldiers must be available for mission support');
 for(const id of support){assert.ok(campaign.operativeState[id].alive);if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});}
 order({type:'createSquad',ids:support,name:'Apoyo de San Lorenzo'});const second=campaign.activeSquadId;
 report({event:'supportDeployment',ammunitionCost:deploymentCost(campaign)});
 order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),support);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 for(const id of [main,second]){order({type:'selectSquad',id});campaign=supplyRouteAmmunition(campaign,campaign.squad,{target:6,report}).campaign;campaign=finishReloadsBeforeMarch(campaign,{report});}
 // Approach the convent in daylight after both squads finish loading.
 order({type:'wait',hours:2});
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshMissionSupport',hour:campaign.hour,paid:cash-campaign.resources.treasury,treasury:campaign.resources.treasury,transfers:salvage.transfers,unfilled:salvage.unfilled});
 return {campaign,squads:[main,second]};
}

// Keep the surviving doctors with the advance. All participants travel through
// ordinary queued squad orders; no new soldiers or supplies are injected.
export function prepareFreshCordobaAssault(start,doctors,{report=()=>{}}={}){
 let campaign=finishReloadsBeforeMarch(decodeSave(encodeSave(start)).campaign);
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);};
 const field=campaign.activeSquadId;
 order({type:'createSquad',name:'Socorro de Córdoba',ids:doctors});
 const support=campaign.activeSquadId,squads=[field,support];
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of [117,121,126,129,133,130]){
  if(campaign.squad.length>=6)break;
  if(campaign.recruited.includes(id)||!campaign.operativeState[id].alive||campaign.operativeState[id].captured)continue;
  order({type:'recruitCivic',id,term:'week'});
 }
 assert.equal(campaign.squad.length,6,'Córdoba support uses six living paid recruits, never a fallen soldier');
 order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),campaign.squad);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'active'});
 // Earlier recovery can leave intact rifles on the ground after the enemy
 // bodies have been looted. Use those actual records for the travelling
 // physicians before asking the exhausted pistol cache for more cartridges.
 for(const operativeId of doctors){
  const primary=sectorInventoryModel(campaign,campaign.location,rosterFor(campaign),operativeId).personal;
  if(primary.weaponDropped||![1800,1801,1802,1803].includes(primary.weapon)){
   // The completed convent remains physically accessible from San Nicolás.
   // Field survivors may already own the town's last long guns. Give the
   // physicians an actually observed convent musket and keep their pistols.
   const model=()=>sectorInventoryModel(campaign,'san_lorenzo',rosterFor(campaign),operativeId),source=model().entries.find(row=>row.reachable&&[1800,1801,1803].includes(JSON.parse(row.expected).weapon));
   if(source){
    const keys=new Set(Object.keys(model().personal.inventory??{})),incoming=JSON.parse(source.expected),cash=campaign.resources.treasury;
    order({type:'sectorInventory',sector:'san_lorenzo',operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
    const gun=model().carried.find(row=>!keys.has(row.inventoryKey)&&row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(gun);
    order({type:'sectorInventory',sector:'san_lorenzo',operativeId,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
    assert.equal(campaign.resources.treasury,cash);assert.equal(model().entries.find(row=>row.key===source.key)?.count??0,source.count-1);
    report({event:'finiteCordobaMedicalArmament',operativeId,sector:'san_lorenzo',sourceKey:source.key,weapon:incoming.weapon});
   }else campaign=recoverRoutePrimary(campaign,operativeId,{replace:true,required:false,report});
  }
 }
 const deploying=squads.flatMap(id=>campaign.squads.find(squad=>squad.id===id).members);
 campaign=supplyRouteAmmunition(campaign,deploying,{report}).campaign;
 for(const id of deploying){
  while(campaign.contracts[id]?.expiresAt!=null&&campaign.contracts[id].expiresAt-campaign.hour<=24)order({type:'renewContract',id,term:'day',expectedExpiresAt:campaign.contracts[id].expiresAt});
 }
 for(const id of squads){order({type:'selectSquad',id});campaign=finishReloadsBeforeMarch(campaign);}
 for(const id of squads){order({type:'selectSquad',id});order({type:'attack',sector:'cordoba',queue:true});}
 const ready=()=>squads.every(id=>campaign.squads.find(s=>s.id===id)?.journey?.status==='ready');
 for(let i=0;i<24&&!ready();i++)order({type:'wait',hours:1});
 assert.ok(ready());assert.equal(campaign.pendingEncounter,null);
 order({type:'beginAssault',sector:'cordoba'});
 assert.equal(campaign.pendingBattle.squad.length,12);
 for(const unit of campaign.pendingBattle.squad){assert.ok(!unit.weaponDropped,`soldier ${unit.id} must recover a firearm before departure`);assert.ok(unit.loaded>0&&unit.ammo>0,`soldier ${unit.id} needs a loaded firearm and compatible reserve ammunition`);}
 return campaign;
}

// Care continues at each survivor's actual location. The approaching royalist
// force still has to be defeated by the paid local garrison before time resumes.
export function recoverFreshCordobaSurvivors(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 // Stop urgent wounds before equipment collection or walking to the roof.
 // Strategic treatment uses the same local doctors, dressings and paid time.
 const urgent=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba'&&(r.bleeding>0||r.hp<15);});
 const aidOrder=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 for(let hour=0;hour<24&&urgent().length;hour++){
  assert.equal(c.pendingEncounter,null);
  const patients=urgent(),physicians=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='cordoba'&&!patients.includes(op.id)&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical).slice(0,patients.length);
  assert.ok(physicians.length,'urgent wounds need an available local physician');
  for(const operativeId of patients)aidOrder({type:'assignCare',operativeId,assignment:'patient'});
  for(const op of physicians){if(!c.operativeState[op.id].medkits)c=collectRouteItems(c,op.id,{item:'medkits'},1).campaign;aidOrder({type:'assignCare',operativeId:op.id,assignment:'doctor'});}
  for(const id of [...patients,...physicians.map(op=>op.id)]){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)aidOrder({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  aidOrder({type:'wait',hours:1});
  for(const id of patients)assert.ok(c.operativeState[id].alive,`urgent care must preserve patient ${id}`);
 }
 assert.deepEqual(urgent(),[],'stabilize the actual critical patients before moving defenders');
 c=prepareFreshCordobaDefense(c,{stageOnly:true});
 const doctors=new Set(),dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const alive=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const wounded=()=>alive().filter(id=>{const r=c.operativeState[id];return r.hp<r.maxHp||r.bleeding>0;});
 const selectSite=sector=>{
  if(c.location===sector)return;
  const squad=c.squads.find(q=>q.location===sector&&q.members.some(id=>alive().includes(id)));
  assert.ok(squad,`the actual survivors need a squad at ${sector}`);order({type:'selectSquad',id:squad.id});
 };
 const resolveCareEncounter=(state,{restoreSquad=false}={})=>{
  c=state;const previous=c.activeSquadId,encounter=c.pendingEncounter;assert.ok(encounter);
  selectSite(encounter.sector);
  report({event:'recoveryCounterattack',sector:encounter.sector,hour:c.hour,campaign:structuredClone(c)});
  order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
  // Use the same observed cover, body-region and aid orders as the actual
  // Córdoba assault. Every defense is replayed before its native settlement.
  c=fightNorthernSector(c,encounter.sector,{report,executeBattle:(request,previous)=>cautiousFight(request,previous,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true})}).campaign;
  if(restoreSquad&&c.activeSquadId!==previous)order({type:'selectSquad',id:previous});
  return c;
 };
 const restOnlySites=new Set(),searchedRemains=new Set(),reliefStaff=new Set(),careHours=96+Math.max(0,...alive().map(id=>c.operativeState[id].maxHp-c.operativeState[id].hp))*careRules(c).restHealingHours;
 for(let hours=0;hours<careHours&&(wounded().length||c.pendingEncounter);hours++){
  if(c.pendingEncounter)c=resolveCareEncounter(c);
  if(!wounded().length)break;
  // Rest the idle garrison while medical work consumes its ordinary supplies.
  for(const operativeId of alive())order({type:'assignCare',operativeId,assignment:'rest'});
  for(const site of new Set(wounded().map(id=>c.operativeState[id].location))){
   selectSite(site);
   const patients=wounded().filter(id=>c.operativeState[id].location===site);
   if(restOnlySites.has(site)&&patients.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding))continue;
   let medics=rosterFor(c).filter(op=>alive().includes(op.id)&&c.operativeState[op.id].location===site&&!patients.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&op.medical>=20).sort((a,b)=>b.medical-a.medical);
   if(!medics.length){
    const replacement=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&op.medical>=60&&contractQuote(c,op,'week').price<=c.resources.treasury).sort((a,b)=>b.medical-a.medical)[0];
    assert.ok(replacement,'a living paid physician must provide recovery');
    order({type:'recruitCivic',id:replacement.id,term:'week'});medics=[replacement];
   }
   // One physician treats one patient per hour. Other stable patients rest
   // through that paid hour instead of losing their natural recovery clock.
   const patient=patients.slice().sort((a,b)=>Number(c.operativeState[b].bleeding>0)-Number(c.operativeState[a].bleeding>0)||c.operativeState[a].hp/c.operativeState[a].maxHp-c.operativeState[b].hp/c.operativeState[b].maxHp)[0];
   order({type:'assignCare',operativeId:patient,assignment:'patient'});
   // Stable recovery uses the strongest available physician. Adding every
   // helper spends more dressings for much less healing from finite stock.
   const treating=medics.slice(0,1);
   for(const doctor of treating){
    doctors.add(doctor.id);
    if(!c.operativeState[doctor.id].medkits){
     // Share real local carried dressings before sending a doctor away. The
     // patient and idle soldiers retain their own physical inventory records.
     const donor=alive().find(id=>id!==doctor.id&&!treating.some(op=>op.id===id)&&c.operativeState[id].location===site&&c.operativeState[id].medkits>0&&!sectorInventoryModel(c,site,rosterFor(c),id).reason);
     if(donor!==undefined)order({type:'sectorInventory',sector:site,operativeId:donor,direction:'drop',item:'medkits',count:Math.min(c.operativeState[donor].medkits,4)});
     const row=sectorInventoryModel(c,site,rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
     if(row)order({type:'sectorInventory',sector:site,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(row.count,4)});
     else {
      // Discover the actual local cache; patients remain at their clinic.
      // Stable patients can recover naturally during the real courier wait.
      for(const operativeId of patients)if(c.operativeState[operativeId].hp>=15&&!c.operativeState[operativeId].bleeding)order({type:'assignCare',operativeId,assignment:'rest'});
      report({event:'careCollectionCheckpoint',site,doctor:doctor.id,campaign:structuredClone(c)});
      try{c=collectRouteMedicalSupplies(c,doctor.id,12,{report,resolveEncounter:state=>resolveCareEncounter(state,{restoreSquad:true})}).campaign;}
      catch(error){
       if(error.message!=='no controlled finite medical source remains for an actual courier')throw error;
       assert.ok(patients.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding),'critical or bleeding patients still require actual medical supplies');
       // Fixed caches can be empty while native casualties still carry
       // dressings. Search the public battlefield and inspect visible bodies
       // through ordinary hand orders before relying on prolonged rest.
       if(!searchedRemains.has(site)){
        searchedRemains.add(site);
        c=recoverVisibleRouteDressings(c,doctor.id,Math.max(1,Math.min(4,patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/doctorRate(doctor,c)),0))),{report}).campaign;
       }
       if(!c.operativeState[doctor.id].medkits&&!reliefStaff.has(139)&&!c.recruited.includes(139)){
        // Bridget is a real additional physician, booked once at the normal
        // quoted price. Her actual issued dressings can supplement the last
        // stable wound; no dismissal/recruitment supply cycle is allowed.
        const relief=rosterFor(c).find(op=>op.id===139),r=c.operativeState[139],quote=contractQuote(c,relief,'week');
        if(r.alive&&!r.captured&&r.medkits>0&&quote.available&&quote.total<=c.resources.treasury){
         const cash=c.resources.treasury,bookedAt=c.hour;reliefStaff.add(139);
         order({type:'recruitCivic',id:139,term:'week',destination:site});
         assert.equal(c.resources.treasury,cash-quote.total,'the supplemental physician requires the real quoted payment');
         for(let waiting=0;!c.recruited.includes(139)&&waiting<168;waiting++){
          if(c.pendingEncounter)c=resolveCareEncounter(c);
          for(const id of alive()){
           const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
          }
          order({type:'wait',hours:1});
         }
         assert.ok(c.recruited.includes(139)&&c.operativeState[139].alive&&c.operativeState[139].location===site,'the paid supplemental physician must actually arrive at the clinic');
         const count=c.operativeState[139].medkits;assert.ok(count>0,'only the supplemental physician\'s actual issued dressings are available');
         order({type:'sectorInventory',sector:site,operativeId:139,direction:'drop',item:'medkits',count});
         const stock=sectorInventoryModel(c,site,rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
         assert.ok(stock,'the actual supplemental dressings must be reachable at the clinic');
         order({type:'sectorInventory',sector:site,operativeId:doctor.id,direction:'take',sourceKey:stock.key,expected:stock.expected,count:Math.min(stock.count,count)});
         report({event:'paidMedicalRelief',operativeId:139,site,bookedAt,arrivedAt:c.hour,cost:quote.total,issuedDressings:count});
        }
       }
       if(!c.operativeState[doctor.id].medkits){
        restOnlySites.add(site);report({event:'finiteMedicalStockExhausted',site,hour:c.hour,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp}))});
        continue;
       }
      }
      for(const operativeId of patients){const patient=c.operativeState[operativeId];if(patient.alive&&!patient.captured&&(patient.hp<patient.maxHp||patient.bleeding))order({type:'assignCare',operativeId,assignment:'patient'});}
     }
    }
    order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
   }
   if(c.pendingEncounter)break;
  }
  if(c.pendingEncounter)continue;
  for(const id of alive()){
   const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
  }
  order({type:'wait',hours:1});
 }
 assert.deepEqual(wounded(),[],'every surviving patient must finish actual medical care');
 assert.equal(c.pendingEncounter,null);
 for(const id of dead)assert.equal(c.operativeState[id].alive,false);
 selectSite('cordoba');
 report({event:'cordobaCareFinished',doctors:[...doctors],hour:c.hour,treasury:c.resources.treasury});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function prepareFreshCordobaDefense(start,{stageOnly=false}={}){
 let c=decodeSave(encodeSave(start)).campaign;const field=[...c.squad];
const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
// Local contracts and recovered equipment reinforce the garrison before the attack.
const returning=c.activeSquadId,local=c.squads.find(q=>q.location==='cordoba'&&q.members.length);
order({type:'selectSquad',id:local.id});
for(const id of [144,146,124,136,134,101,108,102,100,130]){
 if(c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba').length>=12)break;
 if(c.recruited.includes(id)||!c.operativeState[id].alive||c.operativeState[id].captured)continue;
 order({type:'recruitCivic',id,term:'week'});
 const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));assert.ok(row,'a real recovered gun must be available');
 const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
 const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon&&JSON.parse(r.expected).instanceId===gun.instanceId);
 assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){
  const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));
  if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
 }
}
// Newly recovered guns remain empty until an ordinary visit finishes loading.
const localIds=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
for(const operativeId of localIds)order({type:'assignCare',operativeId,assignment:'active'});
const reserves=localIds.filter(id=>!c.squads.some(q=>q.members.includes(id)));
for(let offset=0;offset<reserves.length;offset+=6)order({type:'createSquad',name:'Reserva de Córdoba',ids:reserves.slice(offset,offset+6)});
for(const q of c.squads.filter(q=>q.location==='cordoba'&&q.members.length)){order({type:'selectSquad',id:q.id});c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:returning});
if(c.location==='cordoba'){
 // Occupy an authored roof through ordinary walking and climbing while the
 // sector is safe. The next defense must reuse these resident positions.
 order({type:'visitSector'});
 let battle=enterSector(c.pendingBattle,c.sectorStates.cordoba);
 const roofCells=battle.upperSurfaces.filter(p=>!p.blocked).sort((a,b)=>Math.hypot(a.x-battle.width*.5,a.y-battle.height*.5)-Math.hypot(b.x-battle.width*.5,b.y-battle.height*.5)||a.y-b.y||a.x-b.x);
 const act=action=>{battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);};
 for(const id of c.squad){
  let unit=battle.units.find(u=>u.id===String(id));
  // Recovery can begin with critical or routed survivors. Keep their actual
  // condition and position; only capable defenders can walk onto the roof.
  if(!unit||unit.hp<15||unit.unconscious||unit.routed||unit.departure||unit.fled||unit.surrendered||unit.energy<=0)continue;
  act({type:'movement',unitId:unit.id,movement:'walk'});
  unit=battle.units.find(u=>u.id===String(id));
  const destination=roofCells.find(p=>!battle.units.some(other=>other.id!==unit.id&&other.hp>0&&sameCell(other,p))&&getReachable(battle,unit,{stopAt:cell=>sameCell(cell,p)}).some(cell=>sameCell(cell,p)));
  assert.ok(destination,'the local defenders must reach an actual unoccupied roof');
  // Exploration can stop when the walk reveals new terrain. Continue the
  // actual paid route from each admitted position until the roof is reached.
  for(let leg=0;!sameCell(battle.units.find(u=>u.id===unit.id),destination)&&leg<64;leg++){
   const current=battle.units.find(u=>u.id===unit.id),before=spacePoint(current);
   assert.ok(getReachable(battle,current,{stopAt:cell=>sameCell(cell,destination)}).some(cell=>sameCell(cell,destination)),'the roof must remain reachable from the actual position');
   act({type:'move',unitId:unit.id,...spacePoint(destination)});
   assert.notDeepEqual(spacePoint(battle.units.find(u=>u.id===unit.id)),before,'each ordinary roof walk must make actual progress');
  }
  assert.ok(sameCell(battle.units.find(u=>u.id===unit.id),destination));
  act({type:'stance',unitId:unit.id,stance:'crouched'});
 }
 const synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
}
if(stageOnly)return c;
const missing=field.filter(id=>c.operativeState[id].weaponDropped&&!Object.values(c.operativeState[id].inventory??{}).some(item=>[1800,1801,1802].includes(item.weapon)));
if(missing.length&&c.location==='retiro'){
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'buenos_aires'});
 order({type:'visitSector'});
 const recovered=equipOpeningRifles(enterSector(c.pendingBattle,c.sectorStates.buenos_aires),missing);
 const synced=syncBattleTime(c,recovered.battle);assert.equal(synced.error,null);c=synced.campaign;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(unit=>unit.side==='player')});
}
for(const id of field.filter(id=>c.operativeState[id].weaponDropped)){
 const model=()=>sectorInventoryModel(c,c.location,rosterFor(c),id);
 let item=model().carried.find(r=>r.equip?.some(e=>e.slot==='primary'));
 // A routed survivor may have left the gun behind, not merely pocketed it.
 // Recover reachable finite equipment; never restore or buy the lost gun.
 if(!item){
  const available=()=>model().entries.find(r=>{const weapon=JSON.parse(r.expected).weapon;return r.reachable&&weapon>=1800&&weapon<=1808;});
  if(!available()){
   c=recoverRouteFirearm(c,id);
   continue;
  }
  const row=available();assert.ok(row,'a replacement gun must exist in local stock');
  const gun=JSON.parse(row.expected);
  order({type:'sectorInventory',sector:c.location,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon&&JSON.parse(r.expected).instanceId===gun.instanceId);
 }
 assert.ok(item);order({type:'sectorInventory',sector:c.location,operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
}
for(let leg=0;leg<4&&c.location!=='cordoba'&&!c.pendingEncounter;leg++){
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<24&&!c.pendingEncounter&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
 if(c.pendingEncounter)break;
 for(const operativeId of field){const contract=c.contracts[operativeId];if(contract.expiresAt-c.hour<36)order({type:'renewContract',id:operativeId,term:'week',expectedExpiresAt:contract.expiresAt});order({type:'assignCare',operativeId,assignment:'active'});}
 order({type:'travel',sector:'cordoba'});if(c.pendingEncounter)break;
}

 if(c.pendingEncounter?.sector==='cordoba'&&c.location!=='cordoba'){
  const local=c.squads.find(q=>q.location==='cordoba'&&q.members.length);assert.ok(local,'the actual local garrison must defend');order({type:'selectSquad',id:local.id});
 }
 assert.equal(c.location,'cordoba');
 // Fast local recovery can finish before the next raid arrives. Wait for
 // the real strategic force instead of assuming an encounter already exists.
 if(!c.pendingEncounter){
  for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='cordoba'))order({type:'assignCare',operativeId:id,assignment:'rest'});
  for(let hours=0;!c.pendingEncounter&&hours<144;hours++){
   for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){
    const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
   }
   order({type:'wait',hours:1});
  }
 }
 assert.equal(c.pendingEncounter?.sector,'cordoba');
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 return c;
}

export function prepareFreshTucumanAssault(start,{report=()=>{},artillerySupport=false,recovery='doctor',prepareDeparture=null,onCheckpoint=()=>{}}={}){
 assert.ok(['doctor','rest'].includes(recovery),'Tucumán recovery uses real doctor work or ordinary rest');
 assert.ok(prepareDeparture===null||typeof prepareDeparture==='function','departure preparation must use an explicit native route helper');
 const recoveryDefenseIds=[];let recoveryDefenseBudget=null;
 return prepare(start);
 function prepare(initial){
 let c=decodeSave(encodeSave(initial)).campaign;
 onCheckpoint('tucuman-preparation-input',c);
 if(recoveryDefenseBudget===null)recoveryDefenseBudget=c.enemyGroups.filter(g=>!['defeated','withdrawn'].includes(g.status)).length+Math.floor(Object.values(c.enemyReserves.remaining).reduce((sum,n)=>sum+n,0)/3);
const order=a=>{
 // Regrouping also consumes paid time. Keep the doctor and remote survivors
 // employed before each wait, rather than discovering an expired hire later.
 if(a.type==='wait')for(const id of c.recruited){const contract=c.contracts[id];if(c.operativeState[id].alive&&!c.operativeState[id].captured&&contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){const renewed=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(renewed.lastError,null,renewed.lastError);c=renewed;}}
 c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
};
const defendRecovery=(rest=null)=>{
 const encounter=structuredClone(c.pendingEncounter),group=c.enemyGroups.find(g=>g.id===encounter?.groupId);
 assert.ok(group&&group.status==='waiting'&&group.target===encounter.sector,'recovery must respond to the actual waiting enemy group');
 assert.ok(!recoveryDefenseIds.includes(group.id),'a recovery defense cannot resolve the same enemy group twice');
 assert.ok(recoveryDefenseIds.length<recoveryDefenseBudget,'recovery defenses must fit the actual issued groups and finite remaining reserves');
 for(const id of recoveryDefenseIds)assert.ok(c.encounterHistory.some(entry=>entry.groupId===id&&entry.outcome==='victory'),'each earlier recovery defense needs its accepted campaign result');
 const groupId=group.id,sector=encounter.sector,dead=Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>id);
 report({event:'tucumanRecoveryInterrupted',groupId,sector,hour:c.hour,second:c.secondOfHour??0,rest,campaign:structuredClone(c)});
 order({type:'respondToEncounter',groupId,choice:'tactical'});
 const defense=fightNorthernSector(c,sector,{controller:cautiousCombatOrder,report});c=defense.campaign;
 assert.equal(c.enemyGroups.find(g=>g.id===groupId).status,'defeated');assert.ok(c.encounterHistory.some(entry=>entry.groupId===groupId&&entry.outcome==='victory'));
 for(const id of dead)assert.equal(c.operativeState[id].alive,false,'a real defense cannot restore an earlier casualty');
 recoveryDefenseIds.push(groupId);
 report({event:'tucumanRecoveryDefense',groupId,sector,summary:defense.summary,recoveryDefenseIds:[...recoveryDefenseIds],campaign:structuredClone(c)});
 // The battle has changed actual wounds, survivors, locations and equipment.
 // Reuse urgent care and formation from that accepted campaign, with a new
 // wound-based rest bound instead of retaining the earlier clinical plan.
 return prepare(c);
};
if(recovery==='rest'&&c.pendingEncounter)return defendRecovery();
// Stop bleeding before any rest or long march. A low-health survivor must not
// silently die while other squads wait for their energy to recover.
const wounded=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&(r.bleeding>0||r.hp<15);});
const medicalSectors=[...new Set(wounded.map(id=>operativeLocation(c,id)))].filter(sector=>worldOwner(c,sector)==='patriot');
const doctors=new Map(),usedDoctors=new Set();
const candidates=()=>rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&c.operativeState[op.id].medkits>0&&op.medical>=20&&!usedDoctors.has(op.id)).sort((a,b)=>b.medical-a.medical);
for(const sector of medicalSectors){
 const doctor=candidates().find(op=>operativeLocation(c,op.id)===sector);
 if(!doctor)continue;
 doctors.set(sector,doctor.id);usedDoctors.add(doctor.id);
 // A doctor cannot carry every dressing left on a large battlefield. Keep
 // surplus in the real sector stock once the personal pockets are full.
 for(const row of sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const action={type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:row.count},next=dispatchCampaign(c,action);
  if(next.lastError==='No queda espacio en el inventario.')break;
  assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 }
 order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
}
for(const operativeId of wounded.filter(id=>worldOwner(c,operativeLocation(c,id))==='patriot'))order({type:'assignCare',operativeId,assignment:'patient'});
// A routed soldier can leave through a real surrounding cell. Local care
// continues while that squad makes its ordinary return to the secured town.
const ruralGroups=new Map();
for(const id of wounded.filter(id=>worldOwner(c,operativeLocation(c,id))!=='patriot')){
 const sector=operativeLocation(c,id);ruralGroups.set(sector,[...(ruralGroups.get(sector)??[]),id]);
}
for(const [sector,ids] of ruralGroups)for(let offset=0;offset<ids.length;offset+=6){
 const group=ids.slice(offset,offset+6);
 order({type:'createSquad',name:'Evacuación de heridos',ids:group,sector});
 order({type:'travel',sector:'cordoba'});
 for(const id of group){assert.equal(operativeLocation(c,id),'cordoba');order({type:'assignCare',operativeId:id,assignment:'patient'});}
 if(!doctors.has('cordoba')){
  const doctor=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20&&operativeLocation(c,op.id)==='cordoba').sort((a,b)=>b.medical-a.medical)[0];
  assert.ok(doctor,'a living local medic must receive the returning wounded');
  if(!c.operativeState[doctor.id].medkits)c=collectRouteItems(c,doctor.id,{item:'medkits'},1).campaign;
  order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
  doctors.set('cordoba',doctor.id);usedDoctors.add(doctor.id);
 }
}
for(const sector of medicalSectors.filter(sector=>!doctors.has(sector))){
 const doctor=candidates()[0];assert.ok(doctor,'a surviving medic with real dressings must reach the patient');
 usedDoctors.add(doctor.id);doctors.set(sector,doctor.id);
 order({type:'createSquad',name:'Socorro de campaña',ids:[doctor.id],sector:operativeLocation(c,doctor.id)});
 order({type:'assignCare',operativeId:doctor.id,assignment:'active'});
 order({type:'travel',sector});assert.equal(c.location,sector);
 order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
}
for(let h=0;h<12&&wounded.some(id=>c.operativeState[id].bleeding>0||c.operativeState[id].hp<15);h++){
 for(const [sector,id] of doctors)if(!c.operativeState[id].medkits){
  const donor=c.recruited.find(other=>other!==id&&c.operativeState[other].alive&&!c.operativeState[other].captured&&operativeLocation(c,other)===sector&&c.operativeState[other].medkits>0&&!sectorInventoryModel(c,sector,rosterFor(c),other).reason);
  if(donor){
   order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});
   const row=sectorInventoryModel(c,sector,rosterFor(c),id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row);
   order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  }else c=collectRouteItems(c,id,{item:'medkits'},1).campaign;
 }
 assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
}
for(const id of wounded){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15);}
for(const operativeId of [...wounded,...usedDoctors])order({type:'assignCare',operativeId,assignment:'active'});
for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&!r.bleeding&&r.hp>=15&&r.hp<r.maxHp;}))order({type:'assignCare',operativeId,assignment:'rest'});
// Bring every available survivor to Córdoba through ordinary travel.
const unassigned=new Map();
for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&!c.squads.some(q=>q.members.includes(id)))){
 const sector=operativeLocation(c,id);unassigned.set(sector,[...(unassigned.get(sector)??[]),id]);
}
for(const [sector,ids] of unassigned)for(let offset=0;offset<ids.length;offset+=6)order({type:'createSquad',name:'Retaguardia',ids:ids.slice(offset,offset+6),sector});
const returning=c.squads.filter(q=>q.members.length&&q.location!=='cordoba').map(q=>q.id);
for(const id of returning){
 order({type:'selectSquad',id});const members=[...c.squad];
 for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&members.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba',queue:true});
}
for(let h=0;h<48&&returning.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(returning.every(id=>c.squads.find(q=>q.id===id)?.location==='cordoba'));
order({type:'selectSquad',id:c.squads.find(q=>q.location==='cordoba'&&q.members.length).id});
if(!c.recruited.includes(133)&&c.operativeState[133].alive){
 if(!c.hiringArrivals?.some(arrival=>arrival.operativeId===133))order({type:'recruitCivic',id:133,term:'week'});
 // Campaigns with timed arrivals must receive the paid reinforcement before
 // forming the squads. A later automatic arrival would otherwise join an
 // already prepared squad without its recovery and ammunition checks.
 for(let h=0;h<24&&!c.recruited.includes(133);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(c.recruited.includes(133),'the paid reinforcement must arrive before deployment');
}
const fieldIds=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&operativeLocation(c,id)==='cordoba';});
assert.ok(fieldIds.length>0,'Tucumán needs a living, uncaptured field force');
order({type:'squad',ids:fieldIds.slice(0,6)});const assaultSquads=[c.activeSquadId];
for(let offset=6;offset<fieldIds.length;offset+=6){
 order({type:'createSquad',name:'Apoyo de Tucumán',ids:fieldIds.slice(offset,offset+6)});assaultSquads.push(c.activeSquadId);
}
for(const id of fieldIds){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const currentWeapon=rosterFor(c).find(op=>op.id===id).weapon;
 const row=!c.operativeState[id].weaponDropped&&[1800,1801,1802].includes(currentWeapon)?null:model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));
 if(row){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
 // Return spare guns to the shared ground stock before the next soldier equips.
 // Keeping several muskets in one pack leaves later recruits with only blades.
 for(const spare of model().carried.filter(row=>row.inventoryKey&&row.expected&&JSON.parse(row.expected).weapon))order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'drop',item:spare.item,count:1});
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 order({type:'assignCare',operativeId:id,assignment:'rest'});
}
c=sellSurplusEquipment(c,'cordoba',fieldIds,1000,{report});
// Finish wound care in Córdoba before sending the force north. The stock route
// can rest stable wounds after real urgent care; the funded route keeps its
// existing doctor/patient work and finite dressing costs.
const medic=rosterFor(c).filter(op=>fieldIds.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.medical-a.medical)[0];
const patients=fieldIds.filter(id=>id!==medic?.id&&c.operativeState[id].hp<c.operativeState[id].maxHp);
if(recovery==='rest'){
 if(c.pendingEncounter)return defendRecovery();
 const fortBefore=c.sectors.cordoba.fort,fortCash=c.resources.treasury;
 while(c.sectors.cordoba.fort<3)order({type:'fortify',sector:'cordoba'});
 if(c.sectors.cordoba.fort>fortBefore)report({event:'tucumanRecoveryFortified',sector:'cordoba',before:fortBefore,after:c.sectors.cordoba.fort,cost:fortCash-c.resources.treasury,hour:c.hour,second:c.secondOfHour??0});
 const restingWounded=fieldIds.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),restHealingHours=careRules(c).restHealingHours;
 const priorDeaths=Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>id),started={hour:c.hour,second:c.secondOfHour??0};
 const ownership=fieldIds.map(id=>{const r=c.operativeState[id];return {id,medkits:r.medkits,inventory:structuredClone(r.inventory),ammo:r.ammo,carriedLoaded:r.carriedLoaded,condition:r.condition,jammed:r.jammed};});
 const stable=()=>{for(const id of fieldIds){const r=c.operativeState[id];assert.ok(r.alive&&!r.captured&&r.hp>=15,'ordinary rest needs each actual conscious uncaptured survivor');assert.equal(r.bleeding,0,'real urgent care must stop bleeding before stable recovery');}};
 const restBoundHours=Math.max(0,...restingWounded.map(id=>(c.operativeState[id].maxHp-c.operativeState[id].hp)*restHealingHours))+72;
 let restHours=0;stable();
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'rest'});
 while(restingWounded.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp)){
  if(c.pendingEncounter)return defendRecovery({started,restHours,restBoundHours});
  assert.ok(restHours<restBoundHours,'stable recovery must fit the actual wound deficit and ordinary sleep bound');stable();
  const before=fieldIds.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,recoveryHours:c.operativeState[id].recoveryHours})),time=c.hour*3600+(c.secondOfHour??0),until=c.hour+1;
  // Request time again after a real assignment or sleep notice. Each accepted
  // wait still renews the actual serving contracts through the normal order.
  for(let attempt=0;c.hour<until&&attempt<240;attempt++){if(c.pendingEncounter)return defendRecovery({started,restHours,restBoundHours});assert.equal(c.pendingBattle,null);order({type:'wait',hours:1});}
  assert.equal(c.hour*3600+(c.secondOfHour??0),time+3600,'one recovery hour must actually elapse');restHours++;stable();
  for(const r of before){const current=c.operativeState[r.id];assert.ok(current.hp>=r.hp&&current.hp<=Math.min(r.maxHp,r.hp+1),'rest must earn health through ordinary hourly recovery');if(r.hp<r.maxHp)assert.ok(current.hp>r.hp||current.recoveryHours>r.recoveryHours,'each actual rest hour must advance wound recovery');}
  if(c.pendingEncounter)return defendRecovery({started,restHours,restBoundHours});
 }
 for(const id of fieldIds)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp,'ordinary rest must fully recover every actual field survivor');
 for(const before of ownership){const r=c.operativeState[before.id];for(const key of ['medkits','ammo','carriedLoaded','condition','jammed'])assert.deepEqual(r[key],before[key],`rest preserves ${key} for ${before.id}`);assert.deepEqual(r.inventory,before.inventory,'ordinary rest cannot add or replace owned equipment');}
 for(const id of priorDeaths)assert.equal(c.operativeState[id].alive,false,'rest cannot restore an actual fallen soldier');
 report({event:'tucumanRestRecovery',started,finished:{hour:c.hour,second:c.secondOfHour??0},restHours,restBoundHours,treasury:c.resources.treasury,patients:restingWounded.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,bleeding:c.operativeState[id].bleeding,expiresAt:c.contracts[id]?.expiresAt}))});
}else if(patients.length){
 assert.ok(medic,'wounded troops need a surviving doctor');
 for(let h=0;h<96&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  const recovering=patients.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp).sort((a,b)=>c.operativeState[a].hp/c.operativeState[a].maxHp-c.operativeState[b].hp/c.operativeState[b].maxHp);
  for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:operativeId===recovering[0]?'patient':'rest'});
  for(const id of fieldIds){const contract=c.contracts[id];assert.ok(contract,'keep a current contract during care');if(contract.expiresAt!==null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  if(!c.operativeState[medic.id].medkits){
   // Use the local force's actual carried dressings before asking a doctor
   // to leave the clinic. The handover debits its owner through normal orders.
   const donor=fieldIds.find(id=>id!==medic.id&&c.operativeState[id].alive&&!c.operativeState[id].captured&&operativeLocation(c,id)==='cordoba'&&c.operativeState[id].medkits>0&&!sectorInventoryModel(c,'cordoba',rosterFor(c),id).reason);
   if(donor!==undefined)order({type:'sectorInventory',sector:'cordoba',operativeId:donor,direction:'drop',item:'medkits',count:Math.min(c.operativeState[donor].medkits,4)});
   const row=sectorInventoryModel(c,'cordoba',rosterFor(c),medic.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(row)order({type:'sectorInventory',sector:'cordoba',operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(row.count,4)});
   else{
    for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'rest'});
    c=collectRouteMedicalSupplies(c,medic.id,12,{report,resolveEncounter:state=>{
     c=state;const previous=c.activeSquadId,encounter=c.pendingEncounter;
     const local=c.squads.find(squad=>squad.location===encounter.sector&&squad.members.some(id=>c.operativeState[id].alive&&!c.operativeState[id].captured));assert.ok(local,'a real local force must defend the medical courier encounter');
     if(local.id!==c.activeSquadId)order({type:'selectSquad',id:local.id});
     order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
     c=fightNorthernSector(c,encounter.sector,{report,executeBattle:(request,previous)=>cautiousFight(request,previous,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true})}).campaign;
     if(c.activeSquadId!==previous)order({type:'selectSquad',id:previous});
     return c;
    }}).campaign;
    for(const operativeId of patients){assert.ok(c.operativeState[operativeId].alive,'the actual clinic patient must survive the finite supply journey');order({type:'assignCare',operativeId,assignment:'patient'});}
   }
  }
  if(!c.operativeState[medic.id].asleep)order({type:'assignCare',operativeId:medic.id,assignment:c.operativeState[medic.id].medkits?'doctor':'rest'});order({type:'wait',hours:1});
 }
 report({event:'tucumanMedicalRecovery',hour:c.hour,treasury:c.resources.treasury,medic:medic.id,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,bleeding:c.operativeState[id].bleeding,expiresAt:c.contracts[id]?.expiresAt}))});
 for(const id of patients)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'rest'});
}
for(let i=0;i<24&&fieldIds.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){
 if(recovery==='rest'&&c.pendingEncounter)return defendRecovery();
 assert.equal(c.pendingEncounter,null);
 for(const id of fieldIds){const contract=c.contracts[id];assert.ok(contract,'resting survivors retain their paid contracts');if(contract.expiresAt!==null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
 order({type:'wait',hours:1});
}
if(recovery==='rest'&&c.pendingEncounter)return defendRecovery();
for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
for(const id of fieldIds){while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<c.hour+30){const contract=c.contracts[id];order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}}
// A paid replacement column can leave only after the existing recovery and
// actual counterattacks finish. Its own native helper forms and supplies it.
if(prepareDeparture){
 const recovered=structuredClone(c),prepared=prepareDeparture(c);
 assert.deepEqual(c,recovered,'departure preparation preserves its actual recovered input');
 assert.equal(prepared.pendingBattle?.sector,'tucuman');assert.equal(prepared.pendingEncounter,null);
 for(const [id,record]of Object.entries(recovered.operativeState))if(!record.alive)assert.equal(prepared.operativeState[id].alive,false,'paid departure cannot restore an earlier casualty');
 const battle=enterSector(prepared.pendingBattle,prepared.sectorStates.tucuman);
 assert.deepEqual(decodeSave(encodeSave(prepared,battle)),{campaign:prepared,battle});
 onCheckpoint('tucuman-ready',prepared);return prepared;
}
// A physically recovered support gun can cover the infantry approach.
if(artillerySupport){
 const previous=c.activeSquadId,required=artilleryProfile(c,{type:'bronze4'}).crew;
 const fit=id=>c.squads.find(squad=>squad.id===id).members.filter(id=>{const r=c.operativeState[id];return r.alive&&r.hp>=15&&!r.unconscious&&!r.routed&&!r.captured&&!r.asleep&&r.energy>10;});
 const crew=assaultSquads.find(id=>fit(id).length>=required);assert.ok(crew,'the actual artillery crew must come from a capable serving assault squad');
 onCheckpoint('tucuman-battery-prior-squad',c);
 if(c.activeSquadId!==crew)order({type:'selectSquad',id:crew});
 report({event:'tucumanBatteryCrew',previous,previousMembers:c.squads.find(squad=>squad.id===previous).members,selected:crew,fit:fit(crew),required});
 onCheckpoint('tucuman-battery-input',c);
 const localGuns=state=>[...(state.artilleryDepots[state.location]??[]),...(state.sectorStates[state.location]?.artillery??[])].filter(gun=>gun.side==='player'&&gun.type==='bronze4');
 const arsenal=FINITE_ARTILLERY_ARSENALS[c.location];
 if(!localGuns(c).length&&c.sectors[c.location]?.owner==='patriot'&&!c.artilleryArsenalRecoveries[c.location]&&arsenal?.pieces.some(gun=>gun.type==='bronze4')){
  const beforeSeconds=c.hour*3600+(c.secondOfHour??0),cash=c.resources.treasury,pair=visitLocalRoute(c),carrier=pair.battle.units.find(unit=>unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.asleep&&(unit.energy??0)>10);assert.ok(carrier,'a real serving local soldier must physically recover the controlled arsenal');
  c=leaveFiniteCache(takeFiniteCache(pair,carrier.id,[]));
  const guns=localGuns(c);assert.ok(guns.length,'the actual local arsenal visit must admit canonical player-owned guns');
  for(const gun of guns){const source=arsenal.pieces.find(piece=>piece.id===gun.id);assert.ok(source,'the recovered local gun must retain a canonical finite source');for(const key of ['type','side','loaded','ammo'])assert.equal(gun[key],source[key]);}
  report({event:'tucumanLocalArsenalRecovered',sector:c.location,carrier:carrier.id,recovery:structuredClone(c.artilleryArsenalRecoveries[c.location]),elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-beforeSeconds,cost:cash-c.resources.treasury,guns:guns.map(({id,type,side,loaded,ammo})=>({id,type,side,loaded,ammo}))});
 }
 const battery=prepareRouteBattery(c,['bronze4'],{keepServing:fieldIds,report});c=battery.campaign;order({type:'configureArtillery',types:battery.selections});
 onCheckpoint('tucuman-battery-ready',c);
}
// Stage the actual squads through the ordinary clock before the coordinated march.
// Enemy movement and contract costs continue during this wait.
order({type:'wait',hours:4});
if(recovery==='rest'&&c.pendingEncounter)return defendRecovery();
c=supplyRouteAmmunition(c,fieldIds,{report}).campaign;
for(const id of assaultSquads){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c,{report});order({type:'attack',sector:'tucuman',queue:true});}for(let i=0;i<24&&!assaultSquads.every(id=>c.squads.find(s=>s.id===id)?.journey?.status==='ready');i++)order({type:'wait',hours:1});
// The musketeers wait for daylight instead of crossing the citadel approaches
// at night without lamps. Strategic time, contracts and enemy movement continue.
for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
order({type:'beginAssault',sector:'tucuman'});
 assert.equal(c.pendingBattle.squad.length,fieldIds.length);
 const battle=enterSector(c.pendingBattle,c.sectorStates.tucuman);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 onCheckpoint('tucuman-ready',c);
 return c;
 }
}
