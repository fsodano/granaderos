import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {readyLocal} from './local-contract-fixture.mjs';
import {mountCampaign as mount} from './mounted-campaign-fixture.mjs';
const pair=s=>({campaign:s.campaign,battle:s.battle});

test('the mounted meeting conversation waits for the guest before completing and saving its quest reward',async t=>{
 const {arrivalPackage}=await import('./meeting-arrival-fixture.mjs');const m=await mount(t,readyLocal(undefined,arrivalPackage()));
 const open=async()=>{const npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');};await open();const cash=m.read().campaign.resources.treasury;await m.click('Contame sobre el norte.');assert.ok(![...m.document.querySelectorAll('[aria-label="Conversación"] button')].some(b=>b.textContent.startsWith('Ya estamos reunidos.')));assert.equal(m.read().campaign.contentQuestEvents.at(-1).to,'active');await m.click('Cerrar conversación');
 await act(async()=>m.issue({type:'rest'}));await open();await m.click('Ya estamos reunidos.');assert.equal(m.read().campaign.contentQuestEvents.at(-1).to,'completed');assert.equal(m.read().campaign.resources.treasury,cash+100);assert.deepEqual(m.saved(),pair(m.read()));
});
