import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {selectPocket} from './pocket-render-fixture.mjs';
import {personalPockets} from '../game/personal-pockets.js';
test('ordinary pocket controls move a supply stack and save its physical position without duplicating the contents',async t=>{
 const p=supplyCareField(),m=await mountCampaign(t,p);await m.click('Equipo y órdenes');
 assert.equal(m.document.querySelectorAll('.pocket-cell.large').length,4);assert.equal(m.document.querySelectorAll('.pocket-cell.small').length,8);
 await selectPocket(m,'Vendas');await m.click('Mover a otro bolsillo');
 const destination=m.document.querySelector('[aria-label="Bolsillo grande 4: vacío"]');assert.ok(destination);
 await act(async()=>destination.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const s=m.read(),u=s.battle.units.find(u=>u.id==='110');assert.equal(u.medkits,4);assert.equal(personalPockets(u).slots.find(p=>p.id==='large-4').entry.item,'medkits');assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Listo');await m.click('Equipo y órdenes');assert.ok(m.document.querySelector('[aria-label="Bolsillo grande 4: Vendas · 4"]'));
});
