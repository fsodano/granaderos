import {prepareRouteBattery} from './route-battery.mjs';
import {ensureRouteTownIncome,meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {collectRouteItems,repairRouteFirearms} from './finite-route-equipment.mjs';
import {prepareSantaFePaidColumn} from './santa-fe-paid-column.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareFinalAssault,restoreFinalMorale} from './final-campaign-route.mjs';
import {contractQuote} from '../game/contracts.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {primaryAmmoTypeFor} from '../game/ammo-types.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {meetRecruits} from './campaign-recruitment-route.mjs';

// Collection preserves the real sector, person, finite record and care roles.
const findRouteDressings=(state,id,count=1)=>{const found=collectRouteItems(state,id,{item:'medkits'},count);return {campaign:found.campaign,count:found.collected};};

// Continue from the real mountain campaign. Travel and renewal retain their cost.
export function prepareFreshCoastalCommand(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 const field=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.ok(field.includes(57)&&field.length<=5,'the living command must leave a place for the recruit');
 order({type:'squad',ids:field});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'travel',sector:'retiro',mode:'posta'});
 assert.equal(c.location,'retiro');assert.ok(c.hour>before.hour);
 c=meetRecruits(c,['cabral'],57);
 assert.ok(c.recruited.includes(3));assert.equal(c.conversations.cabral.lastApproach,'recruit');
 assert.ok(c.operativeState[57].alive);assert.equal(c.completed,false);
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

export function recoverCoastalSurvivors(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 const patients=field.filter(id=>{const unit=c.operativeState[id];return unit.hp<unit.maxHp||unit.bleeding;});
 const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20&&c.operativeState[op.id].hp>=15).sort((a,b)=>Number(c.contracts[b.id]?.expiresAt===null)-Number(c.contracts[a.id]?.expiresAt===null)||b.medical-a.medical).slice(0,patients.length).map(op=>op.id);
 assert.ok(!patients.length||doctors.length,'actual local survivors need a conscious physician before their service ends');
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 const before=structuredClone(c),renewals=[],purchases=[];
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let hour=0;hour<96&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);hour++){
  assert.equal(c.pendingEncounter,null);
  for(const id of [...patients,...doctors]){
   const contract=c.contracts[id];assert.ok(contract,'care retains each actual patient and physician');
   if(contract.expiresAt!=null&&contract.expiresAt<=c.hour+1){
    const cash=c.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
    renewals.push({id,hour:c.hour,cost:cash-c.resources.treasury,expiresAt:c.contracts[id].expiresAt});
   }
  }
  for(const operativeId of doctors){
   if(!c.operativeState[operativeId].medkits){
    const found=findRouteDressings(c,operativeId,1);c=found.campaign;
    purchases.push({id:operativeId,hour:c.hour,count:found.count,cost:0,source:'finite-sector-items'});
   }
   order({type:'assignCare',operativeId,assignment:'doctor'});
  }
  for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
  order({type:'wait',hours:1});
 }
 for(const id of patients){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 for(const operativeId of field.filter(id=>c.recruited.includes(id)))order({type:'assignCare',operativeId,assignment:'rest'});
 for(const [id,unit]of Object.entries(before.operativeState))if(!unit.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'coastalSurvivorsRecovered',campaign:c,patients,doctors,renewals,purchases,startedHour:before.hour,hour:c.hour});
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 return c;
}

