import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

// Mount the real controller and its SVG ref. Omit scene descendants: wheel
// events must exercise the native listener, with a deterministic frame clock.
async function mountMap(t,{width=64,height=48}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true}),frames=new Map(),jobs=[],changes=[],listeners=[];
 let now=1000,requestId=0,tree,unmounted=false;
 const add=dom.window.SVGElement.prototype.addEventListener;
 dom.window.SVGElement.prototype.addEventListener=function(type,listener,options){listeners.push({type,options});return add.call(this,type,listener,options);};
 class Worker{postMessage(message){jobs.push({worker:this,...message});}terminate(){}}
 class ResizeObserver{constructor(callback){this.callback=callback;}observe(){this.callback([{contentRect:{width:960,height:540}}]);}disconnect(){}}
 const globals={window:dom.window,document:dom.window.document,Worker,ResizeObserver,IS_REACT_ACT_ENVIRONMENT:true,
  performance:new Proxy(performance,{get(target,key){if(key==='now')return()=>now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),
  requestAnimationFrame:callback=>{frames.set(++requestId,callback);return requestId;},cancelAnimationFrame:id=>frames.delete(id)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const battle=createBattle([{id:'p',name:'Observador',x:Math.min(24,width-2),y:Math.min(20,height-2),weapon:1800,loaded:1},{id:'q',name:'Explorador',x:Math.min(30,width-1),y:Math.min(20,height-1)}],{width,height,enemies:[],exploration:true});
 battle.deploymentComplete=true;
 for(const tile of battle.tiles){tile.blocked=false;tile.blocksSight=false;tile.type='grass';}
 const props={battle,onChange:state=>{changes.push(state);return state;},onFinish(){}},wrapper=Battlefield(props),Contents=wrapper.props.children.type;
 function Capture({battle}){tree=Contents({...props,battle});const field=nodes(tree).find(node=>node.props?.className?.startsWith('tactical-field'));return h('svg',{...field.props,children:null});}
 const root=createRoot(document.getElementById('root'));
 const unmount=async()=>{if(!unmounted){unmounted=true;await act(async()=>root.unmount());}};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const draw=async state=>act(async()=>root.render(h(wrapper.type,null,h(Capture,{battle:state}))));
 await draw(battle);
 const svg=document.querySelector('svg');
 svg.getBoundingClientRect=()=>({left:30,top:50,width:960,height:540});
 const strip=()=>nodes(tree).find(node=>node.type===JA2Strip).props;
 return {battle,draw,svg,strip,jobs,changes,listeners,unmount,
  camera:()=>({...strip().cameraRect}),pending:()=>frames.size,
  async wheel(init){const event=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,...init});await act(async()=>svg.dispatchEvent(event));return event;},
  async touch(type,points){const event=new window.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:points.map(([clientX,clientY],identifier)=>({clientX,clientY,identifier}))});await act(async()=>svg.dispatchEvent(event));return event;},
  async frame(milliseconds=16){now+=milliseconds;const callbacks=[...frames.values()];frames.clear();await act(async()=>{for(const callback of callbacks)callback(now);});},
  async zoom(value){while(strip().zoom!==value)await act(async()=>strip().onZoom(Math.sign(value-strip().zoom)));},
  async center(){await act(async()=>strip().onCameraCenter());},
  async pan(dx,dy){await act(async()=>strip().onCameraPan(dx,dy));},
  async deliver(job){await act(async()=>job.worker.onmessage({data:{id:job.id,battle:runBattleJob(job.job)}}));},
 };
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} must equal ${expected}`);
const shifted=(before,after,x,y)=>{close(after.x,before.x+x);close(after.y,before.y+y);assert.equal(after.width,before.width);assert.equal(after.height,before.height);};
const anchor=(camera,x,y)=>({x:camera.x+x*camera.width,y:camera.y+y*camera.height});

test('native wheel pans both axes in CSS pixels at every zoom and coalesces a burst into one frame',async t=>{
 const map=await mountMap(t);
 assert.ok(map.listeners.some(({type,options})=>type==='wheel'&&options?.passive===false));
 for(const zoom of [1,2,3]){
  await map.zoom(zoom);await map.center();const before=map.camera();
  for(let i=0;i<30;i++)assert.equal((await map.wheel({deltaX:1,deltaY:2})).defaultPrevented,true);
  assert.equal(map.pending(),1);assert.deepEqual(map.camera(),before);
  await map.frame();shifted(before,map.camera(),30/zoom,60/zoom);assert.equal(map.pending(),0);
 }
 await map.zoom(3);await map.center();const before=map.camera();
 for(let i=0;i<6;i++){await map.wheel({deltaX:.5,deltaY:.5});await map.frame();}
 shifted(before,map.camera(),1,1);
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0,'panning cannot issue a gameplay order');
 assert.match(map.svg.getAttribute('aria-label'),/Rueda o panel táctil.*Mayús\+rueda/);
});

test('line, page and Shift wheel deltas pan their intended axis; Command wheel remains native',async t=>{
 const map=await mountMap(t);
 for(const [input,x,y] of [
  [{deltaMode:1,deltaX:2,deltaY:3},16,24],
  [{deltaMode:2,deltaX:.25,deltaY:.5},120,135],
  [{shiftKey:true,deltaY:32},16,0],
  [{shiftKey:true,deltaX:32},16,0],
  [{shiftKey:true,deltaMode:2,deltaY:.25},120,0],
  [{deltaX:-20,deltaY:-40},-10,-20],
 ]){await map.center();const before=map.camera();await map.wheel(input);await map.frame();shifted(before,map.camera(),x,y);}
 const before=map.camera();
 for(const modifier of [{metaKey:true},{ctrlKey:true,metaKey:true}])assert.equal((await map.wheel({deltaX:40,deltaY:80,...modifier})).defaultPrevented,false);
 assert.equal(map.pending(),0);assert.deepEqual(map.camera(),before);
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('wheel and existing pan controls clamp the map, and center cancels a queued gesture',async t=>{
 const map=await mountMap(t);
 await map.wheel({deltaX:1e6,deltaY:1e6});await map.frame();
 const end=map.camera(),strip=map.strip();assert.equal(end.x,strip.vw-end.width);assert.equal(end.y,strip.vh-end.height);
 await map.wheel({deltaX:1e6,deltaY:1e6});await map.frame();assert.deepEqual(map.camera(),end);
 await map.pan(-1e6,-1e6);assert.equal(map.camera().x,0);assert.equal(map.camera().y,0);
 await map.wheel({deltaX:-1e6,deltaY:-1e6});await map.frame();assert.equal(map.camera().x,0);assert.equal(map.camera().y,0);
 await map.center();const centered=map.camera();await map.wheel({deltaY:100});assert.equal(map.pending(),1);
 await map.center();assert.equal(map.pending(),0);await map.frame();assert.deepEqual(map.camera(),centered);
 await map.pan(90,65);shifted(centered,map.camera(),90,65);
});

test('a map smaller than the viewport stays bounded when scrolled',async t=>{
 const map=await mountMap(t,{width:8,height:8});await map.zoom(1);
 for(const sign of [-1,1]){await map.wheel({deltaX:sign*1000,deltaY:sign*1000});await map.frame();assert.equal(map.camera().x,0);assert.equal(map.camera().y,0);}
});

test('manual panning remains still during walking until selection explicitly restores follow',async t=>{
 const map=await mountMap(t),before=map.camera();
 const walking=structuredClone(map.battle),walker=walking.units.find(unit=>unit.id==='p');walker.x+=2;walker.lastMovePath=[{x:walker.x-1,y:walker.y},{x:walker.x,y:walker.y}];
 await map.draw(walking);await map.frame(120);assert.notEqual(map.camera().x,before.x,'the camera initially follows the moving selection');
 await map.wheel({deltaX:40,deltaY:60});await map.frame();const panned=map.camera();
 await map.frame(500);assert.deepEqual(map.camera(),panned,'walking must not drag a manually positioned map');
 await act(async()=>map.strip().onSelect('q'));assert.equal(map.strip().selected,'q');assert.notDeepEqual(map.camera(),panned,'selecting a merc centers and resumes follow');
 const centered=map.camera(),next=structuredClone(walking),other=next.units.find(unit=>unit.id==='q');other.x++;other.lastMovePath=[{x:other.x,y:other.y}];
 await map.draw(next);await map.frame(120);assert.notEqual(map.camera().x,centered.x,'explicit center restores movement follow');
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('same merc portrait recenters after manual pan, including during a walk',async t=>{
 const map=await mountMap(t),centered=map.camera();await map.pan(90,65);
 await act(async()=>map.strip().onSelect('p'));assert.deepEqual(map.camera(),centered);assert.equal(map.strip().selected,'p');
 const walking=structuredClone(map.battle),walker=walking.units.find(unit=>unit.id==='p');walker.x+=2;walker.lastMovePath=[{x:walker.x-1,y:walker.y},{x:walker.x,y:walker.y}];
 await map.draw(walking);await map.frame(120);await map.pan(90,65);const panned=map.camera();
 await act(async()=>map.strip().onSelect('p'));assert.notDeepEqual(map.camera(),panned);const recentered=map.camera();
 await map.frame(120);assert.notEqual(map.camera().x,recentered.x,'same-portrait selection resumes follow during the walk');
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('selecting another merc during movement centers them without replacing the queued route',async t=>{
 const map=await mountMap(t);await map.pan(90,65);const panned=map.camera();
 await act(async()=>map.strip().onOrder({type:'move',x:28,y:20}));
 assert.equal(map.jobs.length,1);assert.equal(map.strip().busy,true);
 const first=map.jobs[0];assert.equal(first.job.kind,'movement-step');assert.equal(first.job.action.unitId,'p');
 await act(async()=>map.strip().onSelect('q',true));assert.equal(map.strip().selected,'p');assert.deepEqual(map.camera(),panned,'Shift selection keeps its busy guard');
 await act(async()=>map.strip().onSelect('q'));assert.equal(map.strip().selected,'q');assert.notDeepEqual(map.camera(),panned);
 const other=map.battle.units.find(unit=>unit.id==='q'),position=map.strip().project(other.x,other.y),camera=map.camera();
 close(camera.x+camera.width/2,position.x);close(camera.y+camera.height/2,position.y);
 assert.equal(map.jobs.length,1,'portrait selection must not submit another order');assert.equal(map.changes.length,0);
 await map.deliver(first);assert.equal(map.changes.length,1);const stepped=map.changes[0];assert.equal(stepped.units.find(unit=>unit.id==='p').x,25);
 await map.draw(stepped);assert.equal(map.jobs.length,2,'the original soldier prepares its next route step');
 const remaining=map.jobs[1].job;assert.equal(remaining.kind,'movement-step');assert.equal(remaining.action.unitId,'p');assert.equal(remaining.action.x,28);assert.equal(remaining.action.y,20);
 await map.deliver(map.jobs[1]);await map.frame(120);assert.equal(map.changes.length,1,'the prepared step waits for the current visible step');assert.deepEqual(map.camera(),camera);
 await map.frame(120);assert.equal(map.changes.length,2);assert.equal(map.changes[1].units.find(unit=>unit.id==='p').x,26,'the original soldier continues after its visible step');
 assert.equal(map.strip().selected,'q');assert.deepEqual(map.camera(),camera);
});

test('medical portrait targeting remains blocked while a soldier is moving',async t=>{
 const map=await mountMap(t),walking=structuredClone(map.battle),walker=walking.units.find(unit=>unit.id==='p');
 walker.activeSlot='medical';walker.x+=2;walker.lastMovePath=[{x:walker.x-1,y:walker.y},{x:walker.x,y:walker.y}];
 await map.draw(walking);await map.frame(120);await map.pan(90,65);const panned=map.camera();assert.equal(map.strip().busy,true);
 await act(async()=>map.strip().onSelect('q'));assert.equal(map.strip().selected,'p');assert.deepEqual(map.camera(),panned);
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('Shift group selection and medical targeting do not recenter or change the selected merc',async t=>{
 const map=await mountMap(t);await map.pan(90,65);let panned=map.camera();
 await act(async()=>map.strip().onSelect('q',true));assert.equal(map.strip().selected,'p');assert.deepEqual(map.camera(),panned);assert.ok(map.strip().groupIds.includes('q'));
 const medical=structuredClone(map.battle);medical.units.find(unit=>unit.id==='p').activeSlot='medical';Object.assign(medical.units.find(unit=>unit.id==='q'),{hp:80,bleeding:4,bandaged:0});await map.draw(medical);panned=map.camera();
 await act(async()=>map.strip().onSelect('q'));assert.equal(map.strip().selected,'p');assert.deepEqual(map.camera(),panned);
 assert.equal(map.changes.length,1);assert.equal(map.changes[0].lastError,null);assert.equal(map.changes[0].units.find(unit=>unit.id==='q').bleeding,0,'medical selection retains its treatment order');
});

test('trackpad pinch smoothly zooms in and out at the pointer with one update per frame',async t=>{
 const map=await mountMap(t),before=map.camera(),point=anchor(before,.25,.4);
 for(let i=0;i<10;i++)assert.equal((await map.wheel({ctrlKey:true,deltaY:-1,clientX:270,clientY:266})).defaultPrevented,true);
 assert.equal(map.pending(),1);assert.deepEqual(map.camera(),before);assert.equal(map.strip().zoom,2);
 await map.frame();close(map.strip().zoom,2*Math.exp(.1));assert.equal(map.pending(),0);
 close(anchor(map.camera(),.25,.4).x,point.x);close(anchor(map.camera(),.25,.4).y,point.y);
 assert.ok(!Number.isInteger(map.strip().zoom));
 await map.wheel({ctrlKey:true,deltaY:20,clientX:270,clientY:266});await map.frame();close(map.strip().zoom,2*Math.exp(-.1));
 close(anchor(map.camera(),.25,.4).x,point.x);close(anchor(map.camera(),.25,.4).y,point.y);
 const zoomed=map.camera(),zoom=map.strip().zoom;await map.wheel({deltaX:24,deltaY:48});await map.frame();shifted(zoomed,map.camera(),24/zoom,48/zoom);assert.equal(map.strip().zoom,zoom);
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('pinch clamps zoom and camera bounds and center cancels a queued zoom',async t=>{
 const map=await mountMap(t);
 await map.pan(-1e6,-1e6);await map.wheel({ctrlKey:true,deltaY:1e6,clientX:270,clientY:266});await map.frame();
 assert.equal(map.strip().zoom,1);assert.equal(map.camera().x,0);assert.equal(map.camera().y,0);
 await map.wheel({ctrlKey:true,deltaY:-1e6,clientX:270,clientY:266});await map.frame();assert.equal(map.strip().zoom,3);
 await map.pan(1e6,1e6);await map.wheel({ctrlKey:true,deltaY:40,clientX:270,clientY:266});await map.frame();
 const camera=map.camera();close(camera.x,map.strip().vw-camera.width);close(camera.y,map.strip().vh-camera.height);
 const zoom=map.strip().zoom;await map.wheel({ctrlKey:true,deltaY:-10,clientX:270,clientY:266});assert.equal(map.pending(),1);
 await map.center();assert.equal(map.pending(),0);await map.frame();assert.equal(map.strip().zoom,zoom);
});

test('two-finger touch pinch follows its midpoint, zooms both ways, and cancels cleanly',async t=>{
 const map=await mountMap(t),before=map.camera(),point=anchor(before,.5,.5);
 assert.equal(map.svg.style.touchAction,'none');
 assert.equal((await map.touch('touchstart',[[460,320]])).defaultPrevented,false);assert.equal(map.pending(),0);
 assert.equal((await map.touch('touchstart',[[460,320],[560,320]])).defaultPrevented,true);
 assert.equal((await map.touch('touchmove',[[450,320],[570,320]])).defaultPrevented,true);
 await map.touch('touchmove',[[460,330],[580,330]]);assert.equal(map.pending(),1);await map.frame();close(map.strip().zoom,2.4);
 close(anchor(map.camera(),490/960,280/540).x,point.x);close(anchor(map.camera(),490/960,280/540).y,point.y);
 await map.touch('touchmove',[[475,330],[565,330]]);await map.frame();close(map.strip().zoom,1.8);
 close(anchor(map.camera(),490/960,280/540).x,point.x);close(anchor(map.camera(),490/960,280/540).y,point.y);
 assert.equal((await map.touch('touchend',[])).defaultPrevented,true);
 const ended=map.camera();await map.touch('touchmove',[[475,330]]);assert.equal(map.pending(),0);assert.deepEqual(map.camera(),ended);
 await map.touch('touchstart',[[460,320],[560,320]]);await map.touch('touchmove',[[450,320],[570,320]]);assert.equal(map.pending(),1);
 assert.equal((await map.touch('touchcancel',[])).defaultPrevented,true);assert.equal(map.pending(),0);await map.frame();assert.deepEqual(map.camera(),ended);
 assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});

test('unmount removes the native wheel listener and cancels queued camera work',async t=>{
 const map=await mountMap(t);await map.wheel({deltaX:40,deltaY:80});await map.wheel({ctrlKey:true,deltaY:-10});await map.touch('touchstart',[[460,320],[560,320]]);await map.touch('touchmove',[[450,320],[570,320]]);assert.equal(map.pending(),1);
 await map.unmount();assert.equal(map.pending(),0);
 assert.equal((await map.wheel({deltaY:80})).defaultPrevented,false,'detached SVG has no retained listener');
 assert.equal((await map.wheel({ctrlKey:true,deltaY:-10})).defaultPrevented,false);
 assert.equal((await map.touch('touchmove',[[420,320],[600,320]])).defaultPrevented,false);
 assert.equal(map.pending(),0);assert.equal(map.jobs.length,0);assert.equal(map.changes.length,0);
});
