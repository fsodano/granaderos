import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
export async function selectPocket(m,name){
 const cell=[...m.document.querySelectorAll('.ja2-pocket,.ja2-hands button')].find(e=>e.textContent.includes(name));
 assert.ok(cell,`Pocket containing ${name}`);
 await act(async()=>cell.dispatchEvent(new m.dom.window.MouseEvent('contextmenu',{bubbles:true,button:2})));
 return m.document.querySelector('.pertrechos.ja2-inventory-extra .ja2-inventory-popup');
}
export async function usePocket(m,name){
 const details=await selectPocket(m,name),button=[...details.querySelectorAll('button')].find(b=>/^(Poner .* en mano|Poner en mano principal|Equipar principal)/.test(b.textContent));
 assert.ok(button,details.textContent);assert.equal(button.disabled,false);
 await act(async()=>button.dispatchEvent(new m.dom.window.MouseEvent('click',{bubbles:true})));
 await selectPocket(m,name);
}