function preparePaidCoastalAssault(start,target,{prepareAffordableSupport=false,report=()=>{}}={}){
 let c=recoverCoastalSurvivors(start,{report});
 let protectedIds=[];
 const order=a=>{if(a.type==='wait')for(const id of protectedIds){let q=c.contracts[id];while(c.recruited.includes(id)&&q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];}}c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
 // Recover actual living officers and existing equipment before hiring
 // short-term support. No fixed list may bring an earlier casualty back.
const regulars=c.squad.filter(id=>c.contracts[id]?.expiresAt===null);
assert.ok(regulars.length,'the savings wait needs a command that remains in service');
order({type:'squad',ids:regulars});
for(const operativeId of regulars)order({type:'assignCare',operativeId,assignment:'rest'});
c=ensureRouteTownIncome(c,{report});
// Retain inexpensive local survivors through paid rest while saving ordinary
// income. They remain available at their actual sector with their own kit.
for(const op of rosterFor(c).filter(op=>{
 const unit=c.operativeState[op.id],quote=contractQuote(c,op,'day');
 return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&unit.alive&&!unit.captured&&unit.location==='retiro'&&unit.hp===unit.maxHp&&!unit.bleeding&&quote.available&&quote.price<=routeHiringCeiling(c,100);
})){
 const quote=contractQuote(c,op,'week'),cash=c.resources.treasury;
 order({type:'recruitCivic',id:op.id,term:'week',destination:'retiro'});assert.equal(c.resources.treasury,cash-quote.price);
 report({event:'coastalLocalVeteranRehired',id:op.id,price:quote.price,hour:c.hour,location:c.operativeState[op.id].location});
}
protectedIds=c.recruited.filter(id=>{
 const unit=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id);
 return id>=100&&id<1000&&unit.alive&&!unit.captured&&unit.location==='retiro'&&unit.hp===unit.maxHp&&contractQuote(c,op,'day').price<=routeHiringCeiling(c,100);
});
for(const operativeId of protectedIds)order({type:'assignCare',operativeId,assignment:'rest'});
const candidates=()=>rosterFor(c).filter(op=>{
 const unit=c.operativeState[op.id],quote=contractQuote(c,op,'day'),serving=c.recruited.includes(op.id);
 return op.id>=100&&op.id<1000&&unit.alive&&!unit.captured&&unit.hp===unit.maxHp&&!unit.bleeding&&quote.available&&(!serving||unit.location==='retiro'&&protectedIds.includes(op.id))&&(unit.morale>=50||prepareAffordableSupport&&quote.price<=routeHiringCeiling(c,100));
}).sort((a,b)=>contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||b.marksmanship-a.marksmanship).slice(0,6);
const requiredFunds=()=>Math.max(16000,4000+2*candidates().filter(op=>!c.recruited.includes(op.id)).reduce((sum,op)=>sum+contractQuote(c,op,'day').price,0));
for(let h=0;h<6000&&(candidates().length<6||c.resources.treasury<requiredFunds());h+=6){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:6});if(h%240===0)report({event:'coastalIncomeSaved',target,hour:c.hour,treasury:c.resources.treasury,required:requiredFunds(),ready:candidates().length});}
assert.equal(candidates().length,6,'six real living support soldiers must be available');assert.ok(c.resources.treasury>=requiredFunds(),'ordinary income funds current support quotes and finite supplies');
const recruits=candidates().map(op=>op.id);
assert.equal(recruits.length,6);const field=[...regulars,...recruits];
report({event:'coastalPaidColumnFunded',target,hour:c.hour,treasury:c.resources.treasury,required:requiredFunds(),field:recruits.map(id=>({id,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price,serving:c.recruited.includes(id),morale:c.operativeState[id].morale}))});
if(prepareAffordableSupport){
 const early=recruits.filter(id=>contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price<=routeHiringCeiling(c,100));
 for(const id of early)if(!c.recruited.includes(id)){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day',destination:'retiro'});assert.equal(c.resources.treasury,cash-quote.price);report({event:'coastalSupportHired',id,price:quote.price,treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour});}
 protectedIds=[...new Set([...protectedIds,...early])];for(let h=0;h<24&&early.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});assert.ok(early.every(id=>c.recruited.includes(id)));for(const operativeId of early)order({type:'assignCare',operativeId,assignment:'rest'});
}
const rearm=field.filter(id=>c.operativeState[id].weaponDropped||![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon));
// Current firearms remain usable; a dropped primary needs actual finite local loot.
for(let h=0;h<24&&c.hour%24!==14;h++)order({type:'wait',hours:1});
for(const id of recruits)if(!c.recruited.includes(id)){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;order({type:'recruitCivic',id,term:'day',destination:'retiro'});assert.equal(c.resources.treasury,cash-quote.price);report({event:'coastalSupportHired',id,price:quote.price,treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour});}
protectedIds=recruits;
for(let h=0;h<24&&recruits.some(id=>!c.recruited.includes(id));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
assert.ok(recruits.every(id=>c.recruited.includes(id)),'coastal replacements must arrive before receiving equipment');
for(const operativeId of rearm)c=recoverRoutePrimary(c,operativeId,{report});
for(const operativeId of [...recruits].sort((a,b)=>rosterFor(c).find(op=>op.id===b).medical-rosterFor(c).find(op=>op.id===a).medical))for(const slot of ['headwear','outfit','legwear']){
 if(c.operativeState[operativeId][slot]?.condition>0)continue;
 const model=sectorInventoryModel(c,'retiro',rosterFor(c),operativeId),row=model.entries.find(r=>r.reachable&&JSON.parse(r.expected).kind==='outfit'&&JSON.parse(r.expected).outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot]&&JSON.parse(r.expected).condition>0);if(!row)continue;const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},keys=new Set(model.carried.map(r=>r.inventoryKey));
 order({type:'sectorInventory',sector:'retiro',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});const now=sectorInventoryModel(c,'retiro',rosterFor(c),operativeId),item=now.carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(item);const{item:sourceItem,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(item.expected),record);assert.equal(now.entries.find(r=>r.key===row.key)?.count??0,row.count-1);order({type:'sectorInventory',sector:'retiro',operativeId,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot});assert.deepEqual(c.operativeState[operativeId][slot],record);assert.deepEqual({hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},before);c=decodeSave(encodeSave(c)).campaign;report({event:'earlyFiniteClothing',operativeId,slot,key:row.key,record,sourceCount:row.count,remaining:row.count-1,...before});
}

