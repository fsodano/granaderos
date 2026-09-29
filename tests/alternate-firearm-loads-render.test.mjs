import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {ammoCount} from '../game/ammo-types.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {order,visit} from './local-contract-fixture.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
const pair=()=>{const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'ammunition',operativeId:110,family:'ammoShot',quantity:3,direction:'buy'});return visit(s);};
const choose=async(m,family)=>act(async()=>{const select=m.document.querySelector('[aria-label="Carga para esta arma"]');select.value=family;select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});

test('mounted armory unloads, selects a new load and saves the selected family for departure',async t=>{
 const m=await mountCampaign(t,pair());await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);await m.click('Descargar arma');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,false);await choose(m,'ammoShot');const s=m.saved().campaign;assert.equal(s.operativeState[110].ammunitionChoice,'ammoShot');assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),10);assert.equal(ammoCount(s.operativeState[110],'ammoShot'),3);assert.equal(s.operativeState[110].carriedLoaded,0);
});

test('mounted tactical inventory unloads and selects shot through the actual controls and registered reload',async t=>{
 const m=await mountCampaign(t,pair());await m.click('Equipo y órdenes');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);await m.click('Descargar arma');await choose(m,'ammoShot');await act(async()=>m.issue({type:'reload',unitId:'110'}));const u=m.saved().battle.units.find(u=>u.id==='110');assert.equal(u.ammunitionChoice,'ammoShot');assert.equal(u.loaded,1);assert.equal(ammoCount(u,'ammoShot'),2);assert.equal(ammoCount(u,'ammoMusket'),10);assert.equal(weaponSpecification(u).loadPattern,'cone');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);
});
