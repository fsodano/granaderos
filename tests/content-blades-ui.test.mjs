import {usePocket} from './pocket-render-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';

test('the mounted inventory shows the authored secondary picture, changes hands and preserves the active save',async t=>{
 const d=defaultContentPackage(),blade=d.weapons.find(w=>w.id==='blade-1811');Object.assign(blade,{name:'Bayoneta azul',art:'/art/weapon-1810.png',ap:21,damage:31,reach:2.3});d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let campaign=initialCampaign(8,d);for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'visitSector'}]){campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);}
 const m=await mountCampaign(t,{campaign,battle:enterSector(campaign.pendingBattle)});
 await m.click('Equipo');
 const slot=[...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes('Bayoneta azul'));assert.ok(slot);assert.match(slot.textContent,/Bayoneta azul/);assert.equal(slot.querySelector('img').getAttribute('src'),'/art/weapon-1810.png');
 await usePocket(m,'Bayoneta azul');assert.match(m.document.querySelector('[aria-label="Calar bayoneta"]').textContent,/21 PA/);const current=m.read();assert.equal(current.battle.units.find(u=>u.id==='110').activeSlot,'blade');assert.equal(current.battle.units.find(u=>u.id==='110').bladeMetadata.contentWeapon.ap,21);assert.deepEqual(m.saved(),{campaign:current.campaign,battle:current.battle});
});
