import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {strategicSquadSlots,strategicSquadAssignments} from '../game/strategic-squad-assignments.js';
import {contractQuote} from '../game/contracts.js';
const {default:StrategicRoster}=await import('../web/app/StrategicRoster.tsx');
const {default:StrategicPersonnelMenu}=await import('../web/app/StrategicPersonnelMenu.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const noop=()=>{},order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const unchanged=s=>({...s,lastError:null});

// An explicit existing twelve-person army isolates the roster display and
// reassignment capacity. It is not a fresh-player campaign or a route proof.
function existingArmy(){
 const s=initialCampaign(),ids=rosterFor(s).slice(0,12).map(op=>op.id);
 s.recruited=ids;s.squad=ids.slice(0,6);s.squads=[{id:'squad-1',name:'Primera escuadra',members:[...s.squad],location:'retiro'},{id:'squad-2',name:'Reserva del puerto',members:ids.slice(6),location:'retiro'}];
 s.contracts=Object.fromEntries(ids.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));
 return order(s,{type:'selectSquad',id:s.activeSquadId});
}

test('the dense roster renders twelve person rows with six columns and no squad table or duplicate funds',()=>{
 const state=existingArmy(),before=structuredClone(state),html=render(h(StrategicRoster,{state,roster:rosterFor(state),onDossier:noop,onOpenDesk:noop,onAssignment:noop,onContract:noop,onDestination:noop,dispatch:noop})),doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelector('.personnel-title h2').textContent,'Nómina');assert.equal(doc.querySelectorAll('table').length,1);
 assert.equal(doc.querySelectorAll('.merc-map-table tbody tr').length,12);assert.equal(doc.querySelectorAll('.merc-map-table thead th').length,6);
 assert.equal(doc.querySelector('.merc-map-table thead th:last-child').textContent,'Fin contrato');assert.equal(doc.querySelector('.squad-map-table'),null);
 assert.ok(!doc.body.textContent.includes('Organizar escuadras'));assert.ok(!doc.querySelector('.roster-footer'));assert.ok(!doc.body.textContent.includes('pesos'));
 assert.deepEqual([...doc.querySelectorAll('[data-operative-id]')].map(row=>Number(row.dataset.operativeId)),state.recruited);assert.deepEqual(state,before);
});

test('forming numbered slot six first preserves named squads, duty, inventory and the saved slot identity',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'});state=order(state,{type:'assignCare',operativeId:10,assignment:'doctor'});
 const before=structuredClone(state),choice=strategicSquadAssignments(state,3,rosterFor(state).find(op=>op.id===3)).find(slot=>slot.number===6);
 assert.equal(choice.reason,null);assert.deepEqual(state,before);
 const assigned=order(state,choice.action),created=assigned.squads.find(q=>q.name==='Escuadra 6');assert.ok(created);assert.deepEqual(created.members,[3]);
 assert.equal(assigned.operativeState[3].assignment,'active');assert.equal(assigned.operativeState[10].assignment,'doctor');assert.deepEqual(assigned.squads[0],{...before.squads[0],members:[4,10]});
 for(const id of state.recruited){const changed=assigned.operativeState[id],previous=before.operativeState[id];assert.deepEqual(changed.inventory,previous.inventory);assert.equal(changed.hp,previous.hp);assert.equal(changed.medkits,previous.medkits);}
 assert.equal(assigned.hour,before.hour);assert.deepEqual(assigned.resources,before.resources);assert.deepEqual(state,before);
 const loaded=decodeSave(encodeSave(assigned)).campaign;assert.equal(strategicSquadSlots(loaded)[5].squad.id,created.id);assert.equal(strategicSquadSlots(loaded)[1].squad,null);
});

test('failed squad and duty changes preserve the complete campaign, and ordinary callers keep their previous duty',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:10,assignment:'rest'});state=order(state,{type:'createSquad',name:'Reserva',ids:[10]});assert.equal(state.operativeState[10].assignment,'rest');
 state=order(state,{type:'selectSquad',id:'squad-1'});state=order(state,{type:'travel',sector:'buenos_aires'});
 const before=structuredClone(state),action={type:'assignToSquad',operativeId:10,squadId:'squad-1',returnToService:true};
 const rejected=dispatchCampaign(state,action);assert.match(rejected.lastError,/mismo sector/);assert.deepEqual(unchanged(rejected),unchanged(state));assert.deepEqual(state,before);
 const create=dispatchCampaign(state,{type:'createSquad',name:'Escuadra 6',ids:[10],sector:'buenos_aires',returnToService:true});assert.ok(create.lastError);assert.deepEqual(unchanged(create),unchanged(state));
 const own=order(state,{...action,squadId:state.squads.find(q=>q.members.includes(10)).id});assert.equal(own.operativeState[10].assignment,'active');
});

