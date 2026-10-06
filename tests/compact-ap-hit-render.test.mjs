import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {battleTimers} from './battle-timers-fixture.mjs';
register('./tactical-render-loader.mjs',import.meta.url);

test('a paid punch shows 3 PA, one actual hit number, then removes it; restored play can show the next hit',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const {default:Battlefield}=await import('../web/app/Battlefield.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js'),timers=battleTimers(act),root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{timers.restore();dom.window.close();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}});
 let battle=createBattle([{id:'p',name:'Patriota',x:1,y:1,weapon:0,activeSlot:'unarmed',agility:100,dexterity:100,strength:70,experienceLevel:10}],{seed:45,width:10,height:6,tiles:Array.from({length:60},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Rival',x:2,y:1,patrol:false,overwatch:false}]});
 const draw=()=>root.render(h(Battlefield,{battle,onChange:next=>{battle=next;draw();},onFinish:()=>{}}));
 const target=()=>document.querySelector('[data-unit-id="e"] [data-person-hit-target]');
 await act(async()=>draw());assert.equal(document.querySelector('.ja2-ap-readout').textContent,'25PA');
 for(const remaining of ['22PA','19PA']){
  const before=structuredClone(battle),expected=actBattle(before,{type:'useItem',unitId:'p',targetId:'e'});
  assert.equal(expected.lastError,null);assert.ok(expected.units[1].hp<before.units[1].hp);
  await act(async()=>target().dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true})));
  assert.match(document.querySelector('[aria-label="Vista previa de la orden"]').textContent,/3 PA/);
  await act(async()=>target().dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(document.querySelector('.tactical-damage-number'),null,'preparation cannot show damage');
  await timers.until(()=>Boolean(document.querySelector('.tactical-damage-number')));
  const numbers=document.querySelectorAll('.tactical-damage-number');assert.equal(numbers.length,1);
  assert.equal(numbers[0].textContent,`−${before.units[1].hp-expected.units[1].hp}`);
  assert.equal(numbers[0].parentElement.getAttribute('data-hit-reaction'),'e');
  await timers.settle(document);assert.equal(document.querySelector('.tactical-damage-number'),null);
  assert.deepEqual(battle,expected);assert.equal(document.querySelector('.ja2-ap-readout').textContent,remaining);
  battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));await act(async()=>draw());
  assert.equal(document.querySelector('.tactical-damage-number'),null,'loading cannot replay a past hit');
 }
});
