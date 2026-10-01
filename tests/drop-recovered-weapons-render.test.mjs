import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField,secondaryOrder,secondaryName} from './secondary-loot-fixture.mjs';
import {collectFieldItem,savedField} from './field-loot-render-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';

test('the production inventory leaves a recovered weapon at the soldiers feet and collects it from the occupied cell',async t=>{
 const field=secondaryLootField(),initial=secondaryOrder(field,{type:'loot',targetId:field.target,item:'blade'}),m=await mountCampaign(t,initial);
 const before=initial.battle.units.find(u=>u.id==='110'),key=Object.keys(before.inventory).find(k=>before.inventory[k].contentWeapon?.name===secondaryName),record=structuredClone(before.inventory[key]);
 await m.click('Equipo');await selectPocket(m,secondaryName);await m.click('Soltar aquí');
 let state=savedField(m),actor=state.battle.units.find(u=>u.id==='110'),ground=state.battle.groundItems.find(g=>g.contentWeapon?.name===secondaryName);
 assert.equal(actor.inventory[key],undefined);assert.equal(actor.ap,before.ap-4);assert.deepEqual(weaponRecord(ground),record);
 assert.equal([...m.document.querySelectorAll('.ja2-pocket')].some(e=>e.textContent.includes(secondaryName)),false);
 await m.click('Listo');state=await collectFieldItem(m,ground,secondaryName);actor=state.battle.units.find(u=>u.id==='110');
 assert.equal(state.battle.groundItems.find(g=>g.id===ground.id).count,0);assert.deepEqual(Object.values(actor.inventory).find(r=>r.contentWeapon?.name===secondaryName),record);
 await m.click('Equipo');await selectPocket(m,secondaryName);const cell=[...m.document.querySelectorAll('.ja2-pocket')].find(e=>e.textContent.includes(secondaryName));assert.equal(cell.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
});
