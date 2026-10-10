import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {careRules} from '../game/campaign-care-rules.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {fight} from './opening-driver.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';

export function prepareRescueClinicGuards(start,{courier,report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;
 const sector='tucuman',previous=campaign.activeSquadId,startSeconds=campaign.hour*3600+(campaign.secondOfHour??0),cash=campaign.resources.treasury,medical=new Map(campaign.recruited.map(id=>[id,campaign.operativeState[id].medkits]));
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.sectors[sector].owner,'patriot');
 const ids=campaign.recruited.filter(id=>{const r=campaign.operativeState[id];return id!==courier&&r.alive&&!r.captured&&r.location===sector;});
 assert.ok(ids.length);assert.ok(ids.every(id=>{const r=campaign.operativeState[id];return r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}),'actual local guards must be stable, awake and fit before roof preparation');
 const assignments=ids.map(id=>({id,assignment:campaign.operativeState[id].assignment})),armament=[];
 const order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);};
 const ungrouped=ids.filter(id=>!campaign.squads.some(q=>q.location===sector&&!q.journey&&q.members.includes(id)));
 for(let offset=0;offset<ungrouped.length;offset+=6)order({type:'createSquad',name:'Guardia de la clínica',sector,ids:ungrouped.slice(offset,offset+6)});
 const localSquad=campaign.squads.find(q=>q.location===sector&&!q.journey&&q.members.some(id=>ids.includes(id)));order({type:'selectSquad',id:localSquad.id});
 for(const id of ids)order({type:'assignCare',operativeId:id,assignment:'active'});
 // Apply the established clinic's long-gun policy to an actually dropped or
 // short primary. Take only the first currently known and reachable long gun.
 for(const id of ids){
  const op=rosterFor(campaign).find(op=>op.id===id),record=campaign.operativeState[id];
  if(!record.weaponDropped&&![1804,1805,1806,1807,1808].includes(op.weapon))continue;
  const inventory=sectorInventoryModel(campaign,sector,rosterFor(campaign),id),source=inventory.entries.find(row=>row.reachable&&[1800,1801,1803].includes(JSON.parse(row.expected).weapon)&&(()=>{try{applyItemQuantity(inventory.personal,{...JSON.parse(row.expected),count:1});return true;}catch{return false;}})());
  assert.ok(source,'a clinic guard needs an actual known reachable finite long gun and carrying room');
  const incoming=JSON.parse(source.expected),before=inventory.entries.filter(row=>[1800,1801,1803].includes(JSON.parse(row.expected).weapon)).reduce((sum,row)=>sum+row.count,0);
  order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
  const after=sectorInventoryModel(campaign,sector,rosterFor(campaign),id);assert.equal(after.entries.filter(row=>[1800,1801,1803].includes(JSON.parse(row.expected).weapon)).reduce((sum,row)=>sum+row.count,0),before-1);
  const item=after.carried.find(row=>row.equip?.some(e=>e.slot==='primary'&&e.valid)&&JSON.parse(row.expected).weapon===incoming.weapon&&JSON.parse(row.expected).instanceId===incoming.instanceId);assert.ok(item);
  order({type:'sectorInventory',sector,operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  assert.equal(campaign.operativeState[id].weaponDropped,false);armament.push({id,oldWeapon:op.weapon,weapon:incoming.weapon,sourceKey:source.key,sourceExpected:source.expected,loaded:incoming.loaded});
 }
 const ammunition=supplyRouteAmmunition(campaign,ids,{target:14,report});campaign=ammunition.campaign;
 let roofEvidence;campaign=stageRouteRoofDefenders(campaign,ids,{report:event=>{if(event.event==='routeRoofDefenders')roofEvidence=event;report(event);}});
 for(const {id,assignment}of assignments)if(assignment!=='active')order({type:'assignCare',operativeId:id,assignment:assignment==='doctor'&&!campaign.operativeState[id].medkits?'rest':assignment});
 if(campaign.activeSquadId!==previous)order({type:'selectSquad',id:previous});
 assert.equal(campaign.resources.treasury,cash);assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.recruited,start.recruited);
 for(const [id,r]of Object.entries(start.operativeState)){if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].captured,r.captured);}
 for(const [id,count]of medical)assert.equal(campaign.operativeState[id].medkits,count,'preparation must not consume or grant medical supplies');
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const evidence={event:'rescueClinicPrepared',sector,ids,courier,ungrouped,armament,ammunitionTransactions:ammunition.transactions,roofEvidence,elapsedSeconds:campaign.hour*3600+(campaign.secondOfHour??0)-startSeconds,cost:cash-campaign.resources.treasury};report(evidence);return {campaign,evidence};
}

