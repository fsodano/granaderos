import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {homeDepotGun} from './artillery-depot-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';

test('the mounted depot sends its actual stored gun back to the front and saves one finite shipment',async t=>{
 const m=await mountCampaign(t,visit(homeDepotGun()));await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const before=m.saved().campaign,gun=before.artilleryDepots.retiro[0],panel=m.document.querySelector(`[data-stored-artillery-id="${gun.id}"]`);assert.match(panel.textContent,/Descargada · 6 en reserva/);assert.match(panel.textContent,/18 horas · 0 pesos/);const selects=panel.querySelectorAll('select');assert.equal(selects[0].value,'buenos_aires');assert.equal(selects[1].value,'carts');const button=panel.querySelector('button');assert.equal(button.disabled,false);await m.click('Enviar pieza');assert.equal(m.document.querySelector(`[data-stored-artillery-id="${gun.id}"]`),null);
 const next=saved({campaign:m.saved().campaign}).campaign;assert.deepEqual(next.artilleryDepots.retiro,[]);assert.equal(next.artilleryTransfers.length,1);assert.equal(next.artilleryTransfers[0].from,'retiro');assert.equal(next.artilleryTransfers[0].to,'buenos_aires');assert.equal(next.resources.treasury,before.resources.treasury);for(const key of ['id','type','ammo','loaded','reloadProgress','facing'])assert.deepEqual(next.artilleryTransfers[0].gun[key],gun[key]);assert.match(m.document.querySelector('[aria-label="Artillería en tránsito"]').textContent,/Retiro.*Buenos Aires/);
 await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.equal(m.saved().campaign.artilleryTransfers.length,1);
});
