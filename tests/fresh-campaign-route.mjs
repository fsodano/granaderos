import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {enterSector} from '../game/world.js';
import {equipOpeningRifles} from './opening-equipment.mjs';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
import {ammoResourceKey} from '../game/campaign-ammunition.js';
import {fight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sameCell,spacePoint,tacticalLevel} from '../game/tactical-space.js';
import {doctorRate} from '../game/medical-care.js';
import {contractQuote} from '../game/contracts.js';

// Starts from the actual public new-game state. Checkpoints are outputs of
// ordinary orders, never authored victories or granted territory.
export function beginFreshCampaign({seed=8,report=()=>{}}={}){
 let campaign=initialCampaign(seed);const orders=[];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;orders.push(action);};
 assert.deepEqual(campaign.recruited,[]);
 assert.deepEqual(Object.keys(campaign.sectors).filter(id=>campaign.sectors[id].owner==='patriot'),['retiro']);
 for(const id of [110,114,115,123,137,107])order({type:'recruitCivic',id,term:'week'});
 order({type:'purchaseMedicalSupplies',operativeId:107,quantity:20});
 const needed={};for(const op of rosterFor(campaign).filter(op=>campaign.squad.includes(op.id))){const type=weaponAmmoType(op.weapon);needed[type]=(needed[type]??0)+10;}
 for(const [ammoType,count] of Object.entries(needed)){const quantity=Math.max(0,count-campaign.resources[ammoResourceKey(ammoType)]);if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
 order({type:'attack',sector:'buenos_aires'});
 const request=structuredClone(campaign.pendingBattle);
 report({event:'battleStarted',sector:request.sector,hour:campaign.hour,treasury:campaign.resources.treasury});
 // Use the ordinary rooftop approach. Shorter legs leave this squad exposed
 // below the firing position when the first patrol makes contact.
 let {battle,actions}=fight(request,undefined,{controller:hiredAssaultOrder});
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
 // sector. Buenos Aires has no workshop from which to buy replacements.
 const dressings=sectorInventoryModel(campaign,'buenos_aires',rosterFor(campaign),doctor).entries;
 for(const source of dressings.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(source.count,requiredDressings-campaign.operativeState[doctor].medkits);if(count<=0)break;
  order({type:'sectorInventory',sector:'buenos_aires',operativeId:doctor,direction:'take',sourceKey:source.key,expected:source.expected,count});
 }
 if(campaign.operativeState[doctor].medkits<requiredDressings){
  order({type:'travel',sector:'retiro'});
  order({type:'purchaseMedicalSupplies',operativeId:doctor,quantity:requiredDressings-campaign.operativeState[doctor].medkits});
  order({type:'travel',sector:'buenos_aires'});
 }
 // A sole surviving medic still needs another person to treat her wounds.
 let treatingDoctor=doctor;
 if(campaign.operativeState[doctor].hp<campaign.operativeState[doctor].maxHp){
  treatingDoctor=116;
  if(!campaign.recruited.includes(treatingDoctor))order({type:'recruitCivic',id:treatingDoctor,term:'week'});
  if(campaign.operativeState[treatingDoctor].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:treatingDoctor,quantity:10-campaign.operativeState[treatingDoctor].medkits});
 }
 const patients=campaign.squad.filter(id=>id!==treatingDoctor&&campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 const before=campaign.operativeState[treatingDoctor].medkits;
 order({type:'assignCare',operativeId:treatingDoctor,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let hours=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&hours<48;hours++){
  assert.equal(campaign.pendingEncounter,null,'an actual encounter must be resolved before continuing recovery');
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
 const support=[114,116,119,127,141,104,121,110,115,123,124,136,134].filter(id=>campaign.operativeState[id].alive&&!field.includes(id)).slice(0,6),clothingTransfers=[];
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
  order({type:'sectorInventory',sector:'buenos_aires',operativeId,direction:'take',sourceKey:outfit.key,expected:outfit.expected,count:1});
  const carried=model().carried.find(row=>row.equip?.some(option=>option.slot==='outfit'));
  assert.ok(carried);order({type:'sectorInventory',sector:'buenos_aires',operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'outfit'});
 }
 report({event:'freshEquipmentRecovery',transfers:salvage.transfers,unfilled:salvage.unfilled,clothingTransfers});
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
 const needed={};
 for(const unit of rosterFor(campaign).filter(unit=>ids.has(unit.id))){
  const type=weaponAmmoType(unit.weapon);if(type)needed[type]=(needed[type]??0)+10;
 }
 // The local capital has no ammunition workshop. Make a real return trip to
 // Retiro before purchasing compatible cartridges for the salvaged guns.
 order({type:'selectSquad',id:prepared.fieldSquad});
 order({type:'travel',sector:'retiro'});
 for(const [ammoType,count] of Object.entries(needed)){
  const quantity=Math.max(0,count-(campaign.resources[ammoResourceKey(ammoType)]??0));
  if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});
 }
 order({type:'travel',sector:'buenos_aires'});
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
 for(const id of field){assert.ok(campaign.operativeState[id].alive);if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});}
 order({type:'squad',ids:field});order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),field);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 let recovered=0;
 const inventory=sectorInventoryModel(campaign,'san_nicolas',rosterFor(campaign),112);
 for(const row of inventory.entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
  const count=Math.min(row.count,10-recovered);if(!count)break;
  order({type:'sectorInventory',sector:'san_nicolas',operativeId:112,direction:'take',sourceKey:row.key,expected:row.expected,count});recovered+=count;
 }
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshSanLorenzoPreparation',hour:campaign.hour,field,paid:cash-campaign.resources.treasury,recoveredDressings:recovered,transfers:salvage.transfers,unfilled:salvage.unfilled});
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
 order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),support);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 for(const id of [main,second]){order({type:'selectSquad',id});campaign=finishReloadsBeforeMarch(campaign,{report});}
 // Approach the convent in daylight after both squads finish loading.
 order({type:'wait',hours:2});
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshMissionSupport',hour:campaign.hour,paid:cash-campaign.resources.treasury,treasury:campaign.resources.treasury,transfers:salvage.transfers,unfilled:salvage.unfilled});
 return {campaign,squads:[main,second]};
}

