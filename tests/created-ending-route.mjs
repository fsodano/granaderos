import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {primaryAmmoTypeFor} from '../game/ammo-types.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {equipOpeningRifles} from './opening-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {withdrawCommandToRear,rejoinCommandAfterExit,deployHighPassBattery} from './command-reserve-driver.mjs';
import {coastalSearchController} from './coastal-search-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {recruitFreshNavalCommand,recoverFreshPort,prepareFreshBlockadeAssault,prepareFreshSantaFeAssault} from './fresh-coastal-route.mjs';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {deployInfantryLine} from './battery-deployment-driver.mjs';
import {prepareCreatedCapitalReturn,prepareCreatedFinalCapitalReturn,createdFinalCapitalBattery} from './created-capital-return.mjs';
import {stageActualPaidCapitalRelief,prepareCreatedFiveSurvivorCapitalReturn} from './created-ending-preparation.mjs';
import {deployCapitalLane} from './created-capital-lane.mjs';
import {finishActualCreatedNorthernReturn} from './created-live-northern-route.mjs';
import {createdFiveSupportCapitalBattery} from './created-final-capital-battery.mjs';
import {fightCreatedFinalCapital} from './created-final-capital-fight.mjs';
import {prepareCreatedNorthernRelief,prepareCreatedSaltaReturn,prepareCreatedSaltaDefense,recoverCreatedSaltaDefense,prepareCreatedJujuyReturn,recoverCreatedJujuy,prepareCreatedJujuyDefense,prepareCreatedHumahuacaReturn,stabilizeCreatedHighPass} from './created-northern-return.mjs';
import {stagedBatteryController} from './staged-battery-driver.mjs';
import {stableCrewController,heavyContactCrewController} from './stable-crew-driver.mjs';
import {contractQuote} from '../game/contracts.js';
import {BLADES,actBattle} from '../game/tactical.js';

