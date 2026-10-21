import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {worldCell} from '../game/world-cells.js';
import {publicAssignmentNotice,assignmentAttentionText} from '../game/assignment-attention.js';
const {default:AssignmentAttention}=await import('../web/app/AssignmentAttention.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const noop=()=>{};
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null);return next;};
const draw=state=>render(h(AssignmentAttention,{state,roster:rosterFor(state)}));
const textOnly=markup=>markup.replace(/<[^>]*>/g,'');

test('assignment status is absent until an explicit advance has a notice',()=>{
 const state=initialCampaign();assert.equal(draw(state),'');
 const resting=order(state,{type:'assignCare',operativeId:3,assignment:'rest'});
 assert.equal(draw(resting),'','an assignment change alone does not create a pause notice');
});

test('a preflight assignment pause reports zero elapsed hours and keeps resume in the existing advance control',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'});
 state=order(state,{type:'wait',hours:24});
 const notice=publicAssignmentNotice(state);assert.equal(notice.advancedHours,0);assert.equal(notice.requestedHours,24);
 const markup=draw(state),text=textOnly(markup);
 assert.match(markup,/role="status"/);assert.match(markup,/aria-live="polite"/);assert.match(markup,/aria-atomic="true"/);
 assert.match(text,/Tiempo avanzado: 0 de 24 horas solicitadas/);assert.match(text,/Día 1 · 00:00/);
 assert.match(text,/Al pulsar Iniciar de nuevo, comienza un nuevo período desde la hora actual/);
 assert.ok(text.includes(assignmentAttentionText(state,notice.events[0],rosterFor(state))));
 assert.match(markup,/<button type="button"[^>]*aria-label="Cerrar aviso de asignaciones"/);
 assert.equal((markup.match(/<button/g)??[]).length,1,'closing the notice is separate from the clock control');
 assert.doesNotMatch(markup,/role="dialog"|reported|binding/);
 assert.equal(draw(state),markup,'the notice remains visible during ordinary rerenders');
});

test('the notice lists every affected person with the shared assignment, sector and reason text',()=>{
 let state=initialCampaign();
 for(const operativeId of [3,4]){state.operativeState[operativeId].energy=88;state=order(state,{type:'assignCare',operativeId,assignment:'rest'});}
 state=order(state,{type:'wait',hours:6});
 const notice=publicAssignmentNotice(state);assert.equal(notice.advancedHours,1);assert.equal(notice.events.length,2);
 const markup=draw(state),text=textOnly(markup);assert.match(text,/Tiempo avanzado: 1 de 6 horas solicitadas/);
 assert.match(text,/Día 1 · 01:00/);assert.equal((markup.match(/<li>/g)??[]).length,2);
 for(const event of notice.events)assert.ok(text.includes(assignmentAttentionText(state,event,rosterFor(state))));
});

test('a doctor who uses the last kit is identified with the blocked task and sector reason',()=>{
 let state=initialCampaign();state.operativeState[3].hp-=20;state.operativeState[10].medkits=1;
 state=order(state,{type:'assignCare',operativeId:3,assignment:'patient'});
 state=order(state,{type:'assignCare',operativeId:10,assignment:'doctor'});
 state=order(state,{type:'wait',hours:6});
 const notice=publicAssignmentNotice(state),doctor=notice.events.find(event=>event.operativeId===10);
 assert.equal(notice.advancedHours,1);assert.equal(doctor.code,'no_medkits');assert.equal(doctor.state,'blocked');
 const text=textOnly(draw(state));assert.match(text,/1 de 6 horas solicitadas/);
 assert.match(text,/Paroissien · Médico en Buenos Aires · Fuerte y Retiro/);assert.match(text,/vendas/);
 assert.ok(text.includes(assignmentAttentionText(state,doctor,rosterFor(state))));
});

test('Campaign shows the notice beside its time controls and an ordinary new advance clears an unchanged acknowledged pause',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'});
 state=order(state,{type:'wait',hours:6});
 const markup=render(h(Campaign,{state,dispatch:noop,onBattle:noop,onOpenDesk:noop}));
 assert.equal((markup.match(/aria-label="Avance detenido por asignaciones"/g)??[]).length,1);
 assert.equal((markup.match(/>▶ Iniciar<\/button>/g)??[]).length,1);
 assert.match(markup,/aria-label="Velocidad del tiempo"/);
 assert.doesNotMatch(markup,/aria-label="Tiempo a avanzar"/);
 assert.ok(markup.indexOf('assignment-attention')>markup.indexOf('</header>'));
 assert.ok(markup.indexOf('assignment-attention')<markup.indexOf('strategy-layout'));
 const resumed=order(state,{type:'wait',hours:1});assert.equal(resumed.hour,state.hour+1);assert.equal(draw(resumed),'');
});

