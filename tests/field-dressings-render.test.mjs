import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle,presentedActBattle,fieldDressingsPreview} from '../game/tactical.js';
import {makeOutfit} from '../game/outfits.js';
import {fieldDressingsSource} from '../game/field-dressings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const {default:Inventory}=await import('../web/app/JA2Inventory.tsx');
const noop=()=>{};
const shirt=(condition=100,id='linen:chest')=>({...makeOutfit('linen_shirt',condition),instanceId:id});
const field=(player={})=>createBattle([{id:'p',name:'Soldado',x:1,y:2,weapon:1805,medkits:0,hp:50,bleeding:2,inventory:{linen:shirt()},...player}],{
 width:14,height:8,enemies:[{id:'e',x:12,y:6,patrol:false,overwatch:false}],
 tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),
});
async function mounted(t,initial){
 const dom=new JSDOM('<!doctype html><div id="root"></div>');
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const host=dom.window.document.getElementById('root'),root=createRoot(host);let battle=initial;const orders=[];
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const draw=async(next=battle)=>{
  battle=next;const unit=battle.units[0];
  await act(async()=>root.render(h(Inventory,{battle,unit,units:battle.units,selected:unit.id,mode:'move',showSight:false,busy:false,missionAllies:[],localMilitia:[],
   vw:600,vh:400,cameraRect:{x:0,y:0,width:200,height:150},project:(x,y)=>({x:x*26,y:y*14}),zoom:1,
   onOrder:action=>{orders.push(action);battle=actBattle(battle,{...action,unitId:unit.id});return battle;},
   onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop})));
 };
 const inspect=async(slot)=>{const button=slot?host.querySelector(`[data-equipment-slot="${slot}"]`):[...host.querySelectorAll('.ja2-pocket')].find(button=>button.textContent.includes('Camisa de lino'));assert.ok(button);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true})));};
 await draw();return {host,orders,draw,inspect,get battle(){return battle;},get button(){return [...host.querySelectorAll('button')].find(button=>button.textContent.startsWith('Preparar vendas'));}};
}

test('the real inspected shirt control dispatches a paid finite conversion with saved and presented equality',async t=>{
 const s=field({inventory:{linen:shirt(50)}}),before=structuredClone(s),ui=await mounted(t,s);
 assert.equal(ui.button,undefined,'conversion is offered after selecting the actual garment');await ui.inspect();
 assert.equal(ui.button.textContent,'Preparar vendas · 20 PA');assert.equal(ui.button.disabled,false);
 assert.match(ui.host.textContent,/Consume una camisa de lino guardada para obtener 3 vendas\. No cura heridas\./);
 const expected=fieldDressingsSource(s.units[0],'linen');await act(async()=>ui.button.click());assert.equal(ui.orders.length,1);
 const action={...ui.orders[0],unitId:'p'};assert.deepEqual(action,{type:'craftDressings',inventoryKey:'linen',expectedSource:expected,unitId:'p'});
 assert.equal(ui.battle.lastError,null);assert.equal(ui.battle.units[0].inventory.linen,undefined);assert.equal(ui.battle.units[0].medkits,3);
 assert.equal(ui.battle.units[0].ap,before.units[0].ap-fieldDressingsPreview(s,s.units[0],'linen',expected).pa);
 for(const key of ['hp','bleeding','loaded','condition','energy'])assert.deepEqual(ui.battle.units[0][key],before.units[0][key],key);
 assert.deepEqual(s,before);assert.deepEqual(presentedActBattle(s,action).state,ui.battle);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),action),ui.battle);
 await ui.draw();assert.equal(ui.button,undefined);assert.equal(ui.orders.length,1);
});

test('a stale inspected source cannot consume a replacement shirt until it is selected again',async t=>{
 const s=field(),ui=await mounted(t,s);await ui.inspect();const oldSource=fieldDressingsSource(s.units[0],'linen');
 const replaced=structuredClone(s);replaced.units[0].inventory.linen=shirt(100,'linen:replacement');await ui.draw(replaced);
 assert.equal(ui.button.disabled,true);assert.match(ui.button.title,/Cambió la camisa/);
 await act(async()=>ui.button.click());assert.equal(ui.orders.length,0);assert.deepEqual(ui.battle,replaced);
 assert.notEqual(fieldDressingsSource(replaced.units[0],'linen'),oldSource);await ui.inspect();assert.equal(ui.button.disabled,false);
 await act(async()=>ui.button.click());assert.equal(ui.orders.length,1);assert.equal(ui.orders[0].expectedSource,fieldDressingsSource(replaced.units[0],'linen'));
 assert.equal(ui.battle.units[0].medkits,3);assert.equal(ui.battle.units[0].inventory.linen,undefined);
});

test('the inventory explains insufficient AP, damaged cloth and worn or held sources without dispatching',async t=>{
 const ui=await mounted(t,field()),lowAP=field();lowAP.units[0].ap=19;
 for(const [s,slot,reason]of [
  [lowAP,null,/PA/],
  [field({inventory:{linen:shirt(49)}}),null,/al menos 50%/],
  [field({activeSlot:'item',activeItem:'inventory:linen'}),'hand:right',/Guardá la camisa/],
  [field({leftHandItem:'inventory:linen'}),'hand:left',/Guardá la camisa/],
  [field({outfit:shirt(),inventory:{}}),'outfit',/Guardá la camisa/],
 ]){
  // Recreate the boundary before any order; selecting an unsuitable item never
  // alters its physical custody or cures the soldier.
  await ui.draw(s);await ui.inspect(slot);assert.ok(ui.button);assert.equal(ui.button.disabled,true);assert.match(ui.button.title,reason);
  const snapshot=structuredClone(ui.battle);await act(async()=>ui.button.click());assert.deepEqual(ui.battle,snapshot);assert.equal(ui.orders.length,0);
 }
});
