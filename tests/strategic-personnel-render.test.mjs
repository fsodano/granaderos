import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {strategicSquadSlots,strategicSquadAssignments,strategicNewSquadAssignment} from '../game/strategic-squad-assignments.js';
import {contractQuote} from '../game/contracts.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {createBattle} from '../game/tactical.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
const {default:StrategicRoster}=await import('../web/app/StrategicRoster.tsx');
const {default:StrategicPersonnelMenu}=await import('../web/app/StrategicPersonnelMenu.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const {DossierEquipment}=await import('../web/app/CharacterDossier.tsx');
const {default:SectorInventory}=await import('../web/app/SectorInventory.tsx');
const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
const noop=()=>{},order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const unchanged=s=>({...s,lastError:null});

test('recruitment explains captivity without an arrival estimate and retains the available hiring card',()=>{
 const state=initialCampaign(),id=100;state.resources.treasury=100000;
 // Declared captivity isolates the card from price, route and service refusals.
 Object.assign(state.operativeState[id],{captured:true,location:'uspallata'});
 const before=structuredClone(state),quote=contractQuote(state,rosterFor(state).find(op=>op.id===id));
 assert.equal(quote.available,true);assert.equal(civicStatus(state,id).available,false);
 const doc=new JSDOM(render(h(Recruitment,{state,dispatch:noop}))).window.document,card=doc.querySelector(`[data-operative-id="${id}"]`),button=card.querySelector('.gold-button');
 assert.equal(button.disabled,true);assert.equal(button.textContent,'En cautiverio');
 const reason=doc.getElementById(button.getAttribute('aria-describedby'));
 assert.ok(card.contains(reason));assert.equal(reason.textContent,civicStatus(state,id).reason);assert.match(reason.textContent,/cautivo/);
 assert.doesNotMatch(card.textContent,/Llegada inmediata|Viaje previsto/);assert.deepEqual(state,before);doc.defaultView.close();
 const available=structuredClone(state);available.operativeState[id].captured=false;
 const availableBefore=structuredClone(available),controlDoc=new JSDOM(render(h(Recruitment,{state:available,dispatch:noop}))).window.document,control=controlDoc.querySelector(`[data-operative-id="${id}"]`),hire=control.querySelector('.gold-button');
 assert.equal(civicStatus(available,id).available,true);assert.equal(hire.disabled,false);assert.equal(hire.textContent,`Contratar · ${quote.total} pesos`);
 assert.match(control.textContent,/Llegada inmediata|Viaje previsto/);assert.doesNotMatch(control.textContent,/En cautiverio|está cautivo/);assert.equal(hire.hasAttribute('aria-describedby'),false);
 assert.deepEqual(available,availableBefore);controlDoc.defaultView.close();
});

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

// Six saved numbered slots and a detached seventh group reproduce the public
// menu after a retreat. The new local officer is not assigned to any squad.
function sevenSquadArmy(){
 const state=existingArmy(),ids=state.recruited;
 state.sectors.cordoba.owner='patriot';
 state.squads=Array.from({length:6},(_,i)=>({id:`squad-${i+1}`,name:`Escuadra ${i+1}`,members:[],location:i===2?'santa_fe':'retiro'}));
 Object.assign(state.squads[4],{members:ids.slice(0,6),location:'cordoba'});
 Object.assign(state.squads[5],{members:ids.slice(6,10),location:'cordoba'});
 state.squads.push({id:'squad-7',name:'Destacamento de Buenos Aires',members:[ids[10]],location:'buenos_aires'});
 state.activeSquadId='squad-5';state.squad=[...state.squads[4].members];state.location='cordoba';
 for(const id of ids)state.operativeState[id].location=state.squads.find(q=>q.members.includes(id))?.location??'cordoba';
 state.operativeState[ids[11]].assignment='rest';
 return state;
}

test('the assignment menu forms an eighth local squad when all six numbered slots already exist',async t=>{
 const state=sevenSquadArmy(),id=state.recruited[11],before=structuredClone(state),m=await mountMenu(t,state,id);
 await m.click('Escuadra ›');
 const remote=[...m.doc.querySelectorAll('.strategic-squad-options button')].find(b=>b.textContent==='Escuadra 3');
 assert.equal(remote.disabled,true);assert.match(remote.title,/mismo sector/);
 await m.click('Nueva escuadra');
 const after=m.state(),created=after.squads.find(q=>!before.squads.some(old=>old.id===q.id));
 assert.equal(after.lastError,null);assert.equal(after.squads.length,8);assert.ok(created);
 assert.deepEqual(created.members,[id]);assert.equal(created.location,'cordoba');assert.equal(after.activeSquadId,created.id);
 assert.equal(after.operativeState[id].assignment,'active');assert.equal(m.closed(),1);assert.equal(m.actions.length,1);
 for(const old of before.squads)assert.deepEqual(after.squads.find(q=>q.id===old.id),old,'existing groups stay in their actual locations');
 assert.equal(after.hour,before.hour);assert.equal(after.secondOfHour,before.secondOfHour);assert.deepEqual(after.resources,before.resources);
 for(const member of before.recruited)assert.deepEqual(after.operativeState[member],{...before.operativeState[member],...(member===id?{assignment:'active'}:{})});
 assert.deepEqual(decodeSave(encodeSave(after)).campaign,after);assert.deepEqual(state,before);
});

function eightOccupiedSquads(){
 const state=sevenSquadArmy(),ids=state.recruited;
 state.squads.push({id:'squad-8',name:'Escuadra 7',members:[],location:'cordoba'});
 for(const squad of state.squads)squad.members=[];
 for(const [index,id]of ids.entries()){const squad=state.squads[index%8];squad.members.push(id);state.operativeState[id].location=squad.location;}
 state.squad=[...state.squads.find(q=>q.id===state.activeSquadId).members];
 return state;
}

test('the new-squad button explains the occupied eight-squad limit and cannot dispatch',async t=>{
 const state=eightOccupiedSquads(),id=state.recruited[11],before=structuredClone(state),m=await mountMenu(t,state,id);
 await m.click('Escuadra ›');
 const button=[...m.doc.querySelectorAll('.strategic-squad-options button')].find(b=>b.textContent==='Nueva escuadra');
 assert.ok(button);assert.equal(button.disabled,true);assert.match(button.title,/ocho escuadras ocupadas/);
 await act(async()=>button.dispatchEvent(new m.doc.defaultView.MouseEvent('click',{bubbles:true})));
 assert.deepEqual(m.actions,[]);assert.equal(m.closed(),0);assert.deepEqual(m.state(),before);
 const rejected=dispatchCampaign(state,strategicNewSquadAssignment(state,id,rosterFor(state).find(op=>op.id===id)).action);
 assert.match(rejected.lastError,/ocho escuadras ocupadas/);assert.deepEqual(unchanged(rejected),unchanged(before));
});

test('a new local squad can reuse an empty remote slot without moving the remaining hospital group',()=>{
 const state=eightOccupiedSquads(),[patient,doctor]=state.squads[2].members,id=state.squads[4].members[0];
 state.squads[4].members.push(patient,doctor);state.squads[2].members=[];
 for(const member of [patient,doctor])state.operativeState[member].location='cordoba';
 state.squad=[...state.squads[4].members];state.operativeState[patient].assignment='patient';state.operativeState[doctor].assignment='doctor';state.operativeState[id].assignment='rest';
 const before=structuredClone(state),choice=strategicNewSquadAssignment(state,id,rosterFor(state).find(op=>op.id===id));
 assert.equal(choice.reason,null);assert.equal(choice.action.name,'Escuadra 8');assert.equal(choice.action.sector,'cordoba');
 const after=order(state,choice.action),created=after.squads.find(q=>q.id==='squad-9');
 assert.equal(after.squads.length,8);assert.equal(after.squads.find(q=>q.id==='squad-3'),undefined);assert.deepEqual(created,{id:'squad-9',name:'Escuadra 8',members:[id],location:'cordoba'});
 for(const old of before.squads.filter(q=>q.id!=='squad-3'))assert.deepEqual(after.squads.find(q=>q.id===old.id),{...old,members:old.members.filter(member=>member!==id)});
 for(const member of before.recruited)assert.deepEqual(after.operativeState[member],{...before.operativeState[member],...(member===id?{assignment:'active'}:{})});
 assert.deepEqual(after.resources,before.resources);assert.equal(after.hour,before.hour);assert.equal(after.secondOfHour,before.secondOfHour);
 assert.deepEqual(after.squads.flatMap(q=>q.members).sort((a,b)=>a-b),[...state.recruited].sort((a,b)=>a-b));
 assert.deepEqual(decodeSave(encodeSave(after)).campaign,after);assert.deepEqual(state,before);
});

test('new-squad creation shares encounter, service, travel and training eligibility with existing choices',()=>{
 assert.equal(strategicNewSquadAssignment(initialCampaign(),3),null,'empty numbered UI slots already create squads');
 const cases=[
  ['battle',s=>{s.pendingBattle={};},/encuentro/],
  ['encounter',s=>{s.pendingEncounter={};},/encuentro/],
  ['defeat',s=>{s.defeated=true;},/encuentro/],
  ['not hired',(s,id)=>{s.recruited=s.recruited.filter(member=>member!==id);},/disponible/],
  ['dead',(s,id)=>{s.operativeState[id].alive=false;s.operativeState[id].hp=0;},/disponible/],
  ['captured',(s,id)=>{s.operativeState[id].captured=true;},/disponible/],
  ['zero health',(s,id)=>{s.operativeState[id].hp=0;},/disponible/],
  ['training',(s,id)=>{s.militiaTraining=[{trainerId:id}];},/instrucción/],
  ...['moving','ready','paused'].map(status=>[status,(s,id)=>{s.squads[5].members.push(id);s.squads[5].journey={status};},/ruta pendiente/]),
 ];
 for(const [label,change,message]of cases){
  const state=sevenSquadArmy(),id=state.recruited[11],op=rosterFor(state).find(op=>op.id===id);change(state,id);const before=structuredClone(state);
  assert.match(strategicNewSquadAssignment(state,id,op).reason,message,label);assert.deepEqual(state,before,label);
 }
});

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
 assert.match(m.doc.body.textContent,/1 día hasta la salida/);
 await m.click(`Un día · ${quote.price.toLocaleString('es-AR')} pesos`);assert.equal(m.actions[0].expectedExpiresAt,24);assert.equal(m.actions[0].expectedExpiresSecond,121);
 assert.equal(m.state().lastError,null);assert.equal(m.state().resources.treasury,state.resources.treasury-quote.price);assert.equal(m.state().contracts[103].expiresAt,48);assert.equal(m.state().contracts[103].expiresSecond,121);
 assert.match(m.doc.body.textContent,/2 días hasta la salida/);
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

test('personnel, dossiers and public campaign state distinguish carried, jammed and dropped primary guns without changing equipment',()=>{
 const state=initialCampaign(),cases=[{id:3,weaponDropped:false,jammed:false},{id:4,weaponDropped:false,jammed:true},{id:10,weaponDropped:true,jammed:true}];
 // Declared equipment states isolate display. A dropped gun may retain its ID,
 // condition and jam flag; those fields alone do not mean it is still carried.
 for(const {id,...flags}of cases){state.loadouts[id]={...state.loadouts[id],weapon:1801};Object.assign(state.operativeState[id],flags,{condition:98});if(flags.weaponDropped)state.operativeState[id].carriedLoaded=0;}
 const before=structuredClone(state),roster=rosterFor(state),publicState=playerKnownCampaign(state),care=new JSDOM(render(h(MedicalCare,{state,dispatch:noop}))).window.document;
 assert.deepEqual(publicState.operatives.map(op=>op.id),state.recruited);
 for(const {id,weaponDropped,jammed}of cases){
  const visible=publicState.operatives.find(op=>op.id===id),summary=care.querySelector(`[data-care-id="${id}"] [aria-label="Arma principal"]`);
  assert.equal(visible.weaponDropped,weaponDropped);assert.equal(visible.jammed,jammed);
  const dossier=new JSDOM(render(h(DossierEquipment,{operative:roster.find(op=>op.id===id),record:state.operativeState[id]}))).window.document,equipment=dossier.querySelector('.dossier-equipment'),primary=equipment.querySelector('[data-equipment-slot="primary"]');
  assert.ok(equipment.querySelector('[data-equipment-slot="blade"] img'),'the secondary weapon stays visible');
  if(weaponDropped){for(const node of [summary,primary]){assert.match(node.textContent,/Arma abandonada/);assert.match(node.textContent,/Sin arma principal/);assert.doesNotMatch(node.textContent,/98%|Fallo de chispa/);}assert.equal(primary.querySelector('img'),null);}
  else{assert.ok(primary.querySelector('img'));assert.match(summary.textContent,/Condición 98%/);for(const node of [summary,primary]){assert.doesNotMatch(node.textContent,/Arma abandonada/);assert.equal(node.textContent.includes('Fallo de chispa. No puede disparar.'),jammed);}}
  dossier.defaultView.close();
 }
 assert.deepEqual(state,before);care.defaultView.close();
});

test('personnel energy text and meter respect fatigue capacity without changing raw service records',()=>{
 const state=initialCampaign(),cases=[{id:3,energy:100,fatigue:2,shown:98,max:98},{id:4,energy:100,fatigue:4,shown:96,max:96},{id:10,energy:37.5,fatigue:24,shown:37.5,max:76}];
 // Captive recovery can leave raw energy above the retained military fatigue
 // limit. Rendering must not rewrite that record or its public projection.
 for(const {id,energy,fatigue}of cases)Object.assign(state.operativeState[id],{energy,fatigue});
 const before=structuredClone(state),publicBefore=playerKnownCampaign(state),doc=new JSDOM(render(h(MedicalCare,{state,dispatch:noop}))).window.document;
 for(const {id,shown,max}of cases){const label=doc.querySelector(`[data-care-id="${id}"] .care-vitals label:last-child`),meter=label.querySelector('meter');assert.equal(label.querySelector('strong').textContent,`${Math.round(shown)}/${max}`);assert.equal(meter.getAttribute('value'),String(shown));assert.equal(meter.getAttribute('max'),String(max));}
 assert.deepEqual(state,before);assert.deepEqual(playerKnownCampaign(state),publicBefore);doc.defaultView.close();
});

test('returned equipment and repair reserves show their known former owner without changing custody or hiring gates',()=>{
 const state=initialCampaign(),roster=rosterFor(state),names=new Map(roster.map(op=>[op.id,op.name??op.nickname]));
 // Declared prior returns include two caches from one person and one overflow
 // marker. Ordinary discovered ground stock has no asserted former owner.
 const marker=id=>({id:`service-return-${id}`,siteId:'retiro',sectorId:'retiro',entryEdge:'S',entryAnchor:{x:10,y:15},point:{x:2,y:2}});
 state.serviceEquipmentReturns={version:1,nextId:10,entries:[7,8].map((id,index)=>({...marker(id),operativeId:100,items:[{selection:'rations',stack:{item:'rations',count:index+2,weight:1}}],repairPoints:index?0:7}))};
 Object.assign(state.operativeState[101],{serviceEquipmentReturn:marker(9),rations:4,toolkitPoints:11});
 state.sectorStates.retiro={...createBattle([],{id:'retiro',width:8,height:8,enemies:[],tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),groundItems:[{id:'ordinary',type:'rations',count:1,x:2,y:2,knownToPlayer:true}]}),sectorCleared:true};
 const before=structuredClone(state),gate=contractQuote(state,roster.find(op=>op.id===101),'day').reason;
 assert.match(gate,/Recogé todo el equipo/);
 const model=sectorInventoryModel(state,'retiro',roster,3),publicSector=playerKnownCampaign(state).sectors.find(sector=>sector.id==='retiro');
 const doc=new JSDOM(render(h(SectorInventory,{state,sectorId:'retiro',dispatch:noop}))).window.document,rows=[...doc.querySelectorAll('[aria-label="Equipo descubierto"] > .sector-inventory-row')];
 assert.equal(rows.length,model.entries.length);
 for(const [index,row]of model.entries.entries()){
  const visible=publicSector.equipment.find(entry=>JSON.parse(entry.key)[1]===row.key);assert.ok(visible);
  if(row.kind==='serviceReturn'){assert.equal(row.operativeName,names.get(row.operativeId));assert.equal(visible.operativeId,row.operativeId);assert.equal(visible.operativeName,row.operativeName);assert.ok(rows[index].textContent.includes(`Devuelto por ${row.operativeName}`));}
  else{assert.equal(row.operativeId,undefined);assert.equal(visible.operativeName,undefined);assert.doesNotMatch(rows[index].textContent,/Devuelto por/);}
 }
 assert.deepEqual(model.entries.filter(row=>row.operativeId===100).map(row=>row.count),[2,3]);
 const repairRows=[...doc.querySelectorAll('[aria-label="Materiales de reparación"] .sector-inventory-row')];assert.equal(repairRows.length,2);
 for(const [index,row]of model.repairReserves.entries()){
  assert.equal(row.operativeName,names.get(row.operativeId));assert.ok(repairRows[index].textContent.includes(`Devuelto por ${row.operativeName}`));
  const visible=publicSector.repairReserves.find(entry=>JSON.parse(entry.key)[1]===row.key);assert.equal(visible.operativeId,row.operativeId);assert.equal(visible.operativeName,row.operativeName);assert.equal(visible.repairPoints,row.repairPoints);
 }
 assert.equal(contractQuote(state,roster.find(op=>op.id===101),'day').reason,gate);assert.deepEqual(state,before);doc.defaultView.close();
});

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
