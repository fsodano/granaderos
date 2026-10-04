import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {initialHorseState,MATURITY_HOURS} from '../game/horses.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {default:SectorPreparation}=await import('../web/app/SectorPreparation.tsx');
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const {default:Desk}=await import('../web/app/Desk.tsx');
const tradeCopy=/Comprar|Importar|Vender|Abastecimiento|Forraje|Iniciar cría|Parto previsto|Arrendar montura|Comercio de vestimenta/;
function withOwnedHorse(){
 const state=initialCampaign();
 // An existing save can retain a real owned mount and obsolete feed fields.
 state.horseState={...initialHorseState(),nextId:2,horses:[{id:'horse-1',name:'Mora',sex:'mare',location:'retiro',bornAt:-MATURITY_HOURS,stamina:80,condition:90,feed:7,assignedTo:3,hired:false,hireUntil:null,pregnantUntil:240}]};
 return decodeSave(encodeSave(state)).campaign;
}

test('local and map equipment controls retain physical inventory and owned riders without any shop path',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test'}),globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 let state=withOwnedHorse(),paused=0,actions=[];const treasury=state.resources.treasury;
 const doc=dom.window.document,click=async element=>{assert.ok(element);await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const button=text=>[...doc.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const drawLocal=()=>root.render(h(SectorPreparation,{state,sector:'retiro',onOpen:()=>paused++,dispatch:action=>{actions.push(action);state=dispatchCampaign(state,action);assert.equal(state.lastError,null);drawLocal();}}));
 await act(async()=>drawLocal());assert.doesNotMatch(doc.body.textContent,tradeCopy);assert.ok(button('Caballada'));
 await click(button('Caballada'));assert.equal(paused,1);assert.ok(doc.querySelector('[aria-label="Caballada del sector"]'));assert.doesNotMatch(doc.body.textContent,tradeCopy);
 const rider=doc.querySelector('[aria-label="Jinete de Mora"]');assert.equal(rider.disabled,false);assert.equal(rider.value,'3');
 Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(rider,'4');await act(async()=>rider.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
 assert.deepEqual(actions[0],{type:'horseAction',order:{type:'assign',horseId:'horse-1',operativeId:4}});assert.equal(state.horseState.horses[0].assignedTo,4);assert.equal(state.resources.treasury,treasury);
 await click(button('Liberar montura'));assert.equal(state.horseState.horses[0].assignedTo,null);assert.equal(state.resources.treasury,treasury);
 const saved=decodeSave(encodeSave(state)).campaign;assert.equal(saved.horseState.horses[0].feed,7);assert.equal(saved.horseState.horses[0].pregnantUntil,240);
 await click(doc.querySelector('[aria-label="Cerrar caballada"]'));assert.equal(doc.querySelector('[role="dialog"]'),null);
 const before=structuredClone(state),calls=actions.length;
 await act(async()=>root.render(h(StrategicMap,{state,selected:'retiro',onSelect:()=>{},dispatch:action=>actions.push(action)})));
 await click(doc.querySelector('[aria-label="Caballos"]'));await click(button('Administrar esta vista'));assert.ok(doc.querySelector('[aria-label="Jinete de Mora"]'));assert.doesNotMatch(doc.body.textContent,tradeCopy);
 await click(doc.querySelector('[aria-label="Objetos"]'));assert.ok(doc.querySelector('[aria-label="Equipo del sector"]'));assert.ok(doc.querySelector('[aria-label="Organizar equipo llevado"]'));assert.equal(button('Administrar esta vista'),undefined);assert.equal(doc.querySelector('[aria-label="Jinete de Mora"]'),null);assert.doesNotMatch(doc.body.textContent,tradeCopy);
 await click(doc.querySelector('[aria-label="Tropas"]'));assert.equal(doc.querySelector('.squads-section'),null);assert.equal(button('Administrar esta vista'),undefined);assert.equal(doc.querySelector('[role="dialog"]'),null);assert.equal(doc.querySelectorAll('[data-presence-dot="player"]').length,state.recruited.length);assert.doesNotMatch(doc.body.textContent,tradeCopy);
 assert.equal(actions.length,calls);assert.deepEqual(state,before);
});

test('the desk keeps hiring and received correspondence without finance, supply or shop folders',()=>{
 const state=withOwnedHorse(),before=structuredClone(state),html=render(h(Desk,{state,dispatch:()=>{},onClose:()=>{}}));
 assert.match(html,/Contrataciones/);assert.match(html,/Correspondencia/);assert.match(html,/Fondos disponibles/);assert.match(html,/0 pesos por día · acuerdos de puerto/);assert.match(html,/Cobro a medianoche/);
 assert.doesNotMatch(html,/Tesorería|Abastecimiento|Cabildo|Cuaderno|Armería/);assert.deepEqual(state,before);
});
