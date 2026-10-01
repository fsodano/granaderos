import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField,secondaryName} from './secondary-loot-fixture.mjs';
import {collectFieldItem,savedField} from './field-loot-render-fixture.mjs';

test('the body equipment picker collects only the chosen blade and equips it through the production pockets',async t=>{
 const initial=secondaryLootField(),m=await mountCampaign(t,initial),body=initial.battle.units.find(u=>u.id===initial.target);
 let state=await collectFieldItem(m,body,secondaryName),victim=state.battle.units.find(u=>u.id===initial.target);
 assert.equal(victim.blade,undefined);assert.equal(Boolean(victim.weaponDropped),false);assert.equal(victim.loaded,body.loaded);
 await m.click('Equipo');await selectPocket(m,secondaryName);const cell=[...m.document.querySelectorAll('.ja2-pocket')].find(e=>e.textContent.includes(secondaryName));assert.equal(cell.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 await m.click('Equipar secundaria');state=savedField(m);const actor=state.battle.units.find(u=>u.id==='110');assert.equal(actor.bladeMetadata.contentWeapon.name,secondaryName);assert.equal(actor.activeSlot,'blade');assert.equal(state.battle.units.find(u=>u.id===initial.target).blade,undefined);assert.ok(m.document.querySelector(`[aria-label="Mano principal: ${secondaryName}"]`));
});