// A prior real collection can establish an empty known cache. Other authored
// caches remain candidates until a public route admits their ordinary discovery.
export function rescueMedicalRouteOptions(campaign,courier,{exhaustedSources=[]}={}){
 const publicState=playerKnownCampaign(campaign),actor=publicState.operatives.find(op=>op.id===courier),squad=campaign.squads.find(q=>q.members.includes(courier)&&!q.journey);
 assert.ok(actor?.alive&&!actor.captured&&squad,'the actual serving courier must have a local squad');
 return publicState.sectors.filter(sector=>sector.id!==actor.location&&sector.owner==='patriot'&&FINITE_SECTOR_CACHES[sector.id]).map(sector=>{
  const knownMedical=sector.equipment.filter(row=>row.label===SUPPLY_ITEMS.medkits.label).reduce((sum,row)=>sum+row.count,0),quote=previewStrategicRoute(campaign,squad.id,sector.id,'march');
  const witnessedEmpty=exhaustedSources.includes(sector.id)&&knownMedical===0;
  return {sector:sector.id,knownMedical,witnessedEmpty,quote,admitted:quote.valid&&!witnessedEmpty};
 });
}

// Execute the fixed clinic policy once, then replay only its admitted tape.
// Settle the genuine result before enforcing the route's victory requirement.
export function resolveRescueClinicEncounter(start,{report=()=>{},onCheckpoint=()=>{},executeBattle=fight}={}){
 const before=structuredClone(start),encounter=structuredClone(start.pendingEncounter);assert.equal(encounter?.sector,'tucuman');
 const prepared=dispatchCampaign(start,{type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});assert.equal(prepared.lastError,null);
 const request=prepared.pendingBattle,snapshot=prepared.sectorStates[encounter.sector],result=executeBattle(request,snapshot,{controller:northernClinicDefenseOrder});
 assert.ok(['victory','defeat','retreat'].includes(result.battle.status),'keep an unresolved native defense as a failure');
 let replay={campaign:prepared,battle:enterSector(request,snapshot)};const midpoint=Math.floor(result.orders.length/2);
 for(let index=0;index<result.orders.length;index++){
  const action=result.orders[index];replay.battle=action.type==='endTurn'?endTurn(replay.battle):actBattle(replay.battle,action);assert.equal(replay.battle.lastError,null);
  if(index===midpoint){const synced=syncBattleTime(replay.campaign,replay.battle);assert.equal(synced.error,null);replay=decodeSave(encodeSave(synced.campaign,synced.battle));}
 }
 const expected=syncBattleTime(prepared,result.battle),actual=syncBattleTime(replay.campaign,replay.battle);assert.equal(expected.error,null);assert.equal(actual.error,null);
 assert.deepEqual(decodeSave(encodeSave(actual.campaign,actual.battle)),decodeSave(encodeSave(expected.campaign,expected.battle)));
 const settle=pair=>dispatchCampaign(pair.campaign,{type:'battleResult',battleId:request.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(unit=>unit.side==='player'),sectorState:pair.battle});
 const campaign=settle(decodeSave(encodeSave(expected.campaign,expected.battle))),replayed=settle(decodeSave(encodeSave(actual.campaign,actual.battle)));assert.equal(campaign.lastError,null);assert.equal(replayed.lastError,null);assert.deepEqual(campaign,replayed);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);assert.deepEqual(start,before);
 const evidence={event:'rescueClinicDefense',sector:encounter.sector,groupId:encounter.groupId,status:result.battle.status,turns:result.battle.turn,actions:result.actions,orders:result.orders,elapsedSeconds:result.battle.elapsedSeconds,midpoint,exactNativeReplay:true,units:result.battle.units.map(unit=>({id:unit.id,side:unit.side,hp:unit.hp,routed:unit.routed}))};
 report(evidence);onCheckpoint('rescue-clinic-defense',campaign,evidence);
 assert.equal(result.battle.status,'victory','the real clinic defense must win before full-health recovery can continue');assert.equal(campaign.defeated,false);assert.equal(campaign.sectors[encounter.sector].owner,'patriot');
 return {campaign,evidence};
}

