import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {actBattle,actionCosts,artilleryCosts,artilleryCrewPlan,initializeBattlePerception} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
import {tacticalGridLabel} from '../game/tactical-grid.js';
import {formatAP} from '../game/action-points.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {crewField} from './artillery-crew-fixture.mjs';
import {battleTimers} from './battle-timers-fixture.mjs';

const actor=(battle,id='20')=>battle.units.find(unit=>unit.id===id);
const point=body=>[body.x,body.y,body.tacticalLevel??0];

// Declared tactical arena, not an earned campaign or an acquisition route.
// Use the existing finite crew fixture, with the selected operator at the
// cell beside the cannon and a durable target for both kinds of native fire.
function arena(change=()=>{}){
 const battle=crewField('bronze4');
 const gun=battle.artillery[0];gun.loaded=true;
 Object.assign(actor(battle),{x:2,y:2});
 Object.assign(actor(battle,'21'),{x:1,y:3});
 Object.assign(actor(battle,'22'),{x:1,y:2});
 Object.assign(actor(battle,'e'),{x:8,y:3,hp:300,maxHp:300,bandaged:0,morale:100});
 change(battle);
 // Rebuild native public contact after declared fixture placement, before any
 // mounted order. Do not retain a sighting at the fixture's old target cell.
 return validateBattleSnapshot(initializeBattlePerception(battle));
}

