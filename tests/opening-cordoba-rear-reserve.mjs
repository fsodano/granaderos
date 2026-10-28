import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {bookRouteHires} from './paid-route-hiring.mjs';
import {meetRecruits} from './campaign-recruitment-route.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';
import {relieveStockNorthernPatient} from './fresh-northern-command.mjs';

// The original opening's courier leaves Córdoba without a local reserve.
// Book actual short paid service after the Tucumán defense, before another
// travel tick. The northern army stays at its clinic; no body is moved from it.
export function prepareOpeningCordobaReserve(start,{report=()=>{}}={}){
 const before=structuredClone(start);let campaign=decodeSave(encodeSave(start)).campaign;
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
 assert.equal(campaign.sectors.cordoba.owner,'patriot');
 const local=campaign.recruited.filter(id=>{
  const r=campaign.operativeState[id];
  return r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)==='cordoba';
 });
 if(local.length)return {campaign,receipt:{event:'openingCordobaReserve',needed:false,ids:local,hires:[],actions:[]}};
 const selected=campaign.activeSquadId,actions=[],order=action=>{
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,JSON.stringify(action)+': '+campaign.lastError);actions.push(action);
 };
 // Remote booking still requires a stationary selected squad. Do not cancel
 // or reorganize the courier's already admitted journey to hire the reserve.
 const idle=campaign.squads.find(q=>q.members.length&&!q.journey);
 assert.ok(idle,'Select an actual stationary squad before remote recruitment.');
 order({type:'selectSquad',id:idle.id});
 const paid=[128,142,145,135,105,106,147,109],booked=bookRouteHires(campaign,paid,{term:'day',destination:'cordoba',report});campaign=booked.campaign;
 assert.ok(booked.hires.every(h=>h.arrival.travelHours===0),'The reserve needs its actual quoted immediate arrival before the next raid.');
 order({type:'createSquad',ids:[128,142,145,135],sector:'cordoba',name:'Socorro de Córdoba'});
 campaign=meetRecruits(campaign,['quiroga','paz'],128);
 assert.ok(campaign.recruited.includes(9)&&campaign.recruited.includes(11),'Both officers join through their actual local encounters.');
 order({type:'createSquad',ids:[9,11],sector:'cordoba',name:'Reserva de oficiales'});
 campaign=recoverRoutePrimary(campaign,9,{report});
 const ids=[...paid,9,11];
 campaign=supplyRouteAmmunition(campaign,ids,{target:12,report}).campaign;
 const cover=stageOpeningRearCover(campaign,{sector:'cordoba',exclude:[100],report});campaign=cover.campaign;
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 order({type:'selectSquad',id:selected});
 for(const [id,r]of Object.entries(before.operativeState)){
  assert.equal(campaign.operativeState[id].alive,r.alive);
  assert.equal(campaign.operativeState[id].captured,r.captured);
  if(!r.alive)assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);
 }
 const receipt={event:'openingCordobaReserve',needed:true,ids,hires:booked.hires,actions,cover:cover.receipt,treasuryBefore:start.resources.treasury,treasuryAfter:campaign.resources.treasury,startSeconds:start.hour*3600+(start.secondOfHour??0),endSeconds:campaign.hour*3600+(campaign.secondOfHour??0)};
 report(receipt);assert.deepEqual(start,before);
 campaign=decodeSave(encodeSave(campaign)).campaign;
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return {campaign,receipt};
}

// A native defender can escape into a neighbouring cell while the town wins.
// Send an actual supplied local doctor there before continuing the gun trip.
export function relieveOpeningCordobaReserve(start,ids,{report=()=>{}}={}){
 const before=structuredClone(start),receipts=[];let campaign=decodeSave(encodeSave(start)).campaign;
 const urgent=()=>ids.filter(id=>{
  const r=campaign.operativeState[id];
  return campaign.recruited.includes(id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)!=='cordoba'&&(r.bleeding>0||r.hp<15);
 });
 for(let visit=0;urgent().length;visit++){
  assert.ok(visit<ids.length,'Each actual escaped reserve patient receives finite relief.');
  const patientId=urgent()[0],doctor=rosterFor(campaign).filter(op=>{
   const r=campaign.operativeState[op.id];
   return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&!operativeInTransit(campaign,op.id)&&operativeLocation(campaign,op.id)==='cordoba'&&r.hp>=15&&!r.bleeding&&!r.asleep&&r.energy>10&&r.medkits>0&&op.medical>=20;
  }).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0];
  assert.ok(doctor,'A supplied actual Córdoba physician must reach the escaped wounded defender.');
  const relieved=relieveStockNorthernPatient(campaign,{patientId,doctorId:doctor.id,report});campaign=relieved.campaign;receipts.push(relieved.receipt);
 }
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 return {campaign,receipts};
}