// Keep the surviving doctors with the advance. All participants travel through
// ordinary queued squad orders; no new soldiers or supplies are injected.
export function prepareFreshCordobaAssault(start,doctors){
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
 const deploying=squads.flatMap(id=>campaign.squads.find(squad=>squad.id===id).members);
 const requiredAmmo={};
 for(const unit of rosterFor(campaign).filter(unit=>deploying.includes(unit.id))){
  const type=weaponAmmoType(unit.weapon);if(type)requiredAmmo[type]=(requiredAmmo[type]??0)+10;
 }
 const productionIds=[];
 for(const [type,count] of Object.entries(requiredAmmo)){
  const key=ammoResourceKey(type);if((campaign.resources[key]??0)>=count)continue;
  order({type:'produce',recipe:key,sector:'retiro'});productionIds.push(campaign.production.at(-1).id);
 }
 for(let hours=0;productionIds.some(id=>campaign.production.some(job=>job.id===id))&&hours<24;hours++){
  assert.equal(campaign.pendingEncounter,null,'resolve any encounter before loading for Córdoba');
  order({type:'wait',hours:1});
 }
 assert.ok(productionIds.every(id=>!campaign.production.some(job=>job.id===id)),'compatible ammunition must finish production before departure');
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
 let c=prepareFreshCordobaDefense(start,{stageOnly:true});
 const doctors=new Set(),dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const alive=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const wounded=()=>alive().filter(id=>{const r=c.operativeState[id];return r.hp<r.maxHp||r.bleeding>0;});
 const selectSite=sector=>{
  if(c.location===sector)return;
  const squad=c.squads.find(q=>q.location===sector&&q.members.some(id=>alive().includes(id)));
  assert.ok(squad,`the actual survivors need a squad at ${sector}`);order({type:'selectSquad',id:squad.id});
 };
 for(let hours=0;hours<96&&(wounded().length||c.pendingEncounter);hours++){
  if(c.pendingEncounter){
   const encounter=c.pendingEncounter;selectSite(encounter.sector);
   report({event:'recoveryCounterattack',sector:encounter.sector,hour:c.hour,campaign:structuredClone(c)});
   order({type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});
   const holdRoof=(battle,unit)=>{
    const action=cautiousCombatOrder(battle,unit);
    // Keep the established firing position instead of advancing into the
    // street when no shot is currently available. Ground troops still act.
    return action?.type==='move'&&tacticalLevel(unit)>0&&tacticalLevel(action)===0?null:action;
   };
   c=fightNorthernSector(c,encounter.sector,{controller:holdRoof,report}).campaign;
  }
  if(!wounded().length)break;
  // Rest the idle garrison while medical work consumes its ordinary supplies.
  for(const operativeId of alive())order({type:'assignCare',operativeId,assignment:'rest'});
  for(const site of new Set(wounded().map(id=>c.operativeState[id].location))){
   selectSite(site);
   const patients=wounded().filter(id=>c.operativeState[id].location===site);
   let medics=rosterFor(c).filter(op=>alive().includes(op.id)&&c.operativeState[op.id].location===site&&!patients.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&op.medical>=20).sort((a,b)=>b.medical-a.medical);
   if(!medics.length){
    const replacement=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&op.medical>=60&&contractQuote(c,op,'week').price<=c.resources.treasury).sort((a,b)=>b.medical-a.medical)[0];
    assert.ok(replacement,'a living paid physician must provide recovery');
    order({type:'recruitCivic',id:replacement.id,term:'week'});medics=[replacement];
   }
   for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
   for(const doctor of medics.slice(0,patients.length)){
    doctors.add(doctor.id);
    if(!c.operativeState[doctor.id].medkits){
     const row=sectorInventoryModel(c,site,rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
     if(row)order({type:'sectorInventory',sector:site,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(row.count,4)});
     else {
      if(!['retiro','cordoba','mendoza'].includes(c.location)){
       // Route the actual patients and doctor to the stocked workshop. This
       // ordinary journey can itself stop for an enemy encounter.
       order({type:'createSquad',name:'Socorro de Córdoba',ids:[...patients,doctor.id],sector:site});
       for(const operativeId of [...patients,doctor.id])order({type:'assignCare',operativeId,assignment:'active'});
       order({type:'travel',sector:'retiro'});
       if(c.pendingEncounter)break;
       assert.equal(c.location,'retiro');
       for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
      }
      order({type:'purchaseMedicalSupplies',operativeId:doctor.id,quantity:4});
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
  act({type:'movement',unitId:unit.id,movement:'walk'});
  unit=battle.units.find(u=>u.id===String(id));
  const destination=roofCells.find(p=>!battle.units.some(other=>other.id!==unit.id&&other.hp>0&&sameCell(other,p))&&getReachable(battle,unit,{stopAt:cell=>sameCell(cell,p)}).length);
  assert.ok(destination,'the local defenders must reach an actual unoccupied roof');
  act({type:'move',unitId:unit.id,...spacePoint(destination)});
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
 // Use reachable stock or pay for a replacement; never restore the lost gun.
 if(!item){
  const available=()=>model().entries.find(r=>{const weapon=JSON.parse(r.expected).weapon;return r.reachable&&weapon>=1800&&weapon<=1808;});
  if(!available()){
   order({type:'purchaseEquipment',item:1801});
   const bought=c.armoryItems.find(item=>item.item===1801);assert.ok(bought);
   order({type:'equip',operativeId:id,slot:'weapon',itemId:1801,instanceId:bought.id});
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

export function prepareFreshTucumanAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
const order=a=>{
 // Regrouping also consumes paid time. Keep the doctor and remote survivors
 // employed before each wait, rather than discovering an expired hire later.
 if(a.type==='wait')for(const id of c.recruited){const contract=c.contracts[id];if(c.operativeState[id].alive&&!c.operativeState[id].captured&&contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){const renewed=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(renewed.lastError,null,renewed.lastError);c=renewed;}}
 c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
};
// Stop bleeding before any rest or long march. A low-health survivor must not
// silently die while other squads wait for their energy to recover.
const wounded=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&(r.bleeding>0||r.hp<15);});
const medicalSectors=[...new Set(wounded.map(id=>c.operativeState[id].location))];
const doctors=new Map(),usedDoctors=new Set();
const candidates=()=>rosterFor(c).filter(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&c.operativeState[op.id].medkits>0&&op.medical>=20&&!usedDoctors.has(op.id)).sort((a,b)=>b.medical-a.medical);
for(const sector of medicalSectors){
 const doctor=candidates().find(op=>c.operativeState[op.id].location===sector);
 if(!doctor)continue;
 doctors.set(sector,doctor.id);usedDoctors.add(doctor.id);
 for(const row of sectorInventoryModel(c,sector,rosterFor(c),doctor.id).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'))order({type:'sectorInventory',sector,operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:row.count});
 order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
}
for(const operativeId of wounded)order({type:'assignCare',operativeId,assignment:'patient'});
for(const sector of medicalSectors.filter(sector=>!doctors.has(sector))){
 const doctor=candidates()[0];assert.ok(doctor,'a surviving medic with real dressings must reach the patient');
 usedDoctors.add(doctor.id);doctors.set(sector,doctor.id);
 order({type:'createSquad',name:'Socorro de campaña',ids:[doctor.id],sector:c.operativeState[doctor.id].location});
 order({type:'assignCare',operativeId:doctor.id,assignment:'active'});
 order({type:'travel',sector});assert.equal(c.location,sector);
 order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});
}
for(let h=0;h<12&&wounded.some(id=>c.operativeState[id].bleeding>0||c.operativeState[id].hp<15);h++){
 assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
}
for(const id of wounded){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15);}
for(const operativeId of [...wounded,...usedDoctors])order({type:'assignCare',operativeId,assignment:'active'});
// Bring every available survivor to Córdoba through ordinary travel.
const unassigned=new Map();
for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&!c.squads.some(q=>q.members.includes(id)))){
 const sector=c.operativeState[id].location;unassigned.set(sector,[...(unassigned.get(sector)??[]),id]);
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
if(!c.recruited.includes(133)&&c.operativeState[133].alive)order({type:'recruitCivic',id:133,term:'week'});
const fieldIds=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
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
// Finish wound care in the supplied Córdoba hospital before sending the force
// north. Use the actual healthy medic, local stock, and campaign treasury.
const medic=rosterFor(c).filter(op=>fieldIds.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.medical-a.medical)[0];
const patients=fieldIds.filter(id=>id!==medic?.id&&c.operativeState[id].hp<c.operativeState[id].maxHp);
if(patients.length){
 assert.ok(medic,'wounded troops need a surviving doctor');
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let h=0;h<96&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  for(const id of fieldIds){const contract=c.contracts[id];assert.ok(contract,'keep a current contract during care');if(contract.expiresAt!==null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  if(!c.operativeState[medic.id].medkits&&c.resources.treasury>=30)order({type:'purchaseMedicalSupplies',operativeId:medic.id,quantity:1});
  order({type:'assignCare',operativeId:medic.id,assignment:c.operativeState[medic.id].medkits?'doctor':'rest'});order({type:'wait',hours:1});
 }
 report({event:'tucumanMedicalRecovery',hour:c.hour,treasury:c.resources.treasury,medic:medic.id,patients:patients.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,bleeding:c.operativeState[id].bleeding,expiresAt:c.contracts[id]?.expiresAt}))});
 for(const id of patients)assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
 for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'rest'});
}
for(let i=0;i<24&&fieldIds.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){
 assert.equal(c.pendingEncounter,null);
 for(const id of fieldIds){const contract=c.contracts[id];assert.ok(contract,'resting survivors retain their paid contracts');if(contract.expiresAt!==null&&contract.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
 order({type:'wait',hours:1});
}
for(const operativeId of fieldIds)order({type:'assignCare',operativeId,assignment:'active'});
for(const id of fieldIds){while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<c.hour+30){const contract=c.contracts[id];order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}}
// Stage the actual squads through the ordinary clock before the coordinated march.
// Enemy movement and contract costs continue during this wait.
order({type:'wait',hours:4});
const requiredAmmo={};
for(const op of rosterFor(c).filter(op=>fieldIds.includes(op.id))){const ammoType=weaponAmmoType(op.weapon);if(ammoType)requiredAmmo[ammoType]=(requiredAmmo[ammoType]??0)+Math.max(0,10-availableAmmunition(c.operativeState[op.id],ammoType)-(c.operativeState[op.id].carriedLoaded??0));}
for(const [ammoType,count] of Object.entries(requiredAmmo)){const quantity=Math.max(0,count-(c.resources[ammoResourceKey(ammoType)]??0)-(c.depots.cordoba?.[ammoResourceKey(ammoType)]??0));if(quantity)order({type:'purchaseAmmunition',ammoType,quantity});}
for(const id of assaultSquads){order({type:'selectSquad',id});c=finishReloadsBeforeMarch(c,{report});order({type:'attack',sector:'tucuman',queue:true});}for(let i=0;i<24&&!assaultSquads.every(id=>c.squads.find(s=>s.id===id)?.journey?.status==='ready');i++)order({type:'wait',hours:1});
// The musketeers wait for daylight instead of crossing the citadel approaches
// at night without lamps. Strategic time, contracts and enemy movement continue.
for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
order({type:'beginAssault',sector:'tucuman'});
 assert.equal(c.pendingBattle.squad.length,fieldIds.length);
 const battle=enterSector(c.pendingBattle,c.sectorStates.tucuman);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}
