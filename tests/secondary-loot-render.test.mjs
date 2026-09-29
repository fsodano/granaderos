import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField,secondaryName} from './secondary-loot-fixture.mjs';

test('the ordinary body-loot control shows the recovered authored blade image and equips it through the production inventory',async t=>{
 const initial=secondaryLootField(),m=await mountCampaign(t,initial);
 const loot=m.document.querySelector('[aria-label="Recoger equipo"]');assert.ok(loot);await act(async()=>loot.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const body=m.document.querySelector(`[data-unit-id="${initial.target}"]`);assert.ok(body);await act(async()=>body.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let state=m.read(),victim=state.battle.units.find(u=>u.id===initial.target);assert.equal(victim.blade,0);assert.equal(victim.weaponDropped,true);
 await m.click('Equipo y órdenes');const row=await selectPocket(m,secondaryName);assert.ok(row,secondaryName);assert.equal([...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes(secondaryName)).querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 const equip=[...row.querySelectorAll('button')].find(b=>b.textContent.includes('Equipar secundaria'));assert.ok(equip);await act(async()=>equip.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 state=m.read();const actor=state.battle.units.find(u=>u.id==='110');assert.equal(actor.bladeMetadata.contentWeapon.name,secondaryName);assert.equal(actor.activeSlot,'blade');assert.equal(state.battle.units.find(u=>u.id===initial.target).blade,0);assert.deepEqual(m.saved(),{campaign:state.campaign,battle:state.battle});assert.match(m.document.querySelector('.held-weapon').textContent,new RegExp(secondaryName));
});
