import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle} from '../game/tactical.js';
import {spriteRender,spriteMovementFrame,spriteViewport} from '../game/sprite-render.js';
const {default:SpriteFigure}=await import('../web/app/SpriteFigure.tsx');
const {StableJA2Roster}=await import('../web/app/JA2Roster.tsx');

async function mount(t){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 return {dom,root,render:async node=>act(async()=>root.render(node))};
}

test('walking reuses the atlas between authored frames and preserves exact rounded placement',async t=>{
 const mounted=await mount(t),unit={id:'walker',hp:100,weapon:1800,activeSlot:'primary',skinTone:'dark'};
 const motion={direction:3,frame:0,moving:true,elapsedMs:0};
 const draw=(position,motion)=>mounted.render(h('svg',null,h(SpriteFigure,{unit,position,motion})));
 await draw({x:100,y:150},motion);
 const doc=mounted.dom.window.document,atlas=doc.querySelector('[data-sprite-position] svg'),base=atlas.innerHTML,firstViewBox=atlas.getAttribute('viewBox');
 const changes=[],observer=new mounted.dom.window.MutationObserver(records=>changes.push(...records));observer.observe(atlas,{subtree:true,childList:true,attributes:true});
 for(let frame=0;frame<15;frame++){
  const position={x:100+frame/3,y:150+frame/7},moving={...motion,elapsedMs:frame*10};
  await draw(position,moving);
  const sprite=spriteRender(unit,moving),view=spriteViewport(sprite,position,moving.direction,spriteMovementFrame(moving,sprite.frames,sprite.fps));
  assert.equal(doc.querySelector('[data-sprite-position]').getAttribute('transform'),`translate(${view.x} ${view.y})`);
  assert.equal(doc.querySelector('[data-sprite-position] svg'),atlas);
  assert.equal(atlas.innerHTML,base);
 }
 assert.equal(changes.length,0,'subframe motion must leave the atlas and skin filter untouched');
 await draw({x:110,y:155},{...motion,elapsedMs:250});
 assert.notEqual(atlas.getAttribute('viewBox'),firstViewBox);
 const [x,y]=atlas.getAttribute('viewBox').split(' '),filter=atlas.querySelector('filter');
 assert.equal(filter.getAttribute('x'),x);assert.equal(filter.getAttribute('y'),y);
 assert.ok(changes.length>0,'the next authored frame must update the displayed atlas');observer.disconnect();
});

test('walking updates do not rebuild roster models and clicks use the latest handlers',async t=>{
 const mounted=await mount(t),battle=createBattle([{id:'p',name:'Vigía',weapon:1800}],{width:8,height:8,exploration:true,enemies:[]});
 let hpReads=0;const players=battle.units.map(unit=>new Proxy(unit,{get(target,key,receiver){if(key==='hp')hpReads++;return Reflect.get(target,key,receiver);}})),groupIds=[];
 const called=[];const props={battle,players,selected:'p',groupIds};
 const render=version=>mounted.render(h(StableJA2Roster,{...props,onSelect:(id,additive)=>called.push({version,id,additive}),onOpenInventory:id=>called.push({version,id,inventory:true})}));
 await render(0);assert.ok(hpReads>0);hpReads=0;
 for(let frame=1;frame<=20;frame++)await render(frame);
 assert.equal(hpReads,0,'unchanged roster data must not be read during interpolated movement');
 const card=mounted.dom.window.document.querySelector('[role="listitem"]');
 await act(async()=>{card.dispatchEvent(new mounted.dom.window.MouseEvent('click',{bubbles:true,shiftKey:true}));card.dispatchEvent(new mounted.dom.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));});
 assert.deepEqual(called,[{version:20,id:'p',additive:true},{version:20,id:'p',inventory:true}]);
 const next={...battle,units:battle.units.map(unit=>({...unit,hp:65}))};
 await mounted.render(h(StableJA2Roster,{...props,battle:next,players:next.units,onSelect(){},onOpenInventory(){}}));
 assert.match(card.getAttribute('aria-label'),/Salud 65/);
});