// Recover the actual mountain survivors before their paid terms end. The
// affordable relief column waits for real arrivals, care, rest and shop stock.
export function prepareCreatedCoastalAssault(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const expeditionIds=c.squad.filter(id=>{const r=c.operativeState[id];return id!==57&&r.alive&&!r.captured&&r.location==='mendoza'&&c.contracts[id]?.kind==='paid';}).sort((a,b)=>a-b);
 assert.equal(expeditionIds.length,2,'the coast preparation retains the actual paid mountain pair');
 const keep=new Set([57,...expeditionIds]),events=[];
 const order=action=>{
  if(action.type==='assignCare'&&c.operativeState[action.operativeId].assignment===action.assignment)return;
  const elapsed=action.type==='wait'?action.hours:action.type==='travel'?24:0;
  if(elapsed)for(const id of keep){
   let contract=c.contracts[id];
   while(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+elapsed){
    const before=c.resources.treasury;
    const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
    assert.equal(next.lastError,null,next.lastError);c=next;
    events.push({action:{type:'renewContract',id},hour:c.hour,cost:before-c.resources.treasury});
    contract=c.contracts[id];
   }
  }
  const before=c.resources.treasury,next=dispatchCampaign(c,action);
  assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
  events.push({action,hour:c.hour,cost:before-c.resources.treasury});
 };
 const waitUntil=(limit,ready,{income=false}={})=>{
  for(let elapsed=0,attempts=0;elapsed<limit&&attempts<limit&&!ready();attempts++){
   assert.equal(c.pendingEncounter,null,'resolve an actual encounter before the coast march');
   const untilExpiry=Math.min(...[...keep].map(id=>c.contracts[id]?.expiresAt==null?Infinity:c.contracts[id].expiresAt-c.hour-1));
   const hours=income?Math.max(1,Math.min(24-c.hour%24,untilExpiry,limit-elapsed)):1,before=c.hour;
   order({type:'wait',hours});elapsed+=c.hour-before;
   if(c.hour===before)assert.ok(c.assignmentAttention.notice||c.contractAttention.notice||c.logisticsNotice,'a paused wait must expose a real notice');
  }
  assert.ok(ready(),'bounded coastal preparation must reach its stated condition');
 };
 const rearmMissingPrimaries=ids=>{
  for(const operativeId of ids){
   const primary=()=>rosterFor(c).find(op=>op.id===operativeId);
   if(!c.operativeState[operativeId].weaponDropped&&primaryAmmoTypeFor(primary()))continue;
   const inventory=()=>sectorInventoryModel(c,c.location,rosterFor(c),operativeId);
   const carried=()=>inventory().carried.find(row=>row.inventoryKey&&row.equip?.some(option=>option.slot==='primary'&&option.valid)&&primaryAmmoTypeFor(JSON.parse(row.expected)));
   let firearm=carried();
   if(!firearm){
    const source=inventory().entries.find(row=>row.reachable&&primaryAmmoTypeFor(JSON.parse(row.expected)));
    if(source){
     order({type:'sectorInventory',sector:c.location,operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
     firearm=carried();assert.ok(firearm,'the collected local firearm must be available to equip');
    }
   }
   if(firearm)order({type:'sectorInventory',sector:c.location,operativeId,direction:'equip',inventoryKey:firearm.inventoryKey,expected:firearm.expected,slot:'primary'});
   else {
    const rifle=equipmentKey(equipmentCatalog(c).find(item=>item.id===1801));
    waitUntil(48,()=>c.merchants[c.location].stock[rifle]>0);
    order({type:'purchaseEquipment',item:rifle});order({type:'equip',operativeId,slot:'weapon',itemId:rifle});
   }
   assert.ok(!c.operativeState[operativeId].weaponDropped&&primaryAmmoTypeFor(primary()),'the actual hired soldier must hold a compatible firearm before supply');
  }
 };
 const recoverMissingBodyKit=ids=>{
  for(const operativeId of ids)for(const slot of ['headwear','outfit','legwear','blade']){
   const worn=slot==='blade'?rosterFor(c).find(op=>op.id===operativeId).blade:c.operativeState[operativeId][slot];
   if(slot==='blade'?worn>0:worn?.condition>0)continue;
   const matches=record=>slot==='blade'?!!BLADES[record.weapon]:record.kind==='outfit'&&record.outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot];
   const usable=row=>row.inventoryKey&&matches(JSON.parse(row.expected))&&row.equip.some(choice=>choice.slot===slot&&choice.valid);
   let model=sectorInventoryModel(c,c.location,rosterFor(c),operativeId),carried=model.carried.find(usable);
   if(!carried){
    const source=model.entries.filter(row=>row.reachable&&matches(JSON.parse(row.expected))).sort((a,b)=>Number(b.key.startsWith('ground:service-return-'))-Number(a.key.startsWith('ground:service-return-')))[0];
    assert.ok(source,`a finite local source must supply the coastal soldier ${operativeId}'s ${slot}`);
    const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
    order({type:'sectorInventory',sector:c.location,operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
    model=sectorInventoryModel(c,c.location,rosterFor(c),operativeId);carried=model.carried.find(usable);assert.ok(carried);
    const {item,...record}=JSON.parse(source.expected);assert.deepEqual(JSON.parse(carried.expected),record,'the actual local body item retains its metadata');
    const remaining=model.entries.find(row=>row.key===source.key)?.count??0;assert.equal(remaining,source.count-1,'the local source is consumed exactly once');
    assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before);
    report({event:'coastalReturnedKit',operativeId,slot,sourceKey:source.key,record,remaining,...before});
   }
   const record=JSON.parse(carried.expected);
   order({type:'sectorInventory',sector:c.location,operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});
   if(slot==='blade')assert.equal(rosterFor(c).find(op=>op.id===operativeId).blade,record.weapon);
   else assert.deepEqual(c.operativeState[operativeId][slot],record);
  }
 };
 assert.equal(c.location,'mendoza');assert.ok(c.operativeState[57].alive);
 const ready=op=>{const r=c.operativeState[op.id];return r.alive&&!r.captured&&!c.recruited.includes(op.id)&&r.hp===r.maxHp&&contractQuote(c,op,'week').available;};
 const chooseMedic=(preferred,excluded)=>{
  const roster=rosterFor(c),original=roster.find(op=>op.id===preferred);
  if(original&&ready(original)&&original.medical>=60&&!excluded.includes(original.id))return original.id;
  const replacement=roster.filter(op=>op.id>=100&&op.id<1000&&!excluded.includes(op.id)&&ready(op)&&op.medical>=60&&contractQuote(c,op,'day').price<=100).sort((a,b)=>b.medical-a.medical||b.marksmanship-a.marksmanship||a.id-b.id)[0];
  assert.ok(replacement,'a quoted living medical replacement must accept the coast contract');return replacement.id;
 };
 const doctorId=chooseMedic(107,[...expeditionIds,114,139,146]),reliefId=chooseMedic(146,[...expeditionIds,114,139,doctorId]);
 const hire=id=>{
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),before=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
  order({type:'recruitCivic',id,term:'week',destination:'mendoza'});assert.equal(c.resources.treasury,before-quote.price);keep.add(id);
 };
 hire(doctorId);
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(24,()=>c.recruited.includes(doctorId));
 const firstPatient=expeditionIds.includes(143)?143:expeditionIds[0],patients=[firstPatient,...expeditionIds.filter(id=>id!==firstPatient&&(c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding>0))];
 for(const patientId of patients){
  order({type:'assignCare',operativeId:patientId,assignment:'patient'});
  const careStart=c.hour,healthBefore=c.operativeState[patientId].hp;
  for(let h=0;h<36&&(c.operativeState[patientId].hp<c.operativeState[patientId].maxHp||c.operativeState[patientId].bleeding>0);h++){
   if(!c.operativeState[doctorId].medkits)order({type:'purchaseMedicalSupplies',operativeId:doctorId,quantity:1});
   order({type:'assignCare',operativeId:doctorId,assignment:'doctor'});order({type:'wait',hours:1});
  }
  assert.equal(c.operativeState[patientId].hp,c.operativeState[patientId].maxHp);assert.equal(c.operativeState[patientId].bleeding,0);
  order({type:'assignCare',operativeId:patientId,assignment:'rest'});
  report({event:'mountainSurvivorRecovered',id:patientId,healthBefore,healthAfter:c.operativeState[patientId].hp,hours:c.hour-careStart});
 }
 // The former expedition hires leave normally after treatment. Their living
 // records remain intact; they do not become free members of the new column.
 for(const id of expeditionIds)keep.delete(id);
 for(const id of [114,139,reliefId])hire(id);
 waitUntil(24,()=>[114,139,reliefId].every(id=>c.recruited.includes(id)));
 const field=[57,doctorId,114,139,reliefId];order({type:'squad',ids:field});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(600,()=>field.every(id=>{
  const r=c.operativeState[id];return r.morale>=65&&!r.fatigue&&!r.asleep;
 })&&c.resources.treasury>=8500);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 let p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,field).battle}));
 rearmMissingPrimaries(field);
 recoverMissingBodyKit(field);
 order({type:'travel',sector:'buenos_aires',mode:'posta'});
 order({type:'squad',ids:[57,doctorId,114,139]});c=meetRecruits(c,['dorrego','paroissien'],57);
 field.push(4,10);keep.add(4);keep.add(10);
 const groups=[];
 for(let offset=0;offset<field.length;offset+=6){
  order({type:'createSquad',ids:field.slice(offset,offset+6),sector:'buenos_aires',name:'Columna del puerto'});
  groups.push(c.activeSquadId);
  for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
  order({type:'travel',sector:'retiro',queue:true,mode:'posta'});
 }
 waitUntil(24,()=>groups.every(id=>!c.squads.find(q=>q.id===id).journey));
 for(const id of groups){
  order({type:'selectSquad',id});p=visit(c);
  c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,c.squad).battle}));
  rearmMissingPrimaries(c.squad);
  c=supplyRouteAmmunition(c,c.squad,{target:16}).campaign;c=finishReloadsBeforeMarch(c);
 }
 for(let count=0;count<2;count++){
  waitUntil(48,()=>c.merchants.retiro.stock.bronze4>0);
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(const operativeId of [10,139])if(c.operativeState[operativeId].medkits<10){
  order({type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits});
 }
 // The surviving local command cannot clear the port alone. Bank ordinary
 // income before hiring four living specialists and paying for their rest.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(2200,()=>c.resources.treasury>=40000,{income:true});
 const reinforcements=[105,128,132,145];
 for(const id of reinforcements){
  order({type:'recruitCivic',id,term:'day',destination:'retiro'});keep.add(id);
 }
 waitUntil(24,()=>reinforcements.every(id=>c.recruited.includes(id)));
 field.push(...reinforcements);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(160,()=>reinforcements.every(id=>c.operativeState[id].morale>=50));
 for(const operativeId of reinforcements)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'createSquad',ids:reinforcements,sector:'retiro',name:'Refuerzo del puerto'});
 p=visit(c);c=leave(sync({campaign:p.campaign,battle:equipOpeningRifles(p.battle,reinforcements).battle}));
 rearmMissingPrimaries(reinforcements);
 c=supplyRouteAmmunition(c,reinforcements,{target:16}).campaign;c=finishReloadsBeforeMarch(c);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 waitUntil(48,()=>c.hour%24===6&&field.every(id=>{
  const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;
 }));
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:['bronze4','bronze4']});
 c=prepareFinalAssault(c,{staging:'buenos_aires',target:'ensenada',fieldIds:field});
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.ok(expeditionIds.every(id=>c.operativeState[id].alive&&!c.recruited.includes(id)));
 const battle=enterSector(c.pendingBattle,c.sectorStates.ensenada);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 report({event:'createdCoastalAssaultReady',hour:c.hour,treasury:c.resources.treasury,field,events});
 return {campaign:c,field,events,roles:{expeditionIds,doctorId,reliefId}};
}