async function mount(t,battle,{workers=false}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const pending=[];
 class Worker{postMessage(message){pending.push({worker:this,...message});}terminate(){this.closed=true;}}
 const globals={...(workers?{Worker}:{}),window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
 const {createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root')),commits=[];
 let current=battle,timers;
 function Screen(){
  const [state,set]=useState(current);current=state;
  return h(Battlefield,{battle:state,onChange:next=>{commits.push(next);set(next);return next;},onFinish(){},onRetreat(){}});
 }
 t.after(async()=>{
  try{await act(async()=>root.unmount());}
  finally{timers?.restore();dom.window.close();for(const [key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 });
 await act(async()=>root.render(h(Screen)));
 timers=battleTimers(act);
 const doc=dom.window.document;
 // JSDOM has no SVG screen matrix. Declare an identity viewport for focus
 // positioning; native keyboard targeting still selects the actual torso ID.
 const field=doc.querySelector('.tactical-field'),screenMatrix={};
 field.getScreenCTM=()=>({inverse:()=>screenMatrix});
 field.createSVGPoint=()=>({x:0,y:0,matrixTransform(matrix){assert.equal(matrix,screenMatrix);return {x:this.x,y:this.y};}});
 const click=async element=>{assert.ok(element,'the visible control exists');await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const button=label=>[...doc.querySelectorAll('.ja2-artillery-toolbar button')].find(element=>element.textContent.startsWith(label));
 const menu=()=>doc.querySelector('.ja2-artillery-menu');
 const open=async()=>{
  if(!menu().open)await act(async()=>menu().querySelector('summary').click());
  // Native details coalesces its toggle onto a timer. Deliver that real event
  // before querying the descendants mounted by the React toggle handler.
  await timers.until(()=>Boolean(select()));
 };
 const select=()=>doc.querySelector('select[aria-label="Seleccionar pieza de artillería"]');
 const close=async()=>{
  if(menu().open)await act(async()=>menu().querySelector('summary').click());
  await timers.until(()=>!doc.querySelector('.ja2-artillery'));
 };
 const choose=async()=>{
  await open();const element=select();assert.ok(element);
  Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(element,'gun');
  await act(async()=>element.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
 };
 const fireAtTarget=async()=>{
  const element=doc.querySelector('[data-unit-id="e"] [data-person-hit-target]');assert.ok(element,'the real target is visible');
  // Native keyboard targeting fixes the same torso point used by the reducer
  // comparison; no simulated pixel coordinate chooses another body part.
  await act(async()=>element.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 };
 const hoverTarget=async()=>{
  const element=doc.querySelector('[data-unit-id="e"] [data-person-hit-target]');assert.ok(element,'the actual enemy has its native hit target');
  await act(async()=>element.dispatchEvent(new dom.window.FocusEvent('focusin',{bubbles:true})));
 };
 const aim=async()=>{await act(async()=>doc.querySelector('.tactical-field').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'f',bubbles:true})));};
 const moveTo=async(x,y)=>{
  const label=tacticalGridLabel(x,y),cell=[...doc.querySelectorAll('[data-surface-level="0"]')].find(el=>el.getAttribute('aria-label')?.startsWith(label+','));
  assert.ok(cell,'the native ground cell exists');
  await act(async()=>cell.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 };
 const jobs=()=>pending.filter(message=>!message.worker.closed);
 const deliver=async kind=>{
  const index=pending.findIndex(message=>!message.worker.closed&&message.job?.kind===kind);assert.ok(index>=0,'the native worker job exists');
  const {worker,id,job}=pending.splice(index,1)[0],result=runBattleJob(job);
  await act(async()=>worker.onmessage({data:{id,battle:result}}));return result;
 };
 return {moveTo,jobs,deliver,doc,read:()=>current,commits,button,menu,select,open,close,choose,click,fireAtTarget,hoverTarget,aim,until:timers.until,settle:()=>timers.settle(doc)};
}

function assertCrew(m,battle){
 const gun=battle.artillery[0],unit=actor(battle),cost=artilleryCosts(battle,unit,gun).fire;
 const plan=artilleryCrewPlan(battle,unit,gun,cost);
 const rows=[...m.doc.querySelectorAll('.ja2-artillery-crew [data-artillery-crew-id]')];
 assert.deepEqual(rows.map(row=>row.dataset.artilleryCrewId),plan.crew);
 for(const row of rows){const member=actor(battle,row.dataset.artilleryCrewId);assert.equal(row.textContent,`${member.nickname||member.name} · ${formatAP(cost)} PA`);}
 assert.match(m.doc.querySelector('.ja2-artillery-active').textContent,/Cañón/);
 assert.ok(m.doc.querySelector('.ja2-artillery-active').textContent.includes(unit.nickname||unit.name));
}

function assertMenuExited(m){
 assert.equal(m.menu().open,false);
 assert.equal(m.select(),null,'the closed menu unmounts its cannon selector');
 assert.equal(m.doc.querySelector('.ja2-artillery-active'),null);
}

test('visible adjacent controls switch personal fire and cannon fire with their exact native ammunition and crew costs',async t=>{
 const initial=arena(),original=structuredClone(initial),m=await mount(t,initial);
 const unit=actor(initial),piece=initial.artillery[0];assert.equal(Math.abs(unit.x-piece.x)+Math.abs(unit.y-piece.y),1);
 assert.equal(new Set([...initial.units.filter(member=>member.side==='player'),piece].map(member=>point(member).join(','))).size,4);
 await m.choose();assertCrew(m,initial);
 assert.equal(m.commits.length,0,'selecting the cannon is a UI choice');
 await m.click(m.button('Arma personal'));
 assertMenuExited(m);assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 assert.deepEqual(m.read(),initial);assert.equal(m.commits.length,0,'an already held primary needs no weapon order');
 await m.hoverTarget();assert.match(m.doc.querySelector('[data-context-action-cursor="aim"]').textContent,/Disparar/);assert.equal(m.doc.querySelector('.aim-cursor'),null,'the normal enemy hover uses the compact contextual cursor before explicit F targeting');assert.equal(m.commits.length,0);
 const rifleBefore=structuredClone(m.read()),rifleRequest={type:'fire',unitId:'20',targetId:'e',aim:0,hitLocation:'torso'},rifleExpected=actBattle(rifleBefore,rifleRequest);
 assert.equal(rifleExpected.lastError,null);
 await m.fireAtTarget();await m.settle();
 assert.equal(m.commits.length,1);assert.deepEqual(m.read(),rifleExpected);
 assert.equal(actor(m.read()).loaded,actor(rifleBefore).loaded-1);
 assert.equal(actor(m.read()).ap,actor(rifleBefore).ap-actionCosts(rifleBefore,actor(rifleBefore),actor(rifleBefore,'e')).fire);
 assert.deepEqual(m.read().artillery,rifleBefore.artillery);
 for(const id of ['21','22'])assert.deepEqual(actor(m.read(),id),actor(rifleBefore,id));
 assert.deepEqual(point(actor(m.read())),point(actor(initial)));
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());
 await m.choose();assertCrew(m,m.read());
 const cannonBefore=structuredClone(m.read()),gun=cannonBefore.artillery[0],cost=artilleryCosts(cannonBefore,actor(cannonBefore),gun).fire;
 const crew=artilleryCrewPlan(cannonBefore,actor(cannonBefore),gun,cost).crew;
 const cannonExpected=actBattle(cannonBefore,{type:'artillery',unitId:'20',artilleryId:'gun',x:8,y:3,tacticalLevel:0,targetId:'e',mode:'solid',aim:0,hitLocation:'torso'});
 assert.equal(cannonExpected.lastError,null);
 await m.fireAtTarget();assert.ok(m.doc.querySelector('[data-enemy-frame]'));
 assert.equal(m.button('Dejar cañón').disabled,true);assert.equal(m.button('Arma personal').disabled,true);
 await m.click(m.button('Dejar cañón'));await m.click(m.button('Arma personal'));
 assert.equal(m.menu().open,true,'disabled busy switches cannot close the cannon menu');
 assert.equal(m.select().value,'gun');assert.equal(m.commits.length,1,'busy switches cannot issue another order');
 await m.settle();assert.equal(m.commits.length,2);assert.deepEqual(m.read(),cannonExpected);
 assert.equal(m.read().artillery[0].loaded,false);assert.equal(m.read().artillery[0].ammo,gun.ammo);
 assert.equal(actor(m.read()).loaded,actor(cannonBefore).loaded,'cannon fire cannot spend the personal cartridge');
 for(const id of crew)assert.equal(actor(m.read(),id).ap,actor(cannonBefore,id).ap-cost);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'&&!crew.includes(unit.id)))assert.deepEqual(actor(m.read(),member.id),member);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'))assert.deepEqual(point(actor(m.read(),member.id)),point(member));
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());assert.deepEqual(initial,original,'the declared input is immutable');
});

test('the visible movement cursor refuses entry into the cannon cell through the real native worker',async t=>{
 const initial=arena(),original=structuredClone(initial),m=await mount(t,initial,{workers:true}),gun=initial.artillery[0];
 await m.moveTo(gun.x,gun.y);await m.until(()=>m.jobs().some(message=>message.job?.kind==='movement-step'));
 const job=m.jobs().find(message=>message.job?.kind==='movement-step').job;
 assert.equal(job.action.type,'move');assert.equal(job.action.unitId,'20');assert.equal(job.action.x,gun.x);assert.equal(job.action.y,gun.y);
 const expected=runBattleJob(job);assert.equal(expected.status,'stopped');assert.ok(expected.state.lastError);
 await m.deliver('movement-step');await m.until(()=>m.commits.length===1);
 assert.deepEqual(m.read(),expected.state);
 assert.deepEqual({...m.read(),lastError:initial.lastError,log:initial.log},initial,'refusal spends no AP, time, ammunition or RNG');
 assert.deepEqual(point(actor(m.read())),point(actor(initial)));assert.deepEqual(m.read().artillery,initial.artillery);
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());assert.deepEqual(initial,original);
});

test('compact operator and personal switch stay visible while optional leave clears the cursor without an order or cost',async t=>{
 const initial=arena(),m=await mount(t,initial);assert.ok(m.doc.querySelector('.ja2-artillery-toolbar'));
 await m.choose();assertCrew(m,initial);
 await m.close();assert.equal(m.menu().open,false);
 assert.ok(m.doc.querySelector('.ja2-artillery-active').textContent.includes(actor(initial).nickname||actor(initial).name));
 assert.match(m.doc.querySelector('.ja2-artillery-active').textContent,/Cañón/);
 assert.equal(m.doc.querySelector('.ja2-artillery-crew'),null,'crew detail stays inside the optional menu');
 assert.equal(m.button('Dejar cañón'),undefined,'pure leave is an optional menu action');
 assert.ok(m.button('Arma personal'));assert.equal(m.button('Arma personal').disabled,false);
 assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 await m.open();assert.ok(m.button('Dejar cañón'));
 await m.click(m.button('Dejar cañón'));
 assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 assertMenuExited(m);
 assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.deepEqual(validateBattleSnapshot(m.read()),initial);
});

test('using a personal weapon from a different held slot pays only the existing native switch and preserves the same cell and gun',async t=>{
 const initial=arena(battle=>{const unit=actor(battle);unit.activeSlot='medical';unit.medkits=2;}),m=await mount(t,initial);
 await m.choose();const expected=actBattle(initial,{type:'weapon',unitId:'20',slot:'primary',aim:0,hitLocation:'torso'});assert.equal(expected.lastError,null);
 assert.match(m.button('Arma personal').textContent,/1 PA/);
 await m.click(m.button('Arma personal'));
 assert.equal(m.commits.length,1);assert.deepEqual(m.read(),expected);
 assert.equal(actor(m.read()).activeSlot,'primary');assert.equal(actor(m.read()).ap,actor(initial).ap-4);
 assertMenuExited(m);assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 assert.deepEqual(point(actor(m.read())),point(actor(initial)));assert.deepEqual(m.read().artillery,initial.artillery);
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());
 await m.hoverTarget();assert.ok(m.doc.querySelector('[data-context-action-cursor="aim"]'));await m.aim();assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Disparo');assert.ok(m.doc.querySelector('.aim-cursor'),'explicit F retains the real firearm targeting forecast');assert.equal(m.commits.length,1);assert.deepEqual(m.read(),expected,'hover and explicit targeting spend no native AP, time or ammunition');
});

