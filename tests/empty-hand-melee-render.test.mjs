import {usePocket} from './pocket-render-fixture.mjs';
import {weaponSpecification,weaponRecord} from '../game/weapon-definition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {disarmedArrival} from './empty-hand-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
import {weaponFor} from '../game/tactical.js';
import {savedField} from './field-loot-render-fixture.mjs';
const click=async(m,e)=>{assert.ok(e);assert.equal(e.disabled,false);await act(async()=>e.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));};

test('the production controls show an empty main hand after actual recovery and allow the retained authored secondary',async t=>{
 const p=disarmedArrival(),m=await mountCampaign(t,p),patient=p.battle.units.find(u=>u.id==='111');
 await click(m,[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(patient.name)));
 await m.click('Equipo');const primary=m.document.querySelector('.ja2-inventory [aria-label="Mano principal: Vacía"]');assert.ok(primary);assert.equal(primary.querySelector('img'),null);
 const blade=[...m.document.querySelectorAll('.ja2-pocket,.ja2-inventory .ja2-hands button')].find(e=>e.textContent.includes('Sable conservado'));assert.ok(blade);assert.equal(blade.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 await usePocket(m,'Sable conservado');const s=savedField(m),u=s.battle.units.find(u=>u.id==='111');assert.equal(u.activeSlot,'blade');assert.equal(weaponFor(u).name,'Sable conservado');assert.equal(u.weaponDropped,true);
});

test('the real hand and pocket controls store an owned gun and restore its exact mechanism state',async t=>{
 const p=secondaryLootField(),actor=p.battle.units.find(u=>u.id==='110');Object.assign(actor,{loaded:0,reloadProgress:.4,condition:37,jammed:true});const original=weaponRecord(actor),bladeName=weaponSpecification(actor,'blade').name,m=await mountCampaign(t,p);
 await m.click('Equipo');await usePocket(m,original.contentWeapon.name);const ap=savedField(m).battle.units.find(u=>u.id==='110').ap;
 await click(m,m.document.querySelector('.ja2-inventory [aria-label^="Mano principal:"]'));
 assert.deepEqual(weaponRecord(savedField(m).battle.units.find(u=>u.id==='110').equipmentCursor.stack),original);
 await click(m,[...m.document.querySelectorAll('.ja2-pocket-row.large button')].find(e=>e.getAttribute('aria-label')?.endsWith(': vacío')));
 let s=savedField(m),u=s.battle.units.find(u=>u.id==='110');assert.equal(u.equipmentCursor,undefined);assert.equal(u.activeSlot,'unarmed');assert.equal(u.ap,ap);assert.equal(weaponFor(u).id,0);assert.ok(Object.values(u.inventory).some(r=>r.weapon===original.weapon&&r.condition===37&&r.reloadProgress===.4));
 await usePocket(m,bladeName);assert.equal(weaponFor(savedField(m).battle.units.find(u=>u.id==='110')).name,bladeName);
 await usePocket(m,original.contentWeapon.name);s=savedField(m);u=s.battle.units.find(u=>u.id==='110');assert.equal(u.activeSlot,'primary');assert.deepEqual(weaponRecord(u),original);
});
