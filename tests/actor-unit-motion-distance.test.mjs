import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useMemo} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle} from '../game/tactical.js';
const {useUnitMotion}=await import('../web/app/useUnitMotion.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const {surfaceMotionPoint}=await import('../web/lib/tactical-elevation.ts');
const {readFileSync}=await import('node:fs');
const manifest=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url),'utf8'));

async function mount(t){
 const dom=new JSDOM('<div id="root"></div>'),callbacks=new Map();let now=1000,serial=0,motion;
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,
  performance:new Proxy(performance,{get(target,key){if(key==='now')return()=>now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),
  requestAnimationFrame:fn=>{callbacks.set(++serial,fn);return serial;},cancelAnimationFrame:id=>callbacks.delete(id)};
 const prior=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,value]of prior)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}});
 function Probe({battle}){const visible=useMemo(()=>battle.presentationVisibleIds?new Set(battle.presentationVisibleIds):undefined,[battle]),continuing=useMemo(()=>new Set(battle.presentationMovingUnitId?[battle.presentationMovingUnitId]:[]),[battle]);motion=useUnitMotion(battle,undefined,visible,continuing);return null;}
 return {draw:battle=>act(async()=>root.render(h(Probe,{battle}))),async tick(ms){now+=ms;const pending=[...callbacks.values()];callbacks.clear();await act(async()=>{for(const fn of pending)fn(now);});},get motion(){return motion;},get pending(){return callbacks.size;}};
}
function field(){return createBattle([{id:'p',x:1,y:1}],{width:16,height:8,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:3,y:1,weapon:1801}]});}

test('real movement publishes cumulative distance through paid cells and stationary boundaries',async t=>{
 const env=await mount(t);let state={...field(),presentationVisibleIds:['p','e'],presentationStepMs:120};await env.draw(state);
 const actor=state.units.find(u=>u.id==='e'),cardinal=movementStepDuration(actor,{x:3,y:1},{x:4,y:1},state.presentationStepMs),diagonal=movementStepDuration(actor,{x:4,y:1},{x:5,y:2},state.presentationStepMs);
 const step=(x,y)=>({...state,presentationMovingUnitId:'e',units:state.units.map(u=>u.id==='e'?{...u,x,y}:u)});
 state=step(4,1);await env.draw(state);await env.tick(cardinal);
 assert.equal(env.motion.actorPositions['unit:e'].elapsedDistance,1);
 assert.equal(env.motion.actorPositions['unit:e'].segmentFraction,1);assert.equal(env.motion.actorPositions['unit:e'].climbDirection,0);
 assert.equal(env.motion.positions.e,env.motion.actorPositions['unit:e'],'legacy alias points at the same namespaced sample');
 await env.tick(300);assert.equal(env.motion.positions.e.elapsedDistance,1,'waiting cannot advance foot phase');
 state=step(5,2);await env.draw(state);assert.equal(env.motion.positions.e.elapsedDistance,1);
 await env.tick(diagonal/2);const motion=env.motion.positions.e;
 assert.ok(Math.abs(motion.elapsedDistance-(1+Math.SQRT2/2))<1e-10);
 assert.equal(motion.travelX,1);assert.equal(motion.travelY,1);
 assert.ok(Math.abs(motion.elapsedTravelX-1.5)<1e-10);assert.ok(Math.abs(motion.elapsedTravelY-.5)<1e-10);
 await env.tick(diagonal/2);assert.ok(Math.abs(env.motion.positions.e.elapsedDistance-(1+Math.SQRT2))<1e-10);
 await env.draw({...state,presentationMovingUnitId:null});
 state=step(4,2);await env.draw(state);assert.equal(env.motion.positions.e.elapsedDistance,0,'a separate order starts a new travel phase');
 await env.tick(cardinal/2);assert.equal(env.motion.positions.e.travelX,-1);assert.equal(env.motion.positions.e.travelY,0);assert.ok(Math.abs(env.motion.positions.e.elapsedTravelX+.5)<1e-10);
});

test('presented climb keeps its link and final segment fraction',async t=>{
 const env=await mount(t);const ground=field();
 const platform={x:4,y:1,tacticalLevel:1,elevation:3,kind:'platform'};
 let state={...ground,upperSurfaces:[platform],presentationVisibleIds:['p','e'],presentationStepMs:120};await env.draw(state);
 state={...state,presentationMovingUnitId:'e',units:state.units.map(u=>u.id==='e'?{...u,x:4,y:1,tacticalLevel:1,lastMovePath:[{x:4,y:1,tacticalLevel:1,kind:'climb',linkId:'ladder'}]}:u)};
 const actor=state.units.find(unit=>unit.id==='e'),from=surfaceMotionPoint(ground,ground.units.find(unit=>unit.id==='e')),to=surfaceMotionPoint(state,actor.lastMovePath.at(-1));
 const native=manifest.animationLibraries.male.clips.find(clip=>clip.name==='life.climbUp');
 const duration=Math.max(120,native.duration*1000,3/.65*1000),paid=structuredClone(state);
 assert.equal(movementStepDuration(actor,from,to,120),duration,'The recorded delay cannot compress the native climb or supported vertical pace');
 await env.draw(state);await env.tick(60);assert.ok(Math.abs(env.motion.positions.e.segmentFraction-60/duration)<1e-12);assert.equal(env.motion.blocking,true);
 await env.tick(duration/2-60);
 assert.equal(env.motion.positions.e.kind,'climb');assert.equal(env.motion.positions.e.linkId,'ladder');assert.ok(Math.abs(env.motion.positions.e.segmentFraction-.5)<1e-12);assert.equal(env.motion.positions.e.climbDirection,1);
 assert.equal(env.motion.positions.e.moving,true);assert.equal(env.motion.positions.e.settled,false);assert.deepEqual(state,paid,'The display clock cannot change paid state');
 await env.tick(duration/2);const final=env.motion.positions.e;
 assert.equal(final.segmentFraction,1);assert.equal(final.climbDirection,1);assert.equal(final.kind,'climb');assert.equal(final.linkId,'ladder');
 assert.deepEqual([final.x,final.y,final.tacticalLevel,final.renderedHeight],[4,1,1,3]);assert.equal(final.settled,true);
 await env.draw({...state,presentationMovingUnitId:null});assert.equal(env.motion.blocking,false);assert.deepEqual(state,paid);
});
