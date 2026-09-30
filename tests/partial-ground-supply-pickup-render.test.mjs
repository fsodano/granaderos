import {fillSparePockets} from './pocket-capacity-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {supplyCareField} from './supply-transfer-fixture.mjs';
import {tactical,saved} from './local-contract-fixture.mjs';
import {openFieldEquipment,selectFieldItem,savedField} from './field-loot-render-fixture.mjs';
async function openPicker(m,p,recipient='111'){
 const who=p.battle.units.find(u=>u.id===recipient),button=[...m.document.querySelectorAll('.ja2-roster button')].find(b=>b.getAttribute('aria-label')?.includes(who.name));assert.ok(button);
 await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 return openFieldEquipment(m,p.battle.groundItems.find(g=>g.type==='medkits'));
}
function supplies(){let p=supplyCareField();p=tactical(p,{type:'dropSupply',unitId:'110',item:'medkits',count:3});return tactical(p,{type:'dropSupply',unitId:'110',item:'rations',count:2});}

test('the real ground selector chooses among colocated bundles, collects the requested quantity and saves the untouched remainder',async t=>{
 const p=supplies(),m=await mountCampaign(t,p),ration=p.battle.groundItems.find(g=>g.type==='rations'),vendas=p.battle.groundItems.find(g=>g.type==='medkits');
 await openPicker(m,p);assert.equal(m.document.querySelectorAll('.ja2-loot-choice input').length,2);await selectFieldItem(m,'Raciones');await m.click('Recoger selección');
 const s=savedField(m);assert.equal(s.battle.groundItems.find(g=>g.id===ration.id).count,1);assert.equal(s.battle.groundItems.find(g=>g.id===vendas.id).count,3);assert.equal(s.battle.units.find(u=>u.id==='111').rations,3);assert.equal(m.document.querySelector('.ja2-loot-dialog'),null);
});
test('opening the ground selector pauses the ordinary exploration clock and cancel or close spends nothing',async t=>{
 const p=supplies(),m=await mountCampaign(t,p);await m.click('Reanudar');await openPicker(m,p);const before=savedField(m);
 await act(async()=>new Promise(resolve=>setTimeout(resolve,6250)));assert.deepEqual(savedField(m).battle,before.battle);
 const first=m.document.querySelector('.ja2-loot-choice input');assert.equal(m.document.activeElement,first);
 // Browsers dispatch cancel on a modal dialog when Escape is pressed.
 await act(async()=>m.document.querySelector('.ja2-loot-dialog').dispatchEvent(new m.dom.window.Event('cancel',{bubbles:false,cancelable:true})));
 assert.equal(m.document.querySelector('.ja2-loot-dialog'),null);assert.deepEqual(savedField(m).battle,before.battle);await m.click('Pausar');await openPicker(m,p);await m.click('Cerrar equipo');assert.deepEqual(savedField(m).battle,before.battle);
});
test('the ground selector explains an overflowing whole bundle and accepts only the reduced exact quantity',async t=>{
 let p=supplyCareField();const recipient=p.battle.units.find(u=>u.id==='111');recipient.medkits=4;fillSparePockets(recipient);p=saved(p);p=tactical(p,{type:'dropSupply',unitId:'110',item:'medkits',count:3});const m=await mountCampaign(t,p);
 const dialog=await openPicker(m,p);await m.click('Seleccionar todos');const button=dialog.querySelector('.gold-button');assert.equal(button.disabled,true);assert.match(dialog.textContent,/bolsillo|espacio/);
 const before=savedField(m);await selectFieldItem(m,'Vendas',1);assert.equal(button.disabled,false);assert.deepEqual(savedField(m),before);await m.click('Recoger selección');
 const s=savedField(m);assert.equal(s.battle.units.find(u=>u.id==='111').medkits,5);assert.equal(s.battle.groundItems.find(g=>g.type==='medkits').count,2);
});
