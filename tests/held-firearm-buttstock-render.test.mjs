import {usePocket} from './pocket-render-fixture.mjs';
import {weaponSpecification} from '../game/weapon-definition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {buttstockField} from './buttstock-fixture.mjs';
import {weaponRecord} from '../game/weapon-definition.js';

test('the ordinary stock control attacks the selected live enemy and saves the actual firearm, then shows the selected hand action',async t=>{
 const p=buttstockField(),u=p.battle.units.find(u=>u.id==='110'),target=p.battle.units.find(u=>u.id===p.target),record=weaponRecord(u),m=await mountCampaign(t,p);
 const key=async key=>act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key,bubbles:true})));
 await key('b');assert.equal(m.read().battle.units.find(u=>u.id==='110').weaponMode,'melee');
 const enemy=m.document.querySelector(`[data-unit-id="${p.target}"] [data-person-hit-target]`);assert.ok(enemy);await act(async()=>enemy.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 let s=m.saved();assert.equal(s.battle.lastError,null);assert.equal(s.battle.units.find(u=>u.id==='110').ap,u.ap-16);assert.ok(s.battle.units.find(u=>u.id===p.target).hp<target.hp);assert.deepEqual(weaponRecord(s.battle.units.find(u=>u.id==='110')),record);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
 await m.click('Equipo');const gun=m.document.querySelector('.ja2-inventory .ja2-hands [aria-label^="Mano principal:"]');assert.match(gun.textContent,/Fusil de Acosta/);assert.equal(gun.querySelector('img').getAttribute('src'),'/art/weapon-1801.png');
 await m.click('Listo');for(let i=0;i<12&&m.saved().battle.units.find(u=>u.id==='110').activeSlot!=='unarmed';i++)await key('w');assert.equal(m.saved().battle.units.find(u=>u.id==='110').activeSlot,'unarmed');await m.click('Equipo');
 await usePocket(m,weaponSpecification(u,'blade').name);assert.equal(m.read().battle.units.find(u=>u.id==='110').activeSlot,'blade');
 await usePocket(m,record.contentWeapon.name);await m.click('Listo');if(m.saved().battle.units.find(u=>u.id==='110').weaponMode!=='melee')await key('b');assert.equal(m.read().battle.units.find(u=>u.id==='110').weaponMode,'melee');s=m.saved();assert.deepEqual(weaponRecord(s.battle.units.find(u=>u.id==='110')),record);assert.deepEqual(m.saved(),{campaign:s.campaign,battle:s.battle});
});
