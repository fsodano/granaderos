import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {strategicClockControls} from './strategic-clock-render-fixture.mjs';
import {combatMilitia} from './militia-combat-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
const select=async(m,label,value)=>{const e=m.document.querySelector(`[aria-label="${label}"]`);assert.ok(e,label);Object.getOwnPropertyDescriptor(m.dom.window.HTMLSelectElement.prototype,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));};
const button=(m,text)=>{const b=[...m.document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(text));assert.ok(b,text);return b;};
const current=m=>m.saved().campaign;
async function completeCourse(m,clock){for(let i=0;i<200&&current(m).militiaTraining.length;i++)await clock.advanceHour();assert.equal(current(m).militiaTraining.length,0);}

test('the campaign can form new militia despite existing candidates, then select a paid promotion of the same wounded people',async t=>{
 const {s,id}=combatMilitia(),m=await mountCampaign(t,visit(s));await m.click('Volver a la campaña');await m.click('Sector');const clock=strategicClockControls(t,act,m.document),first=structuredClone(current(m).garrisons.retiro),cash=current(m).resources.treasury;
 const choice=m.document.querySelector('[aria-label="Tipo de instrucción de milicias"]');assert.equal(choice.value,'1');assert.deepEqual([...choice.options].map(o=>o.value),['0','1']);assert.match(button(m,'Entrenar milicias').textContent,/120 pesos/);
 await select(m,'Tipo de instrucción de milicias',0);assert.match(button(m,'Entrenar milicias').textContent,/60 pesos/);await m.click('Entrenar milicias');assert.equal(current(m).lastError,null);assert.equal(current(m).militiaTraining[0].rank,0);assert.equal(current(m).resources.treasury,cash-60);assert.deepEqual(current(m).garrisons.retiro,first);await completeCourse(m,clock);assert.deepEqual(current(m).sectors.retiro.militia,[6,0,0]);assert.deepEqual(current(m).garrisons.retiro,first);assert.equal(m.document.querySelector('[aria-label="Tipo de instrucción de milicias"]').value,'0');
 await select(m,'Tipo de instrucción de milicias',1);const before=current(m).resources.treasury;await m.click('Entrenar milicias');assert.equal(current(m).lastError,null);assert.equal(current(m).resources.treasury,before-120);assert.deepEqual(current(m).militiaTraining[0].trainees.map(u=>u.id),first.map(u=>u.id));assert.match(m.document.querySelector('[aria-label="Milicianos en instrucción"]').textContent,/44\/60 salud/);await completeCourse(m,clock);const after=current(m);assert.deepEqual(after.sectors.retiro.militia,[3,3,0]);const patient=after.garrisons.retiro.find(u=>u.id===id),original=first.find(u=>u.id===id);assert.equal(patient.militiaRank,1);for(const key of ['hp','maxHp','weaponMetadata','loaded','ammo','condition','inventory'])assert.deepEqual(patient[key],original[key],key);assert.equal(after.lastError,null);
});

test('the selected course reports its actual treasury shortage and cannot spend funds from a disabled control',async t=>{
 const {s}=combatMilitia();s.resources.treasury=59;const m=await mountCampaign(t,visit(saved({campaign:s}).campaign));await m.click('Volver a la campaña');await m.click('Sector');const cash=current(m).resources.treasury;assert.ok(cash>0&&cash<=59);assert.equal(button(m,'Entrenar milicias').disabled,true);assert.match(m.document.querySelector('.simple-militia').textContent,new RegExp(`Faltan ${120-cash} pesos`));await select(m,'Tipo de instrucción de milicias',0);assert.equal(button(m,'Entrenar milicias').disabled,true);assert.match(m.document.querySelector('.simple-militia').textContent,new RegExp(60-cash===1?'Falta 1 peso':`Faltan ${60-cash} pesos`));const before=current(m);await m.click('Entrenar milicias');assert.deepEqual(current(m),before);
});