test('an ineligible nearby crew disables cannon work and reports its real deficit without blocking personal fire',async t=>{
 const initial=arena(battle=>{actor(battle,'21').stance='prone';actor(battle,'22').stance='prone';}),m=await mount(t,initial);
 await m.choose();const plan=artilleryCrewPlan(initial,actor(initial),initial.artillery[0],artilleryCosts(initial,actor(initial),initial.artillery[0]).fire);
 assert.ok(plan.reason);assert.deepEqual(plan.crew,['20']);
 assert.deepEqual([...m.doc.querySelectorAll('[data-artillery-crew-id]')].map(row=>row.dataset.artilleryCrewId),plan.crew);
 assert.ok(m.doc.querySelector('.ja2-artillery-crew').textContent.includes(plan.reason));
 for(const label of ['Disparar pieza','Mover pieza','Girar pieza']){assert.equal(m.button(label).disabled,true);await m.click(m.button(label));}
 assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.equal(m.button('Arma personal').disabled,false);await m.click(m.button('Arma personal'));
 assertMenuExited(m);
 assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');assert.deepEqual(m.read(),initial);
});

for(const [label,change]of [
 ['knocked-down operator preparing the primary',battle=>{actor(battle).knockedDown=true;actor(battle).activeSlot='medical';actor(battle).medkits=2;}],
 ['one AP short of preparing the primary',battle=>{actor(battle).activeSlot='medical';actor(battle).medkits=2;actor(battle).ap=3;}],
])test(`personal switch refuses an unavailable ${label} without changing the cannon or actor`,async t=>{
 const initial=arena(change),m=await mount(t,initial);await m.choose();
 assert.equal(m.button('Arma personal').disabled,true);assert.ok(m.button('Arma personal').title);
 await m.click(m.button('Arma personal'));
 assert.equal(m.select().value,'gun');assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.deepEqual(validateBattleSnapshot(m.read()),initial);
});

