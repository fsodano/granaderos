import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {playerKnownState} from '../game/player-known-state.js';
const change=async(m,e,value)=>{assert.ok(e);const proto=e.tagName==='SELECT'?m.dom.window.HTMLSelectElement.prototype:m.dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));};
const transfer=m=>[...m.document.querySelectorAll('[aria-label="Dar o soltar equipo"] button')].find(b=>/^(Dar|Arrojar|Pasar)/.test(b.textContent));
const stored=m=>{const s=m.saved();assert.deepEqual(m.read(),playerKnownState({...s,screen:m.read().screen}));return s;};

test('the shared pocket controls pass the selected supply quantity and save both remaining amounts',async t=>{
 const m=await mountCampaign(t,supplyCareField());await m.click('Equipo');await selectPocket(m,'Vendas');assert.equal(transfer(m).disabled,true);
 await change(m,m.document.querySelector('[aria-label="Cantidad de objetos"]'),3);await change(m,m.document.querySelector('[aria-label="Aliado que recibe el equipo"]'),'111');assert.equal(transfer(m).disabled,false);await act(async()=>transfer(m).dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let s=stored(m);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,1);assert.equal(s.battle.units.find(u=>u.id==='111').medkits,3);assert.equal(m.document.querySelector('[aria-label="Cantidad de objetos"]').value,'1');
 await selectPocket(m,'Raciones');await change(m,m.document.querySelector('[aria-label="Cantidad de objetos"]'),1);assert.equal(transfer(m).disabled,false);await act(async()=>transfer(m).dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));s=stored(m);assert.equal(s.battle.units.find(u=>u.id==='110').rations,1);assert.equal(s.battle.units.find(u=>u.id==='111').rations,3);
});
test('the quantity control limits selection to stock and tactical admission rejects an excess without spending supplies',async t=>{
 const m=await mountCampaign(t,supplyCareField());await m.click('Equipo');await selectPocket(m,'Vendas');const count=m.document.querySelector('[aria-label="Cantidad de objetos"]');await change(m,count,5);assert.equal(count.value,'4');await change(m,m.document.querySelector('[aria-label="Aliado que recibe el equipo"]'),'111');assert.equal(transfer(m).disabled,false);
 const schema=m.registrations.find(x=>x.name==='issue_granaderos_tactical_order').inputSchema;assert.ok(schema.properties.type.enum.includes('transfer'));assert.equal(schema.properties.count.minimum,1);const before=stored(m);await act(async()=>assert.throws(()=>m.issue({type:'transfer',unitId:'110',targetId:'111',item:'medkits',count:5}),/No queda esa cantidad del objeto/));assert.deepEqual(stored(m),before);
});
