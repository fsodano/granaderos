import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {tactical,saved} from './local-contract-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';
function underResident(p){
 const holder=p.battle.units.find(u=>u.id==='110'),i=p.battle.npcs.findIndex(n=>n.civilianSupplies?.medkits>0);assert.ok(i>=0);const n=p.battle.npcs[i];
 // Declared overlap boundary: a resident occupies the cell of a previously dropped item.
 p.battle.npcs[i]={...n,x:holder.x,y:holder.y};return {...saved(p),resident:n.id};
}
async function clickResident(m,id){const n=m.document.querySelector(`[data-unit-id="${id}"]`);assert.ok(n);await act(async()=>n.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));}
async function lootMode(m){const b=m.document.querySelector('[aria-label="Recoger equipo"]');await act(async()=>b.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));}

test('a living residents figure opens the actual ground supply picker without taking that residents personal supplies',async t=>{
 let p=tactical(supplyCareField(),{type:'dropSupply',item:'medkits',count:3});p=underResident(p);const resident=p.battle.npcs.find(n=>n.id===p.resident),stock=structuredClone(resident.civilianSupplies),m=await mountCampaign(t,p);await lootMode(m);await clickResident(m,p.resident);assert.ok(m.document.querySelector('[aria-label="Recoger suministros del suelo"]'));const amount=m.document.querySelector('[aria-label="Cantidad de suministros para recoger"]');Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(amount,'2');await act(async()=>amount.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));await m.click('Recoger cantidad');const s=m.read(),n=s.battle.npcs.find(n=>n.id===p.resident);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,3);assert.equal(s.battle.groundItems.find(g=>g.type==='medkits').count,1);assert.equal(n.hp,resident.hp);assert.deepEqual(n.civilianSupplies,stock);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
test('a living residents figure also permits ordinary collection of the exact loaded gun underneath without searching its owner',async t=>{
 let p=supplyCareField();const record=weaponRecord(p.battle.units.find(u=>u.id==='110'));p=tactical(p,{type:'drop',slot:'primary'});p=underResident(p);const stock=structuredClone(p.battle.npcs.find(n=>n.id===p.resident).civilianSupplies),m=await mountCampaign(t,p);await lootMode(m);await clickResident(m,p.resident);const s=m.read();assert.equal(s.battle.droppedWeapons[0].taken,true);assert.ok(Object.values(s.battle.units.find(u=>u.id==='110').inventory).some(r=>r.weapon===record.weapon&&r.loaded===record.loaded&&r.contentWeapon?.name===record.contentWeapon.name));assert.deepEqual(s.battle.npcs.find(n=>n.id===p.resident).civilianSupplies,stock);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
test('after the loose bundle is empty, the same figure still permits finite unconscious-resident collection and ignores held or container stock',async t=>{
 let p=tactical(supplyCareField({criticalResident:true}),{type:'dropSupply',item:'medkits',count:3});p=underResident(p);const n=p.battle.npcs.find(n=>n.id===p.resident),stock=structuredClone(n.civilianSupplies);p.battle.groundItems.push({id:'entangled',type:'boleadoras',x:n.x,y:n.y,count:1,heldBy:n.id},{id:'stored',type:'medkits',x:n.x,y:n.y,count:2,containerId:'closed'});p={...saved(p),resident:p.resident};const m=await mountCampaign(t,p);await lootMode(m);await clickResident(m,p.resident);await m.click('Recoger cantidad');assert.equal(m.read().battle.units.find(u=>u.id==='110').medkits,4);await clickResident(m,p.resident);const s=m.read(),resident=s.battle.npcs.find(n=>n.id===p.resident);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,5);assert.equal(resident.civilianSupplies.medkits,stock.medkits-1);assert.equal(resident.hp,14);assert.equal(s.battle.groundItems.find(g=>g.id==='entangled').count,1);assert.equal(s.battle.groundItems.find(g=>g.id==='stored').count,2);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
