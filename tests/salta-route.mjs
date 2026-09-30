import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,isSupplied,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {attendYatasto} from './mission-helpers.mjs';
import {contractQuote} from '../game/contracts.js';
import {fightNorthernSector,northernCombatOrder} from './northern-route.mjs';

function orders(start){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 return {get campaign(){return campaign;},events,prepareWeapons(report){campaign=finishReloadsBeforeMarch(campaign,{report});},resolveEncounter(report){
  const encounter=structuredClone(campaign.pendingEncounter),group=structuredClone(campaign.enemyGroups.find(group=>group.id===encounter.groupId));
  const next=dispatchCampaign(campaign,{type:'respondToEncounter',groupId:encounter.groupId,choice:'tactical'});assert.equal(next.lastError,null,next.lastError);assert.deepEqual(next.pendingBattle.enemies,group.units);
  const result=fightNorthernSector(next,encounter.sector,{controller:northernCombatOrder,report});campaign=result.campaign;
  return {groupId:group.id,...result.summary};
 },order(action){
  const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});
 }};
}
function renew(route,ids,buffer){
 for(const id of ids){const c=route.campaign,r=c.operativeState[id],contract=c.contracts[id];
  if(r.alive&&!r.captured&&contract?.expiresAt!=null&&contract.expiresAt-c.hour<=buffer){
   const cash=c.resources.treasury;route.order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
   assert.ok(route.campaign.resources.treasury<cash);
  }
 }
}
export function prepareSaltaAssault(start,{report=()=>{}}={}){
 const route=orders(start),{order}=route;
 assert.equal(start.location,'tucuman');assert.equal(start.pendingBattle,null);
 // Keep the supply depot defended while the northern force marches. Its
 // actual reserves reload their own guns; a paid guard buys a finite musket.
 const selected=start.activeSquadId,reserves=start.recruited.filter(id=>{const r=start.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
 assert.ok(reserves.length&&reserves.length<6);
 order({type:'createSquad',sector:'cordoba',name:'Reserva de Córdoba',ids:reserves});
 for(const operativeId of reserves)order({type:'assignCare',operativeId,assignment:'active'});
 route.prepareWeapons(report);
 for(const operativeId of reserves)order({type:'assignCare',operativeId,assignment:'rest'});
 const guard=113,cashBeforeGuard=route.campaign.resources.treasury,gunStock=route.campaign.merchants.cordoba.stock['1801'];
 order({type:'recruitCivic',id:guard,term:'week'});const guardCost=cashBeforeGuard-route.campaign.resources.treasury;
 assert.equal(guardCost,route.campaign.contracts[guard].paid);
 order({type:'purchaseEquipment',item:1801,quantity:1});order({type:'equip',operativeId:guard,itemId:1801,slot:'weapon'});
 assert.equal(route.campaign.merchants.cordoba.stock['1801'],gunStock-1);assert.equal(cashBeforeGuard-route.campaign.resources.treasury,guardCost+230);
 route.prepareWeapons(report);order({type:'selectSquad',id:selected});
 const reservePreparation={ids:[...reserves,guard],hired:guard,hiringCost:guardCost,weapon:1801,weaponCost:230},defenses=[];
 // Keep service paid while staging a daylight arrival. Replacements are hired
 // locally after the rest, with their normal equipment and real contracts.
 const earliestDeparture=start.hour+(24-start.hour%24)%24;
 let departure;
 const local=start.recruited.filter(id=>{const record=start.operativeState[id];return record.alive&&!record.captured&&record.location==='tucuman';});
 const patients=local.filter(id=>start.operativeState[id].hp<start.operativeState[id].maxHp);
 const doctors=rosterFor(start).filter(op=>local.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20&&start.operativeState[op.id].medkits>0).sort((a,b)=>b.medical-a.medical).slice(0,2).map(op=>op.id);
 assert.equal(doctors.length,2,'two actual supplied doctors restore the local wounded');
 for(const operativeId of local)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':doctors.includes(operativeId)?'doctor':'rest'});
 const medicalStart=doctors.reduce((sum,id)=>sum+start.operativeState[id].medkits,0);
 const careModel=id=>sectorInventoryModel(route.campaign,'tucuman',rosterFor(route.campaign),id);
 let gatheredDressings=0,donatedDressings=0;
 const supplyDoctor=id=>{
  let source=careModel(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!source){
   const donor=local.find(other=>!doctors.includes(other)&&route.campaign.operativeState[other].medkits>0&&!careModel(other).reason);
   if(!donor)return false;
   const carried=route.campaign.operativeState[donor].medkits;
   order({type:'sectorInventory',sector:'tucuman',operativeId:donor,direction:'drop',item:'medkits',count:1});
   assert.equal(route.campaign.operativeState[donor].medkits,carried-1);donatedDressings++;
   source=careModel(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  }
  assert.ok(source,'the doctor must reach the actual dressing');
  const carried=route.campaign.operativeState[id].medkits;
  order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
  assert.equal(route.campaign.operativeState[id].medkits,carried+1);assert.equal(careModel(id).entries.find(row=>row.key===source.key)?.count??0,source.count-1);gatheredDressings++;
  return true;
 };
 // Real wounds can need longer than the next midnight. Complete paid care,
 // then choose a departure whose twelve-hour march arrives in daylight.
 for(let i=0;i<72;i++){
  const arrivalHour=(route.campaign.hour+12)%24;
  if(route.campaign.hour>=earliestDeparture&&arrivalHour>=6&&arrivalHour<18&&patients.every(id=>route.campaign.operativeState[id].hp===route.campaign.operativeState[id].maxHp)){departure=route.campaign.hour;break;}
  if(patients.some(id=>route.campaign.operativeState[id].hp<route.campaign.operativeState[id].maxHp)){
   for(const id of doctors)if(!route.campaign.operativeState[id].medkits)supplyDoctor(id);
   // One supplied doctor can finish the remaining wound even if the other
   // doctor has exhausted every reachable dressing.
   assert.ok(doctors.some(id=>route.campaign.operativeState[id].medkits>0),'continued treatment needs a reachable finite dressing source');
  }
  renew(route,route.campaign.recruited,2);order({type:'wait',hours:1});
  if(patients.every(id=>route.campaign.operativeState[id].hp===route.campaign.operativeState[id].maxHp))for(const operativeId of [...patients,...doctors])if(route.campaign.operativeState[operativeId].assignment!=='rest')order({type:'assignCare',operativeId,assignment:'rest'});
 }assert.ok(Number.isInteger(departure),'supplied paid care completes before the daylight march');assert.equal(route.campaign.hour,departure);
 for(const id of patients)assert.equal(route.campaign.operativeState[id].hp,route.campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart+gatheredDressings-doctors.reduce((sum,id)=>sum+route.campaign.operativeState[id].medkits,0);assert.ok(patients.length?usedDressings>0:usedDressings===0);
 // Pay for an available specialist and ordinary replacements. Fallen recruits
 // stay dead; a living contracted rifleman can serve in the next assault.
 const hired=[],cash=route.campaign.resources.treasury;
 const available=(id,term)=>!route.campaign.recruited.includes(id)&&route.campaign.operativeState[id].alive&&!route.campaign.operativeState[id].captured&&contractQuote(route.campaign,rosterFor(route.campaign).find(op=>op.id===id),term).available;
 const specialist=[128,109,132,143].find(id=>available(id,'day'));assert.ok(specialist);
 order({type:'recruitCivic',id:specialist,term:'day'});hired.push(specialist);
 const replacementCount=Math.max(2,12-local.length-1);
 const replacements=[125,140,144,129,130].filter(id=>available(id,'week')).slice(0,replacementCount);assert.equal(replacements.length,replacementCount);
 for(const id of replacements){order({type:'recruitCivic',id,term:'week'});hired.push(id);}
 const present=id=>route.campaign.recruited.includes(id)&&route.campaign.operativeState[id].alive&&!route.campaign.operativeState[id].captured&&route.campaign.operativeState[id].location==='tucuman';
 const field=[...new Set([specialist,replacements[0],141,127,105,134,126,...local])].filter(id=>present(id)&&!doctors.includes(id)).slice(0,6);
 const support=[...new Set([...doctors,...replacements.slice(1),111,103,104,122,...local])].filter(id=>present(id)&&!field.includes(id)).slice(0,6);
 assert.equal(field.length,6);assert.equal(support.length,6);
 const hiringCost=cash-route.campaign.resources.treasury;assert.equal(hiringCost,hired.reduce((sum,id)=>sum+route.campaign.contracts[id].paid,0));
 for(const receiver of replacements){
  const model=id=>sectorInventoryModel(route.campaign,'tucuman',rosterFor(route.campaign),id);
  if([1800,1801,1802].includes(rosterFor(route.campaign).find(op=>op.id===receiver).weapon))continue;
  const gun=model(receiver).entries.find(row=>row.reachable&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
  // Finite salvage can run out after earlier casualties. Keep the recruit's
  // real weapon instead of assuming every replacement receives a rifle.
  if(!gun)continue;const incoming=JSON.parse(gun.expected);
  order({type:'sectorInventory',sector:'tucuman',operativeId:receiver,direction:'take',sourceKey:gun.key,expected:gun.expected,count:1});
  const carried=model(receiver).carried.find(row=>row.equip?.some(e=>e.slot==='primary')&&JSON.parse(row.expected).weapon===incoming.weapon);assert.ok(carried);
  order({type:'sectorInventory',sector:'tucuman',operativeId:receiver,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'primary'});
 }
 // Preserve the chosen ordering of the real contract transactions and squads.
 renew(route,[...field,...support],13);
 order({type:'squad',ids:field});const fieldSquad=route.campaign.activeSquadId;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});route.prepareWeapons(report);
 order({type:'createSquad',name:'Apoyo del norte',ids:support});const supportSquad=route.campaign.activeSquadId;
 for(const operativeId of support)order({type:'assignCare',operativeId,assignment:'active'});route.prepareWeapons(report);
 order({type:'attack',sector:'salta',queue:true});order({type:'selectSquad',id:fieldSquad});order({type:'attack',sector:'salta',queue:true});
 const deploying=[fieldSquad,supportSquad];
 for(let i=0;i<24&&!deploying.every(id=>route.campaign.squads.find(s=>s.id===id)?.journey?.status==='ready');i++){
  assert.equal(route.campaign.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(route.campaign.hour,departure+12);
 assert.ok(deploying.every(id=>route.campaign.squads.find(s=>s.id===id)?.journey?.status==='ready'));
 while(route.campaign.pendingEncounter){
  const queued=structuredClone(route.campaign.squads.filter(s=>deploying.includes(s.id)).map(s=>s.journey));
  defenses.push(route.resolveEncounter(report));
  assert.deepEqual(route.campaign.squads.filter(s=>deploying.includes(s.id)).map(s=>s.journey),queued,'a remote defense preserves both waiting assault routes');
 }
 order({type:'beginAssault',sector:'salta'});
 const campaign=route.campaign,request=campaign.pendingBattle;
 assert.deepEqual(request.squad.map(u=>Number(u.id)).sort((a,b)=>a-b),[...field,...support].sort((a,b)=>a-b));
 const battle=enterSector(request,campaign.sectorStates.salta);
 assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 report({event:'jointSaltaDeployment',hour:campaign.hour,units:request.squad.map(u=>u.id),patients,usedDressings});
 return {campaign,battle,events:route.events,departure,hired,hiringCost,field,support,reservePreparation,defenses,care:{patients,doctors,usedDressings,gatheredDressings,donatedDressings}};
}

export function completeNorthernMission(start,{report=()=>{}}={}){
 const route=orders(start),{order}=route;
 assert.equal(start.sectors.salta.owner,'patriot');assert.equal(start.phase,2);
 const local=rosterFor(start).filter(op=>{const r=start.operativeState[op.id];return start.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='salta';});
 const patients=local.filter(op=>start.operativeState[op.id].hp<start.operativeState[op.id].maxHp).map(op=>op.id);
 const doctors=local.filter(op=>{const r=start.operativeState[op.id];return !patients.includes(op.id)&&op.medical>=20&&r.medkits>0&&r.energy>10;}).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 assert.ok(!patients.length||doctors.length,'actual wounded survivors need a supplied doctor before the northern mission');
 let careHours=0;
 if(patients.length){
  for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
  for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
  order({type:'wait',hours:1});careHours++;
 }
 for(const id of patients){assert.equal(route.campaign.operativeState[id].bleeding,0);assert.ok(route.campaign.operativeState[id].alive);if(start.operativeState[id].bleeding)assert.equal(route.campaign.operativeState[id].hp,start.operativeState[id].hp);else assert.ok(route.campaign.operativeState[id].hp>=start.operativeState[id].hp);}
 // A doctor first stops bleeding. When every available doctor used that hour
 // on hemorrhage, pay a second real hour to demonstrate subsequent healing.
 if(patients.length&&!patients.some(id=>route.campaign.operativeState[id].hp>start.operativeState[id].hp)){
  assert.ok(doctors.some(id=>route.campaign.operativeState[id].medkits>0),'continued treatment needs real remaining supplies');
  order({type:'wait',hours:1});careHours++;
 }
 const usedDressings=doctors.reduce((sum,id)=>sum+start.operativeState[id].medkits-route.campaign.operativeState[id].medkits,0);assert.ok(patients.length?usedDressings>0:usedDressings===0);
 if(patients.length)assert.ok(patients.some(id=>route.campaign.operativeState[id].hp>start.operativeState[id].hp),'treatment restores at least one actual wound');
 const treated=route.campaign;
 const supplies=route.campaign.resources;order({type:'diplomacy',kind:'northPact'});
 for(const [key,cost] of Object.entries({muskets:20,horses:10,powder:10}))assert.equal(route.campaign.resources[key],supplies[key]-cost);
 // Keep the messenger paid for the actual journey. A healthy lone survivor
 // can carry the agreement even when the force has used its last dressing.
 const messengers=doctors.length?doctors:local.filter(op=>{const r=route.campaign.operativeState[op.id];return r.hp>=15&&!r.bleeding&&r.energy>10;}).map(op=>op.id);
 assert.ok(messengers.length,'an actual capable survivor carries the northern agreement');renew(route,messengers,20);
 const messenger=messengers[0];order({type:'squad',ids:[messenger]});order({type:'assignCare',operativeId:messenger,assignment:'active'});order({type:'travel',sector:'tucuman'});
 assert.equal(route.campaign.hour,start.hour+12+careHours);
 const campaign=attendYatasto(route.campaign);
 assert.equal(campaign.phase,3);assert.equal(campaign.missions.yatasto.completed,true);assert.equal(campaign.flags.northPact,true);assert.equal(isSupplied(campaign,'salta'),true);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.completed,false);
 for(const [id,record] of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 for(const {id} of local.filter(op=>op.id!==messenger)){assert.equal(campaign.operativeState[id].location,'salta');assert.ok(campaign.operativeState[id].hp>=treated.operativeState[id].hp);assert.equal(campaign.operativeState[id].bleeding,0);}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'yatastoCompleted',hour:campaign.hour,second:campaign.secondOfHour,phase:campaign.phase});
 return {campaign,events:route.events,care:{patients,doctors,usedDressings,messenger,hours:careHours}};
}
