import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
export async function selectPocket(m,name){
 const cell=[...m.document.querySelectorAll('.pocket-cell')].find(e=>e.textContent.includes(name));
 assert.ok(cell,`Pocket containing ${name}`);
 await act(async()=>cell.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 return m.document.querySelector('.pocket-details');
}
export async function usePocket(m,name){
 const details=await selectPocket(m,name),button=[...details.querySelectorAll('button')].find(b=>b.textContent.startsWith('Usar en la mano'));
 assert.ok(button);assert.equal(button.disabled,false);
 await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
}
