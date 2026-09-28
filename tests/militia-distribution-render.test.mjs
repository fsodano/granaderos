import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {combatMilitia,militiaReaction} from './militia-combat-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
const select=async(m,label,value)=>{const e=m.document.querySelector(`[aria-label="${label}"]`);assert.ok(e,label);Object.getOwnPropertyDescriptor(m.dom.window.HTMLSelectElement.prototype,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));};
const quantity=async(m,value)=>{const e=m.document.querySelector('[aria-label="Cantidad de milicias"]');Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));};
const button=(m,text)=>{const b=[...m.document.querySelectorAll('.militia-distribution button')].find(e=>e.textContent.trim().startsWith(text));assert.ok(b,text);return b;};
const current=m=>m.saved().campaign;

test('mounted campaign transfers an actual wounded promoted defender and saves a balanced city without charging or duplicating supplies',async t=>{
 const prepared=combatMilitia(),fought=militiaReaction(prepared.s,prepared.id),m=await mountCampaign(t,visit(fought.s));await m.click('Volver a la campaña');
 const initial=current(m),original=structuredClone(initial.garrisons.retiro.find(u=>u.id===prepared.id)),ids=Object.values(initial.garrisons).flat().map(u=>u.id).sort();
 await select(m,'Destino de las milicias','ensenada');await select(m,'Grado de las milicias',1);assert.equal(button(m,'Trasladar defensores').disabled,false);await m.click('Trasladar defensores');
 const moved=current(m).garrisons.ensenada.find(u=>u.id===prepared.id);assert.ok(moved);for(const key of ['hp','loaded','ammo','condition','inventory','militiaExperience','militiaCombatCredit'])assert.deepEqual(moved[key],original[key],key);assert.equal(moved.hp,44);assert.equal(current(m).resources.treasury,initial.resources.treasury);assert.equal(current(m).hour,initial.hour);assert.equal(current(m).secondOfHour,initial.secondOfHour);
 await select(m,'Grado de las milicias',0);await quantity(m,3);assert.equal(button(m,'Trasladar defensores').disabled,true);assert.match(m.document.querySelector('.militia-distribution').textContent,/No hay suficientes defensores/);const denied=current(m);await m.click('Trasladar defensores');assert.deepEqual(current(m),denied);
 assert.ok(m.document.querySelector('[aria-label="Distribución prevista"]'));await m.click('Distribuir de forma pareja');const distributed=current(m);
 assert.deepEqual(['buenos_aires','retiro','ensenada'].map(id=>distributed.sectors[id].militia.reduce((a,b)=>a+b,0)),[1,1,1]);assert.deepEqual(Object.values(distributed.garrisons).flat().map(u=>u.id).sort(),ids);assert.equal(button(m,'Distribuir de forma pareja').disabled,true);await m.click('Distribuir de forma pareja');assert.deepEqual(current(m),distributed);assert.equal(distributed.lastError,null);assert.deepEqual(saved({campaign:distributed}).campaign,distributed);
});

test('mounted campaign explains a prepared occupied city connection and offers no invalid transfer controls',async t=>{
 const {s}=combatMilitia();s.sectors.buenos_aires.owner='royalist';const m=await mountCampaign(t,visit(saved({campaign:s}).campaign));await m.click('Volver a la campaña');
 const panel=m.document.querySelector('.militia-distribution');assert.match(panel.textContent,/No hay otro sector propio conectado/);assert.equal(panel.querySelectorAll('button').length,0);assert.equal(panel.querySelectorAll('select').length,0);
});
