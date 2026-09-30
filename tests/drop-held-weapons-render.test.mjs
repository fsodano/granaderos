import {selectPocket,usePocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';

test('the real inventory drops the selected issued gun, shows empty hands and recovers the same loaded piece under the soldier',async t=>{
 const p=secondaryLootField(),original=weaponRecord(p.battle.units.find(u=>u.id==='110')),m=await mountCampaign(t,p);await m.click('Equipo');await usePocket(m,original.contentWeapon.name);await m.click('Dejar arma en uso');
 let s=m.read(),u=s.battle.units.find(u=>u.id==='110');assert.equal(u.weaponDropped,true);assert.equal(u.loaded,0);assert.equal(u.activeSlot,'unarmed');assert.equal(s.battle.droppedWeapons.length,1);assert.deepEqual(weaponRecord(s.battle.droppedWeapons[0]),original);assert.match(m.document.querySelector('.held-weapon').textContent,/Manos vacías/);const drop=[...m.document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Dejar arma en uso'));assert.equal(drop.disabled,true);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Listo');const loot=m.document.querySelector('[aria-label="Recoger equipo"]');await act(async()=>loot.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));const feet=m.document.querySelector('[data-unit-id="110"]');await act(async()=>feet.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.equal(m.read().battle.droppedWeapons[0].taken,true);
 await m.click('Equipo');const row=await selectPocket(m,original.contentWeapon.name);assert.ok(row);assert.equal([...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes(original.contentWeapon.name)).querySelector('img').getAttribute('src'),original.contentWeapon.art);const equip=[...row.querySelectorAll('button')].find(b=>b.textContent.startsWith('Equipar principal'));await act(async()=>equip.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 s=m.read();u=s.battle.units.find(u=>u.id==='110');assert.equal(u.weaponDropped,false);assert.equal(u.activeSlot,'primary');assert.deepEqual(weaponRecord(u),original);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
