import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';import {incomeSummary} from '../game/economy.js';
import {TOWN_INCOME_SOURCES} from '../game/town-income.js';
import {saved,visit,leave} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {freshHistoricalEnding,stabilizeBeforeMarch} from './fresh-ending-fixture.mjs';

function agreedPortQuote(state){
 const sources=TOWN_INCOME_SOURCES.filter(source=>state.townIncome.activations[source.id]&&source.requiredSectors.every(id=>state.sectors[id].owner==='patriot'))
  .map(source=>({id:source.id,amount:state.townIncome.dailyAmounts?.[source.id]??source.dailyAmount}));
 const daily=sources.reduce((sum,source)=>sum+source.amount,0);
 assert.equal(incomeSummary(state).daily,daily,'the public quote includes only flat payments from agreed, fully controlled ports');
 return {sources,daily};
}

test('an ordinary 3200-peso Retiro-only campaign wins all localities with actual combat and continues after saved victory and service expiry',t=>{
 const {campaign:won,notes,prefix}=freshHistoricalEnding({onCheckpoint:(stage,campaign)=>console.log(JSON.stringify({routeCheckpoint:stage,hour:campaign.hour,treasury:campaign.resources.treasury}))});
 const start=prefix.find(note=>note.stage==='stock-start'),arrivals=prefix.find(note=>note.stage==='paid-arrivals'),agreement=prefix.find(note=>note.stage==='physical-port-agreement'),firstPayment=prefix.find(note=>note.stage==='first-midnight-payment');
 assert.ok(start,'the whole ending must retain its actual stock starting receipt');
 assert.equal(start.treasury,3200);assert.deepEqual(start.controlledSectors,['retiro']);assert.deepEqual(start.recruited,[]);
 assert.ok(arrivals,'the ending must retain the five actual paid opening arrivals');
 assert.equal(arrivals.hour,6);assert.equal(arrivals.hires.length,5);assert.equal(new Set(arrivals.hires.map(hire=>hire.id)).size,5);
 for(const hire of arrivals.hires){assert.ok(hire.debited>0);assert.equal(hire.contract.kind,'paid');assert.equal(hire.contract.started,6);assert.equal(hire.contract.expiresAt,30);assert.equal(hire.contract.paid,hire.debited);}
 assert.equal(arrivals.treasury,start.treasury-arrivals.hires.reduce((sum,hire)=>sum+hire.debited,0),'the first arrival retains exactly the actual contract debits');
 assert.equal(won.contentCampaign.package.rules.startingTreasury,3200);
 assert.ok(agreement,'the starting force must physically agree to Buenos Aires port income');assert.equal(agreement.daily,8000);
 assert.ok(firstPayment,'the starting force must receive its first actual midnight payment');
 assert.equal(firstPayment.received,8000);assert.equal(firstPayment.treasury,firstPayment.treasuryBefore+8000);assert.equal(firstPayment.paidDay,Math.floor(firstPayment.hour/24));
 t.diagnostic(JSON.stringify({stockStartingRoute:{start,arrivals,agreement,firstPayment}}));
 const recoveryDefenses=prefix.filter(note=>note.stage==='recovery-defense');
 assert.ok(recoveryDefenses.length>0,'the seeded stock recovery must resolve its real arriving enemy group through combat');
 assert.equal(new Set(recoveryDefenses.map(note=>note.groupId)).size,recoveryDefenses.length,'each actual recovery raid is settled once');
 for(const note of recoveryDefenses){assert.equal(note.status,'victory');assert.ok(note.actions>0&&note.elapsedSeconds>0);assert.ok(won.encounterHistory.some(entry=>entry.groupId===note.groupId&&entry.outcome==='victory'));for(const id of note.deaths)assert.equal(won.operativeState[id].alive,false);}
 const rest=prefix.filter(note=>note.event==='tucumanRestRecovery');assert.ok(rest.length>0);
 const interruptedRest=prefix.filter(note=>note.event==='tucumanRecoveryInterrupted'&&note.rest);
 for(const note of rest){assert.ok(Number.isSafeInteger(note.restHours)&&note.restHours>=0&&note.restHours<=note.restBoundHours);assert.equal(note.finished.hour-note.started.hour,note.restHours);assert.equal(note.finished.second,note.started.second);if(!note.restHours)assert.deepEqual(note.patients,[],'a zero-hour recovery receipt cannot heal an actual wound');for(const patient of note.patients){assert.equal(patient.hp,patient.maxHp);assert.equal(patient.bleeding,0);}}
 for(const note of interruptedRest){const {started,restHours,restBoundHours}=note.rest,elapsed=note.hour*3600+note.second-started.hour*3600-started.second;assert.ok(Number.isSafeInteger(restHours)&&restHours>=0&&restHours<=restBoundHours);assert.ok(elapsed>=restHours*3600&&elapsed<=(restHours+1)*3600,'the actual raid interrupts the current native rest hour');assert.ok(recoveryDefenses.some(defense=>defense.groupId===note.groupId),'each interrupted clinic raid must earn its real victory');}
 assert.ok(rest.some(note=>note.restHours>0)||interruptedRest.some(note=>note.rest.restHours>0),'wound recovery must retain actual elapsed rest, including the period before a real raid');
 const battles=notes.filter(n=>n.actions>0);
 for(const sector of ['ensenada','santa_fe','tucuman','salta','jujuy','humahuaca','buenos_aires']){
  assert.ok(battles.some(n=>(n.sector??n.stage)===sector),`${sector} must have a real tactical victory`);
 }
 assert.ok(battles.every(n=>n.status==='victory'&&n.turns>0));
 assert.equal(won.completed,true);assert.equal(won.defeated,false);assert.equal(won.phase,4);
 assert.equal(Object.keys(won.sectors).length,13);assert.ok(Object.values(won.sectors).every(r=>r.owner==='patriot'));
 assert.equal(won.blockade,false);assert.equal(won.pendingBattle,null);assert.equal(won.pendingEncounter,null);
 assert.ok(!won.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status)));
 assert.equal(won.operativeState[57].alive,true);assert.ok(won.operativeState[57].hp>=15);
 assert.ok(won.recruited.includes(57));assert.equal(won.contracts[57].expiresAt,null);
 assert.equal(won.log.filter(e=>e.text.includes('¡Campaña concluida!')).length,1);
 const expiring=Object.entries(won.contracts).filter(([id,c])=>won.recruited.includes(Number(id))&&won.operativeState[id].alive&&c.expiresAt!==null&&c.expiresAt<=won.hour+48).map(([id])=>Number(id));
 assert.ok(expiring.length,'actual surviving paid hires must reach service expiry after victory');
 // Stabilize actual wounds before advancing the real post-victory clock.
 const recovery=stabilizeBeforeMarch(won),ready=recovery.campaign;
 for(const id of ready.squad){assert.equal(ready.operativeState[id].bleeding,0);assert.ok(ready.operativeState[id].hp>=15);}
 const agreements=structuredClone(ready.townIncome.activations),quote=agreedPortQuote(ready);
 assert.ok(agreements.buenos_aires,'the real Buenos Aires port meeting must remain recorded');
 assert.ok(quote.daily>0);assert.equal(ready.townIncome.lastPaidDay,Math.floor(ready.hour/24));
 const dead=Object.entries(won.operativeState).filter(([,r])=>!r.alive).map(([id])=>id),money=ready.resources.treasury,end=ready.hour+48,payments=[];
 let s=ready;
 while(s.hour<end){
  const hours=Math.min(end-s.hour,24-s.hour%24),at=s.hour+hours,payment=at%24===0;
  // Port amounts stay flat. Control and the actual saved representative
  // agreement determine the contribution at each crossed midnight.
  const current=agreedPortQuote(s),daily=payment?current.daily:0,before=s.resources.treasury,previousDay=s.townIncome.lastPaidDay;
  s=saved({campaign:advanceCampaignHours(s,hours)}).campaign;
  assert.equal(s.resources.treasury,before+daily);
  assert.deepEqual(s.townIncome.activations,agreements);
  assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));
  assert.deepEqual(agreedPortQuote(s),quote);
  assert.equal(s.townIncome.lastPaidDay,payment?Math.floor(at/24):previousDay,'the saved ledger acknowledges each actual midnight once');
  if(payment)payments.push({hour:at,daily,sources:current.sources,lastPaidDay:s.townIncome.lastPaidDay});
 }
 assert.equal(payments.length,2);assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.hour,end);assert.equal(s.resources.treasury,money+payments.reduce((sum,p)=>sum+p.daily,0));
 const receipts=s.log.filter(e=>e.hour>ready.hour&&e.hour<=end&&/^Los puertos acordados aportaron \d+ pesos a la tesorería\.$/.test(e.text)).reverse().map(e=>({hour:e.hour,daily:Number(e.text.match(/aportaron (\d+) pesos/)[1])}));
 assert.deepEqual(receipts,payments.map(({hour,daily})=>({hour,daily})),'exactly two actual port payments must match the independent quotes and saved ledger');
 for(const id of expiring){assert.equal(s.operativeState[id].alive,true);assert.ok(!s.recruited.includes(id));assert.ok(!s.squad.includes(id));assert.equal(s.contracts[id],undefined);}
 assert.equal(s.blockade,false);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));
 for(const id of dead){assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].alive,false);}
 const beforeReentry=structuredClone({treasury:s.resources.treasury,townIncome:s.townIncome}),p=visit(s);
 for(const id of expiring){assert.equal(p.battle.units.some(u=>u.id===String(id)),false,'an expired hired actor is absent from the retained sector');assert.equal(p.battle.npcs.some(n=>n.operativeId===id),false);}
 s=saved({campaign:leave(p)}).campaign;
 assert.deepEqual({treasury:s.resources.treasury,townIncome:s.townIncome},beforeReentry,'saved sector reentry cannot pay a past midnight again');
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);
 assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);assert.equal(s.log.filter(e=>e.text.includes('¡Campaña concluida!')).length,1);
 t.diagnostic(JSON.stringify({militaryWoundRoute:{victory:{hour:won.hour,second:won.secondOfHour,treasury:won.resources.treasury,squad:won.squad,commanderHp:won.operativeState[57].hp,dead:dead.map(Number)},battles:battles.map(n=>({sector:n.sector??n.stage,turns:n.turns,actions:n.actions})),postVictoryCare:recovery.care,continuation:{hour:s.hour,second:s.secondOfHour,treasury:s.resources.treasury,squad:s.squad,commanderHp:s.operativeState[57].hp,expired:expiring,payments}}}));
});
