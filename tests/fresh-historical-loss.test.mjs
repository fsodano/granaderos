import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {saved} from './local-contract-fixture.mjs';
import {freshMendozaLoss} from './historical-loss-fixture.mjs';

test('a funded Mendoza victory cannot conceal the subsequent death of its required engineer',()=>{
 const {campaign:s,combatCheckpoint:q,deathCheckpoint:p,injuryOrders,actions}=freshMendozaLoss();
 assert.equal(q.battle.status,'victory');assert.equal(q.campaign.defeated,false);assert.equal(q.campaign.completed,false);assert.ok(q.campaign.pendingBattle);assert.ok(actions>0);
 const engineer=q.battle.npcs.find(n=>n.operativeId===2);assert.ok(engineer.hp>0);assert.equal(q.campaign.operativeState[2].alive,true);
 assert.ok(injuryOrders.length>0);assert.ok(injuryOrders.every(action=>action.type==='melee'&&action.targetKind==='npc'&&action.targetId===engineer.id));
 assert.deepEqual(saved(q),q,'the actual victory and living engineer survive official save decoding');
 assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.ok(p.campaign.pendingBattle);assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.equal(s.pendingBattle,null);assert.equal(s.sectors.mendoza.owner,'patriot');assert.equal(s.flags.foundry,false);assert.equal(s.operativeState[2].hp,0);
 assert.equal(saved({campaign:s}).campaign.defeated,true);assert.ok(dispatchCampaign(s,{type:'foundry'}).lastError);assert.ok(dispatchCampaign(s,{type:'wait',hours:1}).lastError);assert.ok(s.operativeState[57].hp>0);assert.ok(s.log.some(e=>/responsable de fundición/.test(e.text)));
});
