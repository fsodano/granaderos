import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {emptyBattery,reloadPiece} from './artillery-supply-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
test('mounted armory buys exactly one round for an actually depleted gun and the saved field crew loads it',async t=>{
 const m=await mountCampaign(t,visit(emptyBattery()));await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');assert.ok(summary);await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const before=m.saved().campaign,gun=before.sectorStates.san_nicolas.artillery[0],panel=()=>m.document.querySelector(`[data-artillery-id="${gun.id}"]`);assert.match(panel().textContent,/Descargada · 0 en reserva/);assert.equal(panel().querySelector('button').disabled,false);await m.click('Comprar 1 munición');const next=m.saved().campaign;assert.equal(next.resources.treasury,before.resources.treasury-10);assert.equal(next.sectorStates.san_nicolas.artillery[0].loaded,false);assert.equal(next.sectorStates.san_nicolas.artillery[0].ammo,1);assert.match(panel().textContent,/Descargada · 1 en reserva/);
 const p=reloadPiece(visit(saved({campaign:next}).campaign));assert.equal(p.battle.artillery[0].id,gun.id);assert.equal(p.battle.artillery[0].loaded,true);assert.equal(p.battle.artillery[0].ammo,0);
});
test('the mounted supply control displays retained loading work and does not complete it when adding reserve',async t=>{
 // Prepared work fraction isolates the supply control from earned combat work,
 // which has its own actual-AP/full-save coverage in artillery crew loading.
 const s=emptyBattery();s.sectorStates.san_nicolas.artillery[0].reloadProgress=.4;const m=await mountCampaign(t,visit(saved({campaign:s}).campaign));await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const panel=m.document.querySelector('[data-artillery-id]');assert.match(panel.textContent,/Recarga 40% · 0 en reserva/);await m.click('Comprar 1 munición');const gun=m.saved().campaign.sectorStates.san_nicolas.artillery[0];assert.equal(gun.reloadProgress,.4);assert.equal(gun.loaded,false);assert.equal(gun.ammo,1);assert.match(panel.textContent,/Recarga 40% · 1 en reserva/);
});
