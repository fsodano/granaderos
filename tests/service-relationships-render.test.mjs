import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {defaultContentPackage} from '../game/content-package.js';
import {enterSector} from '../game/world.js';
import {preparedConductArena,executePaidConductRoute} from './conduct-objections-fixture.mjs';
import {earnLowMoraleRenewal} from './morale-renewal-fixture.mjs';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const pair=()=>order(order(order(initialCampaign(),{type:'advanceStrategicTime',seconds:17}),{type:'recruitCivic',id:107,term:'day'}),{type:'recruitCivic',id:112,term:'week'});

async function mount(t,state,view,id=107){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
 const {default:StrategicPersonnelMenu}=await import('../web/app/StrategicPersonnelMenu.tsx');
 const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
 const {default:ReceivedCorrespondence}=await import('../web/app/ReceivedCorrespondence.tsx');
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));let current=state,closed=false,send,replace,changeView;
 function Screen(){const [s,setState]=useState(state),[show,setShow]=useState(true),[currentView,setView]=useState(view);current=s;send=a=>setState(old=>order(old,a));replace=next=>setState(next);changeView=next=>{setView(next);setShow(true);closed=false;};const props={state:s,roster:rosterFor(s),dispatch:send};return currentView==='recruitment'?h(Recruitment,props):currentView==='attention'?h(ContractAttention,props):currentView==='inbox'?h(ReceivedCorrespondence,{state:s}):show?h(StrategicPersonnelMenu,{...props,id,kind:currentView==='assignment'?'assignment':'contract',onClose:()=>{closed=true;setShow(false);}}):null;}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Screen)));
 return {doc:dom.window.document,state:()=>current,closed:()=>closed,
  button(text,scope=dom.window.document){const button=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(button,text);return button;},
  async click(button){assert.equal(button.disabled,false);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async issue(action){await act(async()=>send(action));},async replace(next){await act(async()=>replace(next));},async view(next){await act(async()=>changeView(next));}
 };
}

