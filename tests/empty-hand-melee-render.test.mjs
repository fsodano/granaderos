import {usePocket} from './pocket-render-fixture.mjs';
import {weaponSpecification} from '../game/weapon-definition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {disarmedArrival} from './empty-hand-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
import {weaponFor} from '../game/tactical.js';

test('the production controls show empty primary hands after actual recovery and allow the retained authored secondary',async t=>{
 const p=disarmedArrival(),m=await mountCampaign(t,p),patient=p.battle.units.find(u=>u.id==='111');const roster=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(patient.name));assert.ok(roster);await act(async()=>roster.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 assert.ok(m.document.querySelector('[aria-label="Golpear con las manos vacías"]'));await m.click('Equipo y órdenes');const primary=m.document.querySelector('.held-weapon'),secondary=[...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes('Sable conservado'));assert.match(primary.textContent,/Puños/);assert.equal(primary.querySelector('img'),null);assert.match(secondary.textContent,/Sable conservado/);assert.equal(secondary.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 await usePocket(m,'Sable conservado');const s=m.read(),u=s.battle.units.find(u=>u.id==='111');assert.equal(u.activeSlot,'blade');assert.equal(weaponFor(u).name,'Sable conservado');assert.equal(u.weaponDropped,true);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});


test('the real inventory puts an owned gun away, saves empty hands, and selects either actual hand explicitly',async t=>{
 const p=secondaryLootField(),actor=p.battle.units.find(u=>u.id==='110');Object.assign(actor,{loaded:0,reloadProgress:.4,condition:37,jammed:true});const m=await mountCampaign(t,p);await m.click('Equipo y órdenes');
 const empty=m.document.querySelector('[aria-label="Usar manos vacías"]');assert.ok(empty);assert.equal(empty.disabled,false);await act(async()=>empty.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let s=m.read(),u=s.battle.units.find(u=>u.id==='110');assert.equal(u.activeSlot,'unarmed');assert.equal(u.ap,actor.ap-4);assert.equal(empty.disabled,true);assert.equal(empty.getAttribute('aria-pressed'),'true');assert.equal(weaponFor(u).id,0);assert.equal(u.weapon,actor.weapon);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await usePocket(m,weaponSpecification(actor,'blade').name);assert.equal(m.read().battle.units.find(u=>u.id==='110').activeSlot,'blade');await act(async()=>empty.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 await usePocket(m,weaponSpecification(actor).name);s=m.read();u=s.battle.units.find(u=>u.id==='110');assert.equal(u.activeSlot,'primary');assert.equal(u.loaded,0);assert.equal(u.reloadProgress,.4);assert.equal(u.condition,37);assert.equal(u.jammed,true);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
