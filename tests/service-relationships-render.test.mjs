import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const pair=()=>order(order(order(initialCampaign(),{type:'advanceStrategicTime',seconds:17}),{type:'recruitCivic',id:107,term:'day'}),{type:'recruitCivic',id:112,term:'week'});

async function mount(t,state,view){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
 const {default:StrategicPersonnelMenu}=await import('../web/app/StrategicPersonnelMenu.tsx');
 const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));let current=state,closed=false;
 function Screen(){const [s,setState]=useState(state),[show,setShow]=useState(true);current=s;const props={state:s,roster:rosterFor(s),dispatch:a=>setState(old=>order(old,a))};return view==='recruitment'?h(Recruitment,props):view==='attention'?h(ContractAttention,props):show?h(StrategicPersonnelMenu,{...props,id:107,kind:'contract',onClose:()=>{closed=true;setShow(false);}}):null;}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Screen)));
 return {doc:dom.window.document,state:()=>current,closed:()=>closed,
  button(text,scope=dom.window.document){const button=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(button,text);return button;},
  async click(button){assert.equal(button.disabled,false);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}
 };
}

test('the real hiring card discloses the named refusal and existing dismissal restores a guarded paid renewal',async t=>{
 const state=pair(),expiry=contractExpiresSeconds(state.contracts[107]),m=await mount(t,state,'recruitment');
 const card=()=>m.doc.querySelector('[data-operative-id="107"]');
 assert.match(card().textContent,/Inés Aguirre.*Gaspar Villalba.*trato a los pacientes/);
 assert.equal([...card().querySelectorAll('button')].find(b=>b.textContent.startsWith('Renovar')).disabled,true);
 await m.click(card().querySelector('button.candidate-face'));const dossier=m.doc.querySelector('[role="dialog"]');assert.ok(dossier);assert.match(dossier.textContent,/Condiciones de servicio.*Gaspar Villalba/);
 await m.click(m.button('Cerrar hoja de servicio',dossier));
 const cash=m.state().resources.treasury;await m.click(m.button('Finalizar servicio de Gaspar Villalba',card()));
 assert.equal(m.state().recruited.includes(112),false);assert.equal(m.state().resources.treasury,cash);assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry);
 assert.equal(card().querySelector('.service-refusal'),null);const quote=contractQuote(m.state(),rosterFor(m.state()).find(o=>o.id===107));
 await m.click([...card().querySelectorAll('button')].find(b=>b.textContent.startsWith('Renovar')));
 assert.equal(m.state().resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry+24*3600);assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
});

test('the personnel contract menu names the conflict and preserves the ordinary dismissal and exact renewal actions',async t=>{
 const state=pair(),expiry=contractExpiresSeconds(state.contracts[107]),m=await mount(t,state,'menu');
 assert.match(m.doc.body.textContent,/Inés Aguirre.*Gaspar Villalba/);assert.equal([...m.doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Un día')).disabled,true);
 await m.click(m.button('Finalizar servicio de Gaspar Villalba'));assert.equal(m.closed(),false);assert.ok(m.state().recruited.includes(107));assert.ok(!m.state().recruited.includes(112));assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry);
 const quote=contractQuote(m.state(),rosterFor(m.state()).find(o=>o.id===107)),cash=m.state().resources.treasury;
 await m.click([...m.doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Un día')));
 assert.equal(m.closed(),true);assert.equal(m.state().resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry+24*3600);
});

test('the real renewal notice offers the named choice and retains its exact guarded timestamp',async t=>{
 let state=pair();state=order(state,{type:'wait',hours:24});assert.equal(state.hour,22);assert.equal(state.secondOfHour,17);
 state=decodeSave(encodeSave(state)).campaign;const m=await mount(t,state,'attention');
 assert.match(m.doc.body.textContent,/Inés Aguirre.*Gaspar Villalba/);assert.match(m.doc.body.textContent,/termina en 2 horas/);
 const renewals=()=>[...m.doc.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')?.startsWith('Renovar a Aguirre'));
 assert.equal(renewals().length,3);assert.ok(renewals().every(b=>b.disabled));const expiry=contractExpiresSeconds(m.state().contracts[107]);
 await m.click(m.button('Finalizar servicio de Gaspar Villalba'));assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry);assert.ok(renewals().every(b=>!b.disabled));
 await m.click(renewals()[0]);assert.equal(m.state().contracts[107].expiresAt,48);assert.equal(m.state().contracts[107].expiresSecond,17);assert.match(m.doc.body.textContent,/ya fue renovado/);assert.equal(renewals().length,0);assert.ok(decodeSave(encodeSave(m.state())));
});

test('a marching rival cannot be dismissed through the compact relationship notice',async t=>{
 let state=pair();state=order(state,{type:'createSquad',name:'Reserva sanitaria',ids:[112]});state=order(state,{type:'attack',sector:'buenos_aires',queue:true});
 const m=await mount(t,state,'recruitment'),card=m.doc.querySelector('[data-operative-id="107"]'),button=m.button('Finalizar servicio de Gaspar Villalba',card);
 assert.equal(button.disabled,true);assert.match(button.title,/Esperá a que llegue/);assert.deepEqual(m.state(),state);
});