// The issued coastal guns share helpers at the entry. Pay for the actual
// relief pair to open the front gun's lane before the normal coastal orders.
export function createdCoastalBattery(campaign,{doctorId,reliefId}){
 const request=campaign.pendingBattle,sectorState=campaign.sectorStates.ensenada;
 assert.equal(request.sector,'ensenada');
 const initial=enterSector(request,sectorState),withdraw=withdrawCommandToRear(initial,57,'buenos_aires');
 const goal={x:Math.floor(initial.width*.65),y:Math.floor(initial.height*.5)};
 const guns=initial.artillery.filter(g=>g.side==='player').sort((a,b)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(b.x-goal.x,b.y-goal.y)||String(a.id).localeCompare(String(b.id)));
 assert.equal(guns.length,2);const front=guns[0],dx=Math.sign(goal.x-front.x);assert.notEqual(dx,0);
 const deploy=start=>{
  let battle=withdraw(start);const before=structuredClone(battle);
  for(const action of [
   {type:'move',unitId:String(doctorId),x:front.x,y:front.y,tacticalLevel:0},
   {type:'move',unitId:String(reliefId),x:front.x,y:front.y+1,tacticalLevel:0},
   {type:'artilleryMove',unitId:String(reliefId),artilleryId:front.id,x:front.x+dx,y:front.y},
   {type:'artilleryMove',unitId:String(reliefId),artilleryId:front.id,x:front.x+dx*2,y:front.y},
  ]){
   battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
  }
  const gunCustody=({x,y,...gun})=>gun;
  assert.deepEqual(battle.artillery.map(gunCustody),before.artillery.map(gunCustody),'crew movement retains every physical gun record');
  assert.deepEqual(battle.artillery.find(g=>g.id===guns[1].id),before.artillery.find(g=>g.id===guns[1].id),'the rear gun stays at its actual entry');
  for(const unit of battle.units){
   const old=before.units.find(u=>u.id===unit.id);
   for(const key of ['hp','maxHp','bleeding','ammo','loaded','loadedAmmoType','reloadProgress','ammunition','ammunitionVersion','medkits','rations','tonic','grenades','toolkitPoints','weapon','weaponInstanceId','weaponMetadata','condition','weaponFittings','weaponFittingPattern','blade','bladeInstanceId','bladeMetadata','bladeCondition','bladeFittingPattern','inventory','headwear','outfit','legwear'])assert.deepEqual(unit[key],old[key],`${unit.id}: ${key} remains under custody during crew movement`);
   assert.ok(unit.ap<=old.ap&&unit.energy<=old.energy,'ordinary movement cannot grant readiness');
  }
  assert.ok(battle.elapsedSeconds>before.elapsedSeconds,'the contact moves and gun drags spend actual tactical time');
  return battle;
 };
 return {deploy,controller:coastalSearchController(deploy(enterSector(request,sectorState,{placement:true})))};
}

