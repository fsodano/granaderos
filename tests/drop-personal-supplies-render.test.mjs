import {selectPocket} from './pocket-render-fixture.mjs';
import {installDialog,selectFieldItem,savedField} from './field-loot-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';

test('the production supply quantity control leaves a saved bundle and another selected soldier collects it under its previous owner',async t=>{
 const p=supplyCareField(),m=await mountCampaign(t,p);await m.click('Equipo');await selectPocket(m,'Vendas');
 const count=m.document.querySelector('[aria-label="Cantidad de objetos"]');Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype,'value').set.call(count,'3');await act(async()=>count.dispatchEvent(new m.dom.window.Event('input',{bubbles:true})));await m.click('Soltar aquí');
 let s=savedField(m);const bundle=s.battle.groundItems.find(g=>g.type==='item'&&g.item==='medkits');assert.ok(bundle);assert.equal(bundle.count,3);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,1);
 await m.click('Listo');const recipient=p.battle.units.find(u=>u.id==='111'),roster=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(recipient.name));assert.ok(roster);await act(async()=>roster.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 // The living former owner still occupies this cell. Ctrl-click opens the
 // ground picker while leaving that person's remaining supplies untouched.
 installDialog(m);const source=m.document.querySelector('[data-unit-id="110"] [data-person-hit-target]');await act(async()=>source.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true,ctrlKey:true})));await selectFieldItem(m,'Vendas',3);await m.click('Recoger selección');
 s=savedField(m);assert.equal(s.battle.groundItems.find(g=>g.id===bundle.id).count,0);assert.equal(s.battle.units.find(u=>u.id==='111').medkits,3);assert.equal(s.battle.units.find(u=>u.id==='110').medkits,1);assert.equal(m.document.querySelector(`[data-ground-item="${bundle.id}"]`),null);
});
