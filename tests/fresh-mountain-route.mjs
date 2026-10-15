import {bankRouteIncome} from './route-income-banking.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {supplyKnownRouteDressings} from './route-known-medical-courier.mjs';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {transferRouteAmmunition} from './route-ammunition-transfer.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,dailyIncome} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {applyItemQuantity,handRecord,extractItemQuantity} from '../game/tactical-inventory.js';
import {planEquipLoot} from '../game/tactical.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {BLADES} from '../game/tactical.js';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {worldCell} from '../game/world-cells.js';
import {entryFromSector} from '../game/tactical-exits.js';
import {campaignRole} from '../game/campaign-roles.js';
import {careAssignmentReason,careAssignmentProgress} from '../game/medical-care.js';
import {operativeLocation,operativeInTransit,canCreateSquad,canReassignOperative} from '../game/squads.js';
import {worldOwner} from '../game/world-cells.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {queueSquadTravel,squadTravelStatus} from '../game/squad-travel.js';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';

const capableMountainActor=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.asleep&&!r.unconscious&&!r.routed&&!r.surrendered&&r.energy>10;};

function prepareMountainDressings(start,recipientId,target,{reserves={},report}={}){
 let c=start;
 const stock=()=>c.operativeState[recipientId].medkits+
  sectorInventoryModel(c,'mendoza',rosterFor(c),recipientId).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0)+
  c.recruited.filter(id=>id!==recipientId&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza'&&!sectorInventoryModel(c,'mendoza',rosterFor(c),id).reason).reduce((sum,id)=>sum+Math.max(0,c.operativeState[id].medkits-(reserves[id]??0)),0);
 for(let deliveries=0;stock()<target;deliveries++){
  assert.ok(deliveries<target,'Finite medical deliveries must make progress toward the existing reserve.');
  const before=stock(),delivery=collectRouteMedicalSupplies(c,recipientId,target-before,{mode:c.routes.posta?'posta':'march',report});c=delivery.campaign;
  assert.ok(delivery.collected>0&&stock()>before,'An ordinary courier must debit and deliver actual finite stock.');
 }
 return c;
}

const ownedMountainGuns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(scene=>scene.artillery??[])].filter(gun=>gun.side==='player');
function mountainBatteryRecords(c,batteryIds){
 assert.ok(Array.isArray(batteryIds)&&batteryIds.length>0&&batteryIds.length<=3&&new Set(batteryIds).size===batteryIds.length,'Explicit mountain guns must be distinct finite owned identities.');
 return batteryIds.map(id=>{const gun=ownedMountainGuns(c).find(gun=>gun.id===id);assert.ok(gun,`The actual mountain gun ${id} must retain canonical custody.`);return gun;});
}
function prepareMountainBattery(c,defaults,{batteryIds,destination,keepServing,report}){
 const records=batteryIds?mountainBatteryRecords(c,batteryIds):null;
 const result=prepareRouteBattery(c,records?records.map(gun=>gun.type):defaults,{destination,keepServing,report,...(records?{excludeIds:ownedMountainGuns(c).filter(gun=>!batteryIds.includes(gun.id)).map(gun=>gun.id)}:{})});
 if(records)assert.deepEqual(result.selections,batteryIds.map(id=>'depot:'+id),'The mountain column keeps the exact selected finite pieces.');
 return result;
}

// The extra native arsenal battle can leave only four unused replacements.
// Move healthy serving reserves from their actual friendly town and pay for
// ordinary rest. Injured clinic patients and the clinic physician stay there.
export const NATIVE_MOUNTAIN_RESERVE_BOUNDS=Object.freeze({count:6,preMarchRestHours:72,travelHours:168,readinessRestHours:600});
export function prepareNativeMountainReserve(start,{count=NATIVE_MOUNTAIN_RESERVE_BOUNDS.count,report=()=>{}}={}){
 let c=start;
 const ready=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id],local=c.recruited.includes(op.id)&&r.location==='mendoza';
  return op.id>=100&&op.id<1000&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&(local||!c.recruited.includes(op.id)&&contractQuote(c,op,'day').available);
 });
 const needed=Math.max(0,count-ready.length);if(!needed)return c;
 const reserves=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id];
  return op.id>=100&&op.id<1000&&c.recruited.includes(op.id)&&r.alive&&!r.captured&&!r.routed&&!r.unconscious&&r.hp===r.maxHp&&!r.bleeding&&op.medical<60&&r.location!=='mendoza'&&c.sectors[r.location]?.owner==='patriot'&&!c.squads.find(q=>q.members.includes(op.id))?.journey;
 }).sort((a,b)=>b.marksmanship-a.marksmanship||a.id-b.id).slice(0,needed).map(op=>op.id);
 assert.equal(reserves.length,needed,'Enough actual healthy serving reserves must remain for the native mountain column.');
 const originalSquad=c.activeSquadId,retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report}),order=retained.order,columns=[];
 for(const sector of new Set(reserves.map(id=>c.operativeState[id].location))){
  const local=reserves.filter(id=>c.operativeState[id].location===sector);
  for(let offset=0;offset<local.length;offset+=6){
   const ids=local.slice(offset,offset+6);order({type:'createSquad',name:'Reserva de la cordillera',ids,sector});const squadId=c.activeSquadId;columns.push(squadId);
   for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
   for(let hour=0;hour<NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours&&ids.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;});hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
   assert.ok(ids.every(id=>{const r=c.operativeState[id];return !r.fatigue&&r.energy===100&&!r.asleep;}),'Actual reserves must finish ordinary rest before travelling.');
   for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
   const cash=c.resources.treasury;order({type:'travel',sector:'mendoza',queue:true,mode:'posta'});
   report({event:'mountainNativeReserveTravel',ids,source:sector,squadId,bookingCost:cash-c.resources.treasury,hour:c.hour});
  }
 }
 for(let hour=0;hour<NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours&&columns.some(id=>c.squads.find(q=>q.id===id).journey);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='mendoza'&&!c.squads.find(q=>q.id===id).journey),'Actual reserves must arrive before mountain preparation.');
 for(const operativeId of reserves)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours&&reserves.some(id=>{const r=c.operativeState[id];return r.morale<50||r.fatigue||r.energy<100||r.asleep;});hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(reserves.every(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&!r.fatigue&&r.energy===100&&!r.asleep;}),'Public paid rest must restore actual reserve readiness.');
 order({type:'selectSquad',id:originalSquad});report({event:'mountainNativeReserveReady',ids:reserves,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury});return c;
}