// Continue the actual Cuyo survivors through port and river victories. The
// commander returns from his boundary exit before meeting the naval officers.
export function finishCreatedCoast(prefix,{onCheckpoint}={}){
 const prepared=prepareCreatedCoastalAssault(prefix.campaign);
 let campaign=prepared.campaign;const notes=[];
 const note=(stage,details={})=>{
  notes.push({stage,hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...details});
  onCheckpoint?.(stage,campaign,notes);
 };
 note('coastal-preparation',{field:prepared.field});
 const port=fightNorthernSector(campaign,'ensenada',createdCoastalBattery(campaign,prepared.roles));
 campaign=port.campaign;
 assert.equal(campaign.operativeState[57].location,'buenos_aires');
 note('ensenada',port.summary);
 campaign=recruitFreshNavalCommand(rejoinCommandAfterExit(campaign,57,'ensenada'));
 note('naval-command');
 campaign=recoverFreshPort(campaign);
 note('coastal-care');
 // The invasion clock can leave the capital friendly on this route. Fight
 // only an actual occupation, while keeping the blockade assertion below.
 if(campaign.sectors.buenos_aires.owner!=='patriot'){
  campaign=prepareFreshBlockadeAssault(campaign);
  const capital=fightNorthernSector(campaign,'buenos_aires',{controller:tucumanCombatOrder,deploy:deployInfantryLine});
  campaign=capital.campaign;note('buenos_aires',capital.summary);
 }
 assert.equal(campaign.blockade,false);
 campaign=prepareFreshSantaFeAssault(campaign);
 const river=fightNorthernSector(campaign,'santa_fe',{controller:coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.santa_fe))});
 campaign=river.campaign;note('santa_fe',river.summary);
 // A later naval occupation can leave the city flag friendly while closing
 // the road. Clear the real blockade before moving the Retiro rear guard.
 if(campaign.blockade){
  let capital;
  if(prepared.roles.expeditionIds.includes(135)){
   const staged=stageActualPaidCapitalRelief(campaign);
   campaign=prepareCreatedCapitalReturn(staged.campaign,{preparedFieldIds:staged.field,useStoredBattery:true});
   capital=fightNorthernSector(campaign,'buenos_aires',{deploy:deployCapitalLane,controller:stableCrewController()});
  }else{
   campaign=prepareCreatedCapitalReturn(campaign);
   capital=fightNorthernSector(campaign,'buenos_aires',{controller:coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires))});
  }
  campaign=capital.campaign;note('buenos_aires',capital.summary);
 }
 assert.equal(campaign.blockade,false);
 for(const [id,record]of Object.entries(prefix.campaign.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[57].alive,true);
 return {campaign,notes,prefix:prefix.notes,roles:prepared.roles};
}

