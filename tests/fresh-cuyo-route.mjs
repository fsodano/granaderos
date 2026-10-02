import {sellSurplusEquipment} from './surplus-equipment-route.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {doctorRate} from '../game/medical-care.js';
import {foundryFor} from '../game/campaign-foundry.js';
import {artilleryCount} from '../game/economy.js';
import {equipmentCatalogItem,merchantStatus} from '../game/equipment.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';

// Actual transport, shop care and defense preparation after fresh Yatasto.
export function prepareFreshCuyoDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{
  if(c.pendingEncounter?.sector==='salta'&&a.type!=='respondToEncounter'){
   const selected=c.activeSquadId,groupId=c.pendingEncounter.groupId;
   c=dispatchCampaign(c,{type:'respondToEncounter',groupId,choice:'retreat',destination:'tucuman'});assert.equal(c.lastError,null,c.lastError);
   c=dispatchCampaign(c,{type:'selectSquad',id:selected});assert.equal(c.lastError,null,c.lastError);
   report({event:'cuyoRearWithdrawal',groupId,hour:c.hour,destination:'tucuman'});
  }
  const elapsed=a.type==='wait'?a.hours:a.type==='travel'?48:0;
  if(elapsed)for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))while(c.contracts[id]?.expiresAt!==null&&c.contracts[id]?.expiresAt<=c.hour+elapsed){const contract=c.contracts[id],next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;}
  c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);
 };
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let i=0;i<24&&c.squad.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
if(!c.routes.posta)order({type:'transport',mode:'posta'});order({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(c.pendingEncounter,null);
// Bring the surviving northern reserve to the assembly point before paying
// for the elite's short contract. Every reinforcement travels normally.
const assemblySquad=c.activeSquadId,reinforcementSquads=[];
const elsewhere=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location!=='cordoba';});
for(const sector of new Set(elsewhere.map(id=>c.operativeState[id].location))){
 const ids=elsewhere.filter(id=>c.operativeState[id].location===sector);
 for(let offset=0;offset<ids.length;offset+=6){
  const members=ids.slice(offset,offset+6);order({type:'createSquad',name:'Refuerzo de Cuyo',ids:members,sector});
  for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});
  reinforcementSquads.push(c.activeSquadId);order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 }
}
for(let h=0;h<48&&reinforcementSquads.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(reinforcementSquads.every(id=>c.squads.find(q=>q.id===id)?.location==='cordoba'));
order({type:'selectSquad',id:assemblySquad});
const assembled=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='cordoba';});
const candidates=rosterFor(c).filter(op=>assembled.includes(op.id)).sort((a,b)=>Number(c.operativeState[b.id].hp===c.operativeState[b.id].maxHp)-Number(c.operativeState[a.id].hp===c.operativeState[a.id].maxHp)||b.marksmanship-a.marksmanship);
const field=[...new Set([1,0,8,...candidates.map(op=>op.id)])].filter(id=>assembled.includes(id)).slice(0,5);
assert.equal(field.length,5,'keep five actual soldiers and a slot for the paid marksman');
order({type:'squad',ids:field});const main=c.activeSquadId;
const reserve=assembled.filter(id=>!field.includes(id));
for(let offset=0;offset<reserve.length;offset+=6)order({type:'createSquad',name:'Reserva de Cuyo',ids:reserve.slice(offset,offset+6),sector:'cordoba'});
order({type:'selectSquad',id:main});

// Budget care from actual wounds and carried dressings. A healthy party must
// not spend 450 pesos on a fixed bulk purchase before signing its defender.
const patients=assembled.filter(id=>{const r=c.operativeState[id];return r.alive&&(r.bleeding>0||r.hp<r.maxHp);});
for(const patientId of patients){
 const physician=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return assembled.includes(op.id)&&op.id!==patientId&&r.alive&&r.hp>=15&&op.medical>=20;}).sort((a,b)=>b.medical-a.medical)[0];
 assert.ok(physician,'a living local physician must treat the actual Cuyo patient');
 const patient=c.operativeState[patientId],rate=doctorRate(physician);
 const treatments=Number(patient.bleeding>0)+Math.ceil((patient.maxHp-patient.hp)/rate);
 while(c.operativeState[physician.id].medkits<treatments)order({type:'purchaseMedicalSupplies',operativeId:physician.id,quantity:Math.min(20,treatments-c.operativeState[physician.id].medkits)});
 order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
 for(let i=0;i<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);i++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
}
c=sellSurplusEquipment(c,'cordoba',assembled,1400,{report});
report({event:'cuyoFunding',hour:c.hour,treasury:c.resources.treasury,availableGuns:sectorInventoryModel(c,'cordoba',rosterFor(c),assembled[0]).entries.filter(row=>JSON.parse(row.expected).weapon).length});
order({type:'recruitCivic',id:142,term:'day'});
for(let h=0;h<24&&!c.recruited.includes(142);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(c.recruited.includes(142),'the paid defender must arrive before receiving ammunition');
c=supplyRouteAmmunition(c,[142],{target:12}).campaign;
for(const id of c.squad){const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));if(row&&![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});}const type=weaponAmmoType(rosterFor(c).find(o=>o.id===id).weapon);for(const row of model().entries.filter(r=>r.reachable&&JSON.parse(r.expected).ammoType===type)){const count=Math.min(row.count,Math.max(0,10-availableAmmunition(c.operativeState[id],type)));if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}order({type:'assignCare',operativeId:id,assignment:'rest'});}
// The stronger northern route leaves a real Salta garrison. Withdraw it
// through the offered adjacent exit before the separate Córdoba defense.
const fieldSquad=c.activeSquadId;
assert.equal(c.contracts[142].term,'day');assert.ok(c.contracts[142].paid>0);
for(let i=0;i<24&&(c.pendingEncounter||c.enemyGroups.some(group=>['marching','waiting'].includes(group.status)&&group.target==='cordoba'));i++){
 if(c.pendingEncounter?.sector==='salta'){
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'retreat',destination:'tucuman'});
  order({type:'selectSquad',id:fieldSquad});
 }
 if(c.pendingEncounter)break;
 order({type:'wait',hours:1});
}
if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});}
 return c;
}

