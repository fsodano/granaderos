import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {readyLocal} from './local-contract-fixture.mjs';
import {releasePackage} from './meeting-release-fixture.mjs';
import {mountCampaign as mount} from './mounted-campaign-fixture.mjs';
import {playerKnownCampaign,playerKnownBattle} from '../game/player-known-state.js';

test('the mounted conversation finishes a meeting, frees the guest and saves one quest reward after a double click',async t=>{
 const m=await mount(t,readyLocal(undefined,releasePackage())),open=async()=>{await act(async()=>m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'j',bubbles:true})));const npc=m.document.querySelector('[data-unit-id="authored-alma-contract"] [data-person-hit-target]');assert.ok(npc);await act(async()=>npc.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));await m.click('Conversar');};
 await open();const cash=m.read().campaign.resources.treasury;await m.click('Contame sobre el norte.');await m.click('Listo');await act(async()=>m.issue({type:'rest'}));await open();assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con "]').textContent,/Pablo retoma su rutina/);
 const button=[...m.document.querySelectorAll('[role="dialog"][aria-label^="Conversación con "] button')].find(b=>b.textContent.startsWith('Ya estamos reunidos.'));assert.ok(button);await act(async()=>{button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true}));});
 const p=m.saved();assert.equal(p.battle.npcs.find(n=>n.contentId==='pablo').scriptedMove,undefined);assert.equal(p.campaign.dialogueMovements.length,2);assert.equal(p.campaign.dialogueMovements.at(-1).target,null);assert.equal(p.campaign.contentQuestEvents.at(-1).to,'completed');assert.equal(p.campaign.resources.treasury,cash+100);assert.match(m.document.querySelector('[role="dialog"][aria-label^="Conversación con "]').textContent,/Pablo queda libre para retomar su rutina/);assert.deepEqual(playerKnownCampaign(p.campaign),m.read().campaign);assert.deepEqual(playerKnownBattle(p.battle),m.read().battle);
});
