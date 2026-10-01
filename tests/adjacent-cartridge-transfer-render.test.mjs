import {selectPocket} from './pocket-render-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {secondaryLootField} from './secondary-loot-fixture.mjs';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';
const change=async(m,e,value)=>{const proto=e.tagName==='SELECT'?m.dom.window.HTMLSelectElement.prototype:m.dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,String(value));await act(async()=>e.dispatchEvent(new m.dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));};

test('the production supply selector hands over loose cartridges and saves both reserves without changing either loaded gun',async t=>{
 const p=secondaryLootField({companion:true,sameFirearm:true}),m=await mountCampaign(t,p);await m.click('Equipo');await selectPocket(m,'Cartuchos');await change(m,m.document.querySelector('[aria-label="Cantidad de objetos"]'),9);await change(m,m.document.querySelector('[aria-label="Aliado que recibe el equipo"]'),'111');const buttons=[...m.document.querySelectorAll('button')],give=buttons.find(b=>b.textContent.match(/^(Dar o arrojar|Dar al aliado|Arrojar al aliado|Pasar por aliados)/)),drop=buttons.find(b=>b.textContent.startsWith('Soltar aquí'));assert.equal(give.disabled,false);assert.equal(drop.disabled,false);await act(async()=>give.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const s=m.read(),source=s.battle.units.find(u=>u.id==='110'),target=s.battle.units.find(u=>u.id==='111');assert.equal(source.ammo,0);assert.equal(target.ammo,18);assert.equal(source.loaded,1);assert.equal(target.loaded,1);const stored=m.saved();assert.deepEqual(playerKnownBattle(stored.battle),s.battle);assert.deepEqual(playerKnownCampaign(stored.campaign),s.campaign);assert.equal(give.disabled,true);
});