// A spent rifle cannot use surviving musket cartridges. Keep its actual gun
// and rounds in the owner's pockets, and equip a known finite long gun only
// when that gun's compatible local stock meets the same readiness target.
export function supplyFreshMountainAmmunition(start,ids,{target=12,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(target)&&target>=0&&target<=1_000_000,'Use a finite integer ammunition target.');
 let c=structuredClone(start);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);report({event:'mountainArmamentOrder',action,hour:c.hour,secondOfHour:c.secondOfHour??0});};
 for(const id of ids){
  const model=()=>sectorInventoryModel(c,c.location,rosterFor(c),id);
  const carried=()=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
  const knownRounds=family=>family?(c.ammunitionStores[c.location]?.[family]??0)+model().entries.filter(row=>row.reachable&&JSON.parse(row.expected).kind==='ammunition'&&JSON.parse(row.expected).ammoType===AMMUNITION_FAMILIES[family].type).reduce((sum,row)=>sum+row.count,0):0;
  const stocked=unit=>{const family=ammoTypeFor({...unit,activeSlot:'primary'});return family&&unit.loaded+ammoCount(unit,family)+knownRounds(family)>=target;};
  const unit=carried();
  if(ammoTypeFor(unit)&&!unit.weaponDropped&&!stocked(unit)){
   const before=model(),keys=new Set(Object.keys(before.personal.inventory??{}));
   const usable=stack=>[1800,1801,1803].includes(stack.weapon)&&stack.condition>0;
   let choice=before.carried.filter(row=>row.inventoryKey&&row.expected&&usable(JSON.parse(row.expected))&&row.equip?.some(option=>option.slot==='primary'&&option.valid)).map(row=>({row,planned:planEquipLoot(before.personal,row.inventoryKey,'primary')})).find(candidate=>stocked(candidate.planned));
   if(!choice)for(const row of before.entries.filter(row=>row.reachable&&usable(JSON.parse(row.expected)))){
    try{
     const packed=applyItemQuantity(before.personal,{...JSON.parse(row.expected),count:1}),inventoryKey=Object.keys(packed.inventory).find(key=>!keys.has(key));
     if(!inventoryKey)continue;
     const planned=planEquipLoot(packed,inventoryKey,'primary');
     if(stocked(planned)){choice={source:row,inventoryKey,planned};break;}
    }catch{continue;}
   }
   if(choice){
    const oldGun=handRecord(before.personal,'primary');
    if(choice.source)order({type:'sectorInventory',sector:c.location,operativeId:id,direction:'take',sourceKey:choice.source.key,expected:choice.source.expected,count:1});
    const gun=choice.row??model().carried.find(row=>row.inventoryKey===choice.inventoryKey);
    assert.ok(gun?.equip.some(option=>option.slot==='primary'&&option.valid),'the actual finite replacement must remain admitted');
    order({type:'sectorInventory',sector:c.location,operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
    assert.deepEqual(handRecord(model().personal,'primary'),handRecord(choice.planned,'primary'),'replacement keeps the actual finite firearm metadata');
    assert.ok(Object.values(c.operativeState[id].inventory).some(item=>Object.entries(oldGun).every(([key,value])=>JSON.stringify(item[key])===JSON.stringify(value))),'the previous firearm and its load remain carried');
    report({event:'mountainFiniteArmament',operativeId:id,oldWeapon:oldGun.weapon,weapon:carried().weapon,sourceKey:choice.source?.key??null,inventoryKey:gun.inventoryKey});
   }
  }
  // Allocate each actor in order so several rifles cannot claim the same last
  // loose rounds. The original finite helper retains its shortage refusal.
  const family=ammoTypeFor({...carried(),activeSlot:'primary'});
  let shortage=family?Math.max(0,target-carried().loaded-ammoCount(carried(),family)-knownRounds(family)):0;
  if(shortage)for(const donorId of c.recruited.filter(donorId=>!ids.includes(donorId))){
   const record=c.operativeState[donorId];
   if(!record?.alive||record.captured||record.location!==c.location||sectorInventoryModel(c,c.location,rosterFor(c),donorId).reason)continue;
   const reserve=ammoCount(carriedAmmunition(rosterFor(c).find(op=>op.id===donorId),record),family),count=Math.min(shortage,Math.max(0,reserve-2));
   if(count){c=transferRouteAmmunition(c,{recipientId:id,donorIds:[donorId],family,count,report}).campaign;shortage-=count;}
   if(!shortage)break;
  }
  c=supplyRouteAmmunition(c,[id],{target,report}).campaign;
 }
 return c;
}

// Preserve the real partial care report before checking completion or leaving.
// A stopped approach can already have paid time, wounds and finite dressings.
export function performFreshMountainFirstAid(opened,{stage='mountain-first-aid',report=()=>{}}={}){
 const aid=autoBandageBattle(opened.battle);
 // autoBandageBattle stops at the first rejection and includes that final
 // attempt in steps. It has no paid effects and is outside the accepted trace.
 const rejectedStep=aid.battle.lastError&&aid.steps.length?{action:aid.steps.at(-1),reason:aid.battle.lastError}:null;
 const steps=rejectedStep?aid.steps.slice(0,-1):aid.steps;
 report({event:'freshMountainAidOrders',stage,steps,attemptedSteps:aid.steps,
  rejectedStep,clockSynchronized:false,campaign:opened.campaign,battle:aid.battle,
  stoppedReason:aid.stoppedReason,untreated:aid.untreated});
 const partial=sync({campaign:opened.campaign,battle:aid.battle});
 report({event:'freshMountainAidCheckpoint',stage,steps,rejectedStep,clockSynchronized:true,...partial});
 if(rejectedStep||aid.stoppedReason||aid.untreated.length){
  const reason=rejectedStep?.reason??aid.stoppedReason??'Finite first aid left untreated survivors.';
  report({event:'freshRouteStopped',stage,reason,steps,rejectedStep,untreated:aid.untreated,...partial});
  const error=Error(reason);error.pair=partial;error.steps=steps;throw error;
 }
 return leave(partial);
}

// Choose a complete column at current quotes. The banked treasury also pays
// for finite supplies; Los Patos reserves a second day for its longer march.
function affordableMountainColumn(c,count,{reserve=1500,paidDays=1,exclude=[],preferRetention=false}={}){
 const budget=Math.max(0,(c.resources.treasury-reserve)/paidDays);
 const candidates=rosterFor(c).map(op=>({op,quote:c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'?{available:true,price:0}:contractQuote(c,op,'day')})).filter(({op,quote})=>{
  const unit=c.operativeState[op.id];
  return op.id>=100&&op.id<1000&&!exclude.includes(op.id)&&unit.alive&&!unit.captured&&unit.hp===unit.maxHp&&unit.morale>=50&&quote.available&&quote.price<=budget&&(!preferRetention||!c.recruited.includes(op.id)||freeMountainDuty(c,op)&&canReassignOperative(c,op.id));
 }).map(row=>({...row,daily:contractQuote(c,row.op,'day').price})).sort((a,b)=>preferRetention?a.daily-b.daily||b.op.marksmanship-a.op.marksmanship:b.op.marksmanship-a.op.marksmanship||a.quote.price-b.quote.price);
 let best=null;
 const choose=(offset,selected,price,score,daily=0)=>{
  if(selected.length===count){if(!best||preferRetention&&daily<best.daily||(!preferRetention||daily===best.daily)&&(score>best.score||score===best.score&&price<best.price))best={ids:selected.map(row=>row.op.id),price,score,daily};return;}
  if(candidates.length-offset<count-selected.length)return;
  for(let i=offset;i<candidates.length;i++){
   const candidate=candidates[i];if(price+candidate.quote.price>budget)continue;
   choose(i+1,[...selected,candidate],price+candidate.quote.price,score+candidate.op.marksmanship+candidate.op.medical*.05,daily+candidate.daily);
  }
 };
 choose(0,[],0,0);
 assert.ok(best,`${count} ready replacements must fit actual quotes, ${paidDays} paid days and the supply reserve`);
 return best;
}

function restorePaidMountainVeterans(start,{report=()=>{}}={}){
 let c=start;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
 const veterans=rosterFor(c).filter(op=>{
  const unit=c.operativeState[op.id],quote=contractQuote(c,op,'day');
  return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&unit.alive&&!unit.captured&&unit.location&&unit.hp===unit.maxHp&&!unit.bleeding&&unit.morale<50&&quote.available&&quote.price<=routeHiringCeiling(c,100);
 }).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,6).map(op=>op.id);
 if(!veterans.length)return c;
 for(const id of veterans){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury,source=c.operativeState[id].location,destination=c.sectors[source]?.owner==='patriot'?source:'mendoza';
  order({type:'recruitCivic',id,term:'week',destination});assert.equal(c.resources.treasury,cash-quote.price);
  report({event:'mountainVeteranRehired',id,price:quote.price,hour:c.hour,morale:c.operativeState[id].morale,source,destination});
 }
 for(let h=0;h<24&&veterans.some(id=>!c.recruited.includes(id));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 const columns=[];
 for(const sector of new Set(veterans.map(id=>c.operativeState[id].location))){
  const local=veterans.filter(id=>c.operativeState[id].location===sector);
  for(let offset=0;offset<local.length;offset+=6){
   const members=local.slice(offset,offset+6);order({type:'createSquad',name:'Veteranos de Mendoza',ids:members,sector});columns.push(c.activeSquadId);
   if(sector!=='mendoza'){for(const operativeId of members)order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
  }
 }
 for(let h=0;h<48&&columns.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const operativeId of veterans){assert.ok(c.recruited.includes(operativeId));assert.equal(c.operativeState[operativeId].location,'mendoza');order({type:'assignCare',operativeId,assignment:'rest'});}
 for(let h=0;h<600&&veterans.some(id=>c.operativeState[id].morale<50);h++){
  assert.equal(c.pendingEncounter,null);
  order({type:'wait',hours:1});
 }
 for(const id of veterans){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.ok(c.operativeState[id].morale>=50);}
 report({event:'mountainVeteransRested',hour:c.hour,treasury:c.resources.treasury,units:veterans.map(id=>({id,morale:c.operativeState[id].morale,expiresAt:c.contracts[id].expiresAt}))});
 return c;
}

export function collectReturnedMountainKit(start,ids,{report=()=>{}}={}){
 let c=start;const originalRoster=rosterFor(c);
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
 for(const operativeId of ids)for(const slot of ['headwear','outfit','legwear','blade']){
  const operative=rosterFor(c).find(op=>op.id===operativeId);
  const worn=slot==='blade'?operative.blade:c.operativeState[operativeId][slot];
  // Local permanent recruits retain deliberate native empty clothing slots.
  // Paid returned kits, broken worn garments and blades still need real stock.
  if(slot!=='blade'&&worn===null&&operative.recruitmentSource==='encounter'&&c.contracts[operativeId]?.kind==='patriot'&&c.contracts[operativeId].expiresAt===null)continue;
  if(slot==='blade'?worn>0:worn?.condition>0)continue;
  const blade=originalRoster.find(op=>op.id===operativeId)?.blade;
  const matches=record=>slot==='blade'?!!BLADES[record.weapon]&&(!blade||record.weapon===blade):record.kind==='outfit'&&record.outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot];
  const usable=row=>row.inventoryKey&&matches(JSON.parse(row.expected))&&row.equip.some(choice=>choice.slot===slot&&choice.valid);
  // Pay due serving terms before quoting the zero-time physical collection.
  retained.retain();
  let model=sectorInventoryModel(c,'mendoza',rosterFor(c),operativeId),carried=model.carried.find(usable),receipt=null;
  if(!carried){
   const source=model.entries.filter(row=>row.reachable&&matches(JSON.parse(row.expected))).sort((a,b)=>Number(b.key.startsWith('ground:service-return-'))-Number(a.key.startsWith('ground:service-return-')))[0];
   assert.ok(source,`a real local source must supply ${operativeId}'s missing ${slot}`);
   const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
   order({type:'sectorInventory',sector:'mendoza',operativeId,direction:'take',sourceKey:source.key,expected:source.expected,count:1});
   model=sectorInventoryModel(c,'mendoza',rosterFor(c),operativeId);carried=model.carried.find(usable);assert.ok(carried);
   const {item,...record}=JSON.parse(source.expected);assert.deepEqual(JSON.parse(carried.expected),record,'collection preserves the actual returned item');
   const remaining=model.entries.find(row=>row.key===source.key)?.count??0;assert.equal(remaining,source.count-1,'the finite local source is debited once');
   assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before,'local collection does not change time or treasury');
   receipt={event:'mountainReturnedKit',operativeId,slot,sourceKey:source.key,record,sourceCount:source.count,remaining,...before};
  }
  const record=JSON.parse(carried.expected);
  order({type:'sectorInventory',sector:'mendoza',operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});
  if(slot==='blade')assert.equal(rosterFor(c).find(op=>op.id===operativeId).blade,record.weapon);
  else assert.deepEqual(c.operativeState[operativeId][slot],record,'equipment retains the collected clothing metadata');
  if(receipt)report(receipt);
 }
 return c;
}

// Normal funding, equipment, timed approaches and explicitly coordinated squads.
export function prepareFreshUspallataAssault(start,{guns=2,batteryIds=null,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
const leader=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&capableMountainActor(c,op.id)&&op.leadership>=60)
 .sort((a,b)=>Number(c.operativeState[b.id].morale>=50)-Number(c.operativeState[a.id].morale>=50)||Number(c.operativeState[b.id].location==='mendoza')-Number(c.operativeState[a.id].location==='mendoza')||b.leadership-a.leadership||a.id-b.id)[0];
assert.ok(leader,'the actual mountain column needs a serving capable leader');
const leaderSquad=c.squads.find(q=>q.members.includes(leader.id)&&!q.journey);
if(leaderSquad)order({type:'selectSquad',id:leaderSquad.id});
else order({type:'createSquad',name:'Comando de la cordillera',ids:[leader.id],sector:c.operativeState[leader.id].location});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
if(c.location!=='mendoza')order({type:'travel',sector:'mendoza',mode:'posta'});
report({event:'mountainServingLeader',id:leader.id,hour:c.hour,second:c.secondOfHour??0,location:c.operativeState[leader.id].location});
const locals=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';});
c=bankRouteIncome(c,400,{keepIds:retained.keepIds(),report});
order({type:'diplomacy',kind:'parliament'});order({type:'fortify',sector:'mendoza'});
for(const operativeId of locals)order({type:'assignCare',operativeId,assignment:'rest'});
c=bankRouteIncome(c,12000,{keepIds:retained.keepIds(),report});
c=restorePaidMountainVeterans(c,{report});
if(batteryIds)c=prepareNativeMountainReserve(c,{report});
for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
// Contracts can expire while the treasury recovers. Select a physician who
// is still in service at departure, rather than keeping a stale roster entry.
const physician=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&capableMountainActor(c,op.id)&&c.operativeState[op.id].location==='mendoza'&&op.id!==leader.id&&op.medical>=20).sort((a,b)=>Number(c.operativeState[b.id].morale>=50)-Number(c.operativeState[a.id].morale>=50)||b.medical-a.medical||a.id-b.id)[0];assert.ok(physician,'the mountain column needs a living local medic');
const column=affordableMountainColumn(c,6,{exclude:[leader.id,physician.id]}),recruits=column.ids;
assert.equal(recruits.length,6,'six living and ready replacements must accept paid contracts');
report({event:'mountainPaidColumn',sector:'uspallata',ids:recruits,price:column.price,hour:c.hour,treasury:c.resources.treasury});
const rearm=recruits.filter(id=>![1800,1801,1802].includes(rosterFor(c).find(op=>op.id===id).weapon));
for(let h=0;h<24&&(c.hour%24<6||c.hour%24>10);h++)order({type:'wait',hours:1});
for(const id of recruits){if(c.recruited.includes(id))continue;retained.retain();const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.price);}
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(recruits.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
c=collectReturnedMountainKit(c,recruits,{report});
for(const operativeId of rearm)c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,replace:true,report});
order({type:'squad',ids:[leader.id,physician.id,...recruits.slice(0,4)]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo de la cordillera',ids:recruits.slice(4),sector:'mendoza'});const support=c.activeSquadId,columns=[main,support];
const field=[leader.id,physician.id,...recruits];
// Redistribute actual remaining field dressings and known local cartridges.
c=prepareMountainDressings(c,physician.id,15,{report});
c=supplyKnownRouteDressings(c,physician.id,15,{report});
// Finish real reloads before attaching the recovered reserve battery.
c=supplyFreshMountainAmmunition(c,field,{target:12,report});
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<48&&field.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue||r.asleep;});h++)order({type:'wait',hours:1});
assert.ok(field.every(id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;}),'Actual field reserves must finish ordinary rest before departure.');
order({type:'configureArtillery',types:[]});
for(const id of columns){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:main});if(batteryIds){assert.equal(batteryIds.length,guns);assert.ok(mountainBatteryRecords(c,batteryIds).every(gun=>gun.loaded||gun.ammo>0),'Explicit Uspallata support must carry actual remaining rounds.');}
const battery=prepareMountainBattery(c,Array.from({length:guns},()=> 'bronze4'),{batteryIds,destination:'mendoza',keepServing:retained.keepIds(),report});c=battery.campaign;order({type:'configureArtillery',types:battery.selections});
for(const id of columns){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
for(let i=0;i<16&&!columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
order({type:'beginAssault',sector:'uspallata'});
 assert.deepEqual(c.pendingBattle.squad.map(unit=>unit.id).sort((a,b)=>a-b),field.slice().sort((a,b)=>a-b));return c;
}

// Recover finite field dressings and give real first aid before the return.
// Hire an actual available doctor and retain every intended serving survivor.
export function recoverFreshUspallata(start,{batteryIds=null,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
const survivors=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='uspallata';});
assert.ok(survivors.length>0,'the actual mountain survivors need recovery');
const doctors=rosterFor(c).filter(o=>survivors.includes(o.id)&&c.operativeState[o.id].hp>=15&&!c.operativeState[o.id].bleeding&&o.medical>=20).sort((a,b)=>b.medical-a.medical).map(o=>o.id);
assert.ok(doctors.length);
const remaining=[...survivors],groups=[],localSlots=c.squads.filter(q=>q.location==='uspallata'&&!q.journey).map(q=>q.id);
while(remaining.length){
 const doctor=doctors.find(id=>remaining.includes(id));assert.notEqual(doctor,undefined,'each physical recovery squad needs a conscious physician');
 const reservedDoctors=doctors.filter(id=>id!==doctor&&remaining.includes(id)).slice(0,Math.ceil(remaining.length/6)-1);
 const members=[doctor,...remaining.filter(id=>id!==doctor&&!reservedDoctors.includes(id))].slice(0,6);
 for(const id of members)remaining.splice(remaining.indexOf(id),1);
 const slot=localSlots.find(id=>!groups.some(group=>group.id===id));
 if(slot){order({type:'selectSquad',id:slot});order({type:'squad',ids:members});}
 else order({type:'createSquad',name:'Socorro de la cordillera',ids:members,sector:'uspallata'});
 groups.push({id:c.activeSquadId,members});
}
for(const id of doctors)for(const row of sectorInventoryModel(c,'uspallata',rosterFor(c),id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){const count=Math.min(row.count,10-c.operativeState[id].medkits);if(count>0)order({type:'sectorInventory',sector:'uspallata',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});}
for(const group of [...groups].sort((a,b)=>Number(b.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0))-Number(a.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0)))){
 order({type:'selectSquad',id:group.id});
 c=performFreshMountainFirstAid(visit(c),{stage:'uspallata-first-aid',report});
}
report({event:'mountainFirstAid',hour:c.hour,survivors:survivors.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}))});
for(const id of survivors){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);order({type:'assignCare',operativeId:id,assignment:'active'});}
order({type:'fortify',sector:'uspallata'});
const crewRequired=batteryIds?Math.max(...mountainBatteryRecords(c,batteryIds).map(gun=>artilleryProfile(c,gun).crew)):2;
const batteryCrew=groups.find(group=>group.members.length>=crewRequired);assert.ok(batteryCrew,'enough real local survivors must store the actual mountain guns');order({type:'selectSquad',id:batteryCrew.id});
c=prepareMountainBattery(c,['bronze4','bronze4'],{batteryIds,destination:'uspallata',keepServing:retained.keepIds(),report}).campaign;
for(const group of groups){order({type:'selectSquad',id:group.id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
for(let h=0;h<48&&groups.some(group=>c.squads.find(q=>q.id===group.id)?.journey);h++){
 order({type:'wait',hours:1});
}
for(const id of survivors)assert.equal(c.operativeState[id].location,'mendoza');
const clinic=groups.find(group=>group.members.length<6);
if(clinic)order({type:'selectSquad',id:clinic.id});
else order({type:'createSquad',name:'Médicos de Mendoza',ids:[doctors[0]],sector:'mendoza'});
assert.equal(c.location,'mendoza');
const patients=survivors.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
const servingDoctor=rosterFor(c).find(o=>c.recruited.includes(o.id)&&!patients.includes(o.id)&&c.operativeState[o.id].alive&&c.operativeState[o.id].hp>=15&&c.operativeState[o.id].location==='mendoza'&&o.medical>=20);
if(patients.length&&!servingDoctor){
 const medic=rosterFor(c).filter(o=>o.id>=100&&o.id<1000&&!c.recruited.includes(o.id)&&c.operativeState[o.id].alive&&o.medical>=60&&contractQuote(c,o,'day').available&&contractQuote(c,o,'day').price<=c.resources.treasury-50).sort((a,b)=>b.medical-a.medical)[0];assert.ok(medic,'actual funds must afford the available physician and finite dressings');
 const medicQuote=contractQuote(c,medic,'day'),medicCash=c.resources.treasury;order({type:'recruitCivic',id:medic.id,term:'day'});assert.equal(c.resources.treasury,medicCash-medicQuote.price);
 for(let h=0;h<24&&!c.recruited.includes(medic.id);h++){
   order({type:'wait',hours:1});
 }
 assert.equal(c.operativeState[medic.id].location,'mendoza');assert.ok(c.recruited.includes(medic.id));
}
const localDoctors=rosterFor(c).filter(o=>c.recruited.includes(o.id)&&!patients.includes(o.id)&&c.operativeState[o.id].alive&&!c.operativeState[o.id].captured&&c.operativeState[o.id].location==='mendoza'&&o.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,patients.length).map(o=>o.id);
// A selected physician must keep the dressing already allocated for this
// medical hour. Cycling it through the other doctors leaves care blocked.
const medicalReserves=Object.fromEntries(localDoctors.map(id=>[id,1]));
c=bankRouteIncome(c,5000,{keepIds:retained.keepIds(),report});
for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 assert.equal(c.pendingEncounter,null);
 for(const id of localDoctors){if(!c.operativeState[id].medkits)c=supplyRouteDressings(c,id,1,{reserves:medicalReserves,report});order({type:'assignCare',operativeId:id,assignment:'doctor'});}
 for(const id of patients)order({type:'assignCare',operativeId:id,assignment:'patient'});
 order({type:'wait',hours:1});report({event:'mountainMedicalCare',hour:c.hour,treasury:c.resources.treasury,patients:patients.map(id=>({id,hp:c.operativeState[id].hp}))});
}
for(const id of survivors){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
return c;
}

const freeMountainDuty=(c,op)=>{
 const r=c.operativeState[op.id];
 if(r.assignment==='doctor')return careAssignmentProgress(c,op,rosterFor(c)).code==='no_patients';
 return ['active','rest','patient'].includes(r.assignment);
};

// End only completed local duty which the actual next force does not need.
// Native dismissal returns its finite property; it grants no refund or time.
export function completeMountainPaidDuties(start,{fieldIds,doctorIds=[],protectedIds=[],horizonSeconds,fixedCost=0,report=()=>{}}={}){
 let c=structuredClone(start);
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const sector=c.location,roster=rosterFor(c),required=new Set([...fieldIds,...doctorIds,...protectedIds,...['foundryEngineer','marchCommander'].map(key=>campaignRole(c,key)?.id).filter(id=>id!==undefined)]);
 assert.ok(fieldIds.length&&new Set(fieldIds).size===fieldIds.length&&fieldIds.every(id=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured),'The continuing mountain field must remain actually serving.');
 assert.ok(doctorIds.every(id=>fieldIds.includes(id)&&roster.find(op=>op.id===id)?.medical>=60),'Actual selected field physicians retain their required skill.');
 const orders=[],completed=[],retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:event=>{if(event.event==='freshRouteOrder'||event.event==='freshRouteRenewal')orders.push(structuredClone(event.action));report(event);}});
 const budget=()=>quoteMountainServiceBudget(c,{keepIds:retained.keepIds(),horizonSeconds,fixedCost});
 const threatened=()=>c.enemyGroups.some(group=>group.target===sector&&['marching','waiting','engaged','stationed'].includes(group.status));
 const patients=()=>roster.some(op=>c.recruited.includes(op.id)&&c.operativeState[op.id]?.alive&&!c.operativeState[op.id].captured&&operativeLocation(c,op.id)===sector&&(c.operativeState[op.id].hp<c.operativeState[op.id].maxHp||c.operativeState[op.id].bleeding));
 const eligible=op=>{
  const r=c.operativeState[op.id],contract=c.contracts[op.id];
  return !required.has(op.id)&&c.recruited.includes(op.id)&&contract?.kind==='paid'&&!contract.guaranteeId&&!contract.departurePending&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.unconscious&&!r.routed&&!r.surrendered&&!r.asleep&&r.energy>10&&canReassignOperative(c,op.id)&&!operativeInTransit(c,op.id)&&operativeLocation(c,op.id)===sector&&worldOwner(c,sector)==='patriot'&&!threatened()&&!c.militiaTraining.some(course=>course.trainerId===op.id)&&freeMountainDuty(c,op)&&!(op.medical>=20&&patients());
 };
 const candidates=roster.filter(eligible).sort((a,b)=>contractRenewalQuote(c,b,'day').price-contractRenewalQuote(c,a,'day').price||a.id-b.id);
 for(const op of candidates){
  const current=budget();if(current.available||!current.shortfall||current.entries.some(row=>row.reason))break;
  if(!eligible(op))continue;
  const collector=fieldIds.find(id=>id!==op.id&&operativeLocation(c,id)===sector&&c.operativeState[id].hp>=15&&!c.operativeState[id].asleep);assert.notEqual(collector,undefined,'An actual continuing local soldier must retain access to returned property.');
  const model=sectorInventoryModel(c,sector,rosterFor(c),op.id);if(model.operativeId!==op.id||model.reason)continue;
  const kit=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count).stack),oldKeys=new Set(sectorInventoryModel(c,sector,rosterFor(c),collector).entries.map(row=>row.key));
  retained.retain();if(c.pendingEncounter||c.pendingBattle)throw Error('A real encounter interrupts completed mountain duty.');
  const before=structuredClone(c),cash=c.resources.treasury,at=c.hour*3600+(c.secondOfHour??0);
  retained.order({type:'dismiss',id:op.id});
  assert.equal(c.resources.treasury,cash);assert.equal(c.hour*3600+(c.secondOfHour??0),at);assert.equal(c.recruited.includes(op.id),false);assert.equal(c.contracts[op.id],undefined);
  for(const key of ['hp','maxHp','bleeding','bandaged','alive','energy','fatigue','morale','location'])assert.deepEqual(c.operativeState[op.id][key],before.operativeState[op.id][key],`Completed service preserves ${op.id}'s ${key}.`);
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
  const returned=sectorInventoryModel(c,sector,rosterFor(c),collector).entries.filter(row=>!oldKeys.has(row.key)).map(row=>JSON.parse(row.expected));
  const ordered=rows=>rows.map(row=>JSON.stringify(row)).sort();assert.deepEqual(ordered(returned),ordered(kit),'Every exact carried stack remains in the local service return once.');
  const receipt={id:op.id,kit:structuredClone(kit),hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury};completed.push(receipt);report({event:'mountainPaidDutyCompleted',...receipt,field:[...fieldIds],doctors:[...doctorIds],campaign:c});
 }
 return {campaign:c,completed,orders,budget:budget()};
}

