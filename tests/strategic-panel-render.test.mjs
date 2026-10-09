import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {worldCell,campaignPlace} from '../game/world-cells.js';
import {assaultGroups,squadTravelStatus} from '../game/squad-travel.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const {default:Campaign}=await import('../web/app/Campaign.tsx');

async function mount(t,state){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current,battleReturns=0,actions=[];
 let issue;function Screen(){const[s,set]=useState(state);current=s;issue=action=>{actions.push(action);set(previous=>dispatchCampaign(previous,action));};return h(Campaign,{state:s,dispatch:issue,onBattle(){battleReturns++;},onOpenDesk(){}});}
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const doc=dom.window.document,fire=async(element,event)=>{assert.ok(element);await act(async()=>element.dispatchEvent(event));};
 await act(async()=>root.render(h(Screen)));
 return{doc,state:()=>current,battleReturns:()=>battleReturns,actions,issue:async action=>{await act(async()=>issue(action));},button:(label,scope=doc)=>[...scope.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim())===label),click:element=>fire(element,new dom.window.MouseEvent('click',{bubbles:true})),key:(element,key,shiftKey=false)=>fire(element,new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true}))};
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
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.button('Marchas'),undefined);assert.ok(m.doc.querySelector('.strategy-layout button[aria-label="Destino: Cabral"]').textContent.includes(worldCell('buenos_aires').grid));
});

test('a saved journey keeps its ETA in the roster and opens only its Destination controls',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1800});s=decodeSave(encodeSave(s)).campaign;const m=await mount(t,s);
 assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.ok(m.doc.querySelector('[data-squad-route]'));
 assert.equal(m.button('Marchas'),undefined);const trigger=m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout'));assert.equal(trigger.disabled,false);assert.match(trigger.textContent,/4 h 30 min/);trigger.focus();await m.click(trigger);
 const menu=m.doc.querySelector('[role="dialog"]');assert.equal(menu.getAttribute('aria-label'),'Destino de Cabral');assert.match(menu.textContent,/Regresar · 30 min/);assert.equal(menu.querySelector('.strategy-panel-tabs'),null);assert.equal(menu.querySelector('.travel-status'),null);assert.deepEqual(m.actions,[]);assert.deepEqual(m.state(),s);
 await m.key(menu.querySelector('button[aria-label="Cerrar"]'),'Escape');assert.equal(m.doc.querySelector('[role="dialog"]'),null);assert.equal(m.doc.activeElement,trigger);
});

test('Sector and Personal retain their controls without a Marchas entry or tab',async t=>{
 const m=await mount(t,initialCampaign());assert.equal(m.button('Marchas'),undefined);await m.click(m.button('Sector',m.doc.querySelector('.strategy-tools')));
 const panel=m.doc.querySelector('.strategic-panel-dialog');assert.deepEqual([...panel.querySelectorAll('.strategy-panel-tabs button')].map(b=>b.textContent),['Sector','Personal']);assert.ok(m.button('Entrar al sector',panel));
 await m.click(m.button('Personal',panel));assert.equal(m.doc.querySelector('.strategic-panel-dialog').getAttribute('aria-label'),'Personal');assert.ok(m.doc.querySelector('.medical-care'));assert.equal(m.doc.querySelector('.travel-status'),null);assert.deepEqual(m.actions,[]);
});

test('an inactive moving person selects their real saved squad before opening only that squad’s Destination menu',async t=>{
 const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
 let s=order(initialCampaign(),{type:'createSquad',name:'Reserva médica',ids:[10]});s=order(s,{type:'travel',sector:'ensenada',queue:true});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});const before=structuredClone(s),m=await mount(t,s);
 await m.click(m.button('Destino: Paroissien',m.doc.querySelector('.strategy-layout')));assert.deepEqual(m.actions,[{type:'selectSquad',id:'squad-2'}]);assert.equal(m.state().lastError,null);assert.equal(m.state().activeSquadId,'squad-2');assert.deepEqual(m.state().squad,[10]);assert.equal(m.doc.querySelector('.strategic-person-menu').getAttribute('aria-label'),'Destino de Paroissien');
 assert.deepEqual(m.state().squads,before.squads);assert.deepEqual(m.state().operativeState,before.operativeState);assert.deepEqual(m.state().resources,before.resources);assert.equal(m.state().hour,before.hour);assert.equal(m.doc.querySelector('.travel-status'),null);
});

