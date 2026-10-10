import {bankRouteIncome} from './route-income-banking.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {supplyKnownRouteDressings} from './route-known-medical-courier.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {applyItemQuantity,handRecord} from '../game/tactical-inventory.js';
import {planEquipLoot} from '../game/tactical.js';
import {contractQuote} from '../game/contracts.js';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {visit,sync,leave} from './local-contract-fixture.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {BLADES} from '../game/tactical.js';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {artilleryProfile} from '../game/artillery-definitions.js';

const capableMountainActor=(c,id)=>{const r=c.operativeState[id];return r?.alive&&!r.captured&&r.hp>=15&&!r.bleeding&&!r.asleep&&!r.unconscious&&!r.routed&&!r.surrendered&&r.energy>10;};

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
export function prepareNativeMountainReserve(start,{count=6,report=()=>{}}={}){
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
   for(let hour=0;hour<72&&ids.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;});hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
   assert.ok(ids.every(id=>{const r=c.operativeState[id];return !r.fatigue&&r.energy===100&&!r.asleep;}),'Actual reserves must finish ordinary rest before travelling.');
   for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});
   const cash=c.resources.treasury;order({type:'travel',sector:'mendoza',queue:true,mode:'posta'});
   report({event:'mountainNativeReserveTravel',ids,source:sector,squadId,bookingCost:cash-c.resources.treasury,hour:c.hour});
  }
 }
 for(let hour=0;hour<168&&columns.some(id=>c.squads.find(q=>q.id===id).journey);hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).location==='mendoza'&&!c.squads.find(q=>q.id===id).journey),'Actual reserves must arrive before mountain preparation.');
 for(const operativeId of reserves)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<600&&reserves.some(id=>{const r=c.operativeState[id];return r.morale<50||r.fatigue||r.energy<100||r.asleep;});hour++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
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
function affordableMountainColumn(c,count,{reserve=1500,paidDays=1,exclude=[]}={}){
 const budget=Math.max(0,(c.resources.treasury-reserve)/paidDays);
 const candidates=rosterFor(c).map(op=>({op,quote:c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'?{available:true,price:0}:contractQuote(c,op,'day')})).filter(({op,quote})=>{
  const unit=c.operativeState[op.id];
  return op.id>=100&&op.id<1000&&!exclude.includes(op.id)&&unit.alive&&!unit.captured&&unit.hp===unit.maxHp&&unit.morale>=50&&quote.available&&quote.price<=budget;
 }).sort((a,b)=>b.op.marksmanship-a.op.marksmanship||a.quote.price-b.quote.price);
 let best=null;
 const choose=(offset,selected,price,score)=>{
  if(selected.length===count){if(!best||score>best.score||score===best.score&&price<best.price)best={ids:selected.map(row=>row.op.id),price,score};return;}
  if(candidates.length-offset<count-selected.length)return;
  for(let i=offset;i<candidates.length;i++){
   const candidate=candidates[i];if(price+candidate.quote.price>budget)continue;
   choose(i+1,[...selected,candidate],price+candidate.quote.price,score+candidate.op.marksmanship+candidate.op.medical*.05);
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
 .sort((a,b)=>Number(c.operativeState[b.id].location==='mendoza')-Number(c.operativeState[a.id].location==='mendoza')||b.leadership-a.leadership||a.id-b.id)[0];
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
const physician=rosterFor(c).filter(op=>c.recruited.includes(op.id)&&capableMountainActor(c,op.id)&&c.operativeState[op.id].location==='mendoza'&&op.id!==leader.id&&op.medical>=20).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];assert.ok(physician,'the mountain column needs a living local medic');
const column=affordableMountainColumn(c,6,{exclude:[leader.id,physician.id]}),recruits=column.ids;
assert.equal(recruits.length,6,'six living and ready replacements must accept paid contracts');
report({event:'mountainPaidColumn',sector:'uspallata',ids:recruits,price:column.price,hour:c.hour,treasury:c.resources.treasury});
const rearm=recruits.filter(id=>![1800,1801,1802].includes(rosterFor(c).find(op=>op.id===id).weapon));
for(let h=0;h<24&&(c.hour%24<6||c.hour%24>10);h++)order({type:'wait',hours:1});
for(const id of recruits){if(c.recruited.includes(id))continue;const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day'});assert.equal(c.resources.treasury,cash-quote.price);}
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(recruits.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
c=collectReturnedMountainKit(c,recruits,{report});
for(const operativeId of rearm)c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,replace:true,report});
order({type:'squad',ids:[leader.id,physician.id,...recruits.slice(0,4)]});const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo de la cordillera',ids:recruits.slice(4),sector:'mendoza'});const support=c.activeSquadId;
// Redistribute actual remaining field dressings and known local cartridges.
c=supplyKnownRouteDressings(c,physician.id,15,{report});
// Finish real reloads before attaching the recovered reserve battery.
c=supplyFreshMountainAmmunition(c,[leader.id,physician.id,...recruits],{target:12,report});
order({type:'configureArtillery',types:[]});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
order({type:'selectSquad',id:main});if(batteryIds){assert.equal(batteryIds.length,guns);assert.ok(mountainBatteryRecords(c,batteryIds).every(gun=>gun.loaded||gun.ammo>0),'Explicit Uspallata support must carry actual remaining rounds.');}
const battery=prepareMountainBattery(c,Array.from({length:guns},()=> 'bronze4'),{batteryIds,destination:'mendoza',keepServing:retained.keepIds(),report});c=battery.campaign;order({type:'configureArtillery',types:battery.selections});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++)order({type:'wait',hours:1});
order({type:'beginAssault',sector:'uspallata'});
 assert.equal(c.pendingBattle.squad.length,8);return c;
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
const remaining=[...survivors],groups=[];
while(remaining.length){
 const doctor=doctors.find(id=>remaining.includes(id));assert.notEqual(doctor,undefined,'each physical recovery squad needs a conscious physician');
 const reservedDoctors=doctors.filter(id=>id!==doctor&&remaining.includes(id)).slice(0,Math.ceil(remaining.length/6)-1);
 const members=[doctor,...remaining.filter(id=>id!==doctor&&!reservedDoctors.includes(id))].slice(0,6);
 for(const id of members)remaining.splice(remaining.indexOf(id),1);
 order({type:'createSquad',name:'Socorro de la cordillera',ids:members,sector:'uspallata'});groups.push({id:c.activeSquadId,members});
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
c=bankRouteIncome(c,5000,{keepIds:retained.keepIds(),report});
for(let h=0;h<48&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 assert.equal(c.pendingEncounter,null);
 for(const id of localDoctors){if(!c.operativeState[id].medkits)c=supplyRouteDressings(c,id,1,{report});order({type:'assignCare',operativeId:id,assignment:'doctor'});}
 for(const id of patients)order({type:'assignCare',operativeId:id,assignment:'patient'});
 order({type:'wait',hours:1});report({event:'mountainMedicalCare',hour:c.hour,treasury:c.resources.treasury,patients:patients.map(id=>({id,hp:c.operativeState[id].hp}))});
}
for(const id of survivors){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
return c;
}

// Bank actual port income before signing contracts and reuse finite mountain guns.
export function prepareFreshLosPatosAssault(start,{batteryIds=null,report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const retained=createFreshRouteOrders(()=>c,next=>{c=next;},{report});
 const order=retained.order;
 c=restorePaidMountainVeterans(c,{report});
 const permanent=rosterFor(c).filter(op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='mendoza'&&c.contracts[op.id]?.expiresAt===null;});
 assert.ok(permanent.length,'the real permanent survivors retain the assembly squad');
 order({type:'squad',ids:permanent.map(op=>op.id).slice(0,6)});
 for(const operativeId of c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location==='mendoza';}))order({type:'assignCare',operativeId,assignment:'rest'});
 const requiredFunds=()=>{
  const prices=rosterFor(c).filter(op=>{const r=c.operativeState[op.id],q=contractQuote(c,op,'day');return op.id>=100&&op.id<1000&&r.alive&&!r.captured&&r.hp===r.maxHp&&r.morale>=50&&(c.recruited.includes(op.id)&&r.location==='mendoza'||q.available);}).map(op=>c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'?0:contractQuote(c,op,'day').price).sort((a,b)=>a-b);
  return Math.max(14000,2000+2*prices.slice(0,8-permanent.length).reduce((sum,price)=>sum+price,0));
 };
 c=bankRouteIncome(c,requiredFunds(),{keepIds:retained.keepIds(),report});
 for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++)order({type:'wait',hours:1});
 const readyLocal=op=>{const r=c.operativeState[op.id];return r.alive&&!r.captured&&r.hp===r.maxHp&&r.morale>=50;};
 const commander=rosterFor(c).filter(op=>readyLocal(op)&&op.leadership>=80&&(permanent.some(p=>p.id===op.id)||op.id>=100&&op.id<1000&&(c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'||contractQuote(c,op,'day').available))).sort((a,b)=>Number(permanent.some(op=>op.id===b.id))-Number(permanent.some(op=>op.id===a.id))||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.marksmanship-a.marksmanship)[0];
 assert.ok(commander,'the second column needs a real ready leader');
 const doctors=rosterFor(c).filter(op=>op.id!==commander.id&&op.medical>=60&&
  (c.recruited.includes(op.id)&&c.operativeState[op.id].location==='mendoza'&&capableMountainActor(c,op.id)||
   !c.recruited.includes(op.id)&&op.id>=100&&op.id<1000&&readyLocal(op)&&contractQuote(c,op,'day').available))
  .sort((a,b)=>Number(c.recruited.includes(b.id))-Number(c.recruited.includes(a.id))||b.medical-a.medical||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,2);
 assert.equal(doctors.length,2,'two actual capable medical>=60 doctors must serve the issued column');
 const base=[...new Set([commander.id,...doctors.map(op=>op.id),...permanent.filter(op=>capableMountainActor(c,op.id)).map(op=>op.id)])].slice(0,8);
 const rolePrice=base.reduce((sum,id)=>sum+(c.recruited.includes(id)?0:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price),0);
 const column=affordableMountainColumn(c,8-base.length,{reserve:2000+2*rolePrice,paidDays:2,exclude:base}),recruits=column.ids;
 assert.equal(recruits.length,8-base.length,'available survivors or replacements accept actual contracts');
 report({event:'mountainPaidColumn',sector:'los_patos',ids:recruits,price:column.price,hour:c.hour,treasury:c.resources.treasury});
 for(const id of recruits)report({event:'mountainLocalReplacement',operativeId:id,hour:c.hour,treasury:c.resources.treasury,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day')});
 const field=[...base,...recruits],hiringIds=[...new Set([...base,...recruits])];
 const rearm=field.filter(id=>c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon));
 for(let h=0;h<24&&(c.hour%24<6||c.hour%24>10);h++)order({type:'wait',hours:1});
 for(const id of hiringIds){if(c.recruited.includes(id))continue;const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);}
for(let h=0;h<24&&hiringIds.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
assert.ok(hiringIds.every(id=>c.recruited.includes(id)),'paid replacements must arrive before receiving equipment');
 for(const operativeId of rearm)c=recoverRoutePrimary(c,operativeId,{preferredWeapon:1801,replace:true,report});
 // Rehiring does not issue the returned kit again. Recover missing paid kit
 // from real stock while keeping permanent encounter recruits' empty slots.
 c=collectReturnedMountainKit(c,hiringIds,{report});
 order({type:'squad',ids:field.slice(0,6)});const main=c.activeSquadId;
 order({type:'createSquad',name:'Apoyo de Los Patos',ids:field.slice(6),sector:'mendoza'});const support=c.activeSquadId;
 const donor=field.find(id=>!doctors.some(op=>op.id===id)&&capableMountainActor(c,id));
 assert.notEqual(donor,undefined,'a distinct capable issued donor must carry the actual doctor reserve');
 const deficits=doctors.map(op=>({id:op.id,medical:op.medical,carried:c.operativeState[op.id].medkits,needed:Math.max(0,5-c.operativeState[op.id].medkits)}));
 c=supplyRouteDressings(c,donor,deficits.reduce((sum,row)=>sum+row.needed,0),{reserves:Object.fromEntries(doctors.map(op=>[op.id,c.operativeState[op.id].medkits])),report});
 report({event:'mountainClinicalRoles',sector:'los_patos',commanderId:commander.id,donorId:donor,donorKits:c.operativeState[donor].medkits,doctors:deficits,field:[...field],campaign:c});
 c=supplyFreshMountainAmmunition(c,field,{target:12,report});
 order({type:'configureArtillery',types:[]});
 for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'travel',sector:'uspallata',mode:'posta'});}
 order({type:'selectSquad',id:main});if(batteryIds)assert.ok(mountainBatteryRecords(c,batteryIds).some(gun=>gun.loaded||gun.ammo>0),'Los Patos support needs real remaining rounds from the same finite battery.');
 const battery=prepareMountainBattery(c,['bronze4','bronze4'],{batteryIds,destination:'uspallata',keepServing:retained.keepIds(),report});c=battery.campaign;order({type:'configureArtillery',types:battery.selections});
 for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:'los_patos',queue:true,mode:'posta'});}
 for(let i=0;i<16&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');i++){order({type:'wait',hours:1});}
 assert.ok([main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'),'both physical approaches finish before staging');
 // Two sequential journeys and the assault approach can arrive after dark.
 // Stage the real arrived squads until daylight, retaining their paid terms.
 const arrivalHour=c.hour;
 for(let i=0;i<24&&(c.hour%24<6||c.hour%24>10);i++){order({type:'wait',hours:1});}
 assert.ok(c.hour%24>=6&&c.hour%24<=10,'the mountain assault starts in daylight');
 report({event:'mountainDaylightStaging',arrivalHour,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field:[...field]});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 order({type:'beginAssault',sector:'los_patos'});
 assert.equal(c.pendingBattle.squad.length,field.length);
 assert.ok(c.pendingBattle.squad.every(u=>u.entryEdge==='E'));
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
c=meetRecruits(c,['san-martin'],envoy);assert.ok(c.recruited.includes(57));
for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
report({event:'andesCommandHandover',envoy,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,returned:field.map(id=>({id,hp:c.operativeState[id].hp,alive:c.operativeState[id].alive,recruited:c.recruited.includes(id)}))});
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}