order({type:'squad',ids:field.slice(0,6)});
const finiteBattery=prepareRouteBattery(c,['bronze4','bronze4'],{destination:'retiro',report});c=finiteBattery.campaign;
const main=c.activeSquadId;
order({type:'createSquad',name:'Apoyo del puerto',ids:field.slice(6),sector:'retiro'});const support=c.activeSquadId;
c=supplyRouteAmmunition(c,field,{target:12}).campaign;
order({type:'configureArtillery',types:[]});
for(const id of [main,support]){order({type:'selectSquad',id});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);}
if(target==='buenos_aires'){
 if(prepareAffordableSupport){
 for(const operativeId of recruits)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<240&&recruits.some(id=>c.operativeState[id].morale<50);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(recruits.every(id=>c.operativeState[id].morale>=50),'actual affordable paid rest must restore morale');
 }
 // Rehired survivors retain their actual fatigue. Waiting at the assembly
 // point on active duty does not provide the rest needed before this assault.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100||c.operativeState[id].asleep);h++){
  for(const id of recruits){const contract=c.contracts[id];if(contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  order({type:'wait',hours:1});
 }
 for(const operativeId of field){assert.equal(c.operativeState[operativeId].fatigue,0);assert.equal(c.operativeState[operativeId].energy,100);order({type:'assignCare',operativeId,assignment:'active'});}
}
if(prepareAffordableSupport)report({event:'earlyPaidReadiness',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field:field.map(id=>({id,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,fatigue:c.operativeState[id].fatigue,quote:contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price})),support:recruits});
order({type:'configureArtillery',types:finiteBattery.selections});
if(target==='ensenada')for(const id of [main,support]){order({type:'selectSquad',id});order({type:'travel',sector:'buenos_aires',mode:'posta'});}
for(const id of [main,support]){order({type:'selectSquad',id});order({type:'attack',sector:target,queue:true,mode:'posta'});}
for(let h=0;h<24&&![main,support].every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++)order({type:'wait',hours:1});
for(let h=0;h<24&&c.hour%24!==6;h++){for(const id of recruits){const contract=c.contracts[id];if(contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}order({type:'wait',hours:1});}
order({type:'beginAssault',sector:target});assert.equal(c.pendingBattle.squad.length,field.length);const battle=enterSector(c.pendingBattle,c.sectorStates[target]);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}

export const prepareFreshEnsenadaAssault=(start,options={})=>preparePaidCoastalAssault(start,'ensenada',options);

export function stabilizeFreshPortSurvivors(start,{report=()=>{},retainPatients=true}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);};
 const locals=c.recruited.filter(id=>{const unit=c.operativeState[id];return unit.alive&&!unit.captured&&unit.location==='ensenada';});
 const patients=locals.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 if(locals.some(id=>c.operativeState[id].bleeding||c.operativeState[id].hp<15)){
  assert.ok(locals.length<=6,'the actual local first-aid party must fit a squad');
  order({type:'createSquad',name:'Primer auxilio del puerto',ids:locals,sector:'ensenada'});order({type:'visitSector'});
  const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates.ensenada)),pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});
  for(const id of locals){assert.ok(c.operativeState[id].alive);assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
  report({event:'navalCommandFirstAid',hour:c.hour,second:c.secondOfHour,treated:aid.treatedIds,steps:aid.steps,locals:locals.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding,medkits:c.operativeState[id].medkits}))});
 }
 // Retain real wounded patients during the command's physical return and
 // local conversations. Later medical care renews only unfinished patients.
 for(const id of retainPatients?patients:[]){
  const contract=c.contracts[id];if(contract?.expiresAt==null||contract.expiresAt>c.hour+24)continue;
  const cash=c.resources.treasury,quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day');
  order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(c.resources.treasury,cash-quote.price);
  report({event:'portPatientRetained',id,price:quote.price,hour:c.hour,expiresAt:c.contracts[id].expiresAt,treasuryBefore:cash,treasuryAfter:c.resources.treasury});
 }
 // A capable survivor must physically speak with the controlled port representative.
 const speaker=locals.find(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding);
 if(speaker&&!c.townIncome.activations.ensenada){
  const selected=c.activeSquadId;order({type:'createSquad',name:'Acuerdo del puerto',ids:[speaker],sector:'ensenada'});
  order({type:'assignCare',operativeId:speaker,assignment:'active'});
  c=meetLocalIncomeRepresentative(c,{sourceId:'ensenada',operativeId:speaker,report});
  if(c.squads.some(group=>group.id===selected))order({type:'selectSquad',id:selected});
 }
 for(const[id,unit]of Object.entries(start.operativeState))if(!unit.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function recruitFreshNavalCommand(start,{report=()=>{}}={}){
 let funded=stabilizeFreshPortSurvivors(start,{report,retainPatients:false});
 const order=action=>{funded=dispatchCampaign(funded,action);assert.equal(funded.lastError,null,JSON.stringify(action)+funded.lastError);};
 order({type:'selectSquad',id:funded.squads.find(q=>q.members.includes(57)).id});
 // Keep two recruitment places. Other survivors remain at their real sector.
 order({type:'squad',ids:[57]});
 const paidForeign=rosterFor(funded).filter(op=>{
  const r=funded.operativeState[op.id],contract=funded.contracts[op.id];
  return op.foreign&&funded.recruited.includes(op.id)&&r.alive&&!r.captured&&contract?.kind!=='patriot'&&(r.lastMoralePayAt===null||funded.hour-r.lastMoralePayAt>=24);
 }).sort((a,b)=>contractQuote(funded,a,'day').price-contractQuote(funded,b,'day').price);
 for(const op of paidForeign){
  if(funded.reputation.foreign>=30)break;
  order({type:'renewContract',id:op.id,term:'day',expectedExpiresAt:funded.contracts[op.id].expiresAt});
 }
 assert.ok(funded.reputation.foreign>=30,'actual foreign service payments must earn the naval reputation requirement');
 const c=meetRecruits(funded,['brown','bouchard'],57);
 assert.ok(c.recruited.includes(5)&&c.recruited.includes(6));
 assert.ok(c.operativeState[57].alive);assert.equal(c.defeated,false);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}

export function prepareFreshSantaFeAssault(start,{report=()=>{},includeLightGun=false}={}){
 // The coast can leave named officers dead. Recover the real survivors and
 // select affordable, living support without recreating the former squad.
 let c=recoverFreshPort(start,{hospital:'cordoba'});
 c=ensureRouteTownIncome(c,{report});
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
 c=prepareSantaFePaidColumn(c,{report});
 const field=[...c.squad];assert.equal(field.length,6);assert.ok(field.includes(57));
 for(const operativeId of field){
  const primary=rosterFor(c).find(op=>op.id===operativeId);
  if(c.operativeState[operativeId].weaponDropped||!primaryAmmoTypeFor(primary)){
   const model=sectorInventoryModel(c,c.location,rosterFor(c),operativeId);
   const row=model.entries.filter(r=>{const stack=JSON.parse(r.expected);return r.reachable&&stack.item==='weapon'&&stack.weapon===1801&&stack.condition>0;}).sort((a,b)=>b.condition-a.condition||Number(b.loaded)-Number(a.loaded)||a.key.localeCompare(b.key))[0];
   if(row){
    const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury,stock:structuredClone(c.merchants[c.location].stock),contracts:structuredClone(c.contracts)},keys=new Set(model.carried.map(r=>r.inventoryKey));
    order({type:'sectorInventory',sector:c.location,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    const now=sectorInventoryModel(c,c.location,rosterFor(c),operativeId),item=now.carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&r.equip?.some(e=>e.slot==='primary'&&e.valid));assert.ok(item);
    const{item:sourceItem,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(item.expected),record,'local rearming retains the complete finite weapon record');
    assert.equal(now.entries.find(r=>r.key===row.key)?.count??0,row.count-1,'each recovered rifle leaves its actual source once');
    order({type:'sectorInventory',sector:c.location,operativeId,direction:'equip',inventoryKey:item.inventoryKey,expected:item.expected,slot:'primary'});
    assert.deepEqual({hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury,stock:c.merchants[c.location].stock,contracts:c.contracts},before,'local recovery preserves paid terms, time, money and supplier stock');
    report({event:'santaFeFinitePrimaryRecovered',operativeId,sourceKey:row.key,record,hour:c.hour,second:c.secondOfHour});
   }else c=recoverRoutePrimary(c,operativeId,{report});
  }

  order({type:'assignCare',operativeId,assignment:'active'});
 }
 c=repairRouteFirearms(c,field);
 c=supplyRouteAmmunition(c,field,{target:15}).campaign;
 order({type:'configureArtillery',types:[]});c=finishReloadsBeforeMarch(c);
 report({event:'freshSantaFePreparation',campaign:c,field});
 c=prepareSantaFeBatteries(c,field,{report,includeLightGun});
 const lightBefore=(c.artilleryDepots.cordoba??[]).filter(gun=>gun.type==='swivel').map(gun=>structuredClone(gun));
 c=prepareFinalAssault(c,{staging:'cordoba',target:'santa_fe',fieldIds:field});
 if(includeLightGun){
  assert.equal(lightBefore.length,1,'the selected light gun must have actual canonical custody');
  const issued=c.pendingBattle.artillery.filter(gun=>!gun.stationed&&gun.type==='swivel');assert.equal(issued.length,1);
  assert.equal(issued[0].id,lightBefore[0].id);assert.equal(issued[0].ammo,lightBefore[0].ammo);assert.equal(issued[0].loaded,lightBefore[0].loaded);
  assert.ok(!(c.artilleryDepots.cordoba??[]).some(gun=>gun.id===lightBefore[0].id));
  report({event:'freshSantaFeLightIssued',record:lightBefore[0]});
 }
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 const battle=enterSector(c.pendingBattle,c.sectorStates.santa_fe);
 assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 return c;
}

// Recover and transport the same finite pieces through controlled arsenals.
// Paid crew terms, remaining shots and the time of day remain active.
export function prepareSantaFeBatteries(start,field,{report=()=>{},includeLightGun=false}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=action=>{
  if(action.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+action.hours){c=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(c.lastError,null,c.lastError);}}
  c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);
 };
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const finiteBattery=prepareRouteBattery(c,['bronze4','bronze4',...(includeLightGun?['swivel']:[])],{destination:'cordoba',report});c=finiteBattery.campaign;
 order({type:'configureArtillery',types:finiteBattery.selections});
 for(let hour=0;hour<48&&(c.hour%24!==6||field.some(id=>{const r=c.operativeState[id];return r.fatigue||r.energy<100||r.asleep;}));hour++)order({type:'wait',hours:1});
 assert.equal(c.hour%24,6);
 for(const operativeId of field){const r=c.operativeState[operativeId];assert.equal(r.fatigue,0);assert.equal(r.energy,100);assert.equal(r.asleep,false);order({type:'assignCare',operativeId,assignment:'active'});}
 return c;
}

