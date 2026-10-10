import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {operativeLocation} from '../game/squads.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {supplyRouteDressings} from './route-dressings.mjs';
import {saved} from './local-contract-fixture.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const medicalRows=(c,sector,id)=>sectorInventoryModel(c,sector,rosterFor(c),id).entries.filter(row=>JSON.parse(row.expected).item==='medkits');

// An existing local courier carries only discovered, reachable dressings.
// Both journeys and every required extension use the normal campaign clock.
export function supplyKnownRouteDressings(start,operativeId,target,{report=()=>{}}={}){
 let c=start;const clinic=operativeLocation(c,operativeId);
 const localStock=()=>medicalRows(c,clinic,operativeId).filter(row=>row.reachable).reduce((sum,row)=>sum+row.count,0)+c.recruited.filter(id=>id!==operativeId&&c.operativeState[id].alive&&!c.operativeState[id].captured&&operativeLocation(c,id)===clinic&&!sectorInventoryModel(c,clinic,rosterFor(c),id).reason).reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);
 if((c.operativeState[operativeId].medkits??0)+localStock()>=target)return supplyRouteDressings(c,operativeId,target,{report});
 if(localStock())c=supplyRouteDressings(c,operativeId,Math.min(target,c.operativeState[operativeId].medkits+localStock()),{report});
 const quantity=target-(c.operativeState[operativeId].medkits??0),mode=c.routes.posta?'posta':'march';
 const plan=c.squads.filter(q=>q.location!==clinic&&q.members.length===1&&!q.journey&&c.sectors[q.location]?.owner==='patriot').map(q=>{
  const id=q.members[0],r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);
  if(!c.recruited.includes(id)||!r?.alive||r.captured||r.hp<15||r.bleeding||r.asleep||r.energy<80||r.fatigue>20||r.assignment!=='active'||expiry!==null&&expiry<=clock(c))return null;
  const model=sectorInventoryModel(c,q.location,rosterFor(c),id),available=medicalRows(c,q.location,id).filter(row=>row.reachable).reduce((sum,row)=>sum+row.count,0);
  if(model.reason||available<quantity)return null;
  try{applyItemQuantity(model.personal,{item:'medkits',count:quantity,weight:.2});}catch{return null;}
  const outward=previewStrategicRoute(c,q.id,clinic,mode);
  const returning=c.squads.filter(local=>local.location===clinic&&!local.journey).map(local=>previewStrategicRoute(c,local.id,q.location,mode)).find(quote=>quote.valid);
  return outward.valid&&returning?{id,source:q.location,squadId:q.id,outward,returning,available}:null;
 }).filter(Boolean).sort((a,b)=>a.outward.hours+a.returning.hours-b.outward.hours-b.returning.hours||b.available-a.available||a.id-b.id)[0];
 // Retain the existing local discovery/failure when no known courier is admitted.
 if(!plan)return supplyRouteDressings(c,operativeId,target,{report});
 const originalSelection=c.activeSquadId,originalGroups=c.squads.map(q=>({id:q.id,members:[...q.members],location:q.location})),serving=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),deaths=Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),departure=clock(c);
 const safe=()=>{
  assert.equal(c.pendingBattle,null,'finish the real battle before the known medical courier');
  assert.equal(c.pendingEncounter,null,'resolve the real courier contact before continuing');
  for(const id of serving){assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive&&!c.operativeState[id].captured,'the actual serving cohort must remain available');const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>clock(c),'retain every actual paid term during the courier journey');}
  for(const id of deaths)assert.equal(c.operativeState[id].alive,false);
 };
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+c.lastError);safe();};
 const travel=sector=>{
  const quote=previewStrategicRoute(c,c.activeSquadId,sector,mode);assert.equal(quote.valid,true,quote.reason);
  report({event:'knownMedicalCourierRoute',id:plan.id,quote,hour:c.hour,secondOfHour:c.secondOfHour??0});order(quote.action);
  for(let h=0;h<720&&c.squads.find(q=>q.id===plan.squadId).journey;h++){
   assert.equal(c.squads.find(q=>q.id===plan.squadId).journey.status,'moving','resolve the real medical courier interruption');order({type:'wait',hours:1});
  }
  assert.equal(c.squads.find(q=>q.id===plan.squadId).journey,undefined);assert.equal(operativeLocation(c,plan.id),sector);
 };
 try{
  safe();const horizon=clock(c)+(plan.outward.hours+plan.returning.hours+1)*3600;
  for(const id of serving)while(contractExpiresSeconds(c.contracts[id])!==null&&contractExpiresSeconds(c.contracts[id])<=horizon){
   const contract=c.contracts[id],quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
   assert.ok(quote.available&&cash>=quote.price,quote.reason??'the actual courier extensions must remain affordable');
   order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);report({event:'knownMedicalCourierRenewal',id,price:quote.price});
  }
  order({type:'selectSquad',id:plan.squadId});const carrierBefore=c.operativeState[plan.id].medkits??0;
  while(c.operativeState[plan.id].medkits-carrierBefore<quantity){
   const row=medicalRows(c,plan.source,plan.id).find(row=>row.reachable),count=Math.min(row?.count??0,quantity-(c.operativeState[plan.id].medkits-carrierBefore));assert.ok(count,'the actual known source must retain its quoted finite dressings');
   const cash=c.resources.treasury,time=clock(c);order({type:'sectorInventory',sector:plan.source,operativeId:plan.id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.resources.treasury,cash);assert.equal(clock(c),time);report({event:'knownMedicalCourierSource',id:plan.id,sector:plan.source,count,sourceKey:row.key,expected:row.expected});
  }
  travel(clinic);const before=c.operativeState[operativeId].medkits,oldKeys=new Set(medicalRows(c,clinic,operativeId).map(row=>row.key));
  order({type:'sectorInventory',sector:clinic,operativeId:plan.id,direction:'drop',item:'medkits',count:quantity});
  const row=medicalRows(c,clinic,operativeId).find(row=>!oldKeys.has(row.key)&&row.reachable&&row.count===quantity);assert.ok(row,'the actual recipient needs a reachable native dressing parcel');
  order({type:'sectorInventory',sector:clinic,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity});
  assert.equal(c.operativeState[operativeId].medkits,before+quantity);assert.equal(c.operativeState[plan.id].medkits,carrierBefore);
  travel(plan.source);if(c.activeSquadId!==originalSelection)order({type:'selectSquad',id:originalSelection});
  assert.deepEqual(c.squads.map(q=>({id:q.id,members:[...q.members],location:q.location})),originalGroups);assert.equal(c.operativeState[operativeId].medkits,target);
  report({event:'knownMedicalCourierComplete',id:plan.id,source:plan.source,clinic,quantity,elapsedSeconds:clock(c)-departure,hour:c.hour,secondOfHour:c.secondOfHour??0,campaign:structuredClone(c)});
  return saved({campaign:c}).campaign;
 }catch(error){report({event:'knownMedicalCourierStopped',id:plan.id,reason:error.message,campaign:structuredClone(c)});error.campaign=c;throw error;}
}
