import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState,StrictMode} from '../web/node_modules/react/index.js';
import {createCampaignProject,projectContent} from '../game/campaign-editor-project.js';
import {applyMapCommands} from '../game/map-commands.js';
import {alternateCampaignDocuments} from './campaign-library-fixture.mjs';
register('./tactical-render-loader.mjs',import.meta.url);

async function mount(t,{project=null,embedded=true,reader}={}){
 project??=await createCampaignProject('map-experience');
 const unexpected=[],console=new VirtualConsole();console.on('jsdomError',error=>{if(!/navigation|HTMLCanvasElement/.test(error.message))unexpected.push(error.message);});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://granaderos.test/editor?campaign=another',pretendToBeVisual:true,virtualConsole:console});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true,fetch:reader??(()=>{throw Error('Embedded editor must not fetch an installed campaign');})};
 const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Editor}=await import('../web/app/editor/SectorEditor.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current=project,changes=0;
 function Harness(){const [value,setValue]=useState(project);current=value;const editor=h(Editor,embedded?{document:value.maps.camp,campaign:projectContent(value),embedded,onDocumentChange:next=>{changes++;setValue(previous=>({...previous,maps:{...previous.maps,camp:next}}));}}:{});return embedded?h('main',{'data-editor-host':true},editor):editor;}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}assert.deepEqual(unexpected,[]);});
 await act(async()=>root.render(h(StrictMode,null,h(Harness))));
 const document=dom.window.document,button=(text,scope=document)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;};
 return {dom,document,button,get project(){return current;},get changes(){return changes;},async click(element){await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},async key(element,key){await act(async()=>element.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true})));},async input(element,value){const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));},async wait(predicate){for(let i=0;i<100;i++){if(predicate())return;await act(async()=>new Promise(resolve=>setTimeout(resolve,15)));}assert.fail('Editor did not settle');}};
}

