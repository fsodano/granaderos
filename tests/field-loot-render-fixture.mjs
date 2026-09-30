import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {tacticalGridLabel} from '../game/tactical-grid.js';
import {playerKnownBattle,playerKnownCampaign} from '../game/player-known-state.js';

export function savedField(m){
 const state=m.saved(),view=m.read();
 assert.deepEqual(view.battle,playerKnownBattle(state.battle));
 assert.deepEqual(view.campaign,playerKnownCampaign(state.campaign));
 return state;
}
export async function collectFieldItem(m,point,name){
 const proto=m.dom.window.HTMLDialogElement.prototype;
 if(!proto.showModal){proto.showModal=function(){this.setAttribute('open','');};proto.close=function(){this.removeAttribute('open');};}
 const marker=m.document.querySelector(`[data-ground-equipment][aria-label^="Equipo en ${tacticalGridLabel(point.x,point.y)} ·"]`)??(point.id?m.document.querySelector(`[data-unit-id="${point.id}"] [data-person-hit-target]`):null);
 assert.ok(marker,'visible equipment or body marker');
 await act(async()=>marker.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 await m.click('Limpiar selección');
 const checkbox=[...m.document.querySelectorAll('.ja2-loot-choice input')].find(e=>e.getAttribute('aria-label').endsWith(` · ${name}`));
 assert.ok(checkbox,`visible item ${name}: ${[...m.document.querySelectorAll('.ja2-loot-choice input')].map(e=>e.getAttribute('aria-label')).join('; ')}`);
 await act(async()=>checkbox.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 const take=m.document.querySelector('.ja2-loot-dialog .gold-button');assert.ok(take);assert.equal(take.disabled,false,take.closest('dialog').textContent);
 await m.click('Recoger selección');
 return savedField(m);
}
