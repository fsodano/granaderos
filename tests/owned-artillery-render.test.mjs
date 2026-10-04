import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {deployedArtillery} from '../game/equipment.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {homeDepotGun} from './artillery-depot-fixture.mjs';
import {initialCampaign as controlledCampaign} from './legacy-campaign-fixture.mjs';
import {order,visit} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {nearbyEnvironmentModel} from '../game/ja2-hud.js';
const {default:SectorPreparation}=await import('../web/app/SectorPreparation.tsx');
const {default:OwnedArtillery}=await import('../web/app/OwnedArtillery.tsx');
const {default:JA2EnvironmentPanel}=await import('../web/app/JA2EnvironmentPanel.tsx');
const commerce=/Comprar|Importar|Vender|Recomprar|Reponer|Comercio|Confirmar intercambio/;

test('a new campaign has no artillery catalogue or shop path and cannot open an owned gun panel',()=>{
 const state=initialCampaign(),before=structuredClone(state),html=render(h(SectorPreparation,{state,sector:'retiro',dispatch(){}}));
 assert.doesNotMatch(html,/Artillería|Cañón|Pedrero|Armería/);assert.doesNotMatch(html,commerce);assert.deepEqual(state,before);
 const panel=render(h(OwnedArtillery,{state,dispatch(){}}));assert.doesNotMatch(panel,/value="(?:bronze4|field8|swivel)"/);assert.doesNotMatch(panel,commerce);
});

test('a conquered arsenal explains physical discovery and the nearby chest reports finite recovered guns',()=>{
 const state=order(controlledCampaign(),{type:'travel',sector:'buenos_aires'}),before=structuredClone(state);
 const hint=render(h(OwnedArtillery,{state,dispatch(){}}));assert.match(hint,/Explorá el arsenal.*abrí su cofre.*munición finita/);assert.doesNotMatch(hint,commerce);
 const pair=takeFiniteCache(visit(state),4,[]),unit=pair.battle.units.find(unit=>unit.id==='4'),model=nearbyEnvironmentModel(pair.battle,unit);
 const target=model.targets.find(target=>target.arsenalHint);assert.ok(target,'the actual nearby arsenal chest is a visible environment target');
 const html=render(h(JA2EnvironmentPanel,{...model,target,selected:target.key,verbs:[],verb:'',busy:false,contents:[],contentIndex:0,count:1,loot:null,onTarget(){},onVerb(){},onUse(){},onContent(){},onCount(){},onLoot(){}}));
 assert.match(html,/piezas.*Artillería/i);assert.match(html,/role="status"/);assert.doesNotMatch(html,commerce);
 const settled=leaveFiniteCache(pair),owned=render(h(OwnedArtillery,{state:settled,dispatch(){}}));assert.doesNotMatch(owned,/Explorá el arsenal/);assert.match(owned,/Artillería emplazada/);assert.match(owned,/Cargada.*6 en reserva/);assert.deepEqual(state,before);
});

test('the ordinary sector panel selects and transports one real captured gun with finite ammunition and saved custody',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test'}),document=dom.window.document;
 const globals={window:dom.window,document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}});
 let state=homeDepotGun(),paused=0;const before=structuredClone(state),gun=structuredClone(state.artilleryDepots.retiro[0]),actions=[];
 const draw=()=>{dom.window.localStorage.setItem('fixture-save',encodeSave(state));root.render(h(SectorPreparation,{state,sector:'retiro',onOpen:()=>paused++,dispatch:action=>{actions.push(action);state=dispatchCampaign(state,action);draw();}}));};
 const click=async text=>{const button=[...document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')??button.textContent.trim())===text);assert.ok(button,text);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const choose=async(index,value)=>{const select=document.querySelector(`[aria-label="Pieza propia ${index}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(select,value);await act(async()=>select.dispatchEvent(new dom.window.Event('change',{bubbles:true})));};
 await act(async()=>draw());await click('Artillería');assert.equal(paused,1);assert.ok(document.querySelector('[aria-label="Artillería del sector"]'));assert.doesNotMatch(document.body.textContent,commerce);
 const first=document.querySelector('[aria-label="Pieza propia 1"]');assert.equal(first.value,`depot:${gun.id}`);assert.deepEqual([...first.options].map(option=>option.value),['',`depot:${gun.id}`]);
 await choose(1,'');await click('Preparar batería');assert.equal(state.lastError,null);assert.deepEqual(deployedArtillery(state),[]);assert.deepEqual(state.artilleryDepots,before.artilleryDepots);assert.equal(state.resources.treasury,before.resources.treasury);
 await choose(1,`depot:${gun.id}`);await choose(2,`depot:${gun.id}`);const prepare=[...document.querySelectorAll('button')].find(button=>button.textContent==='Preparar batería');assert.equal(prepare.disabled,true);assert.match(document.body.textContent,/solo puede ocupar un lugar/);
 await choose(2,'');await click('Preparar batería');assert.equal(state.lastError,null);assert.equal(deployedArtillery(state)[0].id,gun.id);assert.equal(deployedArtillery(state)[0].ammo,gun.ammo);assert.equal(state.resources.treasury,before.resources.treasury);
 const stored=document.querySelector(`[data-stored-artillery-id="${gun.id}"]`),send=stored.querySelector('button');assert.equal(send.disabled,false);assert.match(stored.textContent,/18 horas · 0 pesos/);await click('Enviar pieza');assert.equal(state.lastError,null);assert.deepEqual(state.artilleryDepots.retiro,[]);assert.equal(state.artilleryTransfers.length,1);assert.deepEqual(state.artilleryTransfers[0].gun,gun);assert.equal(state.resources.treasury,before.resources.treasury);
 assert.match(document.querySelector('[aria-label="Artillería en tránsito"]').textContent,/Retiro.*Buenos Aires/);assert.doesNotMatch(document.body.textContent,commerce);
 assert.ok([...document.querySelectorAll('[aria-label^="Pieza propia"]')].every(select=>select.value===''));assert.equal([...document.querySelectorAll('button')].find(button=>button.textContent==='Preparar batería').disabled,false);
 await click('Preparar batería');assert.deepEqual(state.artillerySelection,[]);assert.equal(state.lastError,null);
 const after=structuredClone(state);await act(async()=>send.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));assert.deepEqual(state,after);assert.equal(actions.filter(action=>action.type==='transportArtillery').length,1);
 const stale=dispatchCampaign(state,actions.find(action=>action.type==='transportArtillery'));assert.match(stale.lastError,/debe estar emplazada o guardada/);assert.deepEqual({...stale,lastError:null},after);
 const restored=decodeSave(dom.window.localStorage.getItem('fixture-save')).campaign;assert.deepEqual(restored.artilleryTransfers[0].gun,gun);assert.deepEqual(restored.artilleryDepots.retiro,[]);assert.deepEqual(before,homeDepotGun(),'the preparation leaves its input fixture unchanged');
 await click('Cerrar artillería');assert.equal(document.querySelector('[role="dialog"]'),null);
});
