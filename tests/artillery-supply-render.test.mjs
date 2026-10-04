import test from 'node:test';import assert from 'node:assert/strict';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {emptyBattery} from './artillery-supply-fixture.mjs';
import {saved} from './local-contract-fixture.mjs';

test('an isolated old ammunition purchase cannot refill an actually depleted saved gun or spend money',async t=>{
 const m=await mountLegacyArmory(t,saved({campaign:emptyBattery()})),before=m.saved().campaign,gun=before.sectorStates.san_nicolas.artillery[0],panel=m.document.querySelector(`[data-artillery-id="${gun.id}"]`);
 assert.match(panel.textContent,/Descargada · 0 en reserva/);await m.click('Comprar 1 munición');assert.match(m.read().campaign.lastError,/comercio de equipo no está disponible/);assert.deepEqual(m.saved().campaign,before);assert.match(m.document.querySelector(`[data-artillery-id="${gun.id}"]`).textContent,/Descargada · 0 en reserva/);
});
test('the blocked isolated supply callback preserves saved unfinished loading exactly',async t=>{
 const s=emptyBattery();s.sectorStates.san_nicolas.artillery[0].reloadProgress=.4;const m=await mountLegacyArmory(t,saved({campaign:s})),before=m.saved().campaign;
 assert.match(m.document.querySelector('[data-artillery-id]').textContent,/Recarga 40% · 0 en reserva/);await m.click('Comprar 1 munición');assert.match(m.read().campaign.lastError,/comercio de equipo no está disponible/);assert.deepEqual(m.saved().campaign,before);
});
