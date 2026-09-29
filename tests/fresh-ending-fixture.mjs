import {workshopServiceQuote} from '../game/workshop-service.js';
import {firstAidPlan} from '../game/first-aid.js';
import {doctorRate,careAssignmentReason} from '../game/medical-care.js';
import assert from 'node:assert/strict';
import {dispatchCampaign,isSupplied,civicStatus} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {contractQuote} from '../game/contracts.js';
import {rosterFor} from '../game/campaign.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {freshCuyoRoute} from './fresh-cuyo-fixture.mjs';
import {fight} from './cuyo-route-driver.mjs';
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const deaths=s=>Object.entries(s.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
function renew(s,hours){for(const id of s.squad)if(s.contracts[id].expiresAt!==null&&s.contracts[id].expiresAt<s.hour+hours){const before=s.resources.treasury;s=order(s,{type:'renewContract',id,term:id===128||id===142?'day':'week'});assert.ok(s.resources.treasury<before);}return s;}
function workshop(s){for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:id});if(!n.lastError){assert.ok(n.resources.treasury<s.resources.treasury);s=n;}}return s;}

function recoverSquad(s){
 const care={hours:0,dressingsBought:0,cost:0};
 while(true){
  const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),patient=roster.filter(o=>s.operativeState[o.id].hp<o.maxHp||s.operativeState[o.id].bleeding).sort((a,b)=>a.medical-b.medical)[0];if(!patient)break;
  assert.ok(care.hours<48,'recovery must use bounded, paid campaign care');
  const doctor=roster.filter(o=>o.id!==patient.id&&o.medical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&(s.operativeState[o.id].energy??100)>10).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living local doctor is required');
  for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
  if(!s.operativeState[doctor.id].medkits){const quantity=Math.min(20,Math.ceil((patient.maxHp-s.operativeState[patient.id].hp)/doctorRate(doctor,s))+Number(s.operativeState[patient.id].bleeding>0)),before=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:doctor.id,quantity});care.dressingsBought+=quantity;care.cost+=before-s.resources.treasury;}
  assert.equal(careAssignmentReason(s,doctor,'doctor'),'');s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
  const stock=s.operativeState[doctor.id].medkits;s=saved({campaign:order(s,{type:'wait',hours:1})}).campaign;assert.equal(s.operativeState[doctor.id].medkits,stock-1);care.hours++;
 }
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 assert.equal(care.cost,care.dressingsBought*10);return {campaign:s,care};
}

// Treat urgent wounds before moving the force. This uses ordinary local
// assignments, actual finite dressings and hourly work; it never edits health.
function stabilizeBeforeMarch(s){
 const care={hours:0,dressingsUsed:0,dressingsBought:0,cost:0};
 while(true){
  const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),patients=roster.filter(o=>s.operativeState[o.id].bleeding||s.operativeState[o.id].hp<15);
  if(!patients.length)break;assert.ok(care.hours<24,'urgent care must finish through finite hourly work');
  const doctors=roster.filter(o=>!patients.includes(o)&&o.medical>=20&&(s.operativeState[o.id].energy??100)>10).sort((a,b)=>Number((s.operativeState[b.id].medkits??2)>0)-Number((s.operativeState[a.id].medkits??2)>0)||b.medical-a.medical).slice(0,patients.length);assert.ok(doctors.length,'a stable local doctor is required before the march');
  for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
  const stocks=new Map();for(const doctor of doctors){
   if(!s.operativeState[doctor.id].medkits){const money=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:doctor.id,quantity:1});care.cost+=money-s.resources.treasury;care.dressingsBought++;}
   stocks.set(doctor.id,s.operativeState[doctor.id].medkits);s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});
  }
  for(const patient of patients)s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
  s=saved({campaign:order(s,{type:'wait',hours:1})}).campaign;care.hours++;
  for(const doctor of doctors){assert.equal(s.operativeState[doctor.id].medkits,stocks.get(doctor.id)-1);care.dressingsUsed++;}
 }
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 assert.equal(care.cost,care.dressingsBought*10);return {campaign:s,care};
}

