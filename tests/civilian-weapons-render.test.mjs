import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {selectPocket} from './pocket-render-fixture.mjs';
import {civilianWeaponField,localNPC} from './civilian-weapons-fixture.mjs';

test('ordinary resident loot controls recover authored weapons into real pockets and equip the blade with a saved empty source',async t=>{
 const p=civilianWeaponField(),m=await mountCampaign(t,p),id=localNPC(p.battle).id;
 await m.click('Recoger equipo');const target=m.document.querySelector(`[data-unit-id="${id}"]`);assert.match(target.getAttribute('aria-label'),/Recoger equipo de/);
 await act(async()=>target.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 let s=m.read();assert.deepEqual(localNPC(s.battle).civilianWeapons,{version:1,primary:null,blade:null});
 await m.click('Equipo');const row=await selectPocket(m,'Sable de Alma');const cell=[...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes('Sable de Alma'));assert.equal(cell.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 const equip=[...row.querySelectorAll('button')].find(b=>b.textContent.includes('Equipar secundaria'));assert.ok(equip);await act(async()=>equip.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 s=m.read();assert.equal(s.battle.units[0].bladeMetadata.contentWeapon.name,'Sable de Alma');assert.equal(s.battle.units[0].activeSlot,'blade');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]'),null);assert.equal(localNPC(s.battle).civilianWeapons.blade,null);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