// Forecast the complete existing parallel route from public world geometry.
// Future-origin squad drafts are quotations only and are never adopted.
export function mountainLosPatosDeparturePlan(c,{columns,batteryIds=null,stage='mendoza'}={}){
 assert.ok(['mendoza','uspallata','flanks','assault'].includes(stage));
 const groups=columns.map(id=>{const q=c.squads.find(group=>group.id===id);assert.ok(q);return q;}),destination=worldCell('los_patos',c);
 const origins=['uspallata',`cell-${destination.col}-${destination.row-1}`,`cell-${destination.col}-${destination.row+1}`,`cell-${destination.col-1}-${destination.row}`];
 let fixedCost=0,hours=0;
 const route=(q,from,to,mode,intent='travel')=>{
  if(from===to)return 0;
  const draft={...q,location:from,members:[...q.members]};delete draft.journey;
  queueSquadTravel(c,draft,{sector:to,mode,intent});const quote=squadTravelStatus(draft,c);
  if(mode==='posta')fixedCost+=10*(quote.path.length-1);
  return quote.remaining;
 };
 if(stage==='mendoza'){
  // Recovery has already stored these exact guns at the real arrival depot.
  // Unknown transport/rest work cannot be priced as a zero-hour delivery.
  const stored=c.artilleryDepots.uspallata??[],ids=batteryIds??stored.filter(gun=>gun.side==='player'&&gun.type==='bronze4').slice(0,2).map(gun=>gun.id);
  assert.ok(ids.length&&ids.every(id=>stored.some(gun=>gun.id===id)),'Finish the actual mountain battery delivery before quoting departure.');
  hours+=Math.max(...groups.map(q=>route(q,q.location,'uspallata','posta')));
 }
 if(['mendoza','uspallata'].includes(stage))hours+=Math.max(...groups.map((q,index)=>route(q,'uspallata',origins[index],'march')));
 if(stage!=='assault')hours+=Math.max(...groups.map((q,index)=>route(q,origins[index],'los_patos',index?'march':'posta','attack')));
 let horizonSeconds=c.hour*3600+(c.secondOfHour??0)+hours*3600,daylightHours=0;
 while(Math.floor(horizonSeconds/3600)%24<6||Math.floor(horizonSeconds/3600)%24>10){horizonSeconds+=3600;daylightHours++;assert.ok(daylightHours<24);}
 const assaultSeconds=horizonSeconds,retentionBufferSeconds=3600;
 // Even the final zero-time select/begin orders retain one actual route hour.
 horizonSeconds+=retentionBufferSeconds;
 return {stage,hours,daylightHours,assaultSeconds,retentionBufferSeconds,horizonSeconds,fixedCost};
}
const mountainFieldPool=(c,sector,exclude=[])=>rosterFor(c).filter(op=>{
 const r=c.operativeState[op.id],local=c.recruited.includes(op.id)&&operativeLocation(c,op.id)===sector;
 return !exclude.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&
  (local&&capableMountainActor(c,op.id)&&!operativeInTransit(c,op.id)||
   !c.recruited.includes(op.id)&&op.id>=100&&op.id<1000&&contractQuote(c,op,'day').available);
});

