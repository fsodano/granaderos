import {prepareRouteBattery,prepareRouteMixedBattery} from './route-battery.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {repairRouteFirearms,discoverRouteCache} from './finite-route-equipment.mjs';
import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor,dailyIncome} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {baseMorale} from '../game/morale.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {BLADES} from '../game/tactical.js';
import {squadTravelStatus} from '../game/squad-travel.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';

// Stage the actual surviving Cuyo relief with paid service and finite local kit.
export function stageActualPaidCapitalRelief(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const before=structuredClone(c),paid=[142,147],permanent=[5,6,7,11],events=[];
 for(const id of [...permanent,57])assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.contracts[id].expiresAt===null);
 for(const id of paid)assert.ok(c.operativeState[id].alive&&!c.operativeState[id].captured&&!c.recruited.includes(id));
 const order=a=>{
  if(a.type==='wait')for(const id of paid.filter(id=>c.recruited.includes(id))){
   while(c.contracts[id].expiresAt<=c.hour+a.hours){
    const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),oldExpiry=c.contracts[id].expiresAt,cash=c.resources.treasury;
    order({type:'renewContract',id,term:'day',expectedExpiresAt:oldExpiry});
    assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.contracts[id].expiresAt,quote.expiresAt);
   }
  }
  const cash=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+' '+n.lastError);c=n;
  events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:cash-c.resources.treasury});
 };
 for(const operativeId of [...permanent,57])order({type:'assignCare',operativeId,assignment:'rest'});
 const cordoba=c.squads.find(q=>q.members.includes(57));assert.ok(cordoba&&cordoba.location==='cordoba');order({type:'selectSquad',id:cordoba.id});order({type:'configureArtillery',types:[]});
 const battery=prepareRouteBattery(c,['bronze4','bronze4','bronze4'],{destination:'cordoba',report});c=battery.campaign;assert.equal(battery.selections.length,3);
 const fees=paid.reduce((sum,id)=>sum+contractQuote(c,rosterFor(c).find(op=>op.id===id),'day').price,0);
 const reserve=60000+18*fees+2000;
 report({event:'paidCapitalFundingStarted',hour:c.hour,treasury:c.resources.treasury,income:dailyIncome(c),dailyFees:fees,reserve,storedGuns:3});
 const fundingStart=c.hour;
 for(let attempts=0;attempts<400&&c.resources.treasury<reserve;attempts++){
  assert.equal(c.pendingEncounter,null);assert.ok(dailyIncome(c)>0,'ordinary income must fund the real relief');
  const h=c.hour;order({type:'wait',hours:24-c.hour%24});
  assert.ok(c.hour>h,'a funding wait must advance the ordinary game clock');
  if(attempts%20===0){
   report({event:'paidCapitalFundingProgress',hour:c.hour,treasury:c.resources.treasury});
  }
 }
 assert.ok(c.resources.treasury>=reserve,'the paid relief must bank its complete finite reserve before hiring');
 assert.ok(c.hour-fundingStart<=9600);
 report({event:'paidCapitalFunded',hour:c.hour,treasury:c.resources.treasury,reserve});
 order({type:'createSquad',ids:[7,11],sector:'mendoza',name:'Relevo de Cuyo'});
 for(const id of paid){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
  order({type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.price);
  report({event:'paidCapitalHired',id,hour:c.hour,price:quote.price,arrival:c.hiringArrivals.find(a=>a.operativeId===id)});
 }
 for(let h=0;h<24&&!paid.every(id=>c.recruited.includes(id));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(paid.every(id=>c.recruited.includes(id)&&c.operativeState[id].location==='mendoza'));
 for(const id of paid){
  const op=rosterFor(c).find(o=>o.id===id),r=c.operativeState[id];
  assert.equal(op.weapon,0);assert.equal(op.blade,0);
  for(const slot of ['headwear','outfit','legwear'])assert.equal(r[slot],null);
  assert.deepEqual(r.inventory,{});assert.equal(r.rations,0);assert.equal(r.medkits,0);assert.equal(r.toolkitPoints,0);
 }
 const inventory=id=>sectorInventoryModel(c,'mendoza',rosterFor(c),id);
 for(const operativeId of paid)for(const slot of ['primary','headwear','outfit','legwear','blade']){
  const actor=rosterFor(c).find(op=>op.id===operativeId),state=c.operativeState[operativeId];
  const present=slot==='primary'?actor.weapon:slot==='blade'?actor.blade:state[slot]?.condition;
  if(present>0)continue;
  const matches=item=>slot==='primary'?item.weapon===1801&&item.condition>0:slot==='blade'?!!BLADES[item.weapon]&&item.condition>0:item.kind==='outfit'&&item.condition>0&&item.outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot];
  const model=inventory(operativeId),row=model.entries.filter(row=>row.reachable&&matches(JSON.parse(row.expected))).sort((a,b)=>(b.condition??0)-(a.condition??0)||a.key.localeCompare(b.key))[0];
  assert.ok(row,`actual ${operativeId} ${slot} needs a reachable finite local source`);
  const keys=new Set(model.carried.map(row=>row.inventoryKey).filter(Boolean)),clock={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},contracts=structuredClone(c.contracts);
  order({type:'sectorInventory',sector:'mendoza',operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const after=inventory(operativeId),carried=after.carried.find(row=>row.inventoryKey&&!keys.has(row.inventoryKey)&&row.equip?.some(e=>e.slot===slot&&e.valid));assert.ok(carried);
  const {item,...record}=JSON.parse(row.expected);assert.deepEqual(JSON.parse(carried.expected),record);assert.equal(after.entries.find(source=>source.key===row.key)?.count??0,row.count-1);
  order({type:'sectorInventory',sector:'mendoza',operativeId,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});
  assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},clock);assert.deepEqual(c.contracts,contracts);
  if(slot==='primary')assert.equal(rosterFor(c).find(op=>op.id===operativeId).weapon,record.weapon);
  else if(slot==='blade')assert.equal(rosterFor(c).find(op=>op.id===operativeId).blade,record.weapon);
  else assert.deepEqual(c.operativeState[operativeId][slot],record);
  if(['primary','blade'].includes(slot))assert.deepEqual(JSON.parse(inventory(operativeId).carried.find(row=>row.item===slot).store.expected),JSON.parse(row.expected),'equipped finite weapon retains definitions, identity, fittings, condition and chamber/reload state');
  report({event:'paidCapitalFiniteKit',operativeId,slot,sourceKey:row.key,record,remaining:row.count-1,hour:c.hour});
 }
 const fromMendoza=[7,11,...paid];order({type:'createSquad',ids:fromMendoza,sector:'mendoza',name:'Auxilio de Cuyo'});
 for(const operativeId of fromMendoza)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:[]});order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 const incoming=c.activeSquadId,quote=squadTravelStatus(c.squads.find(q=>q.id===incoming));assert.equal(quote.remaining,4);
 const travelStart=c.hour;
 for(let h=0;h<12&&c.squads.find(q=>q.id===incoming).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.location,'cordoba');assert.equal(c.hour-travelStart,4);
 const field=[5,6,7,11,...paid];
 for(const id of field)assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='cordoba');
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 for(const id of paid)assert.ok(c.contracts[id].expiresAt>c.hour&&contractQuote(c,rosterFor(c).find(o=>o.id===id),'day').price>100);
 assert.equal(c.recruited.includes(135),false,'the only actual available northern physician remains unhired in reserve');
 assert.ok(c.operativeState[135].alive);assert.deepEqual(c.operativeState[135],before.operativeState[135]);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'paidCapitalStaged',hour:c.hour,treasury:c.resources.treasury,field,events,morale:field.map(id=>({id,morale:c.operativeState[id].morale,target:baseMorale(rosterFor(c).find(op=>op.id===id))}))});
 return {campaign:c,field,events,reserve};
}


