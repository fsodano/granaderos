import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';

test('isolated retained armory shows the actual fired emplacement separately from unissued battery stock',async t=>{
 const p=fireStationed(visit(wonBattery())),gun=structuredClone(p.battle.artillery[0]),m=await mountLegacyArmory(t,p);

 const panel=m.document.querySelector('[aria-label="Artillería emplazada"]');assert.ok(panel);assert.match(panel.textContent,/Pedrero de regala · Descargada · 6 en reserva · Propia/);assert.equal(m.document.querySelector('#battery-0').value,'');
 const before=m.saved().campaign;assert.equal(ownedArtilleryCount(before),1);await m.click('Preparar batería');const next=saved({campaign:m.saved().campaign}).campaign;assert.deepEqual(next.artillerySelection,[]);assert.equal(next.armory.swivel,0);assert.equal(next.resources.treasury,before.resources.treasury);
 for(const key of ['id','type','x','y','loaded','ammo','facing'])assert.deepEqual(next.sectorStates.san_nicolas.artillery[0][key],gun[key],key);
 const returned=visit(next);assert.equal(returned.battle.artillery.length,1);assert.equal(returned.battle.artillery[0].ammo,6);assert.equal(returned.battle.artillery[0].loaded,false);
});
