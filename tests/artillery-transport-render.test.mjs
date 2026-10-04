import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {depotSelection} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
const choose=async(m,e,value)=>{assert.ok(e);Object.getOwnPropertyDescriptor(m.dom.window.HTMLSelectElement.prototype,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));};

test('isolated retained armory sends one actual fired gun, rejects unavailable transport and displays finite saved cargo',async t=>{
 const m=await mountLegacyArmory(t,visit(fieldGun()));const before=m.saved().campaign,gun=before.sectorStates.san_nicolas.artillery[0],panel=m.document.querySelector(`[data-artillery-id="${gun.id}"]`),selects=panel.querySelectorAll('fieldset select'),send=panel.querySelector('fieldset button');
 await choose(m,selects[0],'buenos_aires');await choose(m,selects[1],'flotilla');assert.equal(send.disabled,true);assert.match(panel.textContent,/Primero organizá ese transporte/);await m.click('Enviar pieza');assert.deepEqual(m.saved().campaign,before);
 await choose(m,selects[1],'carts');assert.equal(send.disabled,false);assert.match(panel.textContent,/18 horas · 0 pesos · 1 combatiente para cargar/);await m.click('Enviar pieza');assert.equal(m.document.querySelector(`[data-artillery-id="${gun.id}"]`),null);
 const transfer=m.document.querySelector(`[data-artillery-transfer-id="${gun.id}"]`);assert.ok(transfer);assert.match(transfer.textContent,/San Nicolás.*Buenos Aires.*Carretas/);assert.match(transfer.textContent,new RegExp(`Descargada · ${gun.ammo} en reserva.*Llegada en 18 horas`));
 const after=saved({campaign:m.saved().campaign}).campaign;assert.equal(after.artilleryTransfers.length,1);assert.equal(after.resources.treasury,before.resources.treasury);assert.equal(after.hour,before.hour);assert.deepEqual(after.sectorStates.san_nicolas.artillery,[]);assert.equal(after.artilleryTransfers[0].gun.id,gun.id);assert.equal(after.artilleryTransfers[0].gun.ammo,gun.ammo);assert.equal(after.artilleryTransfers[0].gun.loaded,false);
 // A detached stale control cannot dispatch a second piece.
 await act(async()=>send.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));assert.equal(m.saved().campaign.artilleryTransfers.length,1);
});

test('mounted local depot preserves declared unfinished loading and selects its exact gun for a real attack',async t=>{
 let s=fieldGun();s.sectorStates.san_nicolas.artillery[0].reloadProgress=.4;const gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]),token=depotSelection(gun);
 s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'buenos_aires',mode:'carts'});s=order(s,{type:'wait',hours:18});s=order(s,{type:'travel',sector:'buenos_aires'});const m=await mountLegacyArmory(t,visit(saved({campaign:s}).campaign));
 const depot=m.document.querySelector('[aria-label="Depósito local de artillería"]');assert.ok(depot);assert.match(depot.textContent,new RegExp(`Recarga 40% · ${gun.ammo} en reserva`));assert.equal(m.document.querySelector('#battery-0').value,token);
 await choose(m,m.document.querySelector('#battery-1'),token);const prepare=()=>[...m.document.querySelectorAll('button')].find(b=>b.textContent==='Preparar batería');assert.equal(prepare().disabled,true);assert.match(m.document.querySelector('.armory-loadout').textContent,/solo puede ocupar un lugar/);
 await choose(m,m.document.querySelector('#battery-1'),'');await m.click('Preparar batería');const selected=saved({campaign:m.saved().campaign}).campaign;assert.deepEqual(selected.artillerySelection,[token]);assert.equal(selected.artilleryDepots.buenos_aires.length,1);
 s=order(selected,{type:'attack',sector:'ensenada'});assert.deepEqual(s.artilleryDepots.buenos_aires,[]);const p=saved({campaign:s,battle:enterSector(s.pendingBattle)});for(const key of ['id','type','side','loaded','ammo','reloadProgress','facing'])assert.deepEqual(p.battle.artillery[0][key],gun[key],key);
});

test('the isolated retained armory quotes the authored transport duration and charges its displayed fee exactly once',async t=>{
 const {defaultContentPackage}=await import('../game/content-package.js'),{DEFAULT_ARTILLERY_TRANSPORT}=await import('../game/artillery-transport-rules.js');const d=defaultContentPackage();d.artilleryTransport={...DEFAULT_ARTILLERY_TRANSPORT,cartsHours:3,cartsFee:37};const m=await mountLegacyArmory(t,visit(fieldGun(d)));
 const before=m.saved().campaign,panel=m.document.querySelector('[data-artillery-id]');await choose(m,panel.querySelector('fieldset select'),'buenos_aires');assert.match(panel.textContent,/3 horas · 37 pesos · 1 combatiente/);await m.click('Enviar pieza');const next=m.saved().campaign;assert.equal(next.resources.treasury,before.resources.treasury-37);assert.equal(next.artilleryTransfers[0].dueAt,before.hour+3);assert.match(m.document.querySelector('[aria-label="Artillería en tránsito"]').textContent,/Llegada en 3 horas/);
});

test('the mounted fee rejection keeps the actual gun in place and spends no money',async t=>{
 const {defaultContentPackage}=await import('../game/content-package.js'),{DEFAULT_ARTILLERY_TRANSPORT}=await import('../game/artillery-transport-rules.js');const d=defaultContentPackage();d.artilleryTransport={...DEFAULT_ARTILLERY_TRANSPORT,cartsFee:1000000};const m=await mountLegacyArmory(t,visit(fieldGun(d)));
 const before=m.saved().campaign,panel=m.document.querySelector('[data-artillery-id]');await choose(m,panel.querySelector('fieldset select'),'buenos_aires');assert.equal(panel.querySelector('fieldset button').disabled,true);assert.match(panel.textContent,/No hay suficientes pesos para enviar la pieza/);await m.click('Enviar pieza');assert.deepEqual(m.saved().campaign,before);
});
