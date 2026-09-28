import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {readyLocal} from './local-contract-fixture.mjs';
import {releasePackage} from './meeting-release-fixture.mjs';
import {mountCampaign as mount} from './mounted-campaign-fixture.mjs';
const pair=s=>({campaign:s.campaign,battle:s.battle});

test('the mounted conversation finishes a meeting, frees the guest and saves one quest reward after a double click',async t=>{
 const m=await mount(t,readyLocal(undefined,releasePackage())),open=async()=>{const npc=m.document.querySelector('[data-unit-id="authored-alma-contract"]');await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');};
 await open();const cash=m.read().campaign.resources.treasury;await m.click('Contame sobre el norte.');await m.click('Cerrar conversación');await act(async()=>m.issue({type:'rest'}));await open();assert.match(m.document.querySelector('[aria-label="Conversación"]').textContent,/Pablo retoma su rutina/);
 const button=[...m.document.querySelectorAll('[aria-label="Conversación"] button')].find(b=>b.textContent.startsWith('Ya estamos reunidos.'));assert.ok(button);await act(async()=>{button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));});
 const p=m.read();assert.equal(p.battle.npcs.find(n=>n.contentId==='pablo').scriptedMove,undefined);assert.equal(p.campaign.dialogueMovements.length,2);assert.equal(p.campaign.dialogueMovements.at(-1).target,null);assert.equal(p.campaign.contentQuestEvents.at(-1).to,'completed');assert.equal(p.campaign.resources.treasury,cash+100);assert.match(m.document.querySelector('[aria-label="Conversación"]').textContent,/Pablo queda libre para retomar su rutina/);assert.deepEqual(m.saved(),pair(p));
});
