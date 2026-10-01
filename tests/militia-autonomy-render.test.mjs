import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {createBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {combatMilitia,militiaEncounter} from './militia-combat-fixture.mjs';
import {saved,sync,leave} from './local-contract-fixture.mjs';

async function mount(t,battle){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');const root=createRoot(dom.window.document.getElementById('root'));let current=battle;
 function Screen(){const [s,set]=useState(current);current=s;return h(Battlefield,{battle:s,onChange:set,onFinish(){},onRetreat(){}});}
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 await act(async()=>root.render(h(Screen)));
 return {doc:dom.window.document,read:()=>current,click:async element=>{assert.ok(element);await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},key:async key=>{await act(async()=>dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true})));}};
}

test('mounted selection skips militia while the visible garrison remains a legal medical target',async t=>{
 // Prepared wounds and isolated terrain test production controls, not a full route.
 const b=createBattle([{id:'militia',name:'Defensor',militia:true,x:2,y:1,maxHp:100,hp:40,bleeding:3},{id:'doc',name:'Sanitario',x:1,y:1,medical:100,medkits:2},{id:'second',name:'Segundo',x:1,y:2}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false}]});
 const {doc,read,click,key}=await mount(t,b),selected=()=>doc.querySelector('.ja2-portrait-cell.active')?.getAttribute('aria-label');
 assert.match(selected(),/Sanitario/);const garrison=doc.querySelector('[aria-label="Guarnición local"]');assert.match(garrison.textContent,/combate por su cuenta/);assert.equal(garrison.querySelectorAll('button').length,0);assert.match(garrison.querySelector('.squad-card').textContent,/40 SALUD/);
 await click(doc.querySelector('[data-unit-id="militia"]'));assert.match(selected(),/Sanitario/);assert.deepEqual(read(),b);
 await key(' ');assert.match(selected(),/Segundo/);await key(' ');assert.match(selected(),/Sanitario/);
 await key('q');await click(doc.querySelector('[data-unit-id="militia"] [data-person-hit-target]'));
 assert.equal(read().lastError,null);assert.equal(read().units.find(u=>u.id==='doc').medkits,1);assert.equal(read().units.find(u=>u.id==='militia').bleeding,0);assert.match(selected(),/Sanitario/);assert.ok(validateBattleSnapshot(read()));
});

test('mounted end-turn resolves an actual paid defender reaction and saves its wound, finite gear and earned rank',async t=>{
 const prepared=combatMilitia(),encounter=militiaEncounter(prepared.s,prepared.id),{doc,read,click}=await mount(t,encounter.battle),before=structuredClone(encounter.battle.units.find(u=>Number(u.id)===prepared.id));
 const prior=read();await click(doc.querySelector('.ja2-essential .gold-button'));const deadline=Date.now()+10000;while(read()===prior&&Date.now()<deadline)await act(async()=>new Promise(resolve=>setTimeout(resolve,20)));assert.notEqual(read(),prior,'the visible defender turn must commit');
 const b=read(),defender=b.units.find(u=>Number(u.id)===prepared.id);assert.equal(b.lastError,null);assert.equal(b.status,'victory');assert.match(doc.body.textContent,/¡Victoria patriota!/);assert.equal(defender.loaded,before.loaded-1);assert.equal(defender.hp,44);assert.equal(defender.militiaExperience,3);
 const returned=saved({campaign:leave(saved(sync({campaign:encounter.s,battle:b})))}).campaign,retained=returned.garrisons.retiro.find(u=>u.id===prepared.id);
 assert.equal(retained.militiaRank,1);assert.equal(retained.hp,44);assert.equal(retained.loaded,defender.loaded);assert.equal(retained.condition,defender.condition);assert.deepEqual(retained.militiaCombatCredit,defender.militiaCombatCredit);
});
