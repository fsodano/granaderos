import test from 'node:test';import assert from 'node:assert/strict';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {combatMilitia,militiaReaction} from './militia-combat-fixture.mjs';
import {DEFAULT_MILITIA_PROGRESSION} from '../game/militia-progression-rules.js';
import {visit} from './local-contract-fixture.mjs';

test('the production campaign shows pinned thresholds and the actual unpromoted survivor after saved combat',async t=>{
 let {s,id}=combatMilitia(d=>d.militiaProgression={...DEFAULT_MILITIA_PROGRESSION,regularThreshold:4,veteranThreshold:7});({s}=militiaReaction(s,id));const m=await mountCampaign(t,visit(s));await m.click('Volver a la campaña');const panel=m.document.querySelector('.simple-militia');assert.match(panel.textContent,/3 cívicos · 0 montoneros · 0 veteranos/);assert.match(panel.textContent,/Montonero: 4 puntos · Veterano: 7 puntos/);await m.click('Organizar escuadras');const health=m.document.querySelector('[aria-label="Salud de la guarnición"]');assert.match(health.textContent,/Cívico · 3 puntos de combate/);assert.match(health.textContent,/44\/60 salud/);const current=m.saved().campaign;assert.equal(current.garrisons.retiro.find(u=>u.id===id).militiaRank,0);assert.equal(current.contentCampaign.package.militiaProgression.veteranThreshold,7);
});