test('the real hiring card discloses the named refusal and existing dismissal restores a guarded paid renewal',async t=>{
 const state=pair(),expiry=contractExpiresSeconds(state.contracts[107]),m=await mount(t,state,'recruitment');
 const card=()=>m.doc.querySelector('[data-operative-id="107"]');
 assert.match(card().textContent,/Inés Aguirre.*Gaspar Villalba.*trato a los pacientes/);
 assert.match(card().textContent,/Compañeros preferidos: Petrona Lagos/);
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
 assert.match(m.doc.body.textContent,/Compañeros preferidos: Petrona Lagos.*al iniciar un despliegue/iu);
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

test('real hiring and saved deployment disclose the directed preference without changing paid service',async t=>{
 const content=defaultContentPackage();let state=initialCampaign(42,content);const m=await mount(t,state,'recruitment');
 const card=id=>m.doc.querySelector(`[data-operative-id="${id}"]`),preference=()=>card(107).querySelector('.companion-preferences');
 assert.match(preference().textContent,/Petrona Lagos.*hasta \+3.*no supera \+5.*No cambia la paga ni el contrato/);assert.doesNotMatch(preference().textContent,/Apoyo de/);assert.equal(card(116).querySelector('.companion-preferences'),null,'the authored default is directed');
 assert.match(card(107).textContent,/Si ve directamente una orden intencional matar a un civil no combatiente.*rechaza nuevos contratos.*plazo ya pagado/);assert.equal(card(107).querySelector('[aria-label="Objeción de servicio"]'),null,'disclosure does not claim an event');
 assert.match(preference().textContent,/Si ve morir a un compañero preferido que participa en el despliegue, pierde hasta 6 puntos de moral adicionales/);
 await m.click(card(107).querySelector('.candidate-face'));const dossier=m.doc.querySelector('[role="dialog"]');assert.match(dossier.textContent,/Petrona Lagos: Confía en su ayuda para atender heridos/);assert.match(dossier.textContent,/civil no combatiente.*rechaza nuevos contratos.*plazo ya pagado/);await m.click(m.button('Cerrar hoja de servicio',dossier));assert.deepEqual(m.state(),state,'reading a preference does not perform an order');
 for(const id of [107,116]){
  const before=m.state(),quote=contractQuote(before,rosterFor(before).find(o=>o.id===id));await m.click([...card(id).querySelectorAll('button')].find(b=>b.textContent.startsWith('Contratar')));
  assert.equal(m.state().resources.treasury,before.resources.treasury-quote.price);assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
 }
 for(let i=0;i<6;i++)await m.issue({type:'advanceStrategicTime',seconds:3600});
 state=decodeSave(encodeSave(m.state())).campaign;assert.equal(state.hour,6);assert.ok([107,116].every(id=>state.recruited.includes(id)));const contracts=structuredClone(state.contracts),cash=state.resources.treasury,personal=state.operativeState[107].morale;
 await m.replace(state);await m.issue({type:'visitSector'});const deployed=m.state(),issued=deployed.pendingBattle.squad.find(u=>u.id===107);assert.equal(issued.companionId,116);assert.equal(issued.companionBonus,3);assert.equal(issued.personalMorale,personal);
 assert.match(preference().textContent,/Apoyo de Petrona Lagos al inicio del despliegue: \+3 de moral/);
 const battle=enterSector(deployed.pendingBattle),pair=decodeSave(encodeSave(deployed,battle));assert.deepEqual(pair.campaign,deployed);assert.deepEqual(pair.battle,battle);assert.deepEqual(order(state,{type:'visitSector'}),deployed,'saved public-order replay preserves the same issued source and support');
 await m.replace(pair.campaign);assert.match(preference().textContent,/Apoyo de Petrona Lagos al inicio del despliegue: \+3 de moral/);
 await m.issue({type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.deepEqual(m.state().contracts,contracts);assert.equal(m.state().resources.treasury,cash);assert.equal(m.state().operativeState[107].morale,personal);assert.doesNotMatch(preference().textContent,/Apoyo de/);assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
 const old=defaultContentPackage();for(const c of old.characters)delete c.preferredCompanions;await m.replace(initialCampaign(42,old));assert.equal(preference(),null,'a pinned older package remains neutral in the real hiring UI');
});

test('assignment choices disclose prospective support without granting it merely for reading or regrouping',async t=>{
 let state=order(order(initialCampaign(),{type:'recruitCivic',id:107,term:'week'}),{type:'recruitCivic',id:116,term:'week'});state=decodeSave(encodeSave(state)).campaign;
 const personal=state.operativeState[107].morale,cash=state.resources.treasury,contracts=structuredClone(state.contracts),m=await mount(t,state,'assignment');
 assert.match(m.doc.body.textContent,/Petrona Lagos.*Al iniciar un despliegue.*hasta \+3/);assert.doesNotMatch(m.doc.body.textContent,/Apoyo de/);assert.deepEqual(m.state(),state);
 await m.click(m.button('Escuadra ›'));await m.click(m.button('Escuadra 2'));
 assert.equal(m.closed(),true);assert.ok(m.state().squads.find(q=>q.name==='Escuadra 2').members.includes(107));assert.equal(m.state().operativeState[107].morale,personal);assert.equal(m.state().resources.treasury,cash);assert.deepEqual(m.state().contracts,contracts);assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
});


test('the hiring card and real dossier explain authored care, isolation, renewal and load conditions while older pinned prose remains neutral',async t=>{
 const content=defaultContentPackage();content.characters.find(person=>person.id==='person-130').abilities.push('scatter_concealment');
 const state=initialCampaign(42,content),m=await mount(t,state,'recruitment');
 const card=()=>m.doc.querySelector('[data-operative-id="130"]');
 assert.match(card().textContent,/Serenidad al cuidar/);assert.match(card().textContent,/otra persona a la vista.*hasta 2 puntos de tensión.*PA.*vendas.*sí mismo/);
 assert.match(card().textContent,/Temor al aislamiento.*moral menor que 50.*compañero militar capaz.*cuatro casillas.*misma superficie.*hasta 2 puntos de tensión.*turno de combate.*tras la recuperación habitual.*Fuera del despliegue.*hasta 1 punto de moral por hora.*misma escuadra durante la marcha.*mismo sector al detenerse.*máximo 20 puntos.*impide recuperar moral mediante descanso.*no devuelve moral ni tensión/);
 assert.match(card().textContent,/carga de perdigones en cualquier arma de fuego.*mitad.*ocultación.*puntería.*No reduce la resistencia.*ni revela blancos ocultos.*No se aplica.*bala única/);
 assert.match(card().textContent,/moral personal menor que 30.*rechaza renovar.*30 o más.*plazo ya pagado.*apoyo temporal.*no evita el rechazo.*no impide contratarse de nuevo/);
 assert.equal(card().querySelector('[aria-label="Rechazo de renovación por moral"]'),null,'prospective disclosure does not claim a current refusal before hire');
 await m.click(card().querySelector('.candidate-face'));const dossier=m.doc.querySelector('[role="dialog"]');assert.match(dossier.textContent,/Serenidad al cuidar/);assert.match(dossier.textContent,/otra persona a la vista.*hasta 2 puntos de tensión.*PA.*vendas.*sí mismo/);
 assert.match(dossier.textContent,/Temor al aislamiento.*moral menor que 50.*compañero militar capaz.*cuatro casillas.*misma superficie.*turno de combate.*Fuera del despliegue.*hasta 1 punto de moral por hora.*máximo 20 puntos.*no devuelve moral ni tensión/);
 assert.match(dossier.textContent,/carga de perdigones en cualquier arma de fuego.*mitad.*ocultación.*puntería.*No se aplica.*bala única/);
 assert.match(dossier.textContent,/moral personal menor que 30.*rechaza renovar.*30 o más.*plazo ya pagado/);
 assert.match(dossier.textContent,/La rutina de atender a otros le devuelve la calma/);await m.click(m.button('Cerrar hoja de servicio',dossier));assert.deepEqual(m.state(),state,'reading the condition changes no money, contract, health or shock');
 const quote=contractQuote(state,rosterFor(state).find(o=>o.id===130),'day');await m.click([...card().querySelectorAll('button')].find(button=>button.textContent.startsWith('Contratar')));
 assert.equal(m.state().resources.treasury,state.resources.treasury-quote.price);assert.equal(m.state().hiringArrivals.find(arrival=>arrival.operativeId===130).paid,quote.price);assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state(),'the actual first hire stays available and retains its paid arrival');
 const old=structuredClone(content);delete old.characters.find(c=>c.id==='person-130').abilities;await m.replace(decodeSave(encodeSave(initialCampaign(42,old))).campaign);
 assert.doesNotMatch(card().textContent,/Serenidad al cuidar|Temor al aislamiento|Tiro entre cobertura|hasta 2 puntos de tensión|Renovación según el ánimo|rechaza renovar/);await m.click(card().querySelector('.candidate-face'));
 assert.match(m.doc.querySelector('[role="dialog"]').textContent,/La rutina de atender a otros le devuelve la calma/);assert.doesNotMatch(m.doc.querySelector('[role="dialog"]').textContent,/Serenidad al cuidar|Temor al aislamiento|Tiro entre cobertura|hasta 2 puntos de tensión|Renovación según el ánimo|rechaza renovar/);
});

test('real saved conduct objection remains visible across paid service, renewal controls, correspondence and refused rehire',async t=>{
 const fixture=preparedConductArena(),route=executePaidConductRoute(fixture.start),state=decodeSave(encodeSave(route.returned)).campaign;
 const expiry=contractExpiresSeconds(fixture.start.campaign.contracts[107]),receipt=structuredClone(state.operativeState[107].serviceObjection),m=await mount(t,state,'recruitment');
 assert.ok(receipt);assert.equal(contractExpiresSeconds(state.contracts[107]),expiry);assert.ok(state.recruited.includes(107));assert.equal(state.operativeState[107].hp,fixture.start.campaign.operativeState[107].hp);
 const card=()=>m.doc.querySelector('[data-operative-id="107"]'),notice=scope=>scope.querySelector('[aria-label="Objeción de servicio"]');
 assert.match(notice(card()).textContent,/Inés Aguirre.*no acepta contratarse ni renovar.*civil no combatiente.*plazo ya pagado/);assert.equal([...card().querySelectorAll('button')].find(b=>b.textContent.startsWith('Renovar')).disabled,true);
 assert.equal([...card().querySelectorAll('button')].some(b=>b.textContent.startsWith('Finalizar servicio de ')),false,'there is no rival-dismissal remedy');
 await m.click(card().querySelector('.candidate-face'));assert.match(notice(m.doc.querySelector('[role="dialog"]')).textContent,/Inés Aguirre.*plazo ya pagado/);await m.click(m.button('Cerrar hoja de servicio'));
 await m.view('inbox');const complaint=[...m.doc.querySelectorAll('nav button')].find(button=>button.textContent.includes('Una objeción al mando'));assert.ok(complaint);await m.click(complaint);
 assert.match(m.doc.querySelector('article').textContent,/Inés Aguirre.*plazo pagado.*contrato/);assert.equal(m.state().correspondence.filter(letter=>letter.id==='service-objection:107').length,1);assert.deepEqual(m.state(),state,'reading the actual received complaint does not alter service or receipt');
 await m.view('menu');assert.ok(notice(m.doc));assert.ok([...m.doc.querySelectorAll('button')].filter(b=>/^(Un día|Una semana|Dos semanas)/.test(b.textContent)).every(b=>b.disabled));
 const current=m.state(),rejected=dispatchCampaign(current,{type:'renewContract',id:107,term:'day',expectedExpiresAt:current.contracts[107].expiresAt,expectedExpiresSecond:current.contracts[107].expiresSecond??0});assert.match(rejected.lastError,/civil no combatiente/);assert.deepEqual({...rejected,lastError:null},{...current,lastError:null},'a refused renewal changes no money, deadline, items or receipt');
 await m.issue({type:'wait',hours:24});assert.ok(m.state().recruited.includes(107));assert.equal(contractExpiresSeconds(m.state().contracts[107]),expiry);assert.deepEqual(m.state().operativeState[107].serviceObjection,receipt);
 await m.replace(decodeSave(encodeSave(m.state())).campaign);await m.view('attention');const row=[...m.doc.querySelectorAll('li')].find(li=>li.textContent.startsWith('Aguirre'));assert.ok(row);assert.equal(expiry-m.state().hour*3600-(m.state().secondOfHour??0),2*3600-29);assert.match(row.textContent,/termina en 1 hora 59 minutos 31 segundos/);assert.ok(notice(row));const renewals=[...row.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')?.startsWith('Renovar a Aguirre'));assert.equal(renewals.length,3);assert.ok(renewals.every(b=>b.disabled));assert.ok(renewals.every(b=>/civil no combatiente/.test(b.title)));
 await m.view('menu');await m.click(m.button('Despedir'));assert.equal(m.closed(),true);assert.equal(m.state().recruited.includes(107),false);assert.deepEqual(m.state().operativeState[107].serviceObjection,receipt);
 await m.replace(decodeSave(encodeSave(m.state())).campaign);await m.view('recruitment');assert.ok(notice(card()));assert.equal([...card().querySelectorAll('button')].find(b=>b.textContent.startsWith('Contratar')).disabled,true);
 const dismissed=m.state(),rehire=dispatchCampaign(dismissed,{type:'recruitCivic',id:107,term:'day'});assert.match(rehire.lastError,/civil no combatiente/);assert.deepEqual({...rehire,lastError:null},{...dismissed,lastError:null});
 const old=executePaidConductRoute(preparedConductArena({oldPinned:true}).start).returned;await m.replace(decodeSave(encodeSave(old)).campaign);assert.equal(notice(card()),null);assert.doesNotMatch(card().textContent,/orden intencional matar|rechaza nuevos contratos/);assert.equal([...card().querySelectorAll('button')].find(b=>b.textContent.startsWith('Renovar')).disabled,false);assert.equal(m.state().correspondence.some(letter=>letter.id==='service-objection:107'),false);
});

test('earned fractional personal morale refuses real renewal controls until ordinary regroup and rest restore eligibility',async t=>{
 const route=earnLowMoraleRenewal(),state=decodeSave(encodeSave(route.pair.campaign)).campaign,m=await mount(t,state,'recruitment',130);
 const card=()=>m.doc.querySelector('[data-operative-id="130"]'),notice=scope=>scope.querySelector('[aria-label="Rechazo de renovación por moral"]');
 const expiry=contractExpiresSeconds(state.contracts[130]),cash=state.resources.treasury;
 assert.ok(state.operativeState[130].morale<30);assert.equal(Math.round(state.operativeState[130].morale),30,'the ordinary rounded display alone cannot explain this refusal');
 assert.match(notice(card()).textContent,/Moral personal: 29,7.*moral personal menor que 30.*30 o más.*elimina este rechazo.*todo el plazo pagado/);
 const renew=()=>[...card().querySelectorAll('button')].find(button=>button.textContent.startsWith('Renovar'));
 assert.equal(renew().disabled,true);await act(async()=>renew().dispatchEvent(new m.doc.defaultView.MouseEvent('click',{bubbles:true})));assert.deepEqual(m.state(),state,'the disabled real card dispatches no order');
 await m.click(card().querySelector('.candidate-face'));assert.match(notice(m.doc.querySelector('[role="dialog"]')).textContent,/Moral personal: 29,7.*plazo pagado/);await m.click(m.button('Cerrar hoja de servicio'));
 await m.view('menu');const menuButtons=()=>[...m.doc.querySelectorAll('button')].filter(button=>/^(Un día|Una semana|Dos semanas)/.test(button.textContent));
 assert.equal(menuButtons().length,3);assert.ok(menuButtons().every(button=>button.disabled&&/moral personal menor que 30/.test(button.title)));assert.match(notice(m.doc).textContent,/29,7.*30 o más/);
 const refused=dispatchCampaign(state,{type:'renewContract',id:130,term:'day',expectedExpiresAt:state.contracts[130].expiresAt,expectedExpiresSecond:state.contracts[130].expiresSecond??0});assert.match(refused.lastError,/moral personal/);assert.deepEqual({...refused,lastError:null},state,'refusal changes no deadline, kit, wounds, cash or saved isolation budget');
 assert.equal(contractExpiresSeconds(m.state().contracts[130]),expiry);assert.equal(m.state().resources.treasury,cash);
 await m.issue({type:'recruitCivic',id:100,term:'week'});await m.issue({type:'wait',hours:6});assert.ok(m.state().recruited.includes(100));
 const afterArrival=m.state().operativeState[130].morale;assert.ok(afterArrival<state.operativeState[130].morale,'the real arrival delay does not grant morale');
 await m.issue({type:'assignCare',operativeId:130,assignment:'rest'});await m.issue({type:'wait',hours:30});
 const beforeRecovery=decodeSave(encodeSave(m.state())).campaign;assert.equal(beforeRecovery.operativeState[130].morale,29.700000000000003);assert.ok(menuButtons().every(button=>button.disabled));
 // Actual earned cohesion lifts the issued total above the boundary. Reading
 // that admitted deployment must still explain the lower personal morale.
 await m.issue({type:'assignCare',operativeId:130,assignment:'active'});
 await m.issue({type:'visitSector'});const supported=m.state(),battle=enterSector(supported.pendingBattle,supported.sectorStates[supported.pendingBattle.sector]),issued=supported.pendingBattle.squad.find(unit=>unit.id===130);
 assert.equal(issued.personalMorale,beforeRecovery.operativeState[130].morale);assert.ok(issued.morale>=30);await m.replace(decodeSave(encodeSave(supported,battle)).campaign);assert.match(notice(m.doc).textContent,/Moral personal: 29,7.*menor que 30/);
 await m.issue({type:'leaveSector',battleId:supported.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});assert.equal(m.state().operativeState[130].morale,beforeRecovery.operativeState[130].morale);
 await m.issue({type:'assignCare',operativeId:130,assignment:'rest'});
 await m.issue({type:'wait',hours:6});
 assert.ok(m.state().operativeState[130].morale>=30);assert.equal(contractExpiresSeconds(m.state().contracts[130]),expiry,'recovery does not extend the paid term');
 const recovered=decodeSave(encodeSave(m.state())).campaign;await m.replace(recovered);assert.equal(notice(m.doc),null);assert.ok(menuButtons().every(button=>!button.disabled));
 const quote=contractRenewalQuote(recovered,rosterFor(recovered).find(o=>o.id===130),'day');await m.click(menuButtons()[0]);assert.equal(m.closed(),true);
 assert.equal(m.state().resources.treasury,recovered.resources.treasury-quote.price);assert.equal(contractExpiresSeconds(m.state().contracts[130]),expiry+86400);assert.equal(m.state().contracts[130].expiresSecond,recovered.contracts[130].expiresSecond);
 assert.deepEqual(m.state(),order(recovered,{type:'renewContract',id:130,term:'day',expectedExpiresAt:recovered.contracts[130].expiresAt,expectedExpiresSecond:recovered.contracts[130].expiresSecond??0}));assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
 const old=earnLowMoraleRenewal({oldRenewal:true});await m.replace(decodeSave(encodeSave(old.pair.campaign)).campaign);await m.view('recruitment');assert.equal(notice(card()),null);assert.equal(renew().disabled,false);assert.doesNotMatch(card().textContent,/Renovación según el ánimo|rechaza renovar/);
});