test('map authoring groups commands, explains active tools and searches its catalogue without changing map data',async t=>{
 const m=await mount(t),before=structuredClone(m.project);
 assert.equal(m.document.querySelector('.sector-editor').tagName,'SECTION');assert.equal(m.document.querySelectorAll('main').length,1);assert.equal(m.document.querySelector('main main'),null);
 for(const name of ['Acciones del mapa','Archivos del mapa','Pruebas del mapa','Navegar','Construir'])assert.ok(m.document.querySelector(`[aria-label="${name}"]`));
 assert.match(m.document.querySelector('[aria-label="Estado del mapa"]').textContent,/20 × 16.*Proyecto compartido/);
 await m.click(m.button('Medir ruta'));assert.equal(m.button('Medir ruta').getAttribute('aria-pressed'),'true');assert.match(m.document.querySelector('.editor-tool-context').textContent,/Elegí una casilla de inicio/);
 const query=m.document.querySelector('[aria-label="Buscar en catálogo"]');await m.input(query,'ARBOL');assert.ok(m.document.querySelector('.editor-catalogue-group button'));assert.ok([...m.document.querySelectorAll('.editor-catalogue-group button')].every(button=>/árbol/i.test(button.textContent)));
 await m.input(query,'no-existe-este-elemento');assert.match(m.document.querySelector('.editor-palette [role="status"]').textContent,/No hay elementos/);assert.equal(m.document.querySelectorAll('.editor-catalogue-group button').length,0);
 await m.input(query,'');assert.ok(m.document.querySelectorAll('.editor-catalogue-group button').length>10);
 const zoom=m.document.querySelector('[aria-label="Nivel de zoom"]');await m.click(m.document.querySelector('[aria-label="Acercar mapa"]'));assert.equal(zoom.textContent,'125%');await m.click(m.button('Centrar'));assert.equal(zoom.textContent,'100%');
 await m.click(m.button('Herramientas',m.document.querySelector('.editor-panel-tabs')));assert.equal(m.document.querySelector('.sector-editor').dataset.activePanel,'tools');
 assert.equal(m.document.querySelector('.sector-editor').classList.contains('embedded'),true);assert.equal([...m.document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Deshacer'),false);assert.deepEqual(m.project,before);assert.equal(m.changes,0);assert.equal(m.dom.window.localStorage.length,0);
});

test('keyboard selection shows actual object identity, locked feedback and editable properties',async t=>{
 const project=await createCampaignProject('map-selection'),changed=applyMapCommands(project.maps.camp,[{type:'addObject',layer:'props',object:{id:'review-chest',name:'Cofre de revisión',type:'chest',x:7,y:4}}]);assert.deepEqual(changed.errors,[]);project.maps.camp=changed.document;
 const m=await mount(t,{project}),tile=m.document.querySelector('[aria-label="Casilla 7,4"]');tile.focus();assert.equal(m.document.activeElement,tile);await m.key(tile,'Enter');
 assert.match(m.document.querySelector('.editor-selection-summary').textContent,/Cofre de revisión.*review-chest/);assert.equal(m.document.querySelector('.editor-selection-count').textContent,'1 elemento seleccionado');
 const lock=m.document.querySelector('[aria-label="Bloquear Mobiliario"]');await m.click(lock);assert.equal(lock.getAttribute('aria-pressed'),'true');assert.match(m.document.querySelector('.editor-selection-panel .editor-warning').textContent,/capa está bloqueada/);assert.equal(m.button('Aplicar propiedades').disabled,true);
 await m.click(lock);const name=[...m.document.querySelectorAll('.editor-selection-panel label')].find(label=>label.firstChild?.textContent.trim()==='Nombre').querySelector('input');await m.input(name,'Cofre propio');await m.click(m.button('Aplicar propiedades'));assert.equal(m.project.maps.camp.props.find(p=>p.id==='review-chest').name,'Cofre propio');assert.equal(m.changes,1);
 await m.click(m.button('Eliminar'));assert.equal(m.project.maps.camp.props.some(p=>p.id==='review-chest'),false);assert.match(m.document.querySelector('.editor-empty-selection').textContent,/Ningún elemento seleccionado/);
});

test('empty maps explain their required player entry and return to ready status after a real keyboard placement',async t=>{
 const project=await createCampaignProject('map-empty');project.maps.camp.spawns=[];
 const m=await mount(t,{project});assert.equal(m.button('Probar mapa').disabled,true);assert.equal(m.button('Probar escena expandida').disabled,true);assert.match(m.document.querySelector('.editor-map-empty').textContent,/aparición de tu escuadra/);
 const badge=m.document.querySelector('.editor-validation-badge');await m.click(badge);assert.equal(m.document.querySelector('.sector-editor').dataset.activePanel,'properties');assert.equal(m.document.activeElement,m.document.querySelector('[aria-label="Validación del mapa"]'));assert.match(m.document.querySelector('.editor-validation-panel').textContent,/aparición del jugador/);
 const group=[...m.document.querySelectorAll('.editor-catalogue-group')].find(group=>group.querySelector('summary').textContent==='Apariciones, luces y salidas'),player=group.querySelector('button');assert.ok(player);await m.click(player);await m.key(m.document.querySelector('[aria-label="Casilla 3,8"]'),'Enter');
 assert.match(m.document.querySelector('.editor-tool-context').textContent,/Colocar: La escuadra/);
 assert.equal(m.project.maps.camp.spawns.length,1);assert.equal(m.project.maps.camp.spawns[0].side,'player');assert.equal(m.button('Probar mapa').disabled,false);assert.match(badge.textContent,/Listo para probar/);assert.equal(m.document.querySelector('.editor-map-empty'),null);
});

test('standalone editor keeps real local save and undo/redo controls within the new toolbar',async t=>{
 const {reader}=alternateCampaignDocuments(),m=await mount(t,{embedded:false,reader});await m.wait(()=>m.dom.window.localStorage.getItem('granaderos.sector-draft.v2.another'));
 assert.equal(m.document.querySelector('.sector-editor').tagName,'MAIN');assert.equal(m.document.querySelectorAll('main').length,1);
 assert.equal(m.document.querySelector('.sector-editor').classList.contains('embedded'),false);assert.match(m.document.querySelector('[aria-label="Estado del mapa"]').textContent,/Borrador guardado en este navegador/);assert.ok([...m.document.querySelectorAll('a')].some(a=>a.textContent==='Estudio de campaña'&&/^\/studio\/?$/.test(a.getAttribute('href'))));
 const input=m.document.querySelector('[aria-label="Nombre del sector"]'),before=input.value;await m.input(input,'Plano de trabajo');assert.equal(JSON.parse(m.dom.window.localStorage.getItem('granaderos.sector-draft.v2.another')).metadata.title,'Plano de trabajo');
 await m.click(m.button('Deshacer'));assert.equal(input.value,before);await m.click(m.button('Rehacer'));assert.equal(input.value,'Plano de trabajo');assert.equal(m.document.querySelector('[aria-label="Historial del mapa"]').querySelectorAll('button').length,2);
});
