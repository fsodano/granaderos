import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useMemo} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle} from '../game/tactical.js';
import {spriteRender,spriteMovementFrame} from '../game/sprite-render.js';
const {useUnitMotion}=await import('../web/app/useUnitMotion.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const nearly=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const duration=(state,id,requested=state.presentationStepMs)=>{const actor=state.units.find(unit=>unit.id===id);return movementStepDuration(actor,actor,{x:actor.x+1,y:actor.y},requested);};

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

test('successive enemy cells show every authored walking pose without idle flashes or phase resets',async t=>{
 const env=await mount(t);let state={...field(),presentationVisibleIds:['p','e'],presentationStepMs:120};await env.draw(state);
 const phases=new Set(),stepMs=duration(state,'e'),frames=Math.ceil(stepMs/20),frameMs=stepMs/frames;let elapsed=0;
 for(let step=1;step<=8;step++){
  state={...state,presentationMovingUnitId:'e',units:state.units.map(u=>u.id==='e'?{...u,x:3+step}:u)};await env.draw(state);
  nearly(env.motion.positions.e.elapsedMs,elapsed);
  for(let frame=0;frame<frames;frame++){
   await env.tick(frameMs);elapsed+=frameMs;const movement=env.motion.positions.e;
   assert.equal(movement.moving,true,'cell completion must not flash idle');nearly(movement.elapsedMs,elapsed);
   const sprite=spriteRender(state.units.find(u=>u.id==='e'),movement);phases.add(spriteMovementFrame(movement,sprite.frames,sprite.fps));
  }
  assert.equal(env.motion.positions.e.x,3+step);
 }
 const sprite=spriteRender(state.units.find(u=>u.id==='e'),env.motion.positions.e);
 assert.deepEqual([...phases].sort((a,b)=>a-b),Array.from({length:sprite.frames},(_,i)=>i));
 await env.draw({...state,presentationMovingUnitId:null});assert.equal(env.motion.positions.e.moving,false);assert.equal(env.pending,0);
 state={...state,units:state.units.map(u=>u.id==='e'?{...u,x:u.x+1}:u)};await env.draw(state);
 assert.equal(env.motion.positions.e.elapsedMs,0,'a separate walk starts a new cycle');
});

test('an enemy first observed at a cell does not animate its hidden approach',async t=>{
 const env=await mount(t),before={...field(),presentationVisibleIds:['p'],presentationStepMs:120};await env.draw(before);
 const seen={...before,presentationVisibleIds:['p','e'],presentationMovingUnitId:'e',units:before.units.map(u=>u.id==='e'?{...u,x:4}:u)};await env.draw(seen);
 assert.equal(env.motion.positions.e.x,4);assert.equal(env.motion.positions.e.moving,false);assert.equal(env.pending,0);
 const stepMs=duration(seen,'e');
 await env.draw({...seen,units:seen.units.map(u=>u.id==='e'?{...u,x:5}:u)});await env.tick(stepMs/2);
 nearly(env.motion.positions.e.x,4.5);nearly(env.motion.positions.e.elapsedMs,stepMs/2);
});


test('waiting at a reached cell does not skip walking poses when the next cell arrives',async t=>{
 const env=await mount(t);let state={...field(),presentationVisibleIds:['p','e'],presentationStepMs:120};await env.draw(state);
 const observed=[],stepMs=duration(state,'e'),frames=Math.ceil(stepMs/20),frameMs=stepMs/frames;
 for(let step=1;step<=8;step++){
  state={...state,presentationMovingUnitId:'e',units:state.units.map(u=>u.id==='e'?{...u,x:3+step}:u)};await env.draw(state);
  nearly(env.motion.positions.e.elapsedMs,(step-1)*stepMs);
  for(let frame=0;frame<frames;frame++){
   await env.tick(frameMs);const movement=env.motion.positions.e,sprite=spriteRender(state.units.find(u=>u.id==='e'),movement);
   const phase=spriteMovementFrame(movement,sprite.frames,sprite.fps);if(observed.at(-1)!==phase)observed.push(phase);
  }
  assert.equal(env.pending,0,'a waiting actor needs no animation callbacks');
  const held={...env.motion.positions.e};await env.tick(450);assert.deepEqual(env.motion.positions.e,held);
 }
 const sprite=spriteRender(state.units.find(unit=>unit.id==='e'),env.motion.positions.e);
 assert.deepEqual([...new Set(observed)].sort((a,b)=>a-b),Array.from({length:sprite.frames},(_,index)=>index));
 for(let index=1;index<observed.length;index++)assert.equal(observed[index],(observed[index-1]+1)%sprite.frames,'waiting never skips an authored pose');
 await env.draw({...state,presentationMovingUnitId:null});
 state={...state,units:state.units.map(u=>u.id==='e'?{...u,x:u.x+1}:u)};await env.draw(state);
 assert.equal(env.motion.positions.e.elapsedMs,0,'a separate order starts a new cycle');
});

test('a late endpoint callback does not add waiting time to the next step',async t=>{
 const env=await mount(t);let state={...field(),presentationVisibleIds:['p','e'],presentationStepMs:120};await env.draw(state);
 state={...state,presentationMovingUnitId:'e',units:state.units.map(u=>u.id==='e'?{...u,x:4}:u)};await env.draw(state);
 const stepMs=duration(state,'e');await env.tick(stepMs+220);assert.equal(env.motion.positions.e.x,4);
 nearly(env.motion.positions.e.elapsedMs,stepMs);
 state={...state,units:state.units.map(u=>u.id==='e'?{...u,x:5}:u)};await env.draw(state);await env.tick(stepMs/2);
 nearly(env.motion.positions.e.x,4.5);nearly(env.motion.positions.e.elapsedMs,stepMs*1.5);
});


for(const [movementMode,requested]of [['walk',240],['run',150],['crouch',320],['prone',420]])test(`player ${movementMode} retains its gait through delayed cell preparation`,async t=>{
 const env=await mount(t);let state={...field(),presentationVisibleIds:['p','e']};
 state={...state,units:state.units.map(u=>u.id==='p'?{...u,y:2,movementMode,stance:movementMode==='prone'?'prone':movementMode==='crouch'?'crouched':'standing'}:u)};await env.draw(state);
 const stepMs=duration(state,'p',requested);
 for(let step=1;step<=4;step++){
  state={...state,presentationMovingUnitId:'p',units:state.units.map(u=>u.id==='p'?{...u,x:1+step}:u)};await env.draw(state);
  nearly(env.motion.positions.p.elapsedMs,(step-1)*stepMs);
  await env.tick(stepMs/2);nearly(env.motion.positions.p.x,step+.5);nearly(env.motion.positions.p.elapsedMs,(step-.5)*stepMs);
  // An unrelated React snapshot must leave the active clock intact.
  state={...state};await env.draw(state);await env.tick(stepMs/2);
  assert.equal(env.motion.positions.p.x,step+1);nearly(env.motion.positions.p.elapsedMs,step*stepMs);
  assert.equal(env.motion.positions.p.settled,true);assert.equal(env.pending,0);await env.tick(450);
 }
 await env.draw({...state,presentationMovingUnitId:null});assert.equal(env.motion.positions.p.moving,false);
});
