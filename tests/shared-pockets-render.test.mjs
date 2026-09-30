import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {selectPocket} from './pocket-render-fixture.mjs';
import {personalPockets} from '../game/personal-pockets.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
test('ordinary pocket controls move a supply stack and save its physical position without duplicating the contents',async t=>{
 const p=supplyCareField(),m=await mountCampaign(t,p);await m.click('Equipo');
 assert.equal(m.document.querySelectorAll('.ja2-pocket-row.large .ja2-pocket').length,4);assert.equal(m.document.querySelectorAll('.ja2-pocket-row.small .ja2-pocket').length,8);
 const source=[...m.document.querySelectorAll('.ja2-pocket')].find(e=>e.textContent.includes('Vendas'));assert.ok(source);
 await act(async()=>source.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true,shiftKey:true})));
 const destination=m.document.querySelector('[aria-label="Bolsillo grande 4: vacío"]');assert.ok(destination);
 await act(async()=>destination.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const s=m.read(),u=s.battle.units.find(u=>u.id==='110');assert.equal(u.medkits,4);assert.equal(personalPockets(u).slots.find(p=>p.id==='large-4').entry.item,'medkits');const saved=m.saved();assert.deepEqual(playerKnownBattle(saved.battle),s.battle);assert.deepEqual(playerKnownCampaign(saved.campaign),s.campaign);
 await m.click('Listo');await m.click('Equipo');assert.ok(m.document.querySelector('[aria-label="Bolsillo grande 4: Vendas · 4"]'));
});
