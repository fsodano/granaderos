import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
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
import {actBattle} from '../game/tactical.js';

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
 const doctor=107;assert.ok(campaign.operativeState[doctor].alive&&campaign.operativeState[doctor].hp>=15);
 const patients=campaign.squad.filter(id=>id!==doctor&&campaign.operativeState[id].hp<campaign.operativeState[id].maxHp);
 const before=campaign.operativeState[doctor].medkits;
 order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(let hours=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&hours<48;hours++){
  assert.equal(campaign.pendingEncounter,null,'an actual encounter must be resolved before continuing recovery');
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 assert.ok(!patients.length||campaign.operativeState[doctor].medkits<before);
 for(const operativeId of [doctor,...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 const field=[131,113,124,136,134,doctor],cash=campaign.resources.treasury;
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
 report({event:'freshEquipmentRecovery',transfers:salvage.transfers,unfilled:salvage.unfilled});
 const fieldSquad=campaign.activeSquadId,support=[114,116,119,127,141,104];
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
 const departureDelay=(6-((campaign.hour+12)%24)+24)%24;
 for(let i=0;i<departureDelay;i++)order({type:'wait',hours:1});
 const squads=[prepared.fieldSquad,prepared.supportSquad];
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
 const main=campaign.activeSquadId,support=[136,100,101,102,108,130],cash=campaign.resources.treasury;
 for(const id of support){assert.ok(campaign.operativeState[id].alive);if(!campaign.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});}
 order({type:'createSquad',ids:support,name:'Apoyo de San Lorenzo'});const second=campaign.activeSquadId;
 order({type:'visitSector'});
 const salvage=equipOpeningRifles(enterSector(campaign.pendingBattle,campaign.sectorStates.san_nicolas),support);
 const synced=syncBattleTime(campaign,salvage.battle);assert.equal(synced.error,null);campaign=synced.campaign;
 order({type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});
 for(const id of [main,second]){order({type:'selectSquad',id});campaign=finishReloadsBeforeMarch(campaign,{report});}
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'freshMissionSupport',hour:campaign.hour,paid:cash-campaign.resources.treasury,treasury:campaign.resources.treasury,transfers:salvage.transfers,unfilled:salvage.unfilled});
 return {campaign,squads:[main,second]};
}

// Keep the surviving doctors with the advance. All participants travel through
// ordinary queued squad orders; no new soldiers or supplies are injected.
export function prepareFreshCordobaAssault(start){
 let campaign=finishReloadsBeforeMarch(decodeSave(encodeSave(start)).campaign);
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);};
 const field=campaign.activeSquadId;
 order({type:'createSquad',name:'Socorro de Córdoba',ids:[112,122]});
 const support=campaign.activeSquadId,squads=[field,support];
 for(const operativeId of [112,122])order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of squads){order({type:'selectSquad',id});order({type:'attack',sector:'cordoba',queue:true});}
 const ready=()=>squads.every(id=>campaign.squads.find(s=>s.id===id)?.journey?.status==='ready');
 for(let i=0;i<24&&!ready();i++)order({type:'wait',hours:1});
 assert.ok(ready());assert.equal(campaign.pendingEncounter,null);
 order({type:'beginAssault',sector:'cordoba'});
 assert.equal(campaign.pendingBattle.squad.length,8);
 return campaign;
}

// Routed wounded survivors receive local care, then travel to the actual
// Retiro medical shop after recovered field dressings are exhausted.
export function recoverFreshCordobaSurvivors(start){
 let c=decodeSave(encodeSave(start)).campaign;
const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'selectSquad',id:c.squads.find(s=>s.members.includes(111)).id});
order({type:'recruitCivic',id:139,term:'week'});
let model=()=>sectorInventoryModel(c,'buenos_aires',rosterFor(c),139);
for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){order({type:'sectorInventory',sector:'buenos_aires',operativeId:139,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(row.count,10)});if(c.operativeState[139].medkits>=10)break;}
for(const operativeId of [111,125])order({type:'assignCare',operativeId,assignment:'patient'});
order({type:'assignCare',operativeId:139,assignment:'doctor'});
for(let i=0;i<30&&[111,125].some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);i++){assert.equal(c.pendingEncounter,null);
if(!c.operativeState[139].medkits){const row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');if(row)order({type:'sectorInventory',sector:'buenos_aires',operativeId:139,direction:'take',sourceKey:row.key,expected:row.expected,count:Math.min(row.count,10)});else {if(c.location!=='retiro'){order({type:'squad',ids:[111,125,139]});for(const operativeId of [111,125,139])order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'retiro'});for(const operativeId of [111,125])order({type:'assignCare',operativeId,assignment:'patient'});}order({type:'purchaseMedicalSupplies',operativeId:139,quantity:4});order({type:'assignCare',operativeId:139,assignment:'doctor'});}}
order({type:'wait',hours:1});}
for(const id of [111,125])assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function prepareFreshCordobaDefense(start){
 let c=decodeSave(encodeSave(start)).campaign;
const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
for(const id of [111,125]){const m=sectorInventoryModel(c,c.location,rosterFor(c),id),item=m.carried.find(r=>r.equip?.some(e=>e.slot==='primary'));assert.ok(item);order({type:'sectorInventory',sector:c.location,operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
for(let leg=0;leg<4&&c.location!=='cordoba';leg++){
 for(const operativeId of [111,125,139])order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<24&&[111,125,139].some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
 for(const operativeId of [111,125,139]){const contract=c.contracts[operativeId];if(contract.expiresAt-c.hour<36)order({type:'renewContract',id:operativeId,term:'week',expectedExpiresAt:contract.expiresAt});order({type:'assignCare',operativeId,assignment:'active'});}
 order({type:'travel',sector:'cordoba'});if(c.pendingEncounter)break;
}

 assert.equal(c.location,'cordoba');
 assert.equal(c.pendingEncounter?.sector,'cordoba');
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 return c;
}

export function prepareFreshTucumanAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'squad',ids:[111,125,130,139]});for(const id of [144,146])order({type:'recruitCivic',id,term:'week'});
const main=c.activeSquadId,supportIds=[121,126,129,133];for(const id of supportIds)order({type:'recruitCivic',id,term:'week'});order({type:'createSquad',name:'Apoyo de Tucumán',ids:supportIds});const support=c.activeSquadId;
for(const id of [111,125,130,139,144,146,...supportIds]){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
 const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));
 if(row){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}
 const ammoType=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);
 for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===ammoType)){const count=Math.min(row.count,Math.max(0,12-availableAmmunition(c.operativeState[id],ammoType)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
 order({type:'assignCare',operativeId:id,assignment:'rest'});
}
for(let i=0;i<24&&[111,125,130,139,144,146,...supportIds].some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const operativeId of [111,125,130,139,144,146,...supportIds])order({type:'assignCare',operativeId,assignment:'active'});
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'tucuman',queue:true});}for(let i=0;i<24&&![main,support].every(id=>c.squads.find(s=>s.id===id)?.journey?.status==='ready');i++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'tucuman'});
 assert.equal(c.pendingBattle.squad.length,10);
 const battle=enterSector(c.pendingBattle,c.sectorStates.tucuman);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}
