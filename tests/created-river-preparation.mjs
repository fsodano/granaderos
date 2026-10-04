import {prepareRouteBattery} from './route-battery.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {routeHiringCeiling} from './funded-route-fixture.mjs';

// Reunite the real rear guard with the navy, then pay for available surviving
// local support. Every gun, rifle, dressing, arrival and renewal uses ordinary
// campaign actions before the coordinated river assault.
export function prepareCreatedRiverAssault(start,{report=()=>{}}={}){
 const living=start.recruited.filter(id=>{const u=start.operativeState[id];return u.alive&&!u.captured;});
 let c=recoverFreshPort(start,{hospital:'cordoba',fieldIds:living});
 const field=c.recruited.filter(id=>{const u=c.operativeState[id];return u.alive&&!u.captured&&u.location==='cordoba';});
 assert.ok(field.includes(57));assert.ok(field.length<=8);
 const events=[],order=action=>{
  if(action.type==='wait')for(const id of field){
   while(c.contracts[id]?.expiresAt!=null&&c.contracts[id].expiresAt<=c.hour+action.hours){
    order({type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});
   }
  }
  const money=c.resources.treasury,next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+' '+next.lastError);c=next;
  events.push({action,hour:c.hour,cost:money-c.resources.treasury});
 };
 const candidates=rosterFor(c).filter(op=>{
  const u=c.operativeState[op.id],q=contractQuote(c,op,'day');
  return op.id>=100&&op.id<1000&&!c.recruited.includes(op.id)&&u.alive&&!u.captured&&u.hp===u.maxHp&&!u.bleeding&&q.available&&q.price<=routeHiringCeiling(c,100);
 }).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price||a.id-b.id).slice(0,8-field.length);
 const fees=candidates.reduce((sum,op)=>sum+contractQuote(c,op,'week').price,0);assert.ok(c.resources.treasury>=fees+3000,'actual river support and finite supplies must fit the banked treasury');
 for(const op of candidates){
  const q=contractQuote(c,op,'week'),money=c.resources.treasury;order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});assert.equal(c.resources.treasury,money-q.price);field.push(op.id);
 }
 assert.equal(field.length,8,'the two batteries require actual arriving support and a reserve doctor');
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 assert.ok(field.every(id=>c.recruited.includes(id)&&c.operativeState[id].location==='cordoba'));
 const groups=[];
 for(let offset=0;offset<field.length;offset+=6){
  order({type:'createSquad',ids:field.slice(offset,offset+6),sector:'cordoba',name:'Columna del río'});groups.push(c.activeSquadId);
 }
 for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<600&&field.some(id=>c.operativeState[id].morale<65);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(field.every(id=>c.operativeState[id].morale>=65),'actual paid rest must restore the complete assembled column');
 for(const id of field){
  const op=rosterFor(c).find(op=>op.id===id);
  if(c.operativeState[id].weaponDropped||![1800,1801,1802].includes(op.weapon)){
   c=recoverRoutePrimary(c,id,{preferredWeapon:1801,replace:true,report});
  }
  order({type:'assignCare',operativeId:id,assignment:'active'});
 }
 c=supplyRouteAmmunition(c,field,{target:20}).campaign;order({type:'configureArtillery',types:[]});
 for(const group of groups){order({type:'selectSquad',id:group});c=finishReloadsBeforeMarch(c);}
 const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&op.medical>=30).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2);
 const medicalReserves=Object.fromEntries(doctors.map(op=>[op.id,10]));
 for(const op of doctors)if(c.operativeState[op.id].medkits<10)c=supplyRouteDressings(c,op.id,10,{reserves:medicalReserves,report});
 assert.ok(doctors.every(op=>c.operativeState[op.id].medkits>=10));
 order({type:'selectSquad',id:groups[0]});const battery=prepareRouteBattery(c,['bronze4','bronze4','swivel'],{destination:'cordoba',report});c=battery.campaign;
 for(const id of field)order({type:'assignCare',operativeId:id,assignment:'rest'});
 for(let h=0;h<48&&field.some(id=>{const u=c.operativeState[id];return u.energy<100||u.fatigue||u.asleep;});h++)order({type:'wait',hours:1});
 for(const id of field){const u=c.operativeState[id];assert.ok(u.hp===u.maxHp&&!u.bleeding&&u.energy===100&&!u.fatigue&&!u.asleep);order({type:'assignCare',operativeId:id,assignment:'active'});}
 order({type:'configureArtillery',types:battery.selections});
 c=prepareFinalAssault(c,{staging:'cordoba',target:'santa_fe',fieldIds:field,daylight:true});
 assert.equal(c.pendingBattle.squad.length,8);assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,3);
 for(const[id,u]of Object.entries(start.operativeState))if(!u.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdRiverAssaultReady',hour:c.hour,treasury:c.resources.treasury,field,doctors:doctors.map(op=>op.id),fees,events});
 return c;
}