// Stable patients can heal without dressings through the native rest rule.
// The elapsed bound comes from their actual wounds, not a fixed clock target.
export function restRescuePatients(start,{patients,doctors,courier,exhaustedSources=[],report=()=>{},onCheckpoint=()=>{},resolveEncounter=resolveRescueClinicEncounter}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const startSeconds=campaign.hour*3600+(campaign.secondOfHour??0),cash=campaign.resources.treasury,restHealingHours=careRules(campaign).restHealingHours;
 const medical=()=>playerKnownCampaign(campaign).sectors.find(sector=>sector.id==='tucuman').equipment.filter(row=>row.label===SUPPLY_ITEMS.medkits.label).reduce((sum,row)=>sum+row.count,0);
 const routes=rescueMedicalRouteOptions(campaign,courier,{exhaustedSources});assert.equal(routes.some(route=>route.admitted),false,'a remaining source with a valid public route needs ordinary finite collection');assert.equal(medical(),0,'an inaccessible or uncollected local dressing is not exhausted stock');
 assert.ok(campaign.recruited.filter(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].location==='tucuman').every(id=>campaign.operativeState[id].medkits===0),'use the actual local carried dressings before resting without supplies');
 const stable=()=>patients.every(id=>{const record=campaign.operativeState[id];return campaign.recruited.includes(id)&&record.alive&&!record.captured&&record.location==='tucuman'&&!record.bleeding&&record.hp>=15;});assert.ok(stable(),'bleeding or critical wounds still need real medical care');
 const boundHours=Math.max(...patients.map(id=>campaign.operativeState[id].maxHp-campaign.operativeState[id].hp))*restHealingHours;
 const seconds=()=>campaign.hour*3600+(campaign.secondOfHour??0),order=action=>{campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);};
 for(const operativeId of [...new Set([...patients,...doctors])])order({type:'assignCare',operativeId,assignment:'rest'});
 const defenses=[];let requests=0;
 while(patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&seconds()-startSeconds<boundHours*3600&&requests<boundHours*8){
  if(campaign.pendingEncounter){onCheckpoint('rescue-rest-encounter',campaign,{routes,boundHours,requests});const resolved=resolveEncounter(campaign,{report,onCheckpoint});campaign=resolved.campaign;defenses.push(resolved.evidence);assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);}
  assert.ok(stable(),'native rest cannot bypass an actual critical wound, capture or death');
  for(const id of campaign.recruited.filter(id=>campaign.operativeState[id].alive&&!campaign.operativeState[id].captured)){
   let contract=campaign.contracts[id];while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=seconds()+2*3600){order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});contract=campaign.contracts[id];}
  }
  order({type:'wait',hours:1});requests++;
 }
 // An arrival on the final healing tick is still an actual unresolved encounter.
 if(campaign.pendingEncounter){onCheckpoint('rescue-rest-encounter',campaign,{routes,boundHours,requests});const resolved=resolveEncounter(campaign,{report,onCheckpoint});campaign=resolved.campaign;defenses.push(resolved.evidence);}
 assert.ok(stable());for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp,'the native elapsed rest bound must restore the actual surviving patient');
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 const evidence={event:'rescueStableRest',patients,doctors,courier,routes,restHealingHours,boundHours,requests,elapsedSeconds:seconds()-startSeconds,paidRenewalCost:cash-campaign.resources.treasury,defenses};report(evidence);onCheckpoint('rescue-stable-rest',campaign,evidence);
 return {campaign,evidence};
}