test('Destination cancels an unstarted route without spending time or changing people and stores',async t=>{
 const s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true}),m=await mount(t,s);await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));
 await m.click(m.button('Cancelar ruta',m.doc.querySelector('.strategic-person-menu')));assert.deepEqual(m.actions,[{type:'cancelTravel',squadId:'squad-1',choice:'stop'}]);assert.equal(m.state().lastError,null);assert.equal(m.state().squads[0].journey,undefined);
 assert.equal(m.state().hour,s.hour);assert.deepEqual(m.state().operativeState,s.operativeState);assert.deepEqual(m.state().resources,s.resources);assert.deepEqual(m.state().ammunitionStores,s.ammunitionStores);assert.equal(m.doc.querySelector('[role="dialog"]'),null);
});

test('a paid ordinary stop keeps the current leg, its elapsed cost and its actual next arrival',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1800});const m=await mount(t,s),elapsed=squadTravelStatus(s.squads[0]).elapsedSeconds;
 await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));await m.click(m.button('Detenerse en el próximo sector',m.doc.querySelector('.strategic-person-menu')));
 assert.equal(m.state().lastError,null);assert.deepEqual(m.state().squads[0].journey.path,['retiro','cell-27-29']);assert.equal(squadTravelStatus(m.state().squads[0]).elapsedSeconds,elapsed);assert.equal(m.state().hour,s.hour);assert.equal(m.state().secondOfHour,s.secondOfHour);assert.equal(m.state().location,'retiro');assert.deepEqual(m.state().operativeState,s.operativeState);
});

test('even one paid second uses Return, preserves its precise progress and disables another cancellation while returning',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires',queue:true});s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1});assert.equal(s.lastError,null);assert.equal(squadTravelStatus(s.squads[0]).elapsedSeconds,1);s=decodeSave(encodeSave(s)).campaign;
 const m=await mount(t,s);await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));assert.equal(m.button('Cancelar ruta',m.doc.querySelector('.strategic-person-menu')),undefined);
 await m.click(m.button('Regresar · 1 min',m.doc.querySelector('.strategic-person-menu')));assert.deepEqual(m.actions,[{type:'cancelTravel',squadId:'squad-1',choice:'return'}]);assert.equal(m.state().lastError,null);assert.equal(squadTravelStatus(m.state().squads[0]).elapsedSeconds,1);assert.equal(m.state().squads[0].journey.returning,true);assert.equal(m.state().secondOfHour,s.secondOfHour);assert.equal(m.state().location,s.location);assert.deepEqual(m.state().operativeState,s.operativeState);
 await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));const menu=m.doc.querySelector('.strategic-person-menu');assert.equal(m.button('Detenerse en el próximo sector',menu).disabled,true);assert.ok(!menu.textContent.includes('Regresar ·'));assert.equal(m.button('Retomar marcha',menu),undefined);
 assert.deepEqual(decodeSave(encodeSave(m.state())).campaign,m.state());
});

test('Destination resumes an existing paused route only through the ordinary reducer',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires',queue:true});
 // A declared saved pause isolates the route menu. Its path was queued by the
 // real reducer, and the ordinary wake/resume orders pay no extra progress.
 s.squads[0].journey.status='paused';s.squads[0].journey.reason='assignment';s.operativeState[3].asleep=true;s=decodeSave(encodeSave(s)).campaign;
 s=dispatchCampaign(s,{type:'setSleep',operativeId:3,asleep:false});assert.equal(s.lastError,null);const m=await mount(t,s);await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));
 await m.click(m.button('Retomar marcha',m.doc.querySelector('.strategic-person-menu')));assert.deepEqual(m.actions,[{type:'resumeTravel',squadId:'squad-1'}]);assert.equal(m.state().lastError,null);assert.equal(m.state().squads[0].journey.status,'moving');assert.equal(squadTravelStatus(m.state().squads[0]).elapsedSeconds,0);assert.equal(m.state().hour,s.hour);assert.deepEqual(m.state().operativeState,s.operativeState);assert.deepEqual(m.state().resources,s.resources);
});

test('Destination cancels an unstarted attack without beginning a battle or moving its column',async t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});s=dispatchCampaign(s,{type:'attack',sector:'san_nicolas',queue:true});assert.equal(s.lastError,null);const m=await mount(t,s);
 assert.equal(m.doc.querySelector('[data-assault-target]'),null);await m.click(m.button('Destino: Cabral',m.doc.querySelector('.strategy-layout')));await m.click(m.button('Cancelar ataque',m.doc.querySelector('.strategic-person-menu')));
 assert.deepEqual(m.actions,[{type:'cancelTravel',squadId:'squad-1'}]);assert.equal(m.state().lastError,null);assert.equal(m.state().squads[0].journey,undefined);assert.equal(m.state().pendingBattle,null);assert.equal(m.state().hour,s.hour);assert.equal(m.state().location,s.location);assert.deepEqual(m.state().operativeState,s.operativeState);
});