test('joining an existing named squad returns only the chosen person to duty, with no missing or duplicated members',()=>{
 let state=order(initialCampaign(),{type:'createSquad',name:'Reserva médica',ids:[10]});state=order(state,{type:'assignCare',operativeId:3,assignment:'rest'});state=order(state,{type:'assignCare',operativeId:10,assignment:'doctor'});
 const choice=strategicSquadAssignments(state,3,rosterFor(state).find(op=>op.id===3)).find(slot=>slot.number===2),assigned=order(state,choice.action);
 assert.deepEqual(assigned.squads.map(q=>q.members),[[4],[10,3]]);assert.equal(assigned.squads[1].name,'Reserva médica');assert.equal(assigned.operativeState[3].assignment,'active');assert.equal(assigned.operativeState[10].assignment,'doctor');
 assert.deepEqual(assigned.squads.flatMap(q=>q.members).sort((a,b)=>a-b),[3,4,10]);assert.deepEqual(decodeSave(encodeSave(assigned)).campaign,assigned);
});

test('full, remote, traveling and militia-training slots are unavailable while old seventh/eighth squads remain reachable',()=>{
 let state=existingArmy(),id=state.squad[0];assert.match(strategicSquadAssignments(state,id).find(slot=>slot.number===2).reason,/seis combatientes/);
 const before=structuredClone(state),rejected=dispatchCampaign(state,{type:'assignToSquad',operativeId:id,squadId:'squad-2',returnToService:true});assert.ok(rejected.lastError);assert.deepEqual(unchanged(rejected),unchanged(before));
 state.squads[1].members.pop();state.squads[1].location='buenos_aires';assert.match(strategicSquadAssignments(state,id).find(slot=>slot.number===2).reason,/mismo sector/);
 const traveler=order(initialCampaign(),{type:'travel',sector:'buenos_aires',queue:true});assert.ok(strategicSquadAssignments(traveler,3).every(slot=>slot.reason));
 const training=initialCampaign();training.militiaTraining=[{trainerId:10}];assert.match(strategicSquadAssignments(training,10,rosterFor(training).find(op=>op.id===10))[5].reason,/instrucción/);
 const trainingRejected=dispatchCampaign(training,{type:'createSquad',name:'Escuadra 6',ids:[10],sector:'retiro',returnToService:true});assert.match(trainingRejected.lastError,/instrucción/);assert.deepEqual(unchanged(trainingRejected),unchanged(training),'the duty guard also rolls back a squad already formed in the working copy');
 const old=initialCampaign();old.squads.push(...Array.from({length:7},(_,i)=>({id:`squad-${i+2}`,name:`Guardia histórica ${i+2}`,members:[],location:'retiro'})));
 const slots=strategicSquadAssignments(old,3);assert.equal(slots.length,8);assert.equal(slots[6].label,'Guardia histórica 7');assert.equal(slots[7].action.squadId,'squad-8');assert.equal(slots[7].reason,null);
});

async function mountMenu(t,state,id,kind='assignment'){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test'}),globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true},previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));let current,closed=0;const actions=[];
 function Screen(){const[s,set]=useState(state);current=s;return h(StrategicPersonnelMenu,{state:s,roster:rosterFor(s),id,kind,onClose(){closed++;},dispatch:a=>{actions.push(a);set(s=>dispatchCampaign(s,a));}});}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 await act(async()=>root.render(h(Screen)));return{doc:dom.window.document,state:()=>current,actions,closed:()=>closed,async click(label){const b=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);assert.ok(b,label);assert.equal(b.disabled,false);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}};
}

test('assignment opens six numbered buttons and a click forms an actual saved squad in active service',async t=>{
 const state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'}),m=await mountMenu(t,state,3);
 assert.equal(m.doc.querySelector('.strategic-squad-options'),null);await m.click('Escuadra ›');
 assert.deepEqual([...m.doc.querySelectorAll('.strategic-squad-options button')].map(b=>b.textContent),Array.from({length:6},(_,i)=>`Escuadra ${i+1}`));
 await m.click('Escuadra 6');assert.equal(m.actions.length,1);assert.equal(m.actions[0].returnToService,true);assert.equal(m.closed(),1);assert.equal(m.state().lastError,null);assert.equal(m.state().operativeState[3].assignment,'active');
 const loaded=decodeSave(encodeSave(m.state())).campaign;assert.deepEqual(strategicSquadSlots(loaded)[5].squad.members,[3]);
});

