import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {tactical,saved} from './local-contract-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';
import {installDialog,selectFieldItem,savedField} from './field-loot-render-fixture.mjs';
function underResident(p){
 const holder=p.battle.units.find(u=>u.id==='110'),i=p.battle.npcs.findIndex(n=>n.civilianSupplies?.medkits>0);assert.ok(i>=0);const n=p.battle.npcs[i];
 // Declared overlap boundary: a resident occupies the cell of a previously dropped item.
 p.battle.npcs[i]={...n,x:holder.x,y:holder.y};return {...saved(p),resident:n.id};
}
async function clickResident(m,id){installDialog(m);const n=m.document.querySelector(`[data-unit-id="${id}"] [data-person-hit-target]`);assert.ok(n);await act(async()=>n.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true,ctrlKey:true})));assert.ok(m.document.querySelector('.ja2-loot-dialog'));}

test('Control-click on a living residents figure opens the actual ground supply picker without taking that residents personal supplies',async t=>{
 let p=tactical(supplyCareField(),{type:'dropSupply',item:'medkits',count:3});p=underResident(p);const resident=p.battle.npcs.find(n=>n.id===p.resident),stock=structuredClone(resident.civilianSupplies),m=await mountCampaign(t,p);
 await clickResident(m,p.resident);assert.equal(m.document.querySelectorAll('.ja2-loot-choice input').length,1);await selectFieldItem(m,'Vendas',2);await m.click('Recoger selección');
 const s=savedField(m),n=s.battle.npcs.find(n=>n.id===p.resident);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,3);assert.equal(s.battle.groundItems.find(g=>g.type==='medkits').count,1);assert.equal(n.hp,resident.hp);assert.deepEqual(n.civilianSupplies,stock);
});
test('Control-click on a living residents figure also permits ordinary collection of the exact loaded gun underneath without searching its owner',async t=>{
 let p=supplyCareField();const record=weaponRecord(p.battle.units.find(u=>u.id==='110'));p=tactical(p,{type:'drop',slot:'primary'});p=underResident(p);const ground=p.battle.groundItems.find(g=>g.weapon===record.weapon),stock=structuredClone(p.battle.npcs.find(n=>n.id===p.resident).civilianSupplies),m=await mountCampaign(t,p);
 await clickResident(m,p.resident);await selectFieldItem(m,record.contentWeapon.name);await m.click('Recoger selección');const s=savedField(m);assert.equal(s.battle.groundItems.find(g=>g.id===ground.id).count,0);
 assert.ok(Object.values(s.battle.units.find(u=>u.id==='110').inventory).some(r=>r.weapon===record.weapon&&r.loaded===record.loaded&&r.contentWeapon?.name===record.contentWeapon.name));assert.deepEqual(s.battle.npcs.find(n=>n.id===p.resident).civilianSupplies,stock);
});
test('after the loose bundle is empty, the same figure still permits finite unconscious-resident collection and ignores held or container stock',async t=>{
 let p=tactical(supplyCareField({criticalResident:true}),{type:'dropSupply',item:'medkits',count:3});p=underResident(p);const n=p.battle.npcs.find(n=>n.id===p.resident),stock=structuredClone(n.civilianSupplies);
 p.battle.groundItems.push({id:'entangled',type:'boleadoras',x:n.x,y:n.y,count:1,heldBy:n.id},{id:'stored',type:'medkits',x:n.x,y:n.y,count:2,containerId:'closed'});p={...saved(p),resident:p.resident};const m=await mountCampaign(t,p);
 await clickResident(m,p.resident);const labels=[...m.document.querySelectorAll('.ja2-loot-choice input')].map(e=>e.getAttribute('aria-label'));assert.equal(labels.filter(label=>label.includes('En el suelo')).length,1);
 // Select the ground bundle first; the resident remains a separate finite owner.
 await m.click('Limpiar selección');const ground=m.document.querySelector('.ja2-loot-choice input[aria-label$="En el suelo · Vendas"]');assert.ok(ground);await act(async()=>ground.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const amount=ground.closest('.ja2-loot-row').querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(amount,'3');await act(async()=>amount.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));await m.click('Recoger selección');
 assert.equal(savedField(m).battle.units.find(u=>u.id==='110').medkits,4);await clickResident(m,p.resident);await selectFieldItem(m,'Vendas',stock.medkits);await m.click('Recoger selección');
 const s=savedField(m),resident=s.battle.npcs.find(n=>n.id===p.resident);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,4+stock.medkits);assert.equal(resident.civilianSupplies.medkits,0);assert.equal(resident.hp,14);assert.equal(s.battle.groundItems.find(g=>g.id==='entangled').count,1);assert.equal(s.battle.groundItems.find(g=>g.id==='stored').count,2);
});
