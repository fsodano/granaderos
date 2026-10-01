import {deploymentCost} from '../game/campaign.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';

for(const kind of ['created','hired'])test(`fresh ${kind} force wins the coastal opening with real losses, paid replacements and saved replay`,()=>{
 const {campaign,notes}=freshCoastalRoute(kind);
 assert.equal(Boolean(campaign.officer),kind==='created');
 assert.deepEqual(notes.slice(1).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);
 assert.ok(notes.every(n=>n.funds>=0));
});

test('a fresh free officer and local recruits complete the opening without bulletin hires, preserving paid recovery and permanent losses',t=>{
 const {campaign:s,notes}=freshCoastalRoute('local');
 assert.deepEqual(notes.filter(n=>n.sector).map(n=>n.sector),['buenos_aires','san_nicolas','san_lorenzo']);assert.ok(notes.every(n=>n.funds>=0));
 assert.deepEqual(notes[0].squad,[1000,3]);assert.equal(notes[0].funds,2960);
 const care=notes.find(n=>n.stage==='local-recovery');assert.ok(care.hours>0);assert.ok(care.dressingsBought>0);assert.equal(care.dressingCost,care.dressingsBought*10);assert.equal(care.weaponCost,care.squad.length*230);assert.ok(care.workshopCost>0);
 // Current combat determines who survives. Preserve every actual casualty and
 // paid recovery record instead of forcing an old number of deaths or hours.
 const fallen=[...new Set(notes.filter(n=>n.sector).flatMap(n=>n.deaths))];assert.ok(fallen.length>0);
 for(const id of fallen){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);assert.ok(!s.squad.includes(id));}
 assert.ok(s.squad.length>0);assert.ok(s.missionAllies.san_lorenzo.hp>0);
 const finalCare=notes.find(n=>n.stage==='local-final-recovery');assert.ok(finalCare);assert.equal(finalCare.dressingCost,finalCare.dressingsBought*10);assert.equal(finalCare.weaponCost,0);
 const continued=saved({campaign:order(s,{type:'wait',hours:1})}).campaign,money=continued.resources.treasury,cost=deploymentCost(continued),p=visit(continued);
 for(const id of fallen)assert.ok(!p.battle.units.some(u=>u.id===String(id)&&u.hp>0));
 const returned=saved({campaign:leave(p)}).campaign;
 assert.equal(returned.resources.treasury,money-cost);assert.deepEqual(returned.squad,continued.squad);
 for(const id of continued.squad)assert.equal(returned.operativeState[id].hp,continued.operativeState[id].hp);
 for(const id of fallen)assert.equal(returned.operativeState[id].alive,false);
 assert.equal(returned.completed,false);assert.equal(returned.defeated,false);
 t.diagnostic(JSON.stringify({care,opening:{hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury},continuation:{hour:returned.hour,funds:returned.resources.treasury,squad:returned.squad},battles:notes.filter(n=>n.sector).map(({sector,actions,turns,deaths})=>({sector,actions,turns,deaths}))}));
});
