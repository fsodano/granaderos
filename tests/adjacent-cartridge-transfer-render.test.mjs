import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
const change=async(m,e,value)=>{const proto=e.tagName==='SELECT'?m.dom.window.HTMLSelectElement.prototype:m.dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));};

test('the production supply selector hands over loose cartridges and saves both reserves without changing either loaded gun',async t=>{
 const p=secondaryLootField({companion:true}),m=await mountCampaign(t,p);await m.click('Equipo y órdenes');await change(m,m.document.querySelector('[aria-label="Suministro personal"]'),'ammo');await change(m,m.document.querySelector('[aria-label="Cantidad de suministros"]'),9);await change(m,m.document.querySelector('[aria-label="Entregar suministros a"]'),'111');const buttons=[...m.document.querySelectorAll('button')],give=buttons.find(b=>b.textContent.startsWith('Entregar suministros')),drop=buttons.find(b=>b.textContent.startsWith('Dejar suministros en el suelo'));assert.equal(give.disabled,false);assert.equal(drop.disabled,true);assert.match(m.document.querySelector('.pertrechos').textContent,/cartuchos solo se pueden entregar/);await act(async()=>give.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const s=m.read(),source=s.battle.units.find(u=>u.id==='110'),target=s.battle.units.find(u=>u.id==='111');assert.equal(source.ammo,0);assert.equal(target.ammo,18);assert.equal(source.loaded,1);assert.equal(target.loaded,1);assert.equal(give.disabled,true);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
