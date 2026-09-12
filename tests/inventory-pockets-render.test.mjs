import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {inventoryUsage,applyItemQuantity} from '../game/tactical-inventory.js';
const {default:Pockets}=await import('../web/app/JA2Pockets.tsx');
const unit=()=>({id:'p',ammo:25,inventory:{rifle:{weapon:1800,weight:4,count:1,loaded:1,condition:63}}});
test('the shared pocket panel renders twelve real destinations, split stacks and a large weapon',()=>{
 const u=unit(),html=render(h(Pockets,{unit:u,layout:inventoryUsage(u),disabled:false,onPick:()=>{},onOrder:()=>{}}));
 assert.equal((html.match(/class="ja2-pocket(?: occupied)?\s*"/g)??[]).length,12);assert.match(html,/Bolsillo grande 1: Brown Bess/);assert.match(html,/Bolsillo pequeño 1: Cartuchos · 20/);assert.match(html,/Bolsillo pequeño 2: Cartuchos · 5/);assert.match(html,/weapon-1800.png/);assert.doesNotMatch(html,/Equipar principal|Dar o soltar/);
});
test('unavailable soldiers cannot rearrange pockets and overflow stays visible and selectable',()=>{
 const u={...unit(),ammo:1000},layout=inventoryUsage(u),html=render(h(Pockets,{unit:u,layout,disabled:true,onPick:()=>{},onOrder:()=>{}}));assert.match(html,/Objetos sin espacio/);assert.match(html,/No cabe todo el equipo/);assert.equal((html.match(/disabled=""/g)??[]).length,13);assert.ok(layout.overflow[0].count>0);
});
