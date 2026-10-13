import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {actBattle,actionCosts,artilleryCosts,artilleryCrewPlan,initializeBattlePerception} from '../game/tactical.js';
import {formatAP} from '../game/action-points.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {crewField} from './artillery-crew-fixture.mjs';
import {battleTimers} from './battle-timers-fixture.mjs';

const actor=(battle,id='20')=>battle.units.find(unit=>unit.id===id);
const point=body=>[body.x,body.y,body.tacticalLevel??0];

// Declared tactical arena, not an earned campaign or an acquisition route.
// Use the existing finite crew fixture, with the selected operator at the
// actual cannon cell and a durable target for both kinds of native fire.
function arena(change=()=>{}){
 const battle=crewField('bronze4');
 const gun=battle.artillery[0];gun.loaded=true;
 Object.assign(actor(battle),{x:gun.x,y:gun.y});
 Object.assign(actor(battle,'e'),{x:8,y:3,hp:300,maxHp:300,bandaged:0,morale:100});
 change(battle);
 // Rebuild native public contact after declared fixture placement, before any
 // mounted order. Do not retain a sighting at the fixture's old target cell.
 return validateBattleSnapshot(initializeBattlePerception(battle));
}

async function mount(t,battle){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
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
 return {doc,read:()=>current,commits,button,menu,select,choose,click,fireAtTarget,until:timers.until,settle:()=>timers.settle(doc)};
}

function assertCrew(m,battle){
 const gun=battle.artillery[0],unit=actor(battle),cost=artilleryCosts(battle,unit,gun).fire;
 const plan=artilleryCrewPlan(battle,unit,gun,cost);
 const rows=[...m.doc.querySelectorAll('.ja2-artillery-crew [data-artillery-crew-id]')];
 assert.deepEqual(rows.map(row=>row.dataset.artilleryCrewId),plan.crew);
 for(const row of rows){const member=actor(battle,row.dataset.artilleryCrewId);assert.equal(row.textContent,`${member.nickname||member.name} · ${formatAP(cost)} PA`);}
 assert.match(m.doc.querySelector('.ja2-artillery-status').textContent,/Control: cañón/);
 assert.ok(m.doc.querySelector('.ja2-artillery-status').textContent.includes(`Operario: ${unit.nickname||unit.name}`));
}

test('visible same-cell controls switch personal fire and cannon fire with their exact native ammunition and crew costs',async t=>{
 const initial=arena(),original=structuredClone(initial),m=await mount(t,initial);
 assert.deepEqual(point(actor(initial)),point(initial.artillery[0]));
 await m.choose();assertCrew(m,initial);
 assert.equal(m.commits.length,0,'selecting the cannon is a UI choice');
 await m.click(m.button('Usar arma personal'));
 assert.equal(m.select().value,'');assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Disparo');
 assert.deepEqual(m.read(),initial);assert.equal(m.commits.length,0,'an already held primary needs no weapon order');
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
 assert.equal(m.button('Dejar cañón').disabled,true);assert.equal(m.button('Usar arma personal').disabled,true);
 await m.click(m.button('Dejar cañón'));await m.click(m.button('Usar arma personal'));
 assert.equal(m.select().value,'gun');assert.equal(m.commits.length,1,'busy switches cannot issue another order');
 await m.settle();assert.equal(m.commits.length,2);assert.deepEqual(m.read(),cannonExpected);
 assert.equal(m.read().artillery[0].loaded,false);assert.equal(m.read().artillery[0].ammo,gun.ammo);
 assert.equal(actor(m.read()).loaded,actor(cannonBefore).loaded,'cannon fire cannot spend the personal cartridge');
 for(const id of crew)assert.equal(actor(m.read(),id).ap,actor(cannonBefore,id).ap-cost);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'&&!crew.includes(unit.id)))assert.deepEqual(actor(m.read(),member.id),member);
 for(const member of cannonBefore.units.filter(unit=>unit.side==='player'))assert.deepEqual(point(actor(m.read(),member.id)),point(member));
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());assert.deepEqual(initial,original,'the declared input is immutable');
});

