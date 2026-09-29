import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';import {incomeSummary} from '../game/economy.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';import {freshHistoricalEnding} from './fresh-ending-fixture.mjs';

test('a fresh stock campaign wins all localities with actual combat and continues after saved victory and service expiry',t=>{
 const {campaign:won,notes}=freshHistoricalEnding();assert.equal(notes.find(n=>n.stage==='cuyo-relief').commanderRestock,46);assert.deepEqual(notes.filter(n=>n.actions).map(n=>n.stage),['santa_fe','ensenada','jujuy','humahuaca']);assert.equal(won.hour,558);assert.equal(won.operativeState[57].hp,59);assert.ok(won.log.some(e=>e.text.includes('¡Campaña concluida!')));
 assert.deepEqual(notes.find(n=>n.stage==='coastal-care').care,{hours:14,dressingsBought:13,cost:130});assert.equal(won.sectors.buenos_aires.fort,2);
 assert.deepEqual(notes.filter(n=>n.stage.endsWith('-stabilization')).map(n=>({stage:n.stage,...n.care})),[]);
 const expiring=Object.entries(won.contracts).filter(([id,c])=>won.operativeState[id].alive&&c.expiresAt!==null&&c.expiresAt<=won.hour+48).map(([id])=>Number(id));assert.deepEqual(expiring,[112,113,142]);
 const dead=Object.entries(won.operativeState).filter(([,r])=>!r.alive).map(([id])=>id),money=won.resources.treasury,daily=incomeSummary(won).daily;let s=saved({campaign:order(won,{type:'wait',hours:48})}).campaign;
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.hour,606);assert.equal(s.resources.treasury,money+2*daily);for(const id of expiring){assert.equal(s.operativeState[id].alive,true);assert.ok(!s.recruited.includes(id));assert.ok(!s.squad.includes(id));assert.equal(s.contracts[id],undefined);}assert.equal(s.blockade,false);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));
 for(const id of dead){assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].alive,false);}
 let p=visit(s);for(const id of expiring){assert.equal(p.battle.units.some(u=>u.id===String(id)),false,'an expired hired actor is nowhere in the retained sector');assert.equal(p.battle.npcs.some(n=>n.operativeId===id),false);}s=saved({campaign:leave(p)}).campaign;
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);assert.equal(s.log.filter(e=>e.text.includes('¡Campaña concluida!')).length,1);assert.equal(s.operativeState[57].hp,69);
 t.diagnostic(JSON.stringify({militaryWoundRoute:{victory:{hour:won.hour,second:won.secondOfHour,treasury:won.resources.treasury,squad:won.squad,commanderHp:won.operativeState[57].hp,dead:dead.map(Number)},care:notes.filter(n=>n.care).map(n=>({stage:n.stage,...n.care})),continuation:{hour:s.hour,second:s.secondOfHour,treasury:s.resources.treasury,squad:s.squad,commanderHp:s.operativeState[57].hp,expired:expiring}}}));
});
