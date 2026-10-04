import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {completedConferenceStock} from './mission-inventory-fixture.mjs';
import {actBattle} from '../game/tactical.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor} from '../game/campaign.js';
const {default:SectorInventory}=await import('../web/app/SectorInventory.tsx');
function ready(){let s=dispatchCampaign(initialCampaign(45),{type:'visitSector'});let b=enterSector(s.pendingBattle);b=actBattle(b,{type:'drop',unitId:'4',item:'medkits',count:2});assert.equal(b.lastError,null);s=dispatchCampaign(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(s.lastError,null);return s;}
const draw=s=>render(h(SectorInventory,{state:s,sectorId:'retiro',dispatch:()=>{}}));
test('sector equipment renders discovered quantities with labelled selection and pickup controls',()=>{
 const html=draw(ready());assert.match(html,/aria-label="Equipo del sector"/);assert.match(html,/aria-label="Combatiente para el equipo del sector"/);assert.match(html,/Vendas · 2/);assert.match(html,/aria-label="Recoger 1: cantidad de Vendas"/);assert.match(html,/min="1" max="2" step="1"/);assert.match(html,/aria-label="Recoger 1: Vendas"/);assert.match(html,/aria-label="Equipo llevado"/);assert.match(html,/aria-label="Dejar 1:/);
});
test('occupied or unscouted sectors explain why pickup is unavailable',()=>{
 const s=ready();s.sectors.retiro.owner='royalist';let html=draw(s);assert.match(html,/role="status"/);assert.match(html,/bajo control patriota/);assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Recoger 1: Vendas"/);
 html=draw(initialCampaign());assert.match(html,/Primero reconocé y asegurá el sector/);assert.match(html,/No hay equipo descubierto/);
});

test('visited mission sites appear as labelled inventory choices beside their parent sector',()=>{
 const s=completedConferenceStock();
 const html=render(h(SectorInventory,{state:s,sectorId:'tucuman',dispatch:()=>{}}));
 assert.match(html,/aria-label="Lugar del equipo"/);assert.match(html,/<option[^>]*value="tucuman"[^>]*selected=""/);
 assert.match(html,/<option value="yatasto">Conferencia de Yatasto · [0-9]+ objetos<\/option>/);
 const unseen=draw(initialCampaign());assert.doesNotMatch(unseen,/Lugar del equipo|Conferencia de Yatasto|Combate de San Lorenzo/);
});

test('physical sector equipment has pickup and drop controls without clothing commerce or hidden armory storage',()=>{
 const s=ready(),before=structuredClone(s),html=draw(s);
 assert.match(html,/Recoger 1: Vendas/);assert.match(html,/aria-label="Dejar 1:/);
 assert.doesNotMatch(html,/Comercio de vestimenta|Comprar poncho|Guardar en armería|para venderlas|repone sus existencias/);
 assert.deepEqual(s,before);
});

function serviceReturn({unvisited=false}={}){
 let s=unvisited?initialCampaign(45):ready();
 // A restored finite carried kit isolates physical return and collection UI.
 s.operativeState[4].toolkitPoints=100;
 if(!unvisited)s.sectorStates.retiro.groundItems=Array.from({length:2000},(_,i)=>({id:`occupied-${i}`,type:'item',item:'rations',count:1,weight:.5,x:1,y:1}));
 s=dispatchCampaign(s,{type:'dismiss',id:4});assert.equal(s.lastError,null);return s;
}
test('returned equipment and finite repair materials have plain Spanish collection controls',()=>{
 const s=serviceReturn(),html=draw(s);
 assert.match(html,/aria-label="Materiales de reparación"/);assert.match(html,/Materiales de reparación · 100/);
 assert.match(html,/aria-label="Retirar 1: cantidad de Materiales de reparación"/);assert.match(html,/min="1" max="100" step="1"/);
 assert.match(html,/<button class="line-button" aria-label="Retirar 1: Materiales de reparación">Retirar<\/button>/);
 assert.match(html,/aria-label="Recoger [0-9]+:/);assert.doesNotMatch(html,/serviceReturn|fallback|cache|toolkitPoints/);
 s.operativeState[3].toolkitPoints=100000;
 const full=draw(s);assert.match(full,/<button[^>]*disabled=""[^>]*aria-label="Retirar 1: Materiales de reparación"/);assert.match(full,/no puede llevar más materiales/);
});
test('unvisited service returns display a location notice and disabled collection without invalid coordinates',()=>{
 const html=draw(serviceReturn({unvisited:true}));assert.match(html,/Lugar por reconocer/);assert.match(html,/Primero reconocé y asegurá el sector/);
 assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Recoger [0-9]+:/);assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Retirar 1: Materiales de reparación"/);assert.doesNotMatch(html,/NaN|undefined/);
});
test('mounted repair collection sends the exact normal inventory order, refreshes the reserve and survives save',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 let state=serviceReturn();const actions=[];
 const renderState=()=>root.render(h(SectorInventory,{state,sectorId:'retiro',dispatch:action=>{actions.push(action);state=dispatchCampaign(state,action);assert.equal(state.lastError,null);renderState();}}));
 const before=sectorInventoryModel(state,'retiro',rosterFor(state),3).repairReserves[0],points=state.operativeState[3].toolkitPoints,inventory=structuredClone(state.operativeState[3].inventory);
 const carried=()=>dom.window.document.querySelector('[aria-label="Materiales de reparación del combatiente"]').textContent;
 const quantity=async count=>{const input=dom.window.document.querySelector('[aria-label="Retirar 1: cantidad de Materiales de reparación"]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,String(count));await act(async()=>input.dispatchEvent(new dom.window.Event('input',{bubbles:true})));};
 await act(async()=>renderState());assert.equal(carried(),'Materiales de reparación: 0 puntos');await quantity(35);const button=dom.window.document.querySelector('[aria-label="Retirar 1: Materiales de reparación"]');assert.equal(button.disabled,false);
 await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.deepEqual(actions[0],{type:'sectorInventory',sector:'retiro',operativeId:3,direction:'takeRepairPoints',sourceKey:before.key,expected:before.expected,count:35});
 assert.equal(state.operativeState[3].toolkitPoints,points+35);assert.equal(carried(),'Materiales de reparación: 35 puntos');assert.deepEqual(state.operativeState[3].inventory,inventory);assert.match(dom.window.document.querySelector('[aria-label="Materiales de reparación"]').textContent,/Materiales de reparación · 65/);
 state=decodeSave(encodeSave(state)).campaign;assert.equal(sectorInventoryModel(state,'retiro',rosterFor(state),3).repairReserves[0].repairPoints,65);
 const stale=dispatchCampaign(state,actions[0]);assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},{...state,lastError:null});
 state.operativeState[3].asleep=true;await act(async()=>renderState());assert.equal(dom.window.document.querySelector('[aria-label="Retirar 1: Materiales de reparación"]').disabled,true);
 state.operativeState[3].asleep=false;await act(async()=>renderState());await quantity(65);
 await act(async()=>dom.window.document.querySelector('[aria-label="Retirar 1: Materiales de reparación"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.deepEqual(actions[1],{type:'sectorInventory',sector:'retiro',operativeId:3,direction:'takeRepairPoints',sourceKey:before.key,expected:JSON.stringify({repairPoints:65}),count:65});
 assert.equal(state.operativeState[3].toolkitPoints,points+100);assert.equal(carried(),'Materiales de reparación: 100 puntos');assert.deepEqual(state.operativeState[3].inventory,inventory);assert.equal(dom.window.document.querySelector('[aria-label="Materiales de reparación"]'),null);
 state=decodeSave(encodeSave(state)).campaign;await act(async()=>renderState());assert.equal(carried(),'Materiales de reparación: 100 puntos');assert.equal(sectorInventoryModel(state,'retiro',rosterFor(state),3).repairReserves.length,0);
});