test('the always visible leave control clears the cannon cursor without an order, AP cost, time advance or movement',async t=>{
 const initial=arena(),m=await mount(t,initial);assert.ok(m.doc.querySelector('.ja2-artillery-toolbar'));
 await m.choose();assertCrew(m,initial);
 await act(async()=>{m.menu().querySelector('summary').click();});
 await m.until(()=>!m.doc.querySelector('.ja2-artillery'));
 assert.equal(m.menu().open,false);assert.ok(m.button('Dejar cañón'),'leaving stays visible with advanced artillery controls closed');
 await m.click(m.button('Dejar cañón'));
 assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Mover');
 assert.equal(m.doc.querySelector('.ja2-artillery-status'),null);
 assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.deepEqual(validateBattleSnapshot(m.read()),initial);
});

test('using a personal weapon from a different held slot pays only the existing native switch and preserves the same cell and gun',async t=>{
 const initial=arena(battle=>{const unit=actor(battle);unit.activeSlot='medical';unit.medkits=2;}),m=await mount(t,initial);
 await m.choose();const expected=actBattle(initial,{type:'weapon',unitId:'20',slot:'primary',aim:0,hitLocation:'torso'});assert.equal(expected.lastError,null);
 assert.match(m.button('Usar arma personal').textContent,/1 PA/);
 await m.click(m.button('Usar arma personal'));
 assert.equal(m.commits.length,1);assert.deepEqual(m.read(),expected);
 assert.equal(actor(m.read()).activeSlot,'primary');assert.equal(actor(m.read()).ap,actor(initial).ap-4);
 assert.equal(m.select().value,'');assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Disparo');
 assert.deepEqual(point(actor(m.read())),point(actor(initial)));assert.deepEqual(m.read().artillery,initial.artillery);
 assert.deepEqual(validateBattleSnapshot(m.read()),m.read());
});

test('an ineligible nearby crew disables cannon work and reports its real deficit without blocking personal fire',async t=>{
 const initial=arena(battle=>{actor(battle,'21').stance='prone';actor(battle,'22').stance='prone';}),m=await mount(t,initial);
 await m.choose();const plan=artilleryCrewPlan(initial,actor(initial),initial.artillery[0],artilleryCosts(initial,actor(initial),initial.artillery[0]).fire);
 assert.ok(plan.reason);assert.deepEqual(plan.crew,['20']);
 assert.deepEqual([...m.doc.querySelectorAll('[data-artillery-crew-id]')].map(row=>row.dataset.artilleryCrewId),plan.crew);
 assert.ok(m.doc.querySelector('.ja2-artillery-crew').textContent.includes(plan.reason));
 for(const label of ['Disparar pieza','Mover pieza','Girar pieza']){assert.equal(m.button(label).disabled,true);await m.click(m.button(label));}
 assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.equal(m.button('Usar arma personal').disabled,false);await m.click(m.button('Usar arma personal'));
 assert.equal(m.doc.querySelector('.map-order-mode').textContent,'Disparo');assert.deepEqual(m.read(),initial);
});

for(const [label,change]of [
 ['knocked-down operator preparing the primary',battle=>{actor(battle).knockedDown=true;actor(battle).activeSlot='medical';actor(battle).medkits=2;}],
 ['one AP short of preparing the primary',battle=>{actor(battle).activeSlot='medical';actor(battle).medkits=2;actor(battle).ap=3;}],
])test(`personal switch refuses an unavailable ${label} without changing the cannon or actor`,async t=>{
 const initial=arena(change),m=await mount(t,initial);await m.choose();
 assert.equal(m.button('Usar arma personal').disabled,true);assert.ok(m.button('Usar arma personal').title);
 await m.click(m.button('Usar arma personal'));
 assert.equal(m.select().value,'gun');assert.equal(m.commits.length,0);assert.deepEqual(m.read(),initial);
 assert.deepEqual(validateBattleSnapshot(m.read()),initial);
});
