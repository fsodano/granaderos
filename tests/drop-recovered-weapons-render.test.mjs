import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField,secondaryOrder,secondaryName} from './secondary-loot-fixture.mjs';

test('the production inventory leaves a recovered weapon at the soldiers feet and the field control collects it from the occupied cell',async t=>{
 const field=secondaryLootField(),initial=secondaryOrder(field,{type:'loot',targetId:field.target,item:'blade'}),m=await mountCampaign(t,initial);
 const before=initial.battle.units.find(u=>u.id==='110'),key=Object.keys(before.inventory).find(k=>k.startsWith('blade:')),record=structuredClone(before.inventory[key]);
 await m.click('Equipo y órdenes');const row=await selectPocket(m,secondaryName);assert.ok(row);
 const drop=[...row.querySelectorAll('button')].find(b=>b.textContent.includes('Dejar una pieza en el suelo'));assert.ok(drop);assert.equal(drop.disabled,false);
 await act(async()=>drop.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let state=m.read(),actor=state.battle.units.find(u=>u.id==='110');assert.equal(actor.inventory[key],undefined);assert.equal(actor.ap,before.ap-4);assert.equal(state.battle.droppedWeapons.length,1);assert.equal(state.battle.droppedWeapons[0].contentWeapon.name,secondaryName);assert.deepEqual(m.saved(),{campaign:state.campaign,battle:state.battle});
 assert.equal([...m.document.querySelectorAll('.pocket-cell')].some(e=>e.textContent.includes(secondaryName)),false);
 await m.click('Listo');const loot=m.document.querySelector('[aria-label="Recoger equipo"]');assert.ok(loot);await act(async()=>loot.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const feet=m.document.querySelector('[data-unit-id="110"]');assert.ok(feet);await act(async()=>feet.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 state=m.read();actor=state.battle.units.find(u=>u.id==='110');assert.equal(state.battle.lastError,null);assert.equal(state.battle.droppedWeapons[0].taken,true);assert.deepEqual(Object.values(actor.inventory).find(r=>r.contentWeapon?.name===secondaryName),record);assert.deepEqual(m.saved(),{campaign:state.campaign,battle:state.battle});
 await m.click('Equipo y órdenes');const restored=await selectPocket(m,secondaryName);assert.ok(restored);assert.equal([...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes(secondaryName)).querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
});
