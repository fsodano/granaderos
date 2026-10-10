import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,memo,act} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {buildBuilding} from '../game/buildings.js';
const {sameStaticSceneContent,sameStaticSceneProps}=await import('../web/lib/static-scene-content.ts');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');

const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
const first=buildBuilding({id:'first',x:2,y:2,width:6,height:5,doors:[{id:'first-door',x:4,y:7,axis:'x'}]}),second=buildBuilding({id:'second',x:12,y:2,width:6,height:5});
const state={tiles:[...first.tiles,...second.tiles],wallEdges:[...first.wallEdges,...second.wallEdges],buildings:[first.building,second.building]};
const objects=(state,rooms=[],brightness=.6)=>buildBuildingObjects({state,project,revealed:new Set(rooms),light:()=>brightness});

test('revealing one room retains other architecture and updates every changed wall, roof and floor',()=>{
 const before=objects(state),after=objects(structuredClone(state),['first:interior']);
 let reused=0,changed=0;
 for(const object of after){
  const prior=before.find(item=>item.key===object.key);if(!prior)continue;
  const same=sameStaticSceneContent(prior.node,object.node);
  assert.equal(same,render(prior.node)===render(object.node),object.key);
  if(same)reused++;else changed++;
 }
 assert.ok(reused>20);assert.ok(changed>0);
 assert.ok(!after.some(item=>item.key==='architecture-roof-first:interior'));
 assert.ok(sameStaticSceneContent(before.find(item=>item.key==='architecture-roof-second:interior').node,after.find(item=>item.key==='architecture-roof-second:interior').node));
});

test('door states, light, textures, order and component props invalidate retained scenery',()=>{
 const before=objects(state),opened=structuredClone(state);opened.wallEdges.find(t=>t.type==='door').open=true;
 const door=state.wallEdges.find(t=>t.type==='door'),key=`architecture-${door.id}-${door.axis}`;
 assert.equal(sameStaticSceneContent(before.find(o=>o.key===key).node,objects(opened).find(o=>o.key===key).node),false);
 assert.equal(sameStaticSceneContent(before.find(o=>o.key===key).node,objects(state,[],.9).find(o=>o.key===key).node),false);
 assert.equal(sameStaticSceneContent(h('image',{href:'one.png'}),h('image',{href:'two.png'})),false);
 assert.equal(sameStaticSceneContent([h('g',{key:'a'}),h('g',{key:'b'})],[h('g',{key:'b'}),h('g',{key:'a'})]),false);
 assert.equal(sameStaticSceneContent({rooms:new Set(['first'])},{rooms:new Set(['second'])}),false);
 assert.equal(sameStaticSceneContent({onClick:()=>1},{onClick:()=>1}),false);
});

test('equivalent regenerated descriptions do not rerender a mounted layer, while changed scenery does',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true},previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,value]of previous)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
 let renders=0;const Layer=memo(({children})=>{renders++;return h('svg',null,children);},sameStaticSceneProps);
 const draw=color=>act(async()=>root.render(h(Layer,null,h('g',{style:{filter:'brightness(.6)'}},h('rect',{width:20,height:30,fill:color})))));
 await draw('red');const node=dom.window.document.querySelector('rect');
 for(let i=0;i<10;i++)await draw('red');
 assert.equal(renders,1);assert.equal(dom.window.document.querySelector('rect'),node);
 await draw('blue');assert.equal(renders,2);assert.equal(node.getAttribute('fill'),'blue');
});

test('walls that share immutable building metadata compare that metadata only once',()=>{
 let reads=0;
 const building=()=>({get rooms(){reads++;return [{id:'shared',cells:Array.from({length:100},(_,x)=>({x,y:1}))}];}});
 const before=building(),after=building();
 for(let wall=0;wall<80;wall++)assert.ok(sameStaticSceneContent(h('g',{'data-wall':wall,building:before}),h('g',{'data-wall':wall,building:after})));
 assert.equal(reads,2,'a room reveal must not compare the same room cells once per wall');
});
