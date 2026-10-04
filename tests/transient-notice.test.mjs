import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave,SAVE_KEY} from '../game/save.js';

// Keep the real page, notice, state and autosave. Lightweight scene buttons
// submit a rejected tactical snapshot and exercise normal map navigation.
const reactUrl=new URL('../web/node_modules/react/index.js',import.meta.url).href;
const start=`import {createElement as h} from ${JSON.stringify(reactUrl)};`;
const views={
 './Battlefield':`${start}export default function Field({battle,onChange,onMap}){return h('section',{'data-screen':'battle'},h('button',{onClick:()=>onChange({...battle,lastError:'Destino inaccesible o puntos de acción insuficientes.'})},'Rejected move'),h('button',{onClick:onMap},'Map'));}`,
 './Campaign':`${start}export default function Campaign(){return h('section',{'data-screen':'campaign'},'Command map');}`,
 './CampaignPerformance':'export default function Performance(){return null;}',
 '@/components/ui/dialog':`${start}export function Dialog({open,children}){return open?h('div',null,children):null;}export function DialogContent({children}){return h('div',null,children);}export function DialogTitle({children}){return h('h2',null,children);}export function DialogDescription({children}){return h('p',null,children);}`,
};
const homeUrl=new URL('../web/app/page.tsx',import.meta.url).href;
const loader=`const views=${JSON.stringify(views)};export function resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(homeUrl)}&&Object.hasOwn(views,specifier))return {url:'data:text/javascript,'+encodeURIComponent(views[specifier]),shortCircuit:true};return next(specifier,context);}`;
register('./tactical-render-loader.mjs',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(loader)}`,import.meta.url);
const {default:TransientNotice,useTransientNotice,noticeText}=await import('../web/app/TransientNotice.tsx');
const {default:Home}=await import('../web/app/page.tsx');

async function mount(t,component,{stored}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});dom.window.scrollTo=()=>{};
 if(stored)dom.window.localStorage.setItem(SAVE_KEY,stored);
 let clock=0,serial=0,mounted=true;const timers=new Map();
 const globals={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true,
  setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{at:clock+delay,fn});return id;},clearTimeout:id=>timers.delete(id)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 const unmount=async()=>{if(mounted){await act(async()=>root.unmount());mounted=false;}};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(component));
 return {doc:dom.window.document,timers,unmount,stored:()=>dom.window.localStorage.getItem(SAVE_KEY),
  render:async next=>act(async()=>root.render(next)),
  click:async label=>{const button=[...dom.window.document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim()).startsWith(label));assert.ok(button,label);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  advance:async ms=>{const end=clock+ms;for(;;){const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);clock=next[1].at;await act(async()=>next[1].fn());}clock=end;},
 };
}

test('the short movement notice preserves full error evidence and leaves other messages intact',async t=>{
 const full='Destino inaccesible o puntos de acción insuficientes.',m=await mount(t,h(TransientNotice,{message:full}));
 assert.equal(m.doc.querySelector('[role="status"]>span').textContent,'Sin ruta o sin PA.');
 assert.equal(m.doc.querySelector('[role="status"]>span').title,full);assert.equal(noticeText(full), 'Sin ruta o sin PA.');
 assert.equal(noticeText('No hay vendas.'),'No hay vendas.');assert.equal(m.doc.querySelector('[role="status"]').getAttribute('aria-live'),'polite');
 const css=readFileSync(new URL('../web/app/transient-notice.css',import.meta.url),'utf8');
 assert.match(css,/position:fixed/);assert.match(css,/max-width:min\(400px,calc\(100vw - 24px\)\)/);assert.match(css,/:focus-visible/);
});

test('a notice expires after four seconds without extending on an unrelated render',async t=>{
 let dismissals=0;const message='Orden rechazada.',m=await mount(t,h(TransientNotice,{message,eventKey:1,onDismiss:()=>dismissals++}));
 await m.advance(2500);await m.render(h(TransientNotice,{message,eventKey:1,onDismiss:()=>dismissals++}));
 await m.advance(1499);assert.ok(m.doc.querySelector('[role="status"]'));assert.equal(dismissals,0);
 await m.advance(1);assert.equal(m.doc.querySelector('[role="status"]'),null);assert.equal(dismissals,1);assert.equal(m.timers.size,0);
});

test('new identical errors restart the notice before and after automatic dismissal',async t=>{
 let issue;function Screen(){const[notice,setNotice]=useTransientNotice();issue=setNotice;return h(TransientNotice,{message:notice?.message,eventKey:notice?.id,onDismiss:()=>setNotice('')});}
 const m=await mount(t,h(Screen));const show=()=>act(async()=>issue('Orden rechazada.'));
 await show();const first=m.doc.querySelector('[role="status"]>span');await m.advance(3000);await show();
 assert.notEqual(m.doc.querySelector('[role="status"]>span'),first,'the repeated event has new live-region content');assert.equal(m.timers.size,1);
 await m.advance(1000);assert.ok(m.doc.querySelector('[role="status"]'),'the earlier deadline was cancelled');await m.advance(2999);assert.ok(m.doc.querySelector('[role="status"]'));
 await m.advance(1);assert.equal(m.doc.querySelector('[role="status"]'),null);await show();assert.ok(m.doc.querySelector('[role="status"]'));await m.advance(4000);assert.equal(m.doc.querySelector('[role="status"]'),null);
});

test('manual close cancels the timer even when the source message remains unchanged',async t=>{
 let dismissals=0;const m=await mount(t,h(TransientNotice,{message:'Orden rechazada.',eventKey:1,onDismiss:()=>dismissals++}));
 await m.advance(500);await m.click('Cerrar aviso');assert.equal(m.doc.querySelector('[role="status"]'),null);assert.equal(m.timers.size,0);assert.equal(dismissals,1);
 await m.advance(4000);assert.equal(dismissals,1);
 await m.render(h(TransientNotice,{message:'Orden rechazada.',eventKey:2,onDismiss:()=>dismissals++}));assert.ok(m.doc.querySelector('[role="status"]'));
});

test('replacement, clearing and unmount cancel old notice timers',async t=>{
 let dismissals=0;const props={onDismiss:()=>dismissals++},m=await mount(t,h(TransientNotice,{...props,message:'Anterior',eventKey:{}}));
 await m.advance(3500);await m.render(h(TransientNotice,{...props,message:'Nueva',eventKey:{}}));await m.advance(500);assert.match(m.doc.querySelector('[role="status"]').textContent,/Nueva/);assert.equal(dismissals,0);
 await m.render(h(TransientNotice,{...props,message:null}));assert.equal(m.timers.size,0);assert.equal(m.doc.querySelector('[role="status"]'),null);
 await m.render(h(TransientNotice,{...props,message:'Última'}));assert.equal(m.timers.size,1);await m.unmount();assert.equal(m.timers.size,0);await m.advance(4000);assert.equal(dismissals,0);
});

test('a rejected tactical page order expires across map navigation without changing the saved game',async t=>{
 const campaign=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(campaign.lastError,null);const battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);
 const stored=encodeSave(campaign,battle),before=decodeSave(stored),m=await mount(t,h(Home),{stored});await m.click('Continuar campaña');assert.ok(m.doc.querySelector('[data-screen="battle"]'));
 await m.click('Rejected move');assert.equal(m.doc.querySelectorAll('.transient-notice').length,1);assert.match(m.doc.querySelector('[role="status"]').textContent,/Sin ruta o sin PA/);await m.advance(3000);
 await m.click('Rejected move');await m.click('Map');assert.ok(m.doc.querySelector('[data-screen="campaign"]'));assert.equal(m.doc.querySelector('.notice.dismissible'),null);
 await m.advance(1000);assert.ok(m.doc.querySelector('[role="status"]'));await m.advance(3000);assert.equal(m.doc.querySelector('[role="status"]'),null);
 assert.deepEqual(decodeSave(m.stored()),before,'rejected orders and notice dismissal do not change paid state, custody or the save');
});
