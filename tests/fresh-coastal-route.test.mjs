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
 const care=notes.find(n=>n.stage==='local-recovery');assert.ok(care.hours>0);assert.ok(care.dressingsBought>0);assert.equal(care.dressingCost,care.dressingsBought*10);assert.equal(care.weaponCost,920);assert.ok(care.workshopCost>0);
 assert.deepEqual(s.squad,[1000,10]);assert.equal(s.operativeState[3].alive,false);assert.equal(s.operativeState[1000].hp,87);assert.equal(s.operativeState[4].hp,0);assert.equal(s.operativeState[10].hp,72);assert.equal(s.missionAllies.san_lorenzo.hp,88);
 assert.equal(s.hour,130);assert.equal(s.resources.treasury,4211);assert.deepEqual(notes.at(-1).deaths,[3,4]);const finalCare=notes.find(n=>n.stage==='local-final-recovery');assert.equal(finalCare.hours,8);assert.equal(finalCare.dressingsBought,7);assert.equal(finalCare.dressingCost,70);assert.equal(finalCare.weaponCost,0);
 const continued=saved({campaign:order(s,{type:'wait',hours:1})}).campaign,money=continued.resources.treasury,p=visit(continued);
 assert.ok(!p.battle.units.some(u=>u.id==='3'&&u.hp>0));const returned=saved({campaign:leave(p)}).campaign;
 assert.equal(returned.resources.treasury,money-2);assert.deepEqual(returned.squad,[1000,10]);assert.equal(returned.operativeState[10].hp,72);assert.equal(returned.operativeState[3].alive,false);assert.equal(returned.completed,false);assert.equal(returned.defeated,false);
 t.diagnostic(JSON.stringify({care,opening:{hour:s.hour,second:s.secondOfHour,funds:s.resources.treasury},continuation:{hour:returned.hour,funds:returned.resources.treasury,squad:returned.squad},battles:notes.filter(n=>n.sector).map(({sector,actions,turns,deaths})=>({sector,actions,turns,deaths}))}));
});
