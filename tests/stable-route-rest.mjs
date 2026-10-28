import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {careRules} from '../packages/game/campaign-care-rules.js';
import {careAssignmentReason} from '../packages/game/medical-care.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {worldOwner} from '../packages/game/world-cells.js';
import {dailyTownIncome} from '../packages/game/town-income.js';
import {decodeSave,encodeSave} from '../packages/game/save.js';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const custody=r=>r?.captured||r?.captive||r?.surrendered||r?.detention&&!r.detention.freed;
const serving=s=>s.recruited.filter(id=>s.operativeState[id]?.alive&&!custody(s.operativeState[id]));
const stable=r=>r?.alive&&r.hp>=15&&!r.bleeding&&!custody(r);

// Route policy only. Passive healing is performed by ordinary campaign rest,
// never by assigning HP, kits, money, flags or time. Acute wounds need finite
// clinical care first. A real encounter is returned to its normal controller.
export function restStableRoutePatients(start,{patients,sector=start.location,report=()=>{},resolveEncounter}={}){
 const ids=patients===undefined?start.recruited.filter(id=>{
  const r=start.operativeState[id];return r?.alive&&operativeLocation(start,id)===sector&&r.hp<r.maxHp;
 }):[...patients];
 assert.equal(new Set(ids).size,ids.length,'Stable rest patients must have distinct identities.');
 assert.equal(worldOwner(start,sector),'patriot','Stable rest needs an unoccupied safe patriot sector.');
 const kept=serving(start),oldDeaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>id);
 const patientProblem=(s,id)=>{
  const r=s.operativeState[id],expiry=contractExpiresSeconds(s.contracts[id]);
  return !s.recruited.includes(id)||!r?.alive||!s.contracts[id]||expiry!==null&&expiry<=clock(s)?'unserving patient':
   custody(r)?'captive patient':!stable(r)?'acute or bleeding patient':operativeLocation(s,id)!==sector||operativeInTransit(s,id)?'patient is not resting in this sector':null;
 };
 for(const id of ids)assert.equal(patientProblem(start,id),null,`Stable rest refuses ${id}: ${patientProblem(start,id)}.`);
 for(const id of kept){
  const r=start.operativeState[id],expiry=contractExpiresSeconds(start.contracts[id]);
  assert.ok(stable(r),`Stable rest refuses acute or bleeding serving survivor ${id}.`);
  assert.ok(start.contracts[id]&&(expiry===null||expiry>clock(start)),`Serving survivor ${id} needs an active paid term.`);
 }
 assert.equal(start.pendingBattle,null,'Return the actual tactical report before stable route rest.');
 let campaign=decodeSave(encodeSave(start)).campaign;
 const local=kept.filter(id=>operativeLocation(campaign,id)===sector),roster=rosterFor(campaign);
 for(const id of local)assert.equal(careAssignmentReason(campaign,roster.find(op=>op.id===id),'rest'),'',`Stable rest assignment is unavailable for ${id}.`);
 const boundHours=Math.max(0,...ids.map(id=>Math.ceil(campaign.operativeState[id].maxHp-campaign.operativeState[id].hp)))*careRules(campaign).restHealingHours;
 const actions=[],renewals=[],income=[],ticks=[],encounters=[];let hours=0,stoppedReason=null,zeroTimeNotices=0;
 const startSeconds=clock(campaign),cashBefore=campaign.resources.treasury;
 const originalKits=Object.fromEntries(kept.map(id=>[id,campaign.operativeState[id].medkits]));
 const check=()=>{
  // A paid arrival can join during these real hours. Its actual received term
  // and supplies join the same retention ledger; no arrival is synthesized.
  for(const id of serving(campaign))if(!kept.includes(id)){kept.push(id);originalKits[id]=campaign.operativeState[id].medkits;}
  for(const id of oldDeaths)if(campaign.operativeState[id]?.alive)return `An earlier death ${id} was rewritten.`;
  for(const id of ids){const problem=patientProblem(campaign,id);if(problem)return `Stable rest stopped for ${id}: ${problem}.`;}
  if(worldOwner(campaign,sector)!=='patriot')return 'Stable rest stopped: this sector is no longer safe.';
  for(const id of kept){
   const r=campaign.operativeState[id],expiry=contractExpiresSeconds(campaign.contracts[id]);
   if(!stable(r)||!campaign.recruited.includes(id)||!campaign.contracts[id]||expiry!==null&&expiry<=clock(campaign))return `Serving survivor ${id} is no longer available.`;
   if(r.medkits!==originalKits[id])return `Stable rest stopped: medical supplies changed for ${id}.`;
  }
  return null;
 };
 const apply=action=>{
  const next=dispatchCampaign(campaign,action);
  if(next.lastError){stoppedReason=next.lastError;return false;}
  campaign=next;actions.push(action);report({event:'stableRouteRestOrder',action,hour:campaign.hour,second:campaign.secondOfHour??0,treasury:campaign.resources.treasury});return true;
 };
 const encounter=()=>{
  if(!campaign.pendingEncounter)return true;
  if(!resolveEncounter){stoppedReason=`The actual encounter at ${campaign.pendingEncounter.sector} interrupts stable rest.`;return false;}
  const before=campaign,at=clock(before),next=resolveEncounter(before,{sector,patients:[...ids],report});
  campaign=decodeSave(encodeSave(next?.campaign??next)).campaign;
  assert.ok(clock(campaign)>=at,'An encounter controller cannot rewind the campaign clock.');
  encounters.push({before:[before.hour,before.secondOfHour??0],after:[campaign.hour,campaign.secondOfHour??0],sector:before.pendingEncounter.sector});
  stoppedReason=campaign.pendingBattle||campaign.pendingEncounter?'The actual encounter is not settled.':check();
  return !stoppedReason;
 };
 const retain=()=>{
  for(const id of kept){
   let current=campaign.contracts[id],expiry=contractExpiresSeconds(current);
   while(expiry!==null&&expiry<=clock(campaign)+3601){
    const quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day');
    if(!quote.available||campaign.resources.treasury<quote.price){stoppedReason=`The actual renewal for ${id} is unavailable: ${quote.reason??'insufficient treasury'}.`;return false;}
    const before=campaign.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:current.expiresAt,expectedExpiresSecond:current.expiresSecond??0};
    if(!apply(action))return false;
    const contract=campaign.contracts[id];assert.equal(campaign.resources.treasury,before-quote.price);
    assert.equal(contract.expiresAt,quote.expiresAt);assert.equal(contract.expiresSecond??0,quote.expiresSecond??0);
    const row={id,quote,cost:quote.price,contract:structuredClone(contract),hour:campaign.hour,second:campaign.secondOfHour??0};renewals.push(row);report({event:'stableRouteRestRenewal',...row});
    current=contract;const extended=contractExpiresSeconds(current);assert.ok(extended===null||extended>expiry,'An accepted renewal must extend the actual retained term.');expiry=extended;
   }
  }
  return true;
 };
 if(ids.length&&encounter())for(const operativeId of local)if(!apply({type:'assignCare',operativeId,assignment:'rest'}))break;
 while(!stoppedReason&&ids.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)){
  stoppedReason=check();if(stoppedReason||!encounter())break;
  if(hours>=boundHours){stoppedReason='Stable rest reached its authored passive-healing bound.';break;}
  if(!retain())break;
  const before=campaign,at=clock(before),cash=before.resources.treasury,day=before.townIncome?.lastPaidDay;
  if(!apply({type:'wait',hours:1}))break;
  const elapsed=clock(campaign)-at;assert.ok(elapsed>=0&&elapsed<=3600,'An ordinary rest order cannot advance more than its requested hour.');hours+=elapsed/3600;
  const hp=ids.map(id=>({id,before:before.operativeState[id].hp,after:campaign.operativeState[id].hp}));
  const tick={hour:campaign.hour,second:campaign.secondOfHour??0,elapsedSeconds:elapsed,hp,treasuryChange:campaign.resources.treasury-cash};ticks.push(tick);report({event:'stableRouteRestTick',...tick});
  zeroTimeNotices=elapsed===0?zeroTimeNotices+1:0;
  if(zeroTimeNotices>=3)stoppedReason='Stable rest stopped after three consecutive zero-time notices.';
  if(campaign.townIncome?.lastPaidDay>day){
   const row={day:campaign.townIncome.lastPaidDay,hour:campaign.townIncome.lastPaidDay*24,amount:dailyTownIncome(before),observedTreasuryChange:tick.treasuryChange};income.push(row);report({event:'stableRouteRestIncome',...row});
  }
  stoppedReason=stoppedReason||check();if(!stoppedReason&&!encounter())break;
 }
 const completed=!stoppedReason&&ids.every(id=>campaign.operativeState[id].hp===campaign.operativeState[id].maxHp);
 // A stopped strategic encounter also has an official save. An unresolved
 // tactical callback must return its real battle separately to the caller.
 if(!campaign.pendingBattle)campaign=decodeSave(encodeSave(campaign)).campaign;
 const receipt={sector,patients:ids.map(id=>({id,before:start.operativeState[id].hp,after:campaign.operativeState[id].hp,maxHp:campaign.operativeState[id].maxHp})),hours,boundHours,elapsedSeconds:clock(campaign)-startSeconds,start:[start.hour,start.secondOfHour??0],finish:[campaign.hour,campaign.secondOfHour??0],cashBefore,cashAfter:campaign.resources.treasury,renewalCost:renewals.reduce((sum,row)=>sum+row.cost,0),income,passiveHpGained:ticks.reduce((sum,tick)=>sum+tick.hp.reduce((total,row)=>total+row.after-row.before,0),0),dressingsUsed:kept.reduce((sum,id)=>sum+originalKits[id]-campaign.operativeState[id].medkits,0),encounters,completed,stoppedReason};
 report({event:'stableRouteRestFinished',...receipt});
 return {campaign,completed,stoppedReason,patients:ids,hours,boundHours,renewals,actions,ticks,receipt};
}
