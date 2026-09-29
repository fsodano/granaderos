import {usePocket} from './pocket-render-fixture.mjs';
import {weaponSpecification} from '../game/weapon-definition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {buttstockField} from './buttstock-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';

test('the ordinary stock control attacks the selected live enemy and saves the actual firearm, then shows the selected hand action',async t=>{
 const p=buttstockField(),u=p.battle.units.find(u=>u.id==='110'),target=p.battle.units.find(u=>u.id===p.target),record=weaponRecord(u),m=await mountCampaign(t,p);
 const button=m.document.querySelector('[aria-label="Golpear con la culata"]');assert.ok(button);await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const enemy=m.document.querySelector(`[data-unit-id="${p.target}"]`);assert.ok(enemy);await act(async()=>enemy.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let s=m.read();assert.equal(s.battle.lastError,null);assert.equal(s.battle.units.find(u=>u.id==='110').ap,84);assert.ok(s.battle.units.find(u=>u.id===p.target).hp<target.hp);assert.deepEqual(weaponRecord(s.battle.units.find(u=>u.id==='110')),record);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Equipo y órdenes');const gun=m.document.querySelector('.held-weapon');assert.match(gun.textContent,/Fusil de Acosta/);assert.equal(gun.querySelector('img').getAttribute('src'),'/art/weapon-1801.png');
 await act(async()=>m.document.querySelector('[aria-label="Usar manos vacías"]').dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.equal(m.read().battle.units.find(u=>u.id==='110').activeSlot,'unarmed');await m.click('Listo');assert.ok(m.document.querySelector('[aria-label="Golpear con las manos vacías"]'));await m.click('Equipo y órdenes');
 await usePocket(m,weaponSpecification(u,'blade').name);assert.equal(m.read().battle.units.find(u=>u.id==='110').activeSlot,'blade');
 await usePocket(m,record.contentWeapon.name);await m.click('Listo');assert.ok(m.document.querySelector('[aria-label="Golpear con la culata"]'));s=m.read();assert.deepEqual(weaponRecord(s.battle.units.find(u=>u.id==='110')),record);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