// Recover all five actual high-pass survivors during real finite local care.
export function prepareCreatedFiveSurvivorCapitalReturn(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=c.squad.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured;});
 assert.deepEqual(field,[57,7,135,142,145],'the final relief uses all five actual high-pass survivors');
 const events=[],before=structuredClone(c);
 const order=action=>{
  if(action.type==='wait')for(const id of field){
   while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+action.hours){
    order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
   }
  }
  const money=c.resources.treasury,next=dispatchCampaign(c,action);
  assert.equal(next.lastError,null,JSON.stringify(action)+' '+next.lastError);
  c=decodeSave(encodeSave(next)).campaign;
  events.push({action,hour:c.hour,second:c.secondOfHour,cost:money-c.resources.treasury});
 };
 const rest=limit=>{
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
  for(let h=0;h<limit&&field.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue>0||r.asleep;});h++){
   assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
  }
  assert.ok(field.every(id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;}));
 };
 const treat=(patient,doctor,target)=>{
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===patient?'patient':'rest'});
  for(let h=0;h<30&&c.operativeState[patient].hp<target;h++){
   assert.equal(c.pendingEncounter,null);
   if(!c.operativeState[doctor].medkits)c=supplyRouteDressings(c,doctor,(c.operativeState[doctor].medkits??0)+(1),{report});
   order({type:'assignCare',operativeId:doctor,assignment:'doctor'});order({type:'wait',hours:1});
  }
  assert.ok(c.operativeState[patient].hp>=target,'finite local care must reach the stated partial health');
 };
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:[]});
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 const squad=c.activeSquadId;
 for(let h=0;h<60&&c.squads.find(q=>q.id===squad).journey;h++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.location,'cordoba');
 const firstBattery=prepareRouteBattery(c,['bronze4','swivel'],{destination:'cordoba',report});c=firstBattery.campaign;
 treat(145,135,65);treat(135,57,65);rest(24);
 for(const operativeId of field){
  if(c.operativeState[operativeId].condition<100)c=repairRouteFirearms(c,[operativeId]);
  if(operativeId!==57&&c.operativeState[operativeId].medkits<2)c=supplyRouteDressings(c,operativeId,(c.operativeState[operativeId].medkits??0)+(2-c.operativeState[operativeId].medkits),{report});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:firstBattery.selections});

 // Doctor 135 spends his carried kits first, then recovers each required dressing
 // from actual finite local stocks. The others rest while the command wound heals.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===57?'patient':operativeId===135?'doctor':'rest'});
 for(let h=0;h<12&&c.operativeState[57].hp<60;h++){
  assert.equal(c.pendingEncounter,null);
  if(!c.operativeState[135].medkits)c=supplyRouteDressings(c,135,(c.operativeState[135].medkits??0)+(1),{report});
  order({type:'wait',hours:1});
 }
 assert.ok(c.operativeState[57].hp>=60);rest(8);
 for(const operativeId of field){
  if(c.operativeState[operativeId].medkits<2)c=supplyRouteDressings(c,operativeId,(c.operativeState[operativeId].medkits??0)+(2-c.operativeState[operativeId].medkits),{report});
  order({type:'assignCare',operativeId,assignment:'active'});
 }
 report({event:'actualFinalBatteryCare',hour:c.hour,treasury:c.resources.treasury,contracts:structuredClone(c.contracts)});
 for(let h=0;h<24;h++){
  const reservePatients=[7,142].filter(id=>c.operativeState[id].hp<65),physicianPatient=!reservePatients.length&&c.operativeState[135].hp<c.operativeState[135].maxHp;
  const tired=field.some(id=>{const r=c.operativeState[id];return r.energy<100||r.fatigue>0||r.asleep;});
  if(!reservePatients.length&&!physicianPatient&&!tired)break;
  assert.equal(c.pendingEncounter,null);assert.ok(c.hour+1+8<10440,'actual finite care and supply must leave time for the admitted return route');
  const doctor=reservePatients.length?135:physicianPatient?57:null;
  if(doctor&&!c.operativeState[doctor].medkits)c=supplyRouteDressings(c,doctor,(c.operativeState[doctor].medkits??0)+(1),{report});
  for(const operativeId of field)order({type:'assignCare',operativeId,assignment:operativeId===doctor?'doctor':reservePatients.includes(operativeId)||physicianPatient&&operativeId===135?'patient':'rest'});
  order({type:'wait',hours:1});
 }
 assert.ok([7,142].every(id=>c.operativeState[id].hp>=65));assert.equal(c.operativeState[135].hp,c.operativeState[135].maxHp);assert.ok(field.every(id=>{const r=c.operativeState[id];return r.energy===100&&!r.fatigue&&!r.asleep;}));
 const finalBattery=prepareRouteMixedBattery(c,3,{destination:'san_nicolas',report});c=finalBattery.campaign;order({type:'configureArtillery',types:finalBattery.selections});
 // This five-person branch tops up a stated carried reserve instead of
 // adding seven kits to actors who already carry finite dressings.
 const medicalTargets=new Map(field.map(id=>[id,id===135?10:6]));
 c=discoverRouteCache(c,field[0]);
 const medicalBefore=new Map(field.map(id=>[id,c.operativeState[id].medkits]));
 const medicalStock=()=>sectorInventoryModel(c,c.location,rosterFor(c),field[0]).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);
 const localCarried=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===c.location;}).reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);
 const medicalStockBefore=medicalStock();
 const medicalNeed=field.reduce((n,id)=>n+Math.max(0,medicalTargets.get(id)-medicalBefore.get(id)),0);
 const donatedReserve=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===c.location;}).reduce((sum,id)=>sum+Math.max(0,(c.operativeState[id].medkits??0)-(medicalTargets.get(id)??0)),0);
 assert.ok(medicalNeed<=medicalStockBefore+donatedReserve,'the exact five-person reserve must fit actual local stock and carried surplus');
 const medicalTotalBefore=medicalStockBefore+localCarried(),medicalReceipts=[];
 const medicalCashBefore=c.resources.treasury,medicalHour=c.hour,medicalSecond=c.secondOfHour;
 for(const operativeId of field){
  const quantity=Math.max(0,medicalTargets.get(operativeId)-c.operativeState[operativeId].medkits);
  if(quantity)c=supplyRouteDressings(c,operativeId,medicalTargets.get(operativeId),{reserves:Object.fromEntries(medicalTargets),report:event=>{medicalReceipts.push(event);report(event);}});
 }
 assert.ok(field.every(id=>c.operativeState[id].medkits>=medicalTargets.get(id)));
 assert.equal(medicalStock()+localCarried(),medicalTotalBefore,'Actual distribution conserves finite local dressings.');
 assert.equal(c.resources.treasury,medicalCashBefore);
 assert.equal(c.hour,medicalHour);assert.equal(c.secondOfHour,medicalSecond);
 report({event:'actualFivePersonMedicalReserve',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,stockBefore:medicalStockBefore,stockAfter:medicalStock(),collected:medicalReceipts.filter(event=>event.event==='routeDressingsCollected').reduce((sum,event)=>sum+event.count,0),receipts:medicalReceipts,carried:field.map(id=>({id,before:medicalBefore.get(id),target:medicalTargets.get(id),after:c.operativeState[id].medkits}))});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 report({event:'actualFivePersonReturnDeparture',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury});
 c=prepareFinalAssault(c,{staging:'san_nicolas',target:'buenos_aires'});
 assert.ok(c.pendingBattle&&c.pendingBattle.squad.every(u=>u.hp>=60));
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'finalCapitalReady',hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field,events});
 return c;
}
