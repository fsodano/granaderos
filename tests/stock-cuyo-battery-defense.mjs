import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {cautiousCombatOrder} from './cautious-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {relieveStockNorthernPatient} from './fresh-northern-command.mjs';

// An actual local Córdoba reserve resolves a raid while the gun crew is away.
// Every battle and care order retains the native outcome, time and supplies.
export function resolveStockCuyoBatteryEncounter(start,{report=()=>{}}={}){
 const before=structuredClone(start),active=start.activeSquadId,groupId=start.pendingEncounter?.groupId??start.pendingBattle?.defenseGroupId;
 let c=decodeSave(encodeSave(start)).campaign;
 const live=()=>c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),clock=()=>c.hour*3600+(c.secondOfHour??0);
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);};
 const retain=hours=>{
  for(const id of live()){
   let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock()),'Actual living defense participants must still be serving.');
   while(expiry!==null&&expiry<=clock()+hours*3600){
    const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),contract=c.contracts[id],cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+86400);expiry=contractExpiresSeconds(c.contracts[id]);
    report({event:'stockCuyoBatteryDefenseRenewal',id,price:quote.price,hour:c.hour,second:c.secondOfHour??0});
   }
  }
 };
 if(c.pendingEncounter){assert.equal(c.pendingEncounter.sector,'cordoba');order({type:'respondToEncounter',groupId,choice:'tactical'});}
 assert.equal(c.pendingBattle?.sector,'cordoba');assert.equal(c.pendingBattle.defenseGroupId,groupId);
 const result=fightNorthernSector(c,'cordoba',{controller:cautiousCombatOrder,report});c=result.campaign;
 assert.equal(c.sectors.cordoba.owner,'patriot');assert.equal(c.defeated,false);
 report({event:'stockCuyoBatteryDefenseSettled',groupId,campaign:structuredClone(c)});
 const survivors=live().length,startSeconds=clock();
 const acute=()=>live().filter(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
 for(let batch=0;acute().length;batch++){
  assert.ok(batch<live().length,'Actual finite defense care must resolve each patient.');
  const patientId=acute().sort((a,b)=>c.operativeState[a].hp-c.operativeState[b].hp)[0],sector=operativeLocation(c,patientId),patient=c.operativeState[patientId];
  const doctor=rosterFor(c).filter(op=>live().includes(op.id)&&op.id!==patientId&&operativeLocation(c,op.id)===sector&&!operativeInTransit(c,op.id)&&c.operativeState[op.id].hp>=15&&!c.operativeState[op.id].bleeding&&!c.operativeState[op.id].asleep&&c.operativeState[op.id].energy>10&&c.operativeState[op.id].medkits>=(patient.bleeding>0?2:1)&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0];
  assert.ok(doctor,'The actual local patient needs a living supplied doctor.');
  if(patient.bleeding>0){
   retain(2);const stock=c.operativeState[doctor.id].medkits,hp=patient.hp;
   order({type:'assignCare',operativeId:doctor.id,assignment:'doctor'});order({type:'assignCare',operativeId:patientId,assignment:'patient'});order({type:'wait',hours:1});
   assert.equal(c.pendingEncounter,null);assert.equal(c.operativeState[patientId].alive,true);assert.equal(c.operativeState[patientId].bleeding,0);assert.equal(c.operativeState[doctor.id].medkits,stock-1);
   report({event:'stockCuyoBatteryDefenseHourlyCare',doctor:doctor.id,patientId,hpBefore:hp,hpAfter:c.operativeState[patientId].hp,dressingsUsed:1,hour:c.hour,second:c.secondOfHour??0});
  }
  if(c.operativeState[patientId].hp<15)c=relieveStockNorthernPatient(c,{patientId,doctorId:doctor.id,report}).campaign;
  for(const id of [doctor.id,patientId])order({type:'assignCare',operativeId:id,assignment:'rest'});
 }
 order({type:'selectSquad',id:active});
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.equal(live().length,survivors,'Finite care cannot remove or replace an actual surviving defender.');
 assert.ok(c.encounterHistory.some(entry=>entry.groupId===groupId&&entry.outcome==='victory'));assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(start,before);
 c=decodeSave(encodeSave(c)).campaign;assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({event:'stockCuyoBatteryDefenseComplete',groupId,turns:result.summary.turns,actions:result.summary.actions,battleSeconds:result.summary.elapsedSeconds,careSeconds:clock()-startSeconds,losses:before.recruited.filter(id=>before.operativeState[id].alive&&!c.operativeState[id].alive),hour:c.hour,second:c.secondOfHour??0,campaign:structuredClone(c)});
 return c;
}