// Use actual serving reserves before long local rest. Extract only the fit
// reserve from a mixed home group; its stable patient stays at the real source.
// Fit reserves queue their ordinary routes before native time advances.
export function prepareMountainServingReserves(start,{sector=start.location,fieldCount=8,doctorCount=2,exclude=[],report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(fieldCount)&&fieldCount>=1&&fieldCount<=24&&Number.isSafeInteger(doctorCount)&&doctorCount>=1&&doctorCount<=4,'Use the existing bounded mountain force and doctor counts.');
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const local=mountainFieldPool(c,sector,exclude),doctors=local.filter(op=>op.medical>=60);
 const needed=Math.max(0,fieldCount-local.length,doctorCount-doctors.length);if(!needed)return c;
 const chosen=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id];
  return !exclude.includes(op.id)&&c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.unconscious&&!r.routed&&!r.surrendered&&operativeLocation(c,op.id)!==sector&&!operativeInTransit(c,op.id)&&freeMountainDuty(c,op)&&!careAssignmentReason(c,op,'active');
 }).sort((a,b)=>Number(doctors.length<doctorCount&&b.medical>=60)-Number(doctors.length<doctorCount&&a.medical>=60)||Number(c.contracts[b.id]?.expiresAt===null)-Number(c.contracts[a.id]?.expiresAt===null)||b.marksmanship-a.marksmanship||b.medical-a.medical||a.id-b.id).slice(0,Math.min(needed,NATIVE_MOUNTAIN_RESERVE_BOUNDS.count)).map(op=>op.id);
 if(!chosen.length)return c;
 assert.equal(worldOwner(c,sector),'patriot','Serving reserves need a controlled assembly locality.');
 const original=c.activeSquadId,events=[],emit=event=>{const {campaign,battle,...record}=event;events.push(record);},retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:emit}),order=retained.order,groups=[];
 const clock=s=>s.hour*3600+(s.secondOfHour??0),started=clock(c),resting=new Set();let notices=0;
 try{
  report({event:'mountainServingReservesStarted',sector,ids:chosen,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:c});
  for(const op of rosterFor(c).filter(op=>c.recruited.includes(op.id)&&operativeLocation(c,op.id)===sector&&c.operativeState[op.id].hp===c.operativeState[op.id].maxHp&&!c.operativeState[op.id].bleeding&&freeMountainDuty(c,op)&&!careAssignmentReason(c,op,'rest')))order({type:'assignCare',operativeId:op.id,assignment:'rest'});
  for(const id of chosen){
   const from=operativeLocation(c,id),home=c.squads.find(q=>q.members.includes(id));
   assert.ok(home&&!home.journey,'A serving reserve needs its actual uncommitted home group.');
   if(home.members.length===1)order({type:'selectSquad',id:home.id});
   else{assert.ok(canCreateSquad(c),'An actual vacant squad slot must remain for reserve extraction.');order({type:'createSquad',name:'Reserva de la cordillera',ids:[id],sector:from});}
   const group=c.activeSquadId;order({type:'assignCare',operativeId:id,assignment:'active'});
   const needsRest=()=>{const r=c.operativeState[id];return r.asleep||r.energy<100||r.fatigue>0;};
   for(let hour=0;needsRest()&&hour<NATIVE_MOUNTAIN_RESERVE_BOUNDS.preMarchRestHours;hour++){
    assert.equal(careAssignmentReason(c,rosterFor(c).find(op=>op.id===id),'rest'),'','An exhausted reserve needs actual safe rest before travelling.');
    order({type:'assignCare',operativeId:id,assignment:'rest'});order({type:'wait',hours:1});order({type:'assignCare',operativeId:id,assignment:'active'});
   }
   assert.ok(!needsRest(),'Actual reserve rest must finish before booking its route.');
   const quote=['posta','march'].map(mode=>previewStrategicRoute(c,group,sector,mode)).filter(q=>q.valid).sort((a,b)=>a.hours-b.hours)[0];assert.ok(quote,'A reserve needs a current admitted ordinary route, not a remote roster insertion.');
   order(quote.action);groups.push({id:group,operativeId:id});emit({event:'mountainServingReserveQueued',operativeId:id,source:from,squadId:group,quote,hour:c.hour,second:c.secondOfHour??0});
  }
  while(groups.some(({id})=>c.squads.find(q=>q.id===id)?.journey)){
   assert.ok(clock(c)-started<NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours*3600,'Actual reserve routes reached the existing travel bound.');
   const at=clock(c);order({type:'wait',hours:1});const elapsed=clock(c)-at;assert.ok(elapsed>=0&&elapsed<=3600);notices=elapsed===0?notices+1:0;assert.ok(notices<3,'Reserve travel stopped after repeated zero-time notices.');
   for(const group of groups){const q=c.squads.find(q=>q.id===group.id);assert.ok(q);assert.ok(!q.journey||q.journey.status==='moving','Resolve an actual paused reserve route before more preparation time.');if(!q.journey){assert.equal(q.location,sector,'The actual reserve must arrive at its destination.');if(!resting.has(group.operativeId)){order({type:'assignCare',operativeId:group.operativeId,assignment:'rest'});resting.add(group.operativeId);}}}
  }
  for(const id of chosen){assert.equal(operativeLocation(c,id),sector);order({type:'assignCare',operativeId:id,assignment:'rest'});}
  order({type:'selectSquad',id:original});retained.check();assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  for(const event of events)report(event);report({event:'mountainServingReservesArrived',ids:chosen,groups,hour:c.hour,second:c.secondOfHour??0,elapsedSeconds:clock(c)-started,treasury:c.resources.treasury,campaign:c});return c;
 }catch(error){report({event:'mountainServingReservesStopped',reason:error.message,ids:chosen,attemptedReports:events,campaign:c});throw error;}
}