export function prepareFreshMendozaAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const veterans=[...c.squad],main=c.activeSquadId,columns=[main];
 // Use the actual rear reserves rather than an unaffordable new contract.
 // Leave every past casualty and every carried item unchanged.
 const relief=c.recruited.filter(id=>!veterans.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
 assert.ok(relief.length,'the actual surviving rear guard supports the battery');
 for(const id of relief){
  const model=()=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
  if(![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){
   const row=model().entries.find(r=>r.reachable&&[1800,1801,1802].includes(JSON.parse(r.expected).weapon));assert.ok(row);
   const gun=JSON.parse(row.expected);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   const item=model().carried.find(r=>r.expected&&JSON.parse(r.expected).weapon===gun.weapon);assert.ok(item);order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
  }
 }
 const fieldIds=[...relief,...veterans.filter(id=>c.operativeState[id].morale>=50)].slice(0,6);
 order({type:'squad',ids:fieldIds});const support=[...relief,...veterans].filter(id=>!fieldIds.includes(id));
 for(let offset=0;offset<support.length;offset+=6){order({type:'createSquad',name:'Reserva de Mendoza',ids:support.slice(offset,offset+6),sector:'cordoba'});columns.push(c.activeSquadId);}
 c=sellSurplusEquipment(c,'cordoba',[...fieldIds,...support],900,{report,reserve:0});
 const gunPrice=equipmentCatalogItem('bronze4',c).price,cash=c.resources.treasury;
 order({type:'purchaseEquipment',item:'bronze4'});assert.equal(c.resources.treasury,cash-gunPrice);
 report({event:'mendozaReserveBattery',field:fieldIds,support,cost:gunPrice,hour:c.hour});order({type:'configureArtillery',types:[]});
 c=supplyRouteAmmunition(c,[...fieldIds,...support],{target:12,report}).campaign;
 const field=columns.flatMap(id=>c.squads.find(q=>q.id===id).members);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let i=0;i<24&&field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue>0||c.operativeState[id].asleep);i++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 for(const id of field){assert.equal(c.operativeState[id].energy,100);assert.equal(c.operativeState[id].fatigue,0);assert.equal(c.operativeState[id].asleep,false);}
 for(const id of columns){
  order({type:'selectSquad',id});
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  c=finishReloadsBeforeMarch(c,{report});
 }
 order({type:'configureArtillery',types:['bronze4']});
 for(const id of columns){order({type:'selectSquad',id});order({type:'attack',sector:'mendoza',queue:true,mode:'posta'});}
 for(let i=0;i<24&&columns.some(id=>c.squads.find(q=>q.id===id).journey?.status!=='ready');i++)order({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));
 // Hold at the assembly point until the troops can approach in daylight.
 for(let h=0;h<24&&(c.hour%24<8||c.hour%24>16);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 order({type:'beginAssault',sector:'mendoza'});
 assert.deepEqual(c.pendingBattle.squad.map(unit=>unit.id).sort((a,b)=>a-b),[...field].sort((a,b)=>a-b));
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// Purchases use a local merchant's real stock and the campaign treasury.
// Restocking and territorial income advance only through ordinary waits.
function purchaseFoundryCannons(start,target){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const item=equipmentCatalogItem('bronze4',c);
 for(let hour=0;artilleryCount(c)<target&&hour<240;hour++){
  assert.equal(c.pendingEncounter,null,'resolve the real encounter before buying artillery');
  const market=merchantStatus(c,item,isSupplied);assert.equal(market.available,true,market.reason);
  if(market.stock&&c.resources.treasury>=item.price){
   const before=c.resources.treasury,count=artilleryCount(c);
   order({type:'purchaseEquipment',item:'bronze4',quantity:1});
   assert.equal(c.resources.treasury,before-item.price);assert.equal(artilleryCount(c),count+1);
   assert.equal(c.merchants[market.sector].stock.bronze4,market.stock-1);
  }else{
   for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))if(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
   const before=c.hour;order({type:'wait',hours:1});assert.ok(c.hour>before||c.assignmentAttention.notice,'a paused wait must report its assignment notice');
  }
 }
 assert.equal(artilleryCount(c),target);return c;
}

export function startFreshFoundry(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const local=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp>=15&&r.location==='mendoza';});
 const envoy=local.filter(op=>op.leadership>=60).sort((a,b)=>b.leadership-a.leadership)[0]?.id;
 assert.notEqual(envoy,undefined,'a living local leader must meet the actual recruitment requirement');
 // The selected assault squad can have lost its leader. Use the surviving
 // local command, leaving two real places for Beltrán and Barcala to join.
 order({type:'squad',ids:[envoy,...local.map(op=>op.id).filter(id=>id!==envoy)].slice(0,4)});
 c=sellSurplusEquipment(c,'mendoza',c.squad,foundryFor(c).setupCost+150);
 c=meetRecruits(c,['beltran'],envoy);
 const before=c.resources.treasury;order({type:'foundry'});
 assert.equal(c.resources.treasury,before-foundryFor(c).setupCost);
 order({type:'diplomacy',kind:'emancipation'});c=meetRecruits(c,['barcala'],envoy);
 c=purchaseFoundryCannons(c,1);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshArmyFunding(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const local=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
 const patients=local.filter(id=>{const r=c.operativeState[id];return r.bleeding>0||r.hp<r.maxHp;});
 for(const patientId of patients){
  const physician=rosterFor(c).filter(op=>local.includes(op.id)&&op.id!==patientId&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>b.medical-a.medical)[0];
  assert.ok(physician,'an actual local physician must provide foundry recovery');
  const patient=c.operativeState[patientId],required=Number(patient.bleeding>0)+Math.ceil((patient.maxHp-patient.hp)/doctorRate(physician,c));
  while(c.operativeState[physician.id].medkits<required)order({type:'purchaseMedicalSupplies',operativeId:physician.id,quantity:Math.min(20,required-c.operativeState[physician.id].medkits)});
  order({type:'assignCare',operativeId:physician.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});
  for(let h=0;h<48&&(c.operativeState[patientId].bleeding>0||c.operativeState[patientId].hp<c.operativeState[patientId].maxHp);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
 }
 for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';}))order({type:'assignCare',operativeId,assignment:'rest'});
 c=purchaseFoundryCannons(c,2);
 assert.equal(c.flags.armyFunded,false);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

// Leave a trained local defense, then pay for the army and its third cannon.
export function completeFreshArmyFunding(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 const resolveNorthernDefense=()=>{
  if(c.pendingEncounter?.sector!=='tucuman')return;
  const selected=c.activeSquadId;
  order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'auto'});
  assert.equal(c.pendingBattle,null,'the ordinary automatic northern defense must settle');
  order({type:'selectSquad',id:selected});
 };
 // The second cannon can consume nearly all available cash. Sell real
 // battlefield surplus before paying for travel and the rear militia course.
 c=sellSurplusEquipment(c,c.location,c.squad,200);
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'cordoba',mode:'posta'});
 const trainer=rosterFor(c).find(op=>op.id===7&&c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&c.operativeState[op.id].location==='cordoba');
 assert.ok(trainer,'the actual recruited Barcala must arrive before leading the militia course');
 const before=c.resources.treasury;
 order({type:'militia',sector:'cordoba',trainerId:trainer.id,rank:0});
 assert.equal(c.resources.treasury,before-60);
 for(let i=0;i<60&&c.militiaTraining.length;i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.militiaTraining.length,0);assert.equal(c.sectors.cordoba.militia[0],3);
 const foundryWorkers=c.recruited.filter(id=>{const r=c.operativeState[id];return id!==trainer.id&&r.alive&&!r.captured&&r.location==='cordoba';}).slice(0,6);
 assert.ok(foundryWorkers.includes(2),'the living founder must return to the foundry');
 order({type:'createSquad',name:'Fundición de Mendoza',ids:foundryWorkers,sector:'cordoba'});
 order({type:'travel',sector:'mendoza',mode:'posta'});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 c=purchaseFoundryCannons(c,3);
 for(let i=0;i<240&&c.resources.treasury<foundryFor(c).fundingCost;i++){
  resolveNorthernDefense();assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);
  for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured))if(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
  const before=c.hour;order({type:'wait',hours:1});assert.ok(c.hour>before||c.assignmentAttention.notice,'a paused wait must report its assignment notice');
 }
 const funding=c.resources.treasury;order({type:'fundArmy'});
 assert.equal(c.resources.treasury,funding-foundryFor(c).fundingCost);assert.equal(c.flags.armyFunded,true);assert.equal(artilleryCount(c),3);
 assert.equal(c.sectors.cordoba.owner,'patriot');
 assert.equal(c.squads.find(q=>q.members.includes(trainer.id)).location,'cordoba');
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}
