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
 const reserveSquad=route.campaign.activeSquadId;
 const guard=[113,140,144,146,108,101,102].find(id=>!route.campaign.recruited.includes(id)&&route.campaign.operativeState[id].alive&&!route.campaign.operativeState[id].captured),cashBeforeGuard=route.campaign.resources.treasury;
 order({type:'recruitCivic',id:guard,term:'week'});const guardCost=cashBeforeGuard-route.campaign.resources.treasury;
 assert.equal(guardCost,route.campaign.contracts[guard].paid);
 const gunStock=route.campaign.merchants.cordoba.stock['1801'],weaponCash=route.campaign.resources.treasury;
 order({type:'purchaseEquipment',item:1801,quantity:1});order({type:'equip',operativeId:guard,itemId:1801,slot:'weapon'});
 assert.equal(route.campaign.merchants.cordoba.stock['1801'],gunStock-1);assert.equal(weaponCash-route.campaign.resources.treasury,230);
 const reservePreparation={ids:[...reserves,guard],hired:guard,hiringCost:guardCost,weapon:1801,weaponCost:230},defenses=[];
 // Stabilize the actual routed reserve before any tactical loading or march.
 // This care uses paid doctors, carried dressings and finite local restocks.
 const rearPatients=reserves.filter(id=>route.campaign.operativeState[id].bleeding||route.campaign.operativeState[id].hp<route.campaign.operativeState[id].maxHp);
 if(rearPatients.length){
  const rearDoctors=rosterFor(route.campaign).filter(op=>[...reserves,guard].includes(op.id)&&!rearPatients.includes(op.id)&&op.medical>=20&&route.campaign.operativeState[op.id].hp>=15&&!route.campaign.operativeState[op.id].bleeding).sort((a,b)=>b.medical-a.medical).slice(0,2).map(op=>op.id);
  assert.ok(rearDoctors.length,'actual paid rear doctors stabilize the wounded reserve');
  const carriedDressings=rearDoctors.reduce((sum,id)=>sum+route.campaign.operativeState[id].medkits,0);let boughtDressings=0,donatedDressings=0,recoveredDressings=0;
  const rearInventory=id=>sectorInventoryModel(route.campaign,'cordoba',rosterFor(route.campaign),id);
  const supplyRearDoctor=operativeId=>{
   const recovered=rearInventory(operativeId).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
   if(recovered){const count=Math.min(10,recovered.count);order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'take',sourceKey:recovered.key,expected:recovered.expected,count});assert.equal(rearInventory(operativeId).entries.find(row=>row.key===recovered.key)?.count??0,recovered.count-count);recoveredDressings+=count;return count;}
   const quantity=Math.min(10,route.campaign.merchants.cordoba.supplies.medkits);
   if(quantity){order({type:'purchaseMedicalSupplies',operativeId,quantity});boughtDressings+=quantity;return quantity;}
   const donor=reserves.find(id=>!rearDoctors.includes(id)&&route.campaign.operativeState[id].medkits>0&&!rearInventory(id).reason);
   if(!donor)return 0;
   order({type:'sectorInventory',sector:'cordoba',operativeId:donor,direction:'drop',item:'medkits',count:1});
   const source=rearInventory(operativeId).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(source,'the local doctor reaches the donated finite dressing');
   order({type:'sectorInventory',sector:'cordoba',operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1});donatedDressings++;return 1;
  };
  for(const operativeId of rearDoctors)supplyRearDoctor(operativeId);
  for(const operativeId of rearPatients)order({type:'assignCare',operativeId,assignment:'patient'});
  for(const operativeId of rearDoctors)order({type:'assignCare',operativeId,assignment:'doctor'});
  const startHour=route.campaign.hour;
  for(let h=0;h<48&&rearPatients.some(id=>route.campaign.operativeState[id].bleeding||route.campaign.operativeState[id].hp<route.campaign.operativeState[id].maxHp);h++){
   assert.equal(route.campaign.pendingEncounter,null);for(const operativeId of rearDoctors)if(!route.campaign.operativeState[operativeId].medkits)supplyRearDoctor(operativeId);renew(route,route.campaign.recruited,2);order({type:'wait',hours:1});
   assert.ok(rearPatients.every(id=>route.campaign.operativeState[id].alive),'paid care preserves every actual rear survivor');
  }
  reservePreparation.care={patients:rearPatients,doctors:rearDoctors,hours:route.campaign.hour-startHour,boughtDressings,donatedDressings,recoveredDressings,usedDressings:carriedDressings+boughtDressings+donatedDressings+recoveredDressings-rearDoctors.reduce((sum,id)=>sum+route.campaign.operativeState[id].medkits,0)};
  for(const operativeId of [...rearPatients,...rearDoctors]){assert.equal(route.campaign.operativeState[operativeId].bleeding,0);assert.equal(route.campaign.operativeState[operativeId].hp,route.campaign.operativeState[operativeId].maxHp);order({type:'assignCare',operativeId,assignment:'rest'});}
 }
 order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:[]});
 for(const operativeId of [...reserves,guard])order({type:'assignCare',operativeId,assignment:'active'});
 route.prepareWeapons(report);for(const operativeId of [...reserves,guard])order({type:'assignCare',operativeId,assignment:'rest'});
 const originalLocal=start.recruited.filter(id=>{const r=start.operativeState[id];return r.alive&&!r.captured&&r.location==='tucuman';});
 const returning=reserves.filter(id=>id!==1000&&route.campaign.operativeState[id].hp>=15).sort((a,b)=>rosterFor(route.campaign).find(op=>op.id===b).marksmanship-rosterFor(route.campaign).find(op=>op.id===a).marksmanship).slice(0,Math.max(0,9-originalLocal.length));
 if(returning.length){
  order({type:'createSquad',sector:'cordoba',name:'Socorro de la reserva',ids:returning});
  for(const operativeId of returning){
   if(route.campaign.operativeState[operativeId].weaponDropped){order({type:'purchaseEquipment',item:1801});order({type:'equip',operativeId,slot:'weapon',itemId:1801});}
   order({type:'assignCare',operativeId,assignment:'active'});
  }
  route.prepareWeapons(report);renew(route,route.campaign.recruited,13);order({type:'travel',sector:'tucuman'});
  assert.ok(returning.every(id=>route.campaign.operativeState[id].location==='tucuman'),'the healed rear relief completes its actual march');reservePreparation.returning=returning;
 }
 order({type:'selectSquad',id:selected});
 // Keep service paid while staging a daylight arrival. Replacements are hired
 // locally after the rest, with their normal equipment and real contracts.
 const earliestDeparture=route.campaign.hour+(24-route.campaign.hour%24)%24;
 let departure;
 const local=route.campaign.recruited.filter(id=>{const record=route.campaign.operativeState[id];return record.alive&&!record.captured&&record.location==='tucuman';});
 const patients=local.filter(id=>route.campaign.operativeState[id].hp<route.campaign.operativeState[id].maxHp),doctors=[];
 const medicalStart=local.reduce((sum,id)=>sum+route.campaign.operativeState[id].medkits,0);
 const careModel=id=>sectorInventoryModel(route.campaign,'tucuman',rosterFor(route.campaign),id);
 let gatheredDressings=0,donatedDressings=0;
 const supplyDoctor=id=>{
  let source=careModel(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!source){
   const donor=local.find(other=>other!==id&&route.campaign.operativeState[other].medkits>0&&!careModel(other).reason);
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
 // A stable wounded physician can treat another patient, then receive care
 // from a recovered colleague. Their own wounds must also be restored.
 for(let i=0;i<72;i++){
  const wounded=local.filter(id=>route.campaign.operativeState[id].hp<route.campaign.operativeState[id].maxHp);
  const arrivalHour=(route.campaign.hour+12)%24;
  if(route.campaign.hour>=earliestDeparture&&arrivalHour>=6&&arrivalHour<18&&!wounded.length){departure=route.campaign.hour;break;}
  if(wounded.length){
   const eligible=rosterFor(route.campaign).filter(op=>{const r=route.campaign.operativeState[op.id];return local.includes(op.id)&&op.medical>=20&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10;}).sort((a,b)=>b.medical-a.medical||a.id-b.id);
   const hourlyDoctors=eligible.slice(0,2).map(op=>op.id);
   if(wounded.every(id=>hourlyDoctors.includes(id)))hourlyDoctors.splice(hourlyDoctors.indexOf(wounded.at(-1)),1);
   assert.ok(hourlyDoctors.length,'an actual stable colleague must restore the wounded doctor');
   for(const id of hourlyDoctors){if(!route.campaign.operativeState[id].medkits)supplyDoctor(id);assert.ok(route.campaign.operativeState[id].medkits,'continued care consumes finite reachable dressings');if(!doctors.includes(id))doctors.push(id);}
   for(const operativeId of local)order({type:'assignCare',operativeId,assignment:hourlyDoctors.includes(operativeId)?'doctor':wounded.includes(operativeId)?'patient':'rest'});
  }else for(const operativeId of local)order({type:'assignCare',operativeId,assignment:'rest'});
  renew(route,route.campaign.recruited,2);order({type:'wait',hours:1});
  if(route.campaign.pendingEncounter)defenses.push(route.resolveEncounter(report));
 }
 assert.ok(Number.isInteger(departure),'supplied paid care completes before the daylight march');assert.equal(route.campaign.hour,departure);
 for(const id of patients)assert.equal(route.campaign.operativeState[id].hp,route.campaign.operativeState[id].maxHp);
 const usedDressings=medicalStart+gatheredDressings-donatedDressings-local.reduce((sum,id)=>sum+route.campaign.operativeState[id].medkits,0);assert.ok(patients.length?usedDressings>0:usedDressings===0);
 // Pay for an available specialist and ordinary replacements. Fallen recruits
 // stay dead; a living contracted rifleman can serve in the next assault.
 const hired=[],cash=route.campaign.resources.treasury;
 const available=(id,term)=>!route.campaign.recruited.includes(id)&&route.campaign.operativeState[id].alive&&!route.campaign.operativeState[id].captured&&contractQuote(route.campaign,rosterFor(route.campaign).find(op=>op.id===id),term).available;
 const specialist=rosterFor(route.campaign).filter(op=>op.id>=100&&op.id<1000&&available(op.id,'day')&&contractQuote(route.campaign,op,'day').price<=Math.max(0,route.campaign.resources.treasury-250)).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id)[0]?.id;assert.ok(specialist,'the next paid rifleman must be available and leave funds for ordinary relief');
 order({type:'recruitCivic',id:specialist,term:'day'});hired.push(specialist);
 const replacementCount=Math.max(2,12-local.length-1);
 const replacements=rosterFor(route.campaign).filter(op=>op.id>=100&&op.id<1000&&available(op.id,'week')&&contractQuote(route.campaign,op,'week').price<=250).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(route.campaign,a,'week').price-contractQuote(route.campaign,b,'week').price||a.id-b.id).slice(0,replacementCount).map(op=>op.id);assert.equal(replacements.length,replacementCount);
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
 order({type:'configureArtillery',types:['swivel']});
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
 let patients=local.filter(op=>start.operativeState[op.id].bleeding||start.operativeState[op.id].hp<start.operativeState[op.id].maxHp).map(op=>op.id);
 const doctors=local.filter(op=>{const r=start.operativeState[op.id];return op.medical>=20&&r.hp>=15&&!r.bleeding&&r.energy>10;}).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 if(patients.length&&patients.every(id=>doctors.includes(id))&&doctors.length>1)doctors.splice(doctors.indexOf(patients.at(-1)),1);
 patients=patients.filter(id=>!doctors.includes(id));
 let recoveredDressings=0;
 for(const operativeId of doctors){
  if(!patients.length||route.campaign.operativeState[operativeId].medkits)continue;
  const inventory=()=>sectorInventoryModel(route.campaign,'salta',rosterFor(route.campaign),operativeId);
  const source=inventory().entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
  if(!source)continue;
  const count=Math.min(2,source.count),carried=route.campaign.operativeState[operativeId].medkits;
  order({type:'sectorInventory',sector:'salta',operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count});
  assert.equal(route.campaign.operativeState[operativeId].medkits,carried+count);
  assert.equal(inventory().entries.find(row=>row.key===source.key)?.count??0,source.count-count);recoveredDressings+=count;
 }
 if(patients.length){for(let i=doctors.length-1;i>=0;i--)if(!route.campaign.operativeState[doctors[i]].medkits)doctors.splice(i,1);}
 if(patients.length&&!doctors.length){
  const candidate=rosterFor(route.campaign).filter(op=>op.id>=100&&op.id<1000&&op.medical>=20&&route.campaign.operativeState[op.id].alive&&!route.campaign.recruited.includes(op.id)&&!route.campaign.operativeState[op.id].captured&&contractQuote(route.campaign,op,'week').price<=route.campaign.resources.treasury-300).sort((a,b)=>contractQuote(route.campaign,a,'week').price-contractQuote(route.campaign,b,'week').price||b.medical-a.medical)[0];
  assert.ok(candidate,'a paid local medic must be affordable alongside the northern agreement');
  order({type:'recruitCivic',id:candidate.id,term:'week',destination:'salta'});doctors.push(candidate.id);
 }
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
 const usedDressings=recoveredDressings+doctors.reduce((sum,id)=>sum+(start.operativeState[id]?.medkits??0)-route.campaign.operativeState[id].medkits,0);assert.ok(patients.length?usedDressings>0:usedDressings===0);
 if(patients.length)assert.ok(patients.some(id=>route.campaign.operativeState[id].hp>start.operativeState[id].hp),'treatment restores at least one actual wound');
 const treated=route.campaign;
 const supplies=route.campaign.resources;order({type:'diplomacy',kind:'northPact'});
 assert.equal(route.campaign.resources.treasury,supplies.treasury-300);assert.deepEqual(Object.keys(route.campaign.resources),['treasury']);
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
 return {campaign,events:route.events,care:{patients,doctors,usedDressings,recoveredDressings,messenger,hours:careHours}};
}