// A serving physician can be healthy but not ready after the last real battle.
// Recover only local free physicians through paid ordinary rest. Existing
// patients and working clinic duties keep their current finite care policy.
export function prepareMountainDoctorReadiness(start,{sector=start.location,count=2,exclude=[],fieldCount=null,reservedIds=[],report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=4,'The actual mountain columns need a bounded doctor count.');
 assert.ok(fieldCount===null||Number.isSafeInteger(fieldCount)&&fieldCount>=1&&fieldCount<=24,'Actual field readiness must keep the original force bound.');
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.pendingBattle,null,'Return the actual tactical report before preparing physicians.');
 assert.equal(c.pendingEncounter,null,'Resolve the actual encounter before preparing physicians.');
 const ready=op=>{
  const r=c.operativeState[op.id];
  return !exclude.includes(op.id)&&op.medical>=60&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=50&&
   (c.recruited.includes(op.id)&&operativeLocation(c,op.id)===sector&&capableMountainActor(c,op.id)&&!operativeInTransit(c,op.id)||
    !c.recruited.includes(op.id)&&op.id>=100&&op.id<1000&&contractQuote(c,op,'day').available);
 };
 const available=()=>rosterFor(c).filter(ready);
 const fieldReady=()=>fieldCount===null||mountainFieldPool(c,sector,reservedIds).length>=fieldCount;
 if(available().length>=count&&fieldReady())return c;
 assert.equal(worldOwner(c,sector),'patriot','Physician readiness needs a safe controlled locality.');
 const candidates=rosterFor(c).filter(op=>{
  const r=c.operativeState[op.id];
  if(exclude.includes(op.id)||reservedIds.includes(op.id)||fieldCount===null&&op.medical<60||ready(op)||!c.recruited.includes(op.id)||!r.alive||r.captured||r.routed||r.unconscious||r.surrendered||r.hp!==r.maxHp||r.bleeding||operativeLocation(c,op.id)!==sector||operativeInTransit(c,op.id)||careAssignmentReason(c,op,'rest'))return false;
  return freeMountainDuty(c,op);
 }).sort((a,b)=>c.operativeState[b.id].morale-c.operativeState[a.id].morale||b.medical-a.medical||a.id-b.id)
  .slice(0,fieldCount===null?count-available().length:undefined).map(op=>op.id);
 assert.ok(candidates.filter(id=>rosterFor(c).find(op=>op.id===id).medical>=60).length>=Math.max(0,count-available().length),'Enough actual free local physicians must remain for ordinary readiness.');
 assert.ok(fieldReady()||candidates.length,'Actual serving field bodies must remain for ordinary readiness.');
 const events=[],emit=event=>{const {campaign,battle,...record}=event;events.push(record);};
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report:emit}),order=retained.order;
 const clock=s=>s.hour*3600+(s.secondOfHour??0),started=clock(c),before=candidates.map(id=>({id,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue,medkits:c.operativeState[id].medkits}));
 let notices=0;
 try{
  report({event:'mountainDoctorReadinessStarted',sector,count,ids:candidates,before,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:c});
  for(const operativeId of candidates)order({type:'assignCare',operativeId,assignment:'rest'});
  while(available().length<count||!fieldReady()){
   assert.ok(clock(c)-started<NATIVE_MOUNTAIN_RESERVE_BOUNDS.readinessRestHours*3600,'Physician readiness reached the existing ordinary-rest bound.');
   const at=clock(c);order({type:'wait',hours:1});const elapsed=clock(c)-at;
   assert.equal(c.defeated,false,'Physician readiness cannot adopt a defeated campaign.');
   assert.ok(elapsed>=0&&elapsed<=3600,'Ordinary physician rest cannot exceed its requested hour.');
   notices=elapsed===0?notices+1:0;assert.ok(notices<3,'Physician readiness stopped after repeated zero-time notices.');
   emit({event:'mountainDoctorReadinessTick',hour:c.hour,second:c.secondOfHour??0,elapsedSeconds:elapsed,doctors:candidates.map(id=>({id,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue}))});
  }
  retained.check();assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
  for(const event of events)report(event);
  report({event:'mountainDoctorReadinessPrepared',sector,count,ids:candidates,before,after:candidates.map(id=>({id,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue,medkits:c.operativeState[id].medkits})),elapsedSeconds:clock(c)-started,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:c});
  return c;
 }catch(error){
  report({event:'mountainDoctorReadinessStopped',reason:error.message,sector,count,ids:candidates,attemptedReports:events,campaign:c});throw error;
 }
}

