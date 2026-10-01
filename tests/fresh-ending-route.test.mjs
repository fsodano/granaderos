import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';import {incomeSummary} from '../game/economy.js';
import {saved,visit,leave} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {freshHistoricalEnding,stabilizeBeforeMarch} from './fresh-ending-fixture.mjs';

test('a fresh stock campaign wins all localities with actual combat and continues after saved victory and service expiry',t=>{
 const {campaign:won,notes}=freshHistoricalEnding({onCheckpoint:(stage,campaign)=>t.diagnostic(JSON.stringify({routeCheckpoint:stage,hour:campaign.hour,treasury:campaign.resources.treasury}))});
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
 const dead=Object.entries(won.operativeState).filter(([,r])=>!r.alive).map(([id])=>id),money=ready.resources.treasury,end=ready.hour+48,payments=[];
 let s=ready;
 while(s.hour<end){
  const hours=Math.min(end-s.hour,24-s.hour%24),at=s.hour+hours,payment=at%24===0;
  // The income quote accounts for damage ending at the payment hour. Each
  // real payment then improves loyalty before the next day's quote.
  const daily=payment?incomeSummary({...s,hour:at}).daily:0,before=s.resources.treasury;
  s=saved({campaign:advanceCampaignHours(s,hours)}).campaign;
  assert.equal(s.resources.treasury,before+daily);
  if(payment)payments.push({hour:at,daily});
 }
 assert.equal(payments.length,2);assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.hour,end);assert.equal(s.resources.treasury,money+payments.reduce((sum,p)=>sum+p.daily,0));
 const receipts=s.log.filter(e=>e.hour>ready.hour&&/^Las estancias y aduanas aportaron \d+ pesos a la tesorería\.$/.test(e.text)).reverse().map(e=>({hour:e.hour,daily:Number(e.text.match(/aportaron (\d+) pesos/)[1])}));
 assert.deepEqual(receipts,payments,'exactly two real payments must match their independent income quotes');
 for(const id of expiring){assert.equal(s.operativeState[id].alive,true);assert.ok(!s.recruited.includes(id));assert.ok(!s.squad.includes(id));assert.equal(s.contracts[id],undefined);}
 assert.equal(s.blockade,false);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));
 for(const id of dead){assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].alive,false);}
 const p=visit(s);
 for(const id of expiring){assert.equal(p.battle.units.some(u=>u.id===String(id)),false,'an expired hired actor is absent from the retained sector');assert.equal(p.battle.npcs.some(n=>n.operativeId===id),false);}
 s=saved({campaign:leave(p)}).campaign;
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);
 assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);assert.equal(s.log.filter(e=>e.text.includes('¡Campaña concluida!')).length,1);
 t.diagnostic(JSON.stringify({militaryWoundRoute:{victory:{hour:won.hour,second:won.secondOfHour,treasury:won.resources.treasury,squad:won.squad,commanderHp:won.operativeState[57].hp,dead:dead.map(Number)},battles:battles.map(n=>({sector:n.sector??n.stage,turns:n.turns,actions:n.actions})),postVictoryCare:recovery.care,continuation:{hour:s.hour,second:s.secondOfHour,treasury:s.resources.treasury,squad:s.squad,commanderHp:s.operativeState[57].hp,expired:expiring,payments}}}));
});
