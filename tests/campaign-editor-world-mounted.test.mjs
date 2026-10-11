import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState,StrictMode} from '../web/node_modules/react/index.js';
import {createCampaignProject,projectContent} from '../game/campaign-editor-project.js';
import {applyMapCommands} from '../game/map-commands.js';
register('./tactical-render-loader.mjs',import.meta.url);
async function mount(t,component,initial){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://granaderos.test/studio',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true,fetch:()=>{throw Error('Embedded panel must not load installed campaigns');}};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Panel}=await import(component),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let project=initial,changes=0;
 function Harness(){const [state,setState]=useState(initial);project=state;return h(Panel,{project:state,onChange:next=>{changes++;setState(next);}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}});
 await act(async()=>root.render(h(StrictMode,null,h(Harness))));
 const document=dom.window.document,button=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;},label=text=>{const l=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent.trim()===text);assert.ok(l,text);return l.querySelector('input,select,textarea');};
 return {dom,document,get project(){return project;},get changes(){return changes;},button,label,async click(b){await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},async input(e,value){const prototype=e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,value);await act(async()=>e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true})));}};
}
test('embedded map authoring writes shared project state, keeps undo and switches maps without storage or URL effects',async t=>{
 const m=await mount(t,'../web/app/studio/MapWorkspace.tsx',await createCampaignProject('editor-mounted'));
 assert.equal(m.changes,0);assert.equal(m.dom.window.localStorage.length,0);assert.equal(m.document.querySelector('[aria-label="Sector existente"]'),null);assert.equal(m.document.querySelector('a[href*="story"]'),null);
 await m.input(m.document.querySelector('[aria-label="Nombre del sector"]'),'Plano editado');assert.equal(m.project.maps.camp.metadata.title,'Plano editado');assert.equal(m.changes,1);
 await m.click(m.button('Deshacer'));assert.equal(m.project.maps.camp.metadata.title,'Campamento');await m.click(m.button('Rehacer'));assert.equal(m.project.maps.camp.metadata.title,'Plano editado');
 await m.input(m.label('Mapa'),'watch-post');await m.input(m.document.querySelector('[aria-label="Nombre del sector"]'),'Puesto editado');assert.equal(m.project.maps.camp.metadata.title,'Plano editado');assert.equal(m.project.maps['watch-post'].metadata.title,'Puesto editado');assert.equal(m.dom.window.localStorage.length,0);assert.equal(m.dom.window.location.href,'https://granaderos.test/studio');
});
test('mounted world grid creates and moves an indexed locality through shared state',async t=>{
 const m=await mount(t,'../web/app/studio/WorldWorkspace.tsx',await createCampaignProject('editor-grid'));
 assert.equal(m.document.querySelectorAll('[role="gridcell"]').length,1188);
 await m.click(m.document.querySelector('[aria-label="18,18: Celda 18,18"]'));await m.input(m.label('Identidad de nueva localidad'),'market');await m.input(m.label('Nombre de nueva localidad'),'Mercado');await m.click(m.button('Crear en casilla elegida'));assert.equal(m.project.maps.market.metadata.title,'Mercado');assert.ok(m.project.mapIndex.maps.some(m=>m.id==='market'));
 await m.input(m.label('Localidad'),'market');await m.click(m.document.querySelector('[aria-label="19,18: Celda 19,18"]'));await m.click(m.button('Mover cabecera aquí'));assert.equal(m.project.world.cells.find(c=>c.anchor&&c.locality==='market').id,'cell-18-17');assert.equal(m.document.querySelector('[role="alert"]'),null);
});
test('mounted building panel saves reusable project templates and clears explicit finishes',async t=>{
 const p=await createCampaignProject('editor-buildings'),r=applyMapCommands(p.maps.camp,[{type:'addBuilding',building:{id:'house',name:'Casa propia',architecture:'house',roof:'thatch',wallFinish:'stone',x:7,y:4,width:5,height:5}}]);assert.deepEqual(r.errors,[]);p.maps.camp=r.document;
 const m=await mount(t,'../web/app/studio/BuildingWorkspace.tsx',p);await m.click(m.button('Guardar edificio como plantilla'));assert.equal(m.project.editor.buildingTemplates[0].name,'Casa propia');assert.equal(projectContent(m.project).editor,undefined);
 await m.click(m.button('Heredar acabados de campaña'));assert.equal(m.project.maps.camp.buildings[0].wallFinish,undefined);assert.equal(m.project.editor.buildingTemplates[0].building.wallFinish,'stone');await m.input(m.label('Altura de losa (m)'),'4');await m.click(m.button('Crear o reemplazar losa con acceso'));assert.equal(m.project.maps.camp.upperSurfaces.length,25);assert.equal(m.project.maps.camp.upperSurfaces[0].elevation,4);assert.equal(m.project.maps.camp.climbLinks.length,1);await m.click(m.button('Quitar losa y accesos'));assert.deepEqual(m.project.maps.camp.upperSurfaces,[]);await m.click(m.button('Abrir constructor de edificios'));assert.ok(m.document.querySelector('[aria-label="Plantilla de edificio"] option[value="project-0"]'));
});
