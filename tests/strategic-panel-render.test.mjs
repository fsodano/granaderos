import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {worldCell,campaignPlace} from '../game/world-cells.js';
const {default:Campaign}=await import('../web/app/Campaign.tsx');

async function mount(t,state){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current,battleReturns=0,actions=[];
 function Screen(){const[s,set]=useState(state);current=s;return h(Campaign,{state:s,dispatch:action=>{actions.push(action);set(previous=>dispatchCampaign(previous,action));},onBattle(){battleReturns++;},onOpenDesk(){}});}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const doc=dom.window.document,fire=async(element,event)=>{assert.ok(element);await act(async()=>element.dispatchEvent(event));};
 await act(async()=>root.render(h(Screen)));
 return{doc,state:()=>current,battleReturns:()=>battleReturns,actions,button:(label,scope=doc)=>[...scope.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim())===label),click:element=>fire(element,new dom.window.MouseEvent('click',{bubbles:true})),key:(element,key,shiftKey=false)=>fire(element,new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true}))};
}

test('the command map keeps orders absent until requested and its dialog closes with restored focus',async t=>{
 const s=initialCampaign(),before=structuredClone(s),m=await mount(t,s);
 assert.equal(m.doc.querySelector('.strategy-layout').children.length,2);
 assert.equal(m.doc.querySelector('.strategy-orders'),null);assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.button('Volver al sector táctico'),undefined);
 const trigger=m.button('Sector',m.doc.querySelector('.strategy-tools'));trigger.focus();await m.click(trigger);
 const dialog=m.doc.querySelector('[role="dialog"]');assert.equal(dialog.getAttribute('aria-modal'),'true');assert.equal(dialog.getAttribute('aria-label'),`Sector · ${campaignPlace(s.location).name.split(' · ')[0]}`);
 const close=m.button('Cerrar panel de campaña',dialog);assert.equal(m.doc.activeElement,close);assert.ok(m.button('Entrar al sector',dialog));
 await m.key(close,'Tab',true);const last=m.doc.activeElement;assert.notEqual(last,close);assert.ok(last.closest('details')?.hasAttribute('open')||last.tagName==='SUMMARY'||!last.closest('details'),'focus skips controls hidden inside closed details');await m.key(last,'Tab');assert.equal(m.doc.activeElement,close);
 await m.key(close,'Escape');assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.doc.activeElement,trigger);
 await m.click(trigger);await m.click(m.doc.querySelector('.strategic-panel-backdrop'));assert.equal(m.doc.querySelector('[role="dialog"]'),null);
 assert.deepEqual(m.actions,[]);assert.deepEqual(m.state(),before);
});

test('map keyboard navigation leaves geography open; explicit selection opens the selected sector',async t=>{
 const m=await mount(t,initialCampaign()),origin=worldCell(m.state().location),cell=id=>m.doc.querySelector(`[data-map-cell="${id}"]`);
 await m.key(cell(origin.id),'ArrowUp');const selected=worldCell(`cell-${origin.col}-${origin.row-1}`);
 assert.equal(cell(selected.id).getAttribute('aria-pressed'),'true');assert.equal(m.doc.querySelector('[role="dialog"]'),null);
 await m.key(cell(selected.id),'Enter');assert.ok(m.doc.querySelector('[role="dialog"]').textContent.includes(selected.grid));assert.deepEqual(m.actions,[]);
});

test('the requested roster can start a route while the map remains usable for its destination',async t=>{
 const m=await mount(t,initialCampaign());await m.click(m.button('Nómina',m.doc.querySelector('.strategy-tools')));
 assert.ok(m.doc.querySelector('[role="dialog"] .strategy-personnel'));
 await m.click(m.doc.querySelector('[role="dialog"] button[aria-label="Destino: Cabral"]'));
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.ok(m.doc.querySelector('[aria-label="Trazar ruta"]'));
 assert.equal(m.doc.querySelector('.argentina-atlas').getAttribute('data-plotting'),'true');
 await m.click(m.doc.querySelector('[data-map-sector="buenos_aires"]'));
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.button('Confirmar ruta').disabled,false);
 await m.click(m.button('Confirmar ruta'));assert.equal(m.state().lastError,null);assert.ok(m.state().squads[0].journey);
 assert.equal(m.state().hour,0);assert.equal(m.state().location,'retiro');assert.equal(m.doc.querySelector('[aria-label="Trazar ruta"]'),null);
 assert.equal(m.doc.querySelector('[role="dialog"]').getAttribute('aria-label'),'Marchas');
});