// Reclaim the actual northern road before entering the high pass. Relief,
// forward treatment, the invading column and the physical gun transfers all
// retain their own paid time and casualty records.
export function finishCreatedNorthernReturn(prefix,{onCheckpoint}={}){
 if(prefix.roles?.expeditionIds.includes(135))return finishActualCreatedNorthernReturn(prefix,{onCheckpoint});
 let campaign=prepareCreatedNorthernRelief(prefix.campaign);const notes=[...prefix.notes];
 const note=(stage,details={})=>{
  notes.push({stage,hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...details});
  onCheckpoint?.(stage,campaign,notes);
 };
 note('northern-relief');
 const request=campaign.pendingBattle;
 const doctor=request.squad.filter(u=>u.medical>=60).sort((a,b)=>a.marksmanship-b.marksmanship||a.id-b.id)[0];
 assert.ok(doctor,'a real arriving doctor must return to the hospital');
 const deploy=withdrawCommandToRear(enterSector(request,campaign.sectorStates.tucuman),doctor.id,'cordoba');
 const tucuman=fightNorthernSector(campaign,'tucuman',{deploy,controller:stagedBatteryController()});
 campaign=tucuman.campaign;note('tucuman-return',tucuman.summary);
 campaign=prepareCreatedSaltaReturn(campaign);
 const salta=fightNorthernSector(campaign,'salta',{controller:stagedBatteryController()});
 campaign=salta.campaign;note('salta-return',salta.summary);
 campaign=prepareCreatedSaltaDefense(campaign);
 const defense=fightNorthernSector(campaign,'salta',{controller:stableCrewController()});
 campaign=defense.campaign;note('salta-defense',defense.summary);
 campaign=recoverCreatedSaltaDefense(campaign);
 note('salta-defense-care');
 campaign=prepareCreatedJujuyReturn(campaign);
 const search=coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.jujuy));
 const controller=(battle,unit)=>{
  const action=search(battle,unit);
  return unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
 const jujuy=fightNorthernSector(campaign,'jujuy',{controller});
 campaign=jujuy.campaign;note('jujuy',jujuy.summary);
 campaign=recoverCreatedJujuy(campaign);
 note('jujuy-care');
 campaign=prepareCreatedJujuyDefense(campaign);
 const defenseSearch=coastalSearchController(enterSector(campaign.pendingBattle,campaign.sectorStates.jujuy));
 const defenseController=(battle,unit)=>{
  const action=defenseSearch(battle,unit);
  return unit.id==='57'&&['move','climb','charge','artilleryMove','exit'].includes(action?.type)?null:action;
 };
 const northernDefense=fightNorthernSector(campaign,'jujuy',{controller:defenseController});
 campaign=northernDefense.campaign;note('jujuy-defense',northernDefense.summary);
 campaign=prepareCreatedHumahuacaReturn(campaign);
 const pass=fightNorthernSector(campaign,'humahuaca',{controller:heavyContactCrewController(),deploy:deployHighPassBattery});
 campaign=pass.campaign;note('humahuaca',pass.summary);
 campaign=stabilizeCreatedHighPass(campaign);note('humahuaca-stabilization');
 for(const [id,record]of Object.entries(prefix.campaign.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[57].alive,true);
 return {campaign,notes,prefix:prefix.prefix};
}

// Clear the actual final naval occupation before accepting campaign victory.
// The last high-pass crew returns for finite care and fields three paid guns.
export function finishCreatedFinalCapitalReturn(prefix,{onCheckpoint}={}){
 const five=prefix.campaign.squad.length===5&&[57,7,135,142,145].every(id=>prefix.campaign.squad.includes(id));
 let campaign=five?prepareCreatedFiveSurvivorCapitalReturn(prefix.campaign):prepareCreatedFinalCapitalReturn(prefix.campaign);
 const notes=[...prefix.notes];
 const initial=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 const result=five?fightCreatedFinalCapital(campaign,'buenos_aires',{...createdFiveSupportCapitalBattery(initial,{arrivalIds:campaign.pendingBattle.artillery.filter(g=>!g.stationed).map(g=>g.id)}),maxElapsedSeconds:10440*3600-(campaign.hour*3600+campaign.secondOfHour)}):fightNorthernSector(campaign,'buenos_aires',createdFinalCapitalBattery(initial));
 campaign=result.campaign;
 notes.push({stage:'buenos_aires-final',hour:campaign.hour,treasury:campaign.resources.treasury,squad:[...campaign.squad],...result.summary});
 onCheckpoint?.('buenos_aires-final',campaign,notes);
 assert.equal(campaign.completed,true);assert.equal(campaign.defeated,false);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
 assert.equal(campaign.blockade,false);assert.equal(campaign.phase,4);
 assert.equal(Object.keys(campaign.sectors).length,13);
 assert.ok(Object.values(campaign.sectors).every(s=>s.owner==='patriot'));
 assert.ok(!campaign.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status)));
 assert.ok(campaign.operativeState[57].alive&&campaign.operativeState[57].hp>=15);
 for(const [id,r]of Object.entries(prefix.campaign.operativeState))if(!r.alive)assert.equal(campaign.operativeState[id].alive,false);
 return {campaign,notes,prefix:prefix.prefix};
}