// JSDOM has no elementsFromPoint. Use the mounted SVG's numeric hit shapes
// and actual paint order, not a forced actor-target event, for this declared
// viewport. The real browser witness at source54 has the same front-cannon
// overlap. Keep the whole native reducer as the rifle/cannon cost oracle.
function mountedHitAt(doc,x,y){
 const shapes=[...doc.querySelectorAll('[data-sector-input] [data-person-hit-target], [data-sector-input] g[aria-label^="Seleccionar "] > rect, [data-sector-input] [data-artillery-hit-target]')];
 return shapes.reverse().find(element=>{
  if(element.getAttribute('pointer-events')==='none')return false;
  const n=key=>Number(element.getAttribute(key));
  if(element.tagName.toLowerCase()==='ellipse')return ((x-n('cx'))/n('rx'))**2+((y-n('cy'))/n('ry'))**2<=1;
  return x>=n('x')&&x<=n('x')+n('width')&&y>=n('y')&&y<=n('y')+n('height');
 });
}

test('the visible adjacent gunner body selects its real actor before the cannon base and keeps exact native personal and crew fire',async t=>{
 const initial=arena(),before=structuredClone(initial),m=await mount(t,initial);
 const spare=m.doc.querySelector('[data-unit-id="22"] [data-person-hit-target]');
 await act(async()=>spare.dispatchEvent(new spare.ownerDocument.defaultView.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 assert.deepEqual(m.read(),initial);assert.equal(m.commits.length,0,'selecting another actual friend spends no native action');
 const body=m.doc.querySelector('[data-unit-id="20"] [data-person-hit-target]'),num=key=>Number(body.getAttribute(key));
 const bodyCenter={x:num('x')+num('width')/2,y:num('y')+num('height')/2},bodyHit=mountedHitAt(m.doc,bodyCenter.x,bodyCenter.y);
 assert.equal(bodyHit,body,'the painted cannon hit area must not intercept the actual adjacent actor body center');
 await m.click(bodyHit);assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 assert.deepEqual(m.read(),initial);assert.equal(m.commits.length,0,'body selection changes no native AP, clock, ammunition or positions');
 const pieceHit=m.doc.querySelector('[data-artillery-hit-target]');assert.ok(pieceHit,'the cannon has a real small base hit shape');
 const base={x:Number(pieceHit.getAttribute('cx')),y:Number(pieceHit.getAttribute('cy'))};
 assert.equal(mountedHitAt(m.doc,base.x,base.y),pieceHit,'the actual cannon base remains selectable');
 await m.click(pieceHit);await m.open();assertCrew(m,initial);assert.equal(m.commits.length,0);
 await m.click(m.button('Arma personal'));assertMenuExited(m);assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 const rifleBefore=structuredClone(m.read()),rifleExpected=actBattle(rifleBefore,{type:'fire',unitId:'20',targetId:'e',aim:0,hitLocation:'torso'});assert.equal(rifleExpected.lastError,null);
 await m.fireAtTarget();await m.settle();assert.deepEqual(m.read(),rifleExpected);assert.equal(m.commits.length,1);
 assert.equal(actor(m.read()).loaded,actor(rifleBefore).loaded-1);assert.equal(actor(m.read()).ap,actor(rifleBefore).ap-actionCosts(rifleBefore,actor(rifleBefore),actor(rifleBefore,'e')).fire);
 assert.deepEqual(m.read().artillery,rifleBefore.artillery);for(const id of ['21','22'])assert.deepEqual(actor(m.read(),id),actor(rifleBefore,id));
 const cannonBefore=structuredClone(m.read()),gun=cannonBefore.artillery[0],cost=artilleryCosts(cannonBefore,actor(cannonBefore),gun).fire,crew=artilleryCrewPlan(cannonBefore,actor(cannonBefore),gun,cost).crew;
 const again=m.doc.querySelector('[data-artillery-hit-target]');await m.click(again);await m.open();assertCrew(m,cannonBefore);
 const cannonExpected=actBattle(cannonBefore,{type:'artillery',unitId:'20',artilleryId:'gun',x:8,y:3,tacticalLevel:0,targetId:'e',mode:'solid',aim:0,hitLocation:'torso'});assert.equal(cannonExpected.lastError,null);
 await m.fireAtTarget();assert.equal(m.button('Arma personal').disabled,true);await m.settle();assert.deepEqual(m.read(),cannonExpected);assert.equal(m.commits.length,2);
 assert.equal(m.read().artillery[0].loaded,false);assert.equal(m.read().artillery[0].ammo,gun.ammo);assert.equal(actor(m.read()).loaded,actor(cannonBefore).loaded);
 for(const id of crew)assert.equal(actor(m.read(),id).ap,actor(cannonBefore,id).ap-cost);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'&&!crew.includes(unit.id)))assert.deepEqual(actor(m.read(),member.id),member);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'))assert.deepEqual(point(actor(m.read(),member.id)),point(member));
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());assert.deepEqual(initial,before);
});
