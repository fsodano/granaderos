import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {deployedArtillery} from '../game/equipment.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {enterSector} from '../game/world.js';
const choose=async(m,index,value)=>{const e=m.document.querySelector(`#battery-${index}`);assert.ok(e);Object.getOwnPropertyDescriptor(m.dom.window.HTMLSelectElement.prototype,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new m.dom.window.Event('change',{bubbles:true})));};
const openEquipment=async m=>{const summary=[...m.document.querySelectorAll('summary')].find(s=>s.textContent==='Comprar armas y revisar equipo');assert.ok(summary);await act(async()=>summary.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));};

test('mounted armory shows actual automatic stock, saves no-gun choice and rejects unavailable model quantities',async t=>{
 let s=order(initialCampaign(42,defaultContentPackage()),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'purchaseEquipment',item:'swivel'});const m=await mountCampaign(t,visit(s));await m.click('Volver a la campaña');await m.click('Escritorio');await m.click('Tesorería');await openEquipment(m);
 assert.equal(m.document.querySelector('#battery-0').value,'swivel');const before=m.saved().campaign;
 await choose(m,0,'');await m.click('Preparar batería');const empty=m.saved().campaign;assert.equal(empty.artillerySelectionExplicit,true);assert.deepEqual(deployedArtillery(empty),[]);assert.equal(empty.resources.treasury,before.resources.treasury);assert.deepEqual(empty.armory,before.armory);
 await m.click('Resumen');await m.click('Tesorería');await openEquipment(m);assert.equal(m.document.querySelector('#battery-0').value,'');
 await choose(m,0,'field8');const prepare=()=>[...m.document.querySelectorAll('button')].find(b=>b.textContent==='Preparar batería');assert.equal(prepare().disabled,true);assert.match(m.document.querySelector('.armory-loadout').textContent,/No disponés de tantas piezas/);await m.click('Preparar batería');assert.deepEqual(m.saved().campaign,empty);
 await choose(m,0,'swivel');await choose(m,1,'swivel');assert.equal(prepare().disabled,true);await choose(m,1,'');assert.equal(prepare().disabled,false);await m.click('Preparar batería');const selected=m.saved().campaign;assert.deepEqual(selected.artillerySelection,['swivel']);assert.deepEqual(selected.armory,empty.armory);assert.equal(selected.resources.treasury,empty.resources.treasury);
 s=order(saved({campaign:selected}).campaign,{type:'attack',sector:'buenos_aires'});const battle=enterSector(s.pendingBattle);assert.deepEqual(saved({campaign:s,battle}).battle.artillery.map(g=>g.type),['swivel']);
});
