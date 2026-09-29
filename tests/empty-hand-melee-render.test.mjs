import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {disarmedArrival} from './empty-hand-fixture.mjs';
import {weaponFor} from '../game/tactical.js';

test('the production controls show empty primary hands after actual recovery and allow the retained authored secondary',async t=>{
 const p=disarmedArrival(),m=await mountCampaign(t,p),patient=p.battle.units.find(u=>u.id==='111');const roster=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(patient.name));assert.ok(roster);await act(async()=>roster.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 assert.ok(m.document.querySelector('[aria-label="Golpear con las manos vacías"]'));await m.click('Equipo y órdenes');const primary=m.document.querySelector('.hand-slot.primary'),secondary=m.document.querySelector('.hand-slot.blade');assert.match(primary.textContent,/Puños/);assert.equal(primary.querySelector('img'),null);assert.match(secondary.textContent,/Sable conservado/);assert.equal(secondary.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 await act(async()=>secondary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));const s=m.read(),u=s.battle.units.find(u=>u.id==='111');assert.equal(u.activeSlot,'blade');assert.equal(weaponFor(u).name,'Sable conservado');assert.equal(u.weaponDropped,true);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
