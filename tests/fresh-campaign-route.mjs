import {enterSector} from '../game/world.js';
import {equipOpeningRifles} from './opening-equipment.mjs';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {weaponAmmoType} from '../game/ammunition-types.js';
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