async function mounted(t,element){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const show=async value=>act(async()=>root.render(value));await show(element);
 return {document:dom.window.document,show,click:async element=>{assert.ok(element);await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}};
}

test('dismissal hides the same assignment notice through corrections and exposes the next notice',async t=>{
 let state=order(order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'}),{type:'wait',hours:6});
 const props=state=>({state,roster:rosterFor(state)}),before=structuredClone(state),saved=decodeSave(encodeSave(state)),m=await mounted(t,h(AssignmentAttention,props(state)));
 const notice=()=>m.document.querySelector('[aria-label="Avance detenido por asignaciones"]');
 await m.click(m.document.querySelector('[aria-label="Cerrar aviso de asignaciones"]'));
 assert.equal(notice(),null);assert.deepEqual(state,before);assert.deepEqual(decodeSave(encodeSave(state)),saved);
 await m.show(h(AssignmentAttention,props(structuredClone(state))));assert.equal(notice(),null,'a cloned campaign update must not reopen an acknowledged notice');
 state=order(state,{type:'assignCare',operativeId:3,assignment:'active'});
 await m.show(h(AssignmentAttention,props(state)));assert.equal(notice(),null,'fixing the assignment keeps the existing notice dismissed');
 state=order(order(state,{type:'assignCare',operativeId:4,assignment:'rest'}),{type:'wait',hours:6});
 await m.show(h(AssignmentAttention,props(state)));assert.ok(notice());assert.match(notice().textContent,/Dorrego/,'a different notice is shown without resuming the clock');
 await m.click(m.document.querySelector('[aria-label="Cerrar aviso de asignaciones"]'));
 await m.show(h(AssignmentAttention,props({...state,assignmentAttention:{...state.assignmentAttention,notice:null}})));
 await m.show(h(AssignmentAttention,props(state)));assert.ok(notice(),'a cleared notice does not suppress a later occurrence');
});

test('closing the assignment overlay leaves the map selectable and the strategic clock paused',async t=>{
 const state=order(order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'}),{type:'wait',hours:6}),before=structuredClone(state),saved=decodeSave(encodeSave(state)),actions=[];
 const m=await mounted(t,h(Campaign,{state,dispatch:action=>actions.push(action),onBattle:noop,onOpenDesk:noop}));
 const clock=()=>[...m.document.querySelectorAll('button')].find(button=>button.textContent==='▶ Iniciar');
 assert.equal(clock().getAttribute('aria-pressed'),'false');
 await m.click(m.document.querySelector('[aria-label="Cerrar aviso de asignaciones"]'));
 assert.equal(m.document.querySelector('.strategy-encounters').childElementCount,0,'the empty overlay no longer contains a panel over the map');
 assert.equal(clock().getAttribute('aria-pressed'),'false');assert.deepEqual(actions,[]);
 const target=m.document.querySelector(`[data-map-cell="${worldCell('salta',state).id}"]`);await m.click(target);
 assert.equal(target.getAttribute('aria-pressed'),'true');assert.match(m.document.querySelector('[role="dialog"]').getAttribute('aria-label'),/Salta/);
 assert.deepEqual(actions,[]);assert.deepEqual(state,before);assert.deepEqual(decodeSave(encodeSave(state)),saved);
});

test('an identical pause at the same hour appears after the assignment is fixed and rearmed',async t=>{
 let state=order(order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'}),{type:'wait',hours:6});
 const props=state=>({state,roster:rosterFor(state)}),first=structuredClone(state.assignmentAttention.notice),m=await mounted(t,h(AssignmentAttention,props(state)));
 const notice=()=>m.document.querySelector('[aria-label="Avance detenido por asignaciones"]');
 await m.click(m.document.querySelector('[aria-label="Cerrar aviso de asignaciones"]'));assert.equal(notice(),null);
 state=order(state,{type:'assignCare',operativeId:3,assignment:'active'});
 assert.deepEqual(state.assignmentAttention.reported,{});
 await m.show(h(AssignmentAttention,props(state)));assert.equal(notice(),null,'clearing a reported marker does not reopen the historical notice');
 state=order(state,{type:'assignCare',operativeId:3,assignment:'rest'});
 await m.show(h(AssignmentAttention,props(state)));assert.equal(notice(),null,'reassigning alone has not requested another pause');
 state=order(state,{type:'wait',hours:6});assert.deepEqual(state.assignmentAttention.notice,first,'the new preflight pause has the exact same record');
 await m.show(h(AssignmentAttention,props(state)));assert.ok(notice(),'the newly reported pause must be visible');
 await m.click(m.document.querySelector('[aria-label="Cerrar aviso de asignaciones"]'));assert.equal(notice(),null);
 await m.show(h(AssignmentAttention,props(structuredClone(state))));assert.equal(notice(),null,'an unrelated update does not reopen the new dismissed occurrence');
});
