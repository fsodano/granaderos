import {CAMPAIGN_SECTORS} from './data.js';

export const TREASURY_CAP=1000000000;
const headroom=s=>Math.max(0,TREASURY_CAP-s.resources.treasury);
export function treasuryIncomeReason(s,amount){return amount>headroom(s)?`La tesorería no tiene espacio para recibir ${amount} pesos. Gastá fondos y volvé a intentarlo.`:null;}

// A verified victory must finish even at the save limit. Preserve only its
// unpaid balance; ordinary rewards still pay immediately without a new ledger.
export function awardVictoryFunds(s,request,snapshot){
 const amount=250,creditedAmount=0;
 const entries=s.pendingVictoryRewards??=[];
 if(entries.some(e=>e.battleId===request.id))throw Error('Los fondos pendientes de victoria están duplicados.');
 entries.push({battleId:request.id,sector:request.sector,earnedAt:s.hour,earnedSecond:s.secondOfHour??0,amount,creditedAmount});
 // Keep the immutable accepted-victory witness at its physical source. Later
 // visits and occupations retain this small receipt until the debt is paid.
 (snapshot.pendingVictoryFunds??=[]).push({battleId:request.id,earnedAt:s.hour,earnedSecond:s.secondOfHour??0,amount});
}

// Called once after an admitted campaign command, after service refunds.
// Loading a save and rejecting a command never collect an unpaid reward.
export function creditPendingVictoryFunds(s){
 const credits=[];
 for(const entry of s.pendingVictoryRewards??[]){
  const amount=Math.min(headroom(s),entry.amount-entry.creditedAmount);if(!amount)break;
  s.resources.treasury+=amount;entry.creditedAmount+=amount;
  credits.push({battleId:entry.battleId,amount,pending:entry.amount-entry.creditedAmount});
  if(entry.creditedAmount===entry.amount){const source=s.sectorStates[entry.sector];source.pendingVictoryFunds=source.pendingVictoryFunds.filter(e=>e.battleId!==entry.battleId);if(!source.pendingVictoryFunds.length)delete source.pendingVictoryFunds;}
 }
 if(s.pendingVictoryRewards){s.pendingVictoryRewards=s.pendingVictoryRewards.filter(e=>e.creditedAmount<e.amount);if(!s.pendingVictoryRewards.length)delete s.pendingVictoryRewards;}
 return credits;
}

export function validatePendingVictoryFunds(s){
 const entries=s.pendingVictoryRewards;
 const need=ok=>{if(!ok)throw Error('Los fondos pendientes de victoria guardados son inválidos.');};
 const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 need(entries===undefined||Array.isArray(entries)&&entries.length>0&&entries.length<=1000000);
 const witnesses=new Map();
 for(const [sector,scene]of Object.entries(s.sectorStates??{})){
  if(scene.pendingVictoryFunds===undefined)continue;
  need(Array.isArray(scene.pendingVictoryFunds)&&scene.pendingVictoryFunds.length>0&&scene.pendingVictoryFunds.length<=1000000);
  for(const witness of scene.pendingVictoryFunds){
   const keys=['battleId','earnedAt','earnedSecond','amount'];
   need(witness&&typeof witness==='object'&&!Array.isArray(witness)&&Object.keys(witness).length===keys.length&&keys.every(k=>Object.hasOwn(witness,k))&&!witnesses.has(witness.battleId));
   witnesses.set(witness.battleId,{sector,witness});
  }
 }
 const seen=new Set(),now=s.hour*3600+(s.secondOfHour??0);let prior=0;
 for(const e of entries??[]){
  const keys=['battleId','sector','earnedAt','earnedSecond','amount','creditedAmount'];
  need(e&&typeof e==='object'&&!Array.isArray(e)&&Object.keys(e).length===keys.length&&keys.every(k=>Object.hasOwn(e,k)));
  need(CAMPAIGN_SECTORS.some(d=>d.id===e.sector)||e.sector==='san_lorenzo');
  need(typeof e.battleId==='string'&&e.battleId.length<100&&!seen.has(e.battleId));seen.add(e.battleId);
  const prefix=`${e.sector}-`;need(e.battleId.startsWith(prefix));
  const match=e.battleId.slice(prefix.length).match(/^(0|[1-9]\d*)-(0|[1-9]\d*)$/);
  need(match&&integer(Number(match[1]),0,s.hour)&&integer(Number(match[2]),0,4294967295));
  need(integer(e.earnedAt,Number(match[1]),s.hour)&&integer(e.earnedSecond,0,3599)&&e.amount===250&&integer(e.creditedAmount,0,249));
  const earned=e.earnedAt*3600+e.earnedSecond;need(earned<=now&&earned>=prior);prior=earned;
  const source=witnesses.get(e.battleId);need(source&&source.sector===e.sector&&['earnedAt','earnedSecond','amount'].every(k=>source.witness[k]===e[k]));witnesses.delete(e.battleId);
 }
 need(witnesses.size===0);
}