function stagedColumns(){
 const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'createSquad',name:'Reserva médica',ids:[10]});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'attack',sector:'san_nicolas',queue:true});
 const duration=s.squads[0].journey.legHours;s=order(s,{type:'wait',hours:1});s=order(s,{type:'selectSquad',id:'squad-2'});s=order(s,{type:'attack',sector:'san_nicolas',queue:true});s=order(s,{type:'wait',hours:duration});
 assert.equal(assaultGroups(s)[0].ready.length,1);assert.equal(assaultGroups(s)[0].incoming.length,1);return s;
}

test('a ready attack stays explicit in the footer and uses only the actual ready column while the other is incoming',async t=>{
 const s=decodeSave(encodeSave(stagedColumns())).campaign,m=await mount(t,s),button=m.doc.querySelector('.strategy-bottom-controls [data-assault-target="san_nicolas"]');assert.ok(button);assert.equal(button.disabled,false);assert.match(button.title,/2 combatientes listos/);assert.match(button.textContent,/1 en camino/);assert.equal(m.state().pendingBattle,null);assert.deepEqual(m.actions,[]);assert.equal(m.doc.querySelector('[role="dialog"]'),null);
 await m.click(button);assert.deepEqual(m.actions,[{type:'beginAssault',sector:'san_nicolas'}]);assert.equal(m.state().lastError,null);assert.deepEqual(m.state().pendingBattle.squad.map(u=>u.id),[3,4]);assert.equal(m.state().pendingBattle.assaultSquads.length,1);assert.equal(m.state().squads.find(q=>q.id==='squad-2').journey.status,'moving');assert.equal(m.state().hour,s.hour);assert.equal(m.doc.querySelector('.travel-status'),null);
});

test('waiting for both real columns enables one target action that deploys both saved memberships',async t=>{
 let s=stagedColumns();s=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(s.lastError,null);assert.equal(assaultGroups(s)[0].ready.length,2);s=decodeSave(encodeSave(s)).campaign;
 const m=await mount(t,s),button=m.doc.querySelector('.strategy-bottom-controls [data-assault-target="san_nicolas"]');assert.ok(button);assert.match(button.title,/3 combatientes listos/);assert.ok(!button.textContent.includes('en camino'));assert.equal(m.state().pendingBattle,null);
 await m.click(button);assert.equal(m.state().lastError,null);assert.deepEqual(m.state().pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),[3,4,10]);assert.equal(m.state().pendingBattle.assaultSquads.length,2);assert.ok(m.state().squads.every(q=>q.location==='san_nicolas'&&!q.journey));assert.equal(m.state().hour,s.hour);
 const saved=decodeSave(encodeSave(m.state(),enterSector(m.state().pendingBattle)));assert.equal(saved.campaign.pendingBattle.assaultSquads.length,2);assert.equal(saved.battle.units.filter(u=>u.side==='player').length,3);
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

test('an actual repeated rejection reopens a dismissed temporary notice, while local panels and a successful order do not retain it',async t=>{
 const m=await mount(t,initialCampaign()),before=structuredClone(m.state()),rejected={type:'travel',sector:'missing',queue:true};await m.issue(rejected);
 const first=m.state();assert.ok(first.lastError);assert.equal(m.doc.querySelector('.transient-notice').textContent.includes(first.lastError),true);assert.equal(m.doc.querySelector('.strategy-command-screen > p.notice.error'),null);
 await m.click(m.button('Cerrar aviso',m.doc.querySelector('.transient-notice')));assert.equal(m.doc.querySelector('.transient-notice'),null);await m.click(m.button('Sector',m.doc.querySelector('.strategy-tools')));assert.equal(m.doc.querySelector('.transient-notice'),null,'opening a local panel does not invent another rejected action');
 await m.issue(rejected);assert.notEqual(m.state(),first);assert.equal(m.state().lastError,first.lastError);assert.ok(m.doc.querySelector('.transient-notice'));assert.deepEqual(m.state().operativeState,before.operativeState);assert.deepEqual(m.state().resources,before.resources);assert.equal(m.state().hour,before.hour);
 await m.issue({type:'selectSquad',id:'squad-1'});assert.equal(m.state().lastError,null);assert.equal(m.doc.querySelector('.transient-notice'),null);
});
