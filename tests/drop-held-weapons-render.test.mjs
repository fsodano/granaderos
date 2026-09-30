import {selectPocket,usePocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';
import {collectFieldItem,savedField} from './field-loot-render-fixture.mjs';

test('the real inventory drops the selected issued gun, shows empty hands and recovers the same loaded piece under the soldier',async t=>{
 const p=secondaryLootField(),original=weaponRecord(p.battle.units.find(u=>u.id==='110')),m=await mountCampaign(t,p);
 await m.click('Equipo');await usePocket(m,original.contentWeapon.name);await m.click('Soltar aquí');
 let s=savedField(m),u=s.battle.units.find(u=>u.id==='110'),ground=s.battle.groundItems.find(g=>g.weapon===original.weapon);
 assert.equal(u.weaponDropped,true);assert.equal(u.loaded,0);assert.equal(u.activeSlot,'unarmed');assert.deepEqual(weaponRecord(ground),original);
 assert.ok(m.document.querySelector('[aria-label="Mano principal: Vacía"]'));
 await m.click('Listo');s=await collectFieldItem(m,ground,original.contentWeapon.name);assert.equal(s.battle.groundItems.find(g=>g.id===ground.id).count,0);
 await m.click('Equipo');await selectPocket(m,original.contentWeapon.name);const cell=[...m.document.querySelectorAll('.ja2-pocket')].find(e=>e.textContent.includes(original.contentWeapon.name));assert.equal(cell.querySelector('img').getAttribute('src'),original.contentWeapon.art);
 await m.click('Equipar principal');s=savedField(m);u=s.battle.units.find(u=>u.id==='110');assert.equal(u.weaponDropped,false);assert.equal(u.activeSlot,'primary');assert.deepEqual(weaponRecord(u),original);
});
