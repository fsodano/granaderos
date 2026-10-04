import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {AMMO_TYPES,ammoCount,changeAmmo} from '../game/ammo-types.js';
import {syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';

test('the isolated ammunition widget keeps finite stored ownership while public purchase stays closed',async t=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;d.rules.cartridgePrice=3;
 const initial=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});
 // A finite bundle already held in this subsystem save; no purchase is made.
 changeAmmo(initial.operativeState[110],'ammoPistol',10);syncCarriedAmmunition(initial.operativeState[110],1800);
 const m=await mountLegacyArmory(t,saved({campaign:initial})),panel=()=>m.document.querySelector('[aria-label="Munición y depósito"]');assert.ok(panel());
 const family=panel().querySelector('select');Object.getOwnPropertyDescriptor(m.dom.window.HTMLSelectElement.prototype,'value').set.call(family,'ammoPistol');await act(async()=>family.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));
 assert.equal(panel().querySelector('img').getAttribute('src'),AMMO_TYPES.ammoPistol.art);const before=m.saved().campaign;
 assert.equal(panel().querySelector('button').disabled,true);await m.click('Comprar · 30 pesos');assert.deepEqual(m.saved().campaign,before);const rejected=dispatchCampaign(before,{type:'ammunition',operativeId:110,family:'ammoPistol',quantity:10,direction:'buy'});assert.match(rejected.lastError,/comercio de equipo no está disponible/);assert.deepEqual({...rejected,lastError:null},before);
 await m.click('Guardar en este sector');let s=m.saved().campaign;assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),0);assert.equal(s.ammunitionStores.retiro.ammoPistol,10);assert.equal(s.resources.treasury,before.resources.treasury);assert.match(panel().textContent,/10 guardados/);
 await m.click('Retirar del depósito');s=m.saved().campaign;assert.equal(ammoCount(s.operativeState[110],'ammoPistol'),10);assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),9);assert.equal(s.ammunitionStores.retiro.ammoPistol,0);assert.equal(s.resources.treasury,before.resources.treasury);assert.deepEqual(saved({campaign:s}).campaign,s);
 assert.equal([...panel().querySelectorAll('button')].find(b=>b.textContent==='Retirar del depósito').disabled,true);assert.deepEqual(s.ammunitionShops,before.ammunitionShops);
});