export function freshHistoricalEnding(options){return finishHistoricalFromCuyo(freshCuyoRoute(),options);}
export function finishHistoricalFromCuyo(prefix,{onCheckpoint}={}){
 let s=renew(prefix.campaign,60);const notes=[];
 // Mountain losses require real replacements before exposing the commander.
 s=order(s,{type:'wait',hours:24});const relief=[125,103,127,112,104,117,139].filter(id=>civicStatus(s,id).available).slice(0,6-s.squad.length);
 for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:'mendoza'});
 if(relief.length)s=order(s,{type:'wait',hours:6});const commanderRestock=workshopServiceQuote(s,rosterFor(s).find(o=>o.id===57),'resupply',isSupplied(s,s.location)).cost;s=workshop(s);
 for(const id of relief){s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});const item=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(item);s=order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:item.id});}
 notes.push({stage:'cuyo-relief',commanderRestock,hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,relief,squad:[...s.squad]});onCheckpoint?.('cuyo-relief',s,notes);
 s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});const instance=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(instance);s=order(s,{type:'equip',operativeId:57,slot:'weapon',itemId:'firearm-1801',instanceId:instance.id});assert.ok(s.resources.treasury>0);
 for(const [via,sector] of [['cordoba','santa_fe'],['buenos_aires','ensenada'],[null,'jujuy'],[null,'humahuaca']]){
  if(sector==='jujuy'){
   s=order(s,{type:'travel',sector:'cordoba'});s=workshop(s);s=order(s,{type:'travel',sector:'salta'});s=order(s,{type:'wait',hours:24});assert.ok(hiringArrivalOptions(s).some(o=>o.id==='salta'));
   const before=s.resources.treasury,ids=[128,142].slice(0,6-s.squad.length),cost=ids.reduce((sum,id)=>sum+contractQuote(s,rosterFor(s).find(o=>o.id===id),'day').price,0);for(const id of ids)s=order(s,{type:'recruitCivic',id,term:'day',destination:'salta'});assert.equal(s.resources.treasury,before-cost);assert.ok(ids.every(id=>!s.recruited.includes(id)));if(ids.length)s=order(s,{type:'wait',hours:6});assert.ok(ids.every(id=>s.squad.includes(id)&&s.contracts[id].started===s.hour&&s.contracts[id].expiresAt===s.hour+24));
   notes.push({stage:'northern-relief',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad]});onCheckpoint?.('relief',s,notes);
   const arrivalHour=(s.hour+12)%24,daylightWait=arrivalHour<8?8-arrivalHour:arrivalHour>=20?32-arrivalHour:0;if(daylightWait)s=order(s,{type:'wait',hours:daylightWait});
  }else s=renew(s,sector==='humahuaca'?25:60);
  if(sector==='humahuaca'){
   assert.ok(hiringArrivalOptions(s).some(o=>o.id==='jujuy'));const ids=[142,105,103,112,104,139].filter(id=>civicStatus(s,id).available).slice(0,6-s.squad.length),before=s.resources.treasury,cost=ids.reduce((sum,id)=>sum+contractQuote(s,rosterFor(s).find(o=>o.id===id),'day').price,0);
   for(const id of ids)s=order(s,{type:'recruitCivic',id,term:'day',destination:'jujuy'});assert.equal(s.resources.treasury,before-cost);if(ids.length)s=order(s,{type:'wait',hours:6});assert.ok(ids.every(id=>s.squad.includes(id)));
   notes.push({stage:'final-relief',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],relief:ids});onCheckpoint?.('final-relief',s,notes);
   const arrivalHour=(s.hour+12)%24,daylightWait=arrivalHour<6?6-arrivalHour:arrivalHour>=20?30-arrivalHour:0;if(daylightWait)s=order(s,{type:'wait',hours:daylightWait});
  }
  if(via)s=order(s,{type:'travel',sector:via});
  if(sector==='ensenada'){
   s=renew(s,96);assert.ok(hiringArrivalOptions(s).some(o=>o.id==='buenos_aires'));
   const relief=[117,139].filter(id=>civicStatus(s,id).available).slice(0,6-s.squad.length);
   for(const id of relief)s=order(s,{type:'recruitCivic',id,term:'week',destination:'buenos_aires'});
   if(relief.length)s=order(s,{type:'wait',hours:6});s=order(s,{type:'travel',sector:'retiro'});s=workshop(s);
   for(const id of relief){s=order(s,{type:'purchaseEquipment',item:'firearm-1801'});const item=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(item);s=order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:item.id});}
   const recovery=recoverSquad(s);s=workshop(recovery.campaign);
   notes.push({stage:'coastal-care',hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,relief,care:recovery.care,squad:[...s.squad]});onCheckpoint?.('coastal-care',s,notes);s=order(s,{type:'travel',sector:'buenos_aires'});
   // A longer medical campaign must leave enough defense for the later raid.
   const defenseCost=s.resources.treasury;s=order(s,{type:'fortify',sector:'buenos_aires'});assert.equal(s.resources.treasury,defenseCost-150);assert.equal(s.sectors.buenos_aires.fort,2);
   // Recovery changes the departure clock. Reach the wetland in morning light
   // through ordinary waiting and the same twelve-hour assault journey.
   const arrivalHour=(s.hour+12)%24,daylightWait=arrivalHour<8?8-arrivalHour:arrivalHour>=20?32-arrivalHour:0;if(daylightWait)s=order(s,{type:'wait',hours:daylightWait});
  }
  // Renew against the actual departure clock, including all medical and daylight waits.
  s=renew(s,24);
  onCheckpoint?.(`approach-${sector}`,s,notes);s=order(s,{type:'attack',sector});assert.ok(s.pendingBattle);const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const {battle,orders,actions}=fight(request,previous,{scoutCostWeight:.01,avoidCivilians:true,holdPosition:['ensenada','humahuaca'].includes(sector)?['57']:[]});assert.equal(battle.status,'victory',sector);let p={campaign:s,battle:enterSector(request,previous)};
  for(let i=0;i<orders.length;i++){p=tactical(p,orders[i]);if(i===Math.floor(orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,battle.units);assert.deepEqual(p.battle.npcs,battle.npcs);assert.equal(p.battle.seed,battle.seed);assert.equal(p.battle.elapsedSeconds,battle.elapsedSeconds);p=saved(p);assert.equal(p.campaign.completed,false,'victory waits for campaign settlement');p=tactical(p,{type:'explore'});
  for(const actor of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious).sort((a,b)=>a.hp-b.hp)){const u=p.battle.units.find(u=>u.id===actor.id);if(firstAidPlan(u,u).valid)p=tactical(p,{type:'heal',unitId:u.id});}
  p=saved(p);const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};s=saved({campaign:order(p.campaign,report)}).campaign;assert.equal(s.defeated,false);assert.ok(dispatchCampaign(s,report).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.ok(isSupplied(s,sector));assert.equal(s.operativeState[57].alive,true);assert.equal(s.completed,sector==='humahuaca');
  notes.push({stage:sector,hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,squad:[...s.squad],actions,turns:battle.turn,deaths:deaths(s),commanderHp:s.operativeState[57].hp,completed:s.completed});onCheckpoint?.(sector,s,notes);
  if(!s.completed){const recovery=stabilizeBeforeMarch(s);s=recovery.campaign;if(recovery.care.hours){notes.push({stage:`${sector}-stabilization`,hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury,care:recovery.care,squad:[...s.squad]});onCheckpoint?.(`${sector}-stabilization`,s,notes);}s=order(s,{type:'fortify',sector});}
 }
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);assert.equal(s.blockade,false);assert.equal(s.phase,4);assert.equal(Object.keys(s.sectors).length,13);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));assert.equal(s.operativeState[57].hp,59);assert.ok(s.recruited.includes(57));assert.equal(s.contracts[57].expiresAt,null);assert.equal(s.resources.treasury,8168);for(const id of [1000,103,123,137])assert.equal(s.operativeState[id].alive,false);
 return {campaign:s,notes,prefix:prefix.notes};
}