test('a saved journey opens return controls only from the explicit Marchas tool',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'wait',hours:5});const m=await mount(t,s);
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.ok(m.doc.querySelector('[data-squad-route]'));
 await m.click(m.button('Marchas',m.doc.querySelector('.strategy-tools')));assert.match(m.doc.querySelector('[role="dialog"]').textContent,/Regresar · 5 h/);assert.deepEqual(m.actions,[]);
});

test('map inventory and income views open a closable dialog without a permanent detail column',async t=>{
 const m=await mount(t,initialCampaign());assert.equal(m.doc.querySelector('.sector-inventory'),null);
 await m.click(m.button('Objetos'));assert.equal(m.doc.querySelector('[role="dialog"]').getAttribute('aria-label'),'Objetos del sector');assert.ok(m.doc.querySelector('[aria-label="Equipo descubierto"]'));
 await m.click(m.button('Cerrar panel de campaña'));assert.equal(m.doc.querySelector('[role="dialog"]'),null);
 await m.click(m.button('Recursos'));assert.equal(m.doc.querySelector('[role="dialog"]').getAttribute('aria-label'),'Ingresos de los puertos');await m.click(m.button('Cerrar panel de campaña'));
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.doc.querySelector('.strategy-orders'),null);assert.deepEqual(m.actions,[]);
});


test('an open tactical scene has one direct header return while all sector panels remain closed',async t=>{
 const state=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(state.lastError,null);assert.ok(state.pendingBattle);
 const before=structuredClone(state),m=await mount(t,state),button=m.button('Volver al sector táctico');
 assert.ok(button);assert.ok(m.doc.querySelector('.strategy-top').contains(button));assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.doc.querySelector('.strategy-orders'),null);
 assert.equal(m.doc.querySelector('.strategy-clock-cause'),null);assert.match(m.button('▶ Iniciar').title,/órdenes de combate/);assert.equal(m.button('▶ Iniciar').disabled,true);
 await m.click(button);assert.equal(m.battleReturns(),1);assert.deepEqual(m.actions,[]);assert.deepEqual(m.state(),before);
 await m.click(m.button('Sector',m.doc.querySelector('.strategy-tools')));assert.equal(m.doc.querySelectorAll('button[aria-label="Volver al sector táctico"]').length,1);assert.ok(!m.doc.querySelector('[role="dialog"]').textContent.includes('Volver al sector táctico'));
});

test('the map keeps funds above its field and time controls below it without a standing clock notice',async t=>{
 const s=initialCampaign(),m=await mount(t,s),top=m.doc.querySelector('.strategy-top'),bottom=m.doc.querySelector('.strategy-bottom-controls');
 assert.ok(top.querySelector('[aria-label="Fondos disponibles"]').textContent.includes(s.resources.treasury.toLocaleString('es-AR')));
 assert.equal(top.querySelector('.strategy-time'),null);assert.ok(bottom.querySelector('[aria-label="Velocidad del tiempo"]'));assert.ok(bottom.contains(m.button('▶ Iniciar')));
 assert.equal(m.doc.querySelector('.strategy-clock-cause'),null);assert.ok(!m.doc.body.textContent.includes('Reloj detenido: elegí una velocidad'));
 assert.equal(m.doc.querySelector('.squad-map-table'),null);assert.equal(m.doc.querySelector('.roster-footer strong'),null);
 assert.equal(m.doc.querySelector('.merc-map-table thead th:last-child').textContent,'Fin contrato');
 assert.deepEqual(m.actions,[]);
});