// Bank actual port income before signing contracts and reuse finite mountain guns.
export function prepareFreshLosPatosAssault(start,{batteryIds=null,fieldCount=8,report=()=>{}}={}){
 assert.ok(Number.isSafeInteger(fieldCount)&&fieldCount>=8&&fieldCount<=24,'The paid mountain force must fit ordinary six-person columns.');
 let c=decodeSave(encodeSave(start)).campaign;
 let retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=action=>retained.order(action);
 const protectedDuties=fieldCount>8?rosterFor(start).filter(op=>start.recruited.includes(op.id)&&(!freeMountainDuty(start,op)||start.militiaTraining.some(course=>course.trainerId===op.id))).map(op=>op.id):[];
 c=restorePaidMountainVeterans(c,{report});
 const doctorCount=fieldCount>8?Math.ceil(fieldCount/6):2;
 const reservedIds=fieldCount>8&&c.flags.foundry?[campaignRole(c,'foundryEngineer')?.id].filter(id=>id!==undefined):[];
 c=prepareMountainServingReserves(c,{sector:'mendoza',fieldCount,doctorCount,exclude:[...reservedIds,...protectedDuties],report});
 const permanent=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='mendoza'&&c.contracts[op.id]?.expiresAt===null;});
 assert.ok(permanent.length,'the real permanent survivors retain the assembly squad');
 order({type:'squad',ids:permanent.map(op=>op.id).slice(0,6)});
 for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza'&&!protectedDuties.includes(id);}))order({type:'assignCare',operativeId,assignment:'rest'});
 const requiredFunds=()=>{
  const prices=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],q=contractQuote(c,op,'day');return op.id>=100&&op.id<1000&&r.alive&&!r.captured&&r.hp===r.maxHp&&r.morale>=50&&(c.recruited.includes(op.id)&&r.location==='mendoza'||q.available);}).map(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'?0:contractQuote(c,op,'day').price).sort((a,b)=>a-b);
  return Math.max(14000,2000+2*prices.slice(0,Math.max(0,fieldCount-permanent.length)).reduce((sum,price)=>sum+price,0));
 };
 c=bankRouteIncome(c,requiredFunds(),{keepIds:retained.keepIds(),report});
 for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
 const readyLocal=op=>{const r=c.operativeState[op.id];return r.alive&&!r.captured&&r.hp===r.maxHp&&r.morale>=50&&(fieldCount<=8||!protectedDuties.includes(op.id)&&!reservedIds.includes(op.id)&&(!c.recruited.includes(op.id)||freeMountainDuty(c,op)&&canReassignOperative(c,op.id)));};
 const commander=rosterFor(c).filter(op=>readyLocal(op)&&op.leadership>=80&&(permanent.some(p=>p.id===op.id)||op.id>=100&&op.id<1000&&(c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'||contractQuote(c,op,'day').available))).sort((a,b)=>Number(permanent.some(op=>op.id===b.id))-Number(permanent.some(op=>op.id===a.id))||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.marksmanship-a.marksmanship)[0];
 assert.ok(commander,'the second column needs a real ready leader');
 c=prepareMountainDoctorReadiness(c,{sector:'mendoza',count:doctorCount,exclude:[commander.id,...protectedDuties],fieldCount,reservedIds:[...reservedIds,...protectedDuties],report});
 const doctors=rosterFor(c).filter(op=>op.id!==commander.id&&op.medical>=60&&
  (c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'&&capableMountainActor(c,op.id)&&readyLocal(op)||
   !c.recruited.includes(op.id)&&op.id>=100&&op.id<1000&&readyLocal(op)&&contractQuote(c,op,'day').available))
  .sort((a,b)=>fieldCount>8?contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.medical-a.medical||a.id-b.id:Number(c.recruited.includes(b.id))-Number(c.recruited.includes(a.id))||b.medical-a.medical||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,doctorCount);
 assert.equal(doctors.length,doctorCount,'actual capable medical>=60 doctors must serve each dispersed column');
 const engineer=fieldCount>8&&c.flags.foundry?campaignRole(c,'foundryEngineer')?.id:null;
 const base=[...new Set([commander.id,...doctors.map(op=>op.id),...permanent.filter(op=>op.id!==engineer&&capableMountainActor(c,op.id)&&readyLocal(op)).map(op=>op.id)])].slice(0,fieldCount);
 if(engineer!==null)report({event:'mountainFoundryRear',operativeId:engineer,location:c.operativeState[engineer].location,alive:c.operativeState[engineer].alive});
 const rolePrice=base.reduce((sum,id)=>sum+(c.recruited.includes(id)?0:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price),0);
 const column=affordableMountainColumn(c,fieldCount-base.length,{reserve:2000+2*rolePrice,paidDays:2,exclude:[...base,...protectedDuties],preferRetention:fieldCount>8}),recruits=column.ids;
 assert.equal(recruits.length,fieldCount-base.length,'available survivors or replacements accept actual contracts');
 report({event:'mountainPaidColumn',sector:'los_patos',ids:recruits,price:column.price,hour:c.hour,treasury:c.resources.treasury});
 for(const id of recruits)report({event:'mountainLocalReplacement',operativeId:id,hour:c.hour,treasury:c.resources.treasury,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day')});
 const hiringIds=[...new Set([...base,...recruits])],field=[];
 if(fieldCount>8){
  const remaining=hiringIds.filter(id=>!doctors.some(op=>op.id===id)&&id!==commander.id);
  for(let columnIndex=0;field.length<fieldCount;columnIndex++){
   const members=columnIndex===0?[commander.id,doctors[columnIndex].id]:[doctors[columnIndex].id];
   members.push(...remaining.splice(0,Math.min(6-members.length,fieldCount-field.length-members.length)));field.push(...members);
  }
  assert.equal(field.length,fieldCount);assert.equal(new Set(field).size,fieldCount);
 }else field.push(...hiringIds);
 const rearm=field.filter(id=>c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon));
 for(let h=0;h<24&&(c.hour%24<6||c.hour%24>10);h++)order({type:'wait',hours:1});
 for(const id of hiringIds){if(c.recruited.includes(id))continue;const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);}
for(let h=0;h<24&&hiringIds.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(hiringIds.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
 for(const operativeId of rearm)c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,replace:true,report});
 // Rehiring does not issue the returned kit again. Recover missing paid kit
 // from real stock while keeping permanent encounter recruits' empty slots.
 c=collectReturnedMountainKit(c,hiringIds,{report});
 order({type:'squad',ids:field.slice(0,6)});const main=c.activeSquadId,columns=[main];
 for(let offset=6;offset<field.length;offset+=6){
  order({type:'createSquad',name:'Apoyo de Los Patos',ids:field.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);
 }
 const donor=field.find(id=>!doctors.some(op=>op.id===id)&&capableMountainActor(c,id));
 assert.notEqual(donor,undefined,'a distinct capable issued donor must carry the actual doctor reserve');
 const deficits=doctors.map(op=>({id:op.id,medical:op.medical,carried:c.operativeState[op.id].medkits,needed:Math.max(0,5-c.operativeState[op.id].medkits)}));
 const medicalReserves=Object.fromEntries(doctors.map(op=>[op.id,c.operativeState[op.id].medkits])),neededReserve=deficits.reduce((sum,row)=>sum+row.needed,0);
 if(fieldCount>8){
  const reserves=Object.fromEntries(doctors.map(op=>[op.id,Math.max(5,c.operativeState[op.id].medkits)]));
  for(const doctor of doctors){
   c=prepareMountainDressings(c,doctor.id,5,{reserves,report});c=supplyRouteDressings(c,doctor.id,5,{reserves,report});
   assert.ok(c.operativeState[doctor.id].medkits>=5,'each actual flank physician carries their own finite reserve');
  }
  report({event:'mountainDistributedClinicRoles',sector:'los_patos',commanderId:commander.id,doctors:doctors.map(op=>({id:op.id,medical:op.medical,medkits:c.operativeState[op.id].medkits})),field:[...field],columns:[...columns],campaign:c});
 }else{
  c=prepareMountainDressings(c,donor,neededReserve,{reserves:medicalReserves,report});
  c=supplyRouteDressings(c,donor,neededReserve,{reserves:medicalReserves,report});
  report({event:'mountainClinicalRoles',sector:'los_patos',commanderId:commander.id,donorId:donor,donorKits:c.operativeState[donor].medkits,doctors:deficits,field:[...field],campaign:c});
 }
 c=supplyFreshMountainAmmunition(c,field,{target:12,report});
 order({type:'configureArtillery',types:[]});
 for(const id of columns){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
 const parallel=fieldCount>8&&columns.length>1;
 const departureBudget=stage=>{
  const plan=mountainLosPatosDeparturePlan(c,{columns,batteryIds,stage}),budget=quoteMountainServiceBudget(c,{keepIds:retained.keepIds(),horizonSeconds:plan.horizonSeconds,fixedCost:plan.fixedCost});
  report({event:'mountainDepartureBudget',plan,budget,hour:c.hour,second:c.secondOfHour??0});return {plan,budget};
 };
 if(parallel){
  const plan=mountainLosPatosDeparturePlan(c,{columns,batteryIds});
  const beforeServing=retained.keepIds();
  const duties=completeMountainPaidDuties(c,{fieldIds:field,doctorIds:doctors.map(op=>op.id),protectedIds:protectedDuties,horizonSeconds:plan.horizonSeconds,fixedCost:plan.fixedCost,report});
  c=duties.campaign;
  assert.deepEqual(beforeServing.filter(id=>!c.recruited.includes(id)).sort((a,b)=>a-b),duties.completed.map(row=>row.id).sort((a,b)=>a-b),'Only the actual completed-duty receipts can leave continuing service.');
  retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
  let funding=departureBudget('mendoza');
  if(!funding.budget.available){
   assert.ok(funding.budget.entries.every(row=>!row.reason),funding.budget.reason);
   const payroll=retained.keepIds().reduce((sum,id)=>sum+contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day').daily,0);
   assert.ok(dailyIncome(c)>payroll,'Actual port income must exceed continuing service before banking the departure reserve.');
   c=bankRouteIncome(c,funding.budget.totalCost,{keepIds:retained.keepIds(),report});funding=departureBudget('mendoza');
  }
  assert.ok(funding.budget.available,funding.budget.reason??'The complete current mountain departure must be funded.');
 }
 if(parallel){
  for(const id of columns){order({type:'selectSquad',id});order({type:'travel',sector:'uspallata',mode:'posta',queue:true});}
  const began=c.hour*3600+(c.secondOfHour??0);let notices=0;
  while(columns.some(id=>c.squads.find(q=>q.id===id)?.journey)){
   assert.ok(c.hour*3600+(c.secondOfHour??0)-began<NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours*3600);const at=c.hour*3600+(c.secondOfHour??0);order({type:'wait',hours:1});notices=c.hour*3600+(c.secondOfHour??0)===at?notices+1:0;assert.ok(notices<3,'Parallel mountain routes stop after repeated zero-time notices.');
   for(const id of columns){const q=c.squads.find(q=>q.id===id);assert.ok(q);assert.ok(!q.journey||q.journey.status==='moving','Resolve the actual paused mountain route.');if(!q.journey)assert.equal(q.location,'uspallata');}
  }
  for(const id of columns)assert.equal(c.squads.find(q=>q.id===id).location,'uspallata','Every real column arrives before the guns are dispatched.');
  report({event:'mountainColumnsArrived',columns:[...columns],elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-began,hour:c.hour,second:c.secondOfHour??0,campaign:c});
 }else for(const id of columns){order({type:'selectSquad',id});order({type:'travel',sector:'uspallata',mode:'posta'});}
 order({type:'selectSquad',id:main});if(batteryIds)assert.ok(mountainBatteryRecords(c,batteryIds).some(gun=>gun.loaded||gun.ammo>0),'Los Patos support needs real remaining rounds from the same finite battery.');
 const battery=prepareMountainBattery(c,['bronze4','bronze4'],{batteryIds,destination:'uspallata',keepServing:retained.keepIds(),report});c=battery.campaign;order({type:'configureArtillery',types:battery.selections});
 if(parallel){const {budget}=departureBudget('uspallata');assert.ok(budget.available,budget.reason??'Requote the actual remaining flank service before departure.');}
 const destination=worldCell('los_patos',c),flanks=['uspallata',`cell-${destination.col}-${destination.row-1}`,`cell-${destination.col}-${destination.row+1}`,`cell-${destination.col-1}-${destination.row}`];
 const approaches=columns.map((id,index)=>({id,origin:fieldCount>8?flanks[index]:'uspallata',mode:fieldCount>8&&index?'march':'posta'}));
 const queued=[];
 for(const approach of approaches){
  order({type:'selectSquad',id:approach.id});
  if(c.location!==approach.origin){
   const before={hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury};
   order({type:'travel',sector:approach.origin,mode:'march',...(parallel?{queue:true}:{})});
   if(parallel){queued.push({...approach,before});continue;}
   assert.equal(c.location,approach.origin,'the flank must reach its actual neighboring rural cell');
   assert.equal(c.squads.find(q=>q.id===approach.id).journey,undefined,'finish the real flank journey before queuing its assault');
   report({event:'mountainFlankApproach',squadId:approach.id,origin:approach.origin,entry:entryFromSector(approach.origin,'los_patos',null,c),before,after:{hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury},members:[...c.squad]});
  }
 }
 if(queued.length){
  const began=c.hour*3600+(c.secondOfHour??0);let notices=0;
  while(queued.some(approach=>c.squads.find(q=>q.id===approach.id)?.journey)){
   assert.ok(c.hour*3600+(c.secondOfHour??0)-began<NATIVE_MOUNTAIN_RESERVE_BOUNDS.travelHours*3600);const at=c.hour*3600+(c.secondOfHour??0);order({type:'wait',hours:1});notices=c.hour*3600+(c.secondOfHour??0)===at?notices+1:0;assert.ok(notices<3,'Parallel flank routes stop after repeated zero-time notices.');
   for(const approach of queued){const q=c.squads.find(q=>q.id===approach.id);assert.ok(q);assert.ok(!q.journey||q.journey.status==='moving','Resolve the actual paused flank route.');if(!q.journey&&!approach.reported){assert.equal(q.location,approach.origin);report({event:'mountainFlankApproach',squadId:approach.id,origin:approach.origin,entry:entryFromSector(approach.origin,'los_patos',null,c),before:approach.before,after:{hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury},members:[...q.members]});approach.reported=true;}}
  }
  report({event:'mountainFlanksArrived',columns:queued.map(q=>q.id),elapsedSeconds:c.hour*3600+(c.secondOfHour??0)-began,hour:c.hour,second:c.secondOfHour??0,campaign:c});
 }
 if(parallel){const {budget}=departureBudget('flanks');assert.ok(budget.available,budget.reason??'Requote actual service after every real flank arrival.');}
 for(const {id,mode}of approaches){order({type:'selectSquad',id});order({type:'attack',sector:'los_patos',queue:true,mode});}
 for(let i=0;i<16&&!columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++){order({type:'wait',hours:1});}
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'),'all physical approaches finish before staging');
 if(parallel){const {budget}=departureBudget('assault');assert.ok(budget.available,budget.reason??'Actual daylight staging must retain its remaining service.');}
 // Sequential journeys and the assault approach can arrive after dark.
 // Stage the real arrived squads until daylight, retaining their paid terms.
 const arrivalHour=c.hour;
 for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++){order({type:'wait',hours:1});}
 assert.ok(c.hour%24>=6&&c.hour%24<=10,'the mountain assault starts in daylight');
 report({event:'mountainDaylightStaging',arrivalHour,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field:[...field]});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 order({type:'beginAssault',sector:'los_patos'});
 assert.equal(c.pendingBattle.squad.length,field.length);
 for(const approach of approaches){
  const group=c.pendingBattle.assaultSquads.find(q=>q.id===approach.id),entry=entryFromSector(approach.origin,'los_patos',null,c);assert.ok(group);assert.equal(group.origin,approach.origin);
  assert.ok(group.members.every(id=>c.pendingBattle.squad.find(u=>u.id===id).entryEdge===entry.entryEdge),'each actual force keeps its physical approach edge');
 }
 for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

export function completeFreshAndesPreparation(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const localIds=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='los_patos');
 let returningEnvoy;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
// A settled battle can leave a critical survivor in another physical squad.
// Assemble up to six actual locals before using their carried first aid.
if(localIds.length<=6)order({type:'squad',ids:localIds});
if(localIds.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding)){
 const scene=c.sectorStates.los_patos,patients=scene.units.filter(unit=>localIds.includes(Number(unit.id))&&(unit.hp<15||unit.bleeding));
 const doctors=rosterFor(c).filter(op=>localIds.includes(op.id)&&op.medical>0&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding).sort((a,b)=>{
  const distance=id=>{const unit=scene.units.find(unit=>unit.id===String(id));return Math.min(...patients.map(patient=>Math.hypot(unit.x-patient.x,unit.y-patient.y)));};
  return distance(a.id)-distance(b.id)||b.medical-a.medical;
 });
 // Recover only real, reachable field dressings. The nearest conscious
 // physician can then start aid without a fatal cross-sector approach.
 for(const doctor of doctors){
  const model=sectorInventoryModel(c,'los_patos',rosterFor(c),doctor.id);
  for(const source of model.entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits')){
   const count=Math.min(source.count,Math.max(0,3-c.operativeState[doctor.id].medkits));if(!count)continue;
   const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
   order({type:'sectorInventory',sector:'los_patos',operativeId:doctor.id,direction:'take',sourceKey:source.key,expected:source.expected,count});
   const remaining=sectorInventoryModel(c,'los_patos',rosterFor(c),doctor.id).entries.find(row=>row.key===source.key)?.count??0;
   assert.equal(remaining,source.count-count);assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before);
   report({event:'andesFiniteDressingsRecovered',operativeId:doctor.id,sourceKey:source.key,count,sourceCount:source.count,remaining,...before});
  }
 }
}
const aidGroups=c.squads.filter(q=>q.members.some(id=>localIds.includes(id))).sort((a,b)=>Number(b.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding))-Number(a.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding)));
for(const group of aidGroups){
 order({type:'selectSquad',id:group.id});
 c=performFreshMountainFirstAid(visit(c),{stage:'los-patos-first-aid',report});
}
report({event:'andesFirstAid',hour:c.hour,second:c.secondOfHour,units:localIds.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding,medkits:c.operativeState[id].medkits}))});
returningEnvoy=rosterFor(c).filter(op=>localIds.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.leadership>=80).sort((a,b)=>contractQuote(c,a,'day').price-contractQuote(c,b,'day').price)[0]?.id;
for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos')){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
order({type:'fortify',sector:'los_patos'});assert.equal(c.phase,4);
const field=c.recruited.filter(id=>c.operativeState[id].alive&&c.operativeState[id].location==='los_patos');
const returning=c.squads.filter(q=>q.members.some(id=>field.includes(id))).map(q=>q.id);
assert.ok(returning.length>0);
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
// Keep both surviving squads within the normal six-person limit and return
// concurrently, paying each route rather than merging eight people into one.
for(const id of returning){order({type:'selectSquad',id});order({type:'travel',sector:'mendoza',mode:'posta',queue:true});}
for(let hour=0;hour<80&&returning.some(id=>c.squads.find(q=>q.id===id)?.journey);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
for(const id of field){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].location,'mendoza');}
let envoy=rosterFor(c).find(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&!c.operativeState[op.id].captured&&c.operativeState[op.id].location==='mendoza'&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.leadership>=80)?.id;
if(envoy===undefined){
 const candidate=rosterFor(c).filter(op=>{
  const unit=c.operativeState[op.id],quote=contractQuote(c,op,'day');
  return op.id>=100&&op.id<1000&&unit.alive&&!unit.captured&&unit.hp>=15&&!unit.bleeding&&!unit.serviceEquipmentReturn&&op.leadership>=80&&quote.available&&quote.price<=c.resources.treasury-200;
 }).sort((a,b)=>contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.leadership-a.leadership)[0];
 assert.ok(candidate,'the actual treasury must fund a living qualified envoy and the onward journey');
 const quote=contractQuote(c,candidate,'day'),cash=c.resources.treasury,hiredHour=c.hour;
 order({type:'recruitCivic',id:candidate.id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);
 for(let hour=0;hour<24&&!c.recruited.includes(candidate.id);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 envoy=candidate.id;assert.ok(c.recruited.includes(envoy));assert.equal(c.operativeState[envoy].location,'mendoza');
 report({event:'andesPaidEnvoy',id:envoy,price:quote.price,hiredHour,arrivalHour:c.hour,contractExpiresAt:c.contracts[envoy].expiresAt});
}
// Leave a legal place for San Martín without discarding actual survivors.
const companions=field.filter(id=>id!==envoy&&c.recruited.includes(id)).slice(0,4);
order({type:'squad',ids:[envoy,...companions]});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
c=meetRecruits(c,['san-martin'],envoy);assert.ok(c.recruited.includes(57));
for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
report({event:'andesCommandHandover',envoy,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,returned:field.map(id=>({id,hp:c.operativeState[id].hp,alive:c.operativeState[id].alive,recruited:c.recruited.includes(id)}))});
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}
