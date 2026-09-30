import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField,secondaryOrder,secondaryName} from './secondary-loot-fixture.mjs';
import {playerKnownState} from '../game/player-known-state.js';
const stored=m=>{const s=m.saved();assert.deepEqual(m.read(),playerKnownState({...s,screen:m.read().screen}));return s;};
function initial(){const p=secondaryLootField({companion:true});return secondaryOrder(p,{type:'loot',targetId:p.target,item:'blade'});}

test('the production inventory passes an authored piece to the chosen adjacent companion, who can equip the saved weapon',async t=>{
 const p=initial(),m=await mountCampaign(t,p);await m.click('Equipo');const row=await selectPocket(m,secondaryName);assert.ok(row);
 const select=row.querySelector('[aria-label="Aliado que recibe el equipo"]'),button=[...row.querySelectorAll('[aria-label="Dar o soltar equipo"] button')].find(b=>/^(Dar|Arrojar|Pasar)/.test(b.textContent));assert.equal(button.disabled,true);
 await act(async()=>{select.value='111';select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});assert.equal(button.disabled,false);await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let s=stored(m);assert.equal(Object.values(s.battle.units.find(u=>u.id==='110').inventory).some(r=>r.contentWeapon?.name===secondaryName),false);assert.equal(Object.values(s.battle.units.find(u=>u.id==='111').inventory).find(r=>r.weapon).contentWeapon.name,secondaryName);assert.deepEqual(stored(m),s);
 await m.click('Listo');const recipient=p.battle.units.find(u=>u.id==='111'),roster=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(recipient.name));assert.ok(roster);await act(async()=>roster.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Equipo');
 const received=await selectPocket(m,secondaryName);assert.ok(received);assert.equal([...m.document.querySelectorAll('.ja2-pocket')].find(e=>e.textContent.includes(secondaryName)).querySelector('img').getAttribute('src'),'/art/weapon-1810.png');const equip=[...received.querySelectorAll('button')].find(b=>b.textContent.startsWith('Equipar secundaria'));assert.ok(equip);await act(async()=>equip.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 s=stored(m);assert.equal(s.battle.units.find(u=>u.id==='111').bladeMetadata.contentWeapon.name,secondaryName);assert.deepEqual(stored(m),s);
});

test('a distant recipient exposes the real refusal and the registered tactical order rechecks changed geometry without transferring',async t=>{
 const p=initial();Object.assign(p.battle.units.find(u=>u.id==='111'),{x:19,y:0});const m=await mountCampaign(t,p);await m.click('Equipo');const row=await selectPocket(m,secondaryName),select=row.querySelector('[aria-label="Aliado que recibe el equipo"]');
 await act(async()=>{select.value='111';select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});const button=[...row.querySelectorAll('[aria-label="Dar o soltar equipo"] button')].find(b=>/^(Dar|Arrojar|Pasar)/.test(b.textContent));assert.equal(button.disabled,true);assert.match(row.textContent,/lejos|alcance|distancia/i);
 const schema=m.registrations.find(t=>t.name==='issue_granaderos_tactical_order').inputSchema;assert.ok(schema.properties.type.enum.includes('transfer'));const before=m.read(),key=Object.keys(before.battle.units.find(u=>u.id==='110').inventory).find(key=>before.battle.units.find(u=>u.id==='110').inventory[key].weapon);await act(async()=>assert.throws(()=>m.issue({type:'transfer',unitId:'110',targetId:'111',inventoryKey:key}),/debe estar al lado/));assert.deepEqual(m.read().battle.units,before.battle.units);
});
