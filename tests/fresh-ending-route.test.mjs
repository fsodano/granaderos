import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';import {incomeSummary} from '../game/economy.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';import {freshHistoricalEnding} from './fresh-ending-fixture.mjs';

test('a fresh stock campaign wins all localities with actual combat and continues after saved victory and service expiry',()=>{
 const {campaign:won,notes}=freshHistoricalEnding();assert.deepEqual(notes.filter(n=>n.actions).map(n=>n.stage),['santa_fe','ensenada','jujuy','humahuaca']);assert.equal(won.hour,414);assert.ok(won.log.some(e=>e.text.includes('¡Campaña concluida!')));
 const dead=Object.entries(won.operativeState).filter(([,r])=>!r.alive).map(([id])=>id),money=won.resources.treasury,daily=incomeSummary(won).daily;let s=saved({campaign:order(won,{type:'wait',hours:48})}).campaign;
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.hour,462);assert.equal(s.resources.treasury,money+2*daily);assert.equal(s.operativeState[128].alive,true);assert.ok(!s.recruited.includes(128));assert.ok(!s.squad.includes(128));assert.equal(s.contracts[128],undefined);assert.equal(s.blockade,false);assert.ok(Object.values(s.sectors).every(r=>r.owner==='patriot'));
 for(const id of dead){assert.equal(s.operativeState[id].hp,0);assert.equal(s.operativeState[id].alive,false);}
 let p=visit(s);assert.equal(p.battle.units.some(u=>u.id==='128'),false,'the expired hired actor is nowhere in the retained sector');assert.equal(p.battle.npcs.some(n=>n.operativeId===128),false);s=saved({campaign:leave(p)}).campaign;
 assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.pendingBattle,null);assert.ok(dispatchCampaign(s,{type:'fundArmy'}).lastError);assert.equal(s.log.filter(e=>e.text.includes('¡Campaña concluida!')).length,1);assert.equal(s.operativeState[57].hp,88);
});