test('the contract menu renews with the displayed exact second deadline and charges the current quote',async t=>{
 let state=order(initialCampaign(),{type:'advanceStrategicTime',seconds:121});state=order(state,{type:'recruitCivic',id:103,term:'day'});state=decodeSave(encodeSave(state)).campaign;
 const quote=contractQuote(state,rosterFor(state).find(op=>op.id===103),'day'),m=await mountMenu(t,state,103,'contract');
 await m.click(`Un día · ${quote.price.toLocaleString('es-AR')} pesos`);assert.equal(m.actions[0].expectedExpiresAt,24);assert.equal(m.actions[0].expectedExpiresSecond,121);
 assert.equal(m.state().lastError,null);assert.equal(m.state().resources.treasury,state.resources.treasury-quote.price);assert.equal(m.state().contracts[103].expiresAt,48);assert.equal(m.state().contracts[103].expiresSecond,121);
});

async function mountCampaignMenus(t,{narrow=false}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true}),globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true},previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 if(narrow){const style=dom.window.document.createElement('style');style.textContent='.strategy-layout > .strategy-personnel { display: none; }';dom.window.document.head.append(style);}
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));let current;const actions=[];
 function Screen(){const[s,set]=useState(initialCampaign());current=s;return h(Campaign,{state:s,dispatch:a=>{actions.push(a);set(s=>dispatchCampaign(s,a));},onBattle:noop,onOpenDesk:noop});}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 await act(async()=>root.render(h(Screen)));
 const fire=async(element,event)=>{assert.ok(element);await act(async()=>element.dispatchEvent(event));return event;};
 return{doc:dom.window.document,state:()=>current,actions,click:element=>fire(element,new dom.window.MouseEvent('click',{bubbles:true})),key:(element,key,shiftKey=false)=>fire(element,new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}))};
}

for(const kind of ['assignment','contract'])test(`${kind} menu traps Tab in both directions and Escape restores the desktop person button`,async t=>{
 const m=await mountCampaignMenus(t),state=structuredClone(m.state()),label=kind==='assignment'?'Asignación: Cabral':'Fin contrato: Cabral',trigger=m.doc.querySelector(`.strategy-layout button[aria-label="${label}"]`);
 trigger.focus();await m.click(trigger);const dialog=m.doc.querySelector('.strategic-person-menu'),first=dialog.querySelector('button[aria-label="Cerrar"]'),last=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Cancelar');
 assert.equal(m.doc.activeElement,first);last.focus();assert.equal(m.doc.activeElement,last);assert.equal((await m.key(last,'Tab')).defaultPrevented,true);assert.equal(m.doc.activeElement,first);
 assert.equal((await m.key(first,'Tab',true)).defaultPrevented,true);assert.equal(m.doc.activeElement,last);
 assert.equal((await m.key(last,'Escape')).defaultPrevented,true);assert.equal(m.doc.querySelector('.strategic-person-menu'),null);assert.equal(m.doc.activeElement,trigger);assert.deepEqual(m.actions,[]);assert.deepEqual(m.state(),state);
});

test('closing the person menu after the narrow roster unmounts restores the visible Nómina button',async t=>{
 const m=await mountCampaignMenus(t,{narrow:true}),nomina=m.doc.querySelector('.strategy-roster-open'),state=structuredClone(m.state());
 nomina.focus();await m.click(nomina);const panel=m.doc.querySelector('.strategic-panel-dialog'),trigger=panel.querySelector('button[aria-label="Asignación: Cabral"]');trigger.focus();await m.click(trigger);
 assert.equal(trigger.isConnected,false);assert.equal(m.doc.querySelector('.strategic-panel-dialog'),null);const close=m.doc.querySelector('.strategic-person-menu button[aria-label="Cerrar"]');assert.equal(m.doc.activeElement,close);
 await m.key(close,'Escape');assert.equal(m.doc.querySelector('.strategic-person-menu'),null);assert.equal(m.doc.activeElement,nomina);assert.deepEqual(m.actions,[]);assert.deepEqual(m.state(),state);
});

test('a squad action closes the modal and restores its actual assignment trigger after the roster updates',async t=>{
 const m=await mountCampaignMenus(t),trigger=m.doc.querySelector('.strategy-layout button[aria-label="Asignación: Cabral"]');trigger.focus();await m.click(trigger);
 await m.click([...m.doc.querySelectorAll('.strategic-person-menu button')].find(b=>b.textContent==='Escuadra ›'));
 await m.click([...m.doc.querySelectorAll('.strategic-squad-options button')].find(b=>b.textContent==='Escuadra 6'));
 assert.equal(m.doc.querySelector('.strategic-person-menu'),null);assert.equal(m.doc.activeElement,trigger);assert.equal(m.state().lastError,null);assert.deepEqual(m.state().squads.find(q=>q.name==='Escuadra 6').members,[3]);assert.equal(m.actions.length,1);
});