// Stabilize the surviving command with carried supplies and paid patient contracts.
export function recoverFreshPort(start,{hospital='retiro',report=()=>{},fieldIds}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[...new Set(fieldIds??[...c.sectorStates.ensenada.units.filter(u=>u.side==='player'&&u.hp>0).map(u=>Number(u.id)),...c.recruited.filter(id=>['ensenada','buenos_aires'].includes(c.operativeState[id].location)),5,6])].filter(id=>c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured);
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const affordableDoctor=op=>c.contracts[op.id]?.kind==='patriot'||contractQuote(c,op,'day').price<=routeHiringCeiling(c,100);
 let activeDoctors=rosterFor(c).filter(op=>field.includes(op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20&&affordableDoctor(op)).map(op=>op.id);
 const order=a=>{
  // Retain the actual treating doctors as well as their patients. Otherwise
  // a healthy paid doctor can depart while an injured survivor still needs care.
  if(a.type==='wait')for(const id of new Set([...patients.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding),...activeDoctors])){
   const contract=c.contracts[id];
   if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+a.hours){
    const cash=c.resources.treasury,next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;
    report({event:'careRenewal',operativeId:id,assignment:c.operativeState[id].assignment,hour:c.hour,cost:cash-c.resources.treasury,previousExpiresAt:contract.expiresAt,expiresAt:c.contracts[id].expiresAt});
   }
  }
  const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;
 };
 // Routed survivors may be in a different province. Stop their bleeding at
 // their real location before advancing any evacuation clock.
 for(const at of new Set(patients.filter(id=>c.operativeState[id].bleeding).map(id=>c.operativeState[id].location))){
  const local=field.filter(id=>c.operativeState[id].location===at);
  assert.ok(local.length<=6,'the actual first-aid party must fit a squad');
  order({type:'createSquad',name:'Socorro del puerto',ids:local,sector:at});order({type:'visitSector'});
  const aid=autoBandageBattle(enterSector(c.pendingBattle,c.sectorStates[at])),pair=syncBattleTime(c,aid.battle);assert.equal(pair.error,null);c=pair.campaign;
  order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
  for(const id of local)assert.equal(c.operativeState[id].bleeding,0);
 }
 const groups=[];
 for(const at of new Set(field.map(id=>c.operativeState[id].location))){
  const local=field.filter(id=>c.operativeState[id].location===at);
  for(let offset=0;offset<local.length;offset+=6){order({type:'createSquad',name:'Regreso del puerto',ids:local.slice(offset,offset+6),sector:at});groups.push(c.activeSquadId);for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});if(at!==hospital)order({type:'travel',sector:hospital,queue:true,mode:'posta'});}
 }
 for(let h=0;h<48&&groups.some(id=>c.squads.find(q=>q.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of patients)assert.equal(c.operativeState[id].location,hospital);
 const command=c.squads.find(q=>q.members.includes(57));assert.ok(command);order({type:'selectSquad',id:command.id});
 for(const operativeId of field.filter(id=>c.recruited.includes(id)))order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<120&&patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
  assert.equal(c.pendingEncounter,null);
  const unfinished=patients.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
  // A bandaged conscious officer can work as a doctor while wounded. Heal
  // the permanent physician first, then use that real survivor for the rest.
  const primary=[...unfinished].sort((a,b)=>Number(c.contracts[b]?.kind==='patriot'&&rosterFor(c).find(op=>op.id===b).medical>=20)-Number(c.contracts[a]?.kind==='patriot'&&rosterFor(c).find(op=>op.id===a).medical>=20)||rosterFor(c).find(op=>op.id===b).medical-rosterFor(c).find(op=>op.id===a).medical||c.operativeState[a].hp/c.operativeState[a].maxHp-c.operativeState[b].hp/c.operativeState[b].maxHp)[0];
  const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&op.id!==primary&&c.recruited.includes(op.id)&&c.operativeState[op.id].alive&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&op.medical>=20&&affordableDoctor(op)).sort((a,b)=>b.medical-a.medical).slice(0,Math.max(1,unfinished.length));
  assert.ok(doctors.length,'a conscious actual survivor must provide paid finite care');activeDoctors=doctors.map(op=>op.id);
  for(const operativeId of field.filter(id=>c.recruited.includes(id)))order({type:'assignCare',operativeId,assignment:'rest'});
  for(const doctor of doctors){if(!c.operativeState[doctor.id].medkits)c=findRouteDressings(c,doctor.id,1).campaign;order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});}
  order({type:'assignCare',operativeId:primary,assignment:'patient'});
  order({type:'wait',hours:1});
  report({event:'portMedicalCare',hour:c.hour,treasury:c.resources.treasury,patient:primary,doctors:activeDoctors,unfinished:unfinished.map(id=>({id,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp}))});
 }
 for(const id of patients){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return c;
}


// Rebuild paid support and lift the actual naval occupation before the northern road.
export function prepareFreshBlockadeAssault(start,options={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const ready=op=>{const r=c.operativeState[op.id];return c.recruited.includes(op.id)&&c.contracts[op.id]?.kind==='patriot'&&r.alive&&!r.captured&&r.location==='retiro'&&r.hp===r.maxHp&&!r.bleeding;};
 const roster=rosterFor(c),field=c.squad.filter(id=>ready(roster.find(op=>op.id===id)));
 for(const op of roster.filter(op=>ready(op)&&!field.includes(op.id)).sort((a,b)=>b.medical-a.medical||b.marksmanship-a.marksmanship))if(field.length<5)field.push(op.id);
 assert.ok(field.includes(57)&&field.includes(5)&&field.includes(6),'the actual recovered naval command leads the return');
 c=dispatchCampaign(c,{type:'squad',ids:field});assert.equal(c.lastError,null);
 return preparePaidCoastalAssault(c,'buenos_aires',options);
}
