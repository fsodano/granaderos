import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle} from '../game/tactical.js';
const {useUnitMotion}=await import('../web/app/useUnitMotion.ts');

async function mountMotion(t){
 const dom=new JSDOM('<!doctype html><div id="root"></div>'),frames=new Map();
 let now=1000,requestId=0,motion;
 const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,
  performance:new Proxy(performance,{get(target,key){if(key==='now')return()=>now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),requestAnimationFrame:callback=>{frames.set(++requestId,callback);return requestId;},cancelAnimationFrame:id=>frames.delete(id)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 function Probe({battle,continuingIds}){motion=useUnitMotion(battle,undefined,undefined,continuingIds);return null;}
 const draw=(battle,continuingIds)=>act(async()=>root.render(h(Probe,{battle,continuingIds})));
 const frame=async milliseconds=>{const previous=motion.positions;now+=milliseconds;const current=[...frames.values()];frames.clear();await act(async()=>{for(const callback of current)callback(now);});return previous!==motion.positions;};
 return {draw,frame,advance:milliseconds=>{now+=milliseconds;},get now(){return now;},get motion(){return motion;},get pendingFrames(){return frames.size;}};
}

async function beginWalk(env,distance=20,movement='walk'){
 const width=distance+4,before=createBattle([{id:'walker',x:1,y:1}],{width,height:8,tiles:Array.from({length:width*8},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before);
 const after=actBattle(before,{type:'move',unitId:'walker',x:1+distance,y:1,movement});assert.equal(after.lastError,null);
 await env.draw(after);return {before,after,start:env.now};
}

test('route preparation cannot consume opening walk frames or restart an ongoing track',async t=>{
 const env=await mountMotion(t);
 const before=createBattle([{id:'walker',x:1,y:1}],{width:10,height:8,tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before);
 const after=actBattle(before,{type:'move',unitId:'walker',x:5,y:1}),route=after.units[0].lastMovePath;
 Object.defineProperty(after.units[0],'lastMovePath',{get(){env.advance(600);return route;}});
 await env.draw(after);
 assert.equal(env.motion.positions.walker.x,1);assert.equal(env.motion.positions.walker.elapsedMs,0);
 await env.frame(16);
 assert.ok(Math.abs(env.motion.positions.walker.x-(1+16/240))<1e-9,'first visible movement starts at the first route cell after preparation');
 assert.equal(env.motion.positions.walker.elapsedMs,16);
 await env.frame(104);assert.equal(env.motion.positions.walker.x,1.5);
 await env.draw({...after,log:[...after.log,'Otra actualización.']});
 assert.equal(env.motion.positions.walker.x,1.5,'unrelated state changes preserve an ongoing track');
 await env.frame(120);assert.equal(env.motion.positions.walker.x,2);assert.equal(env.motion.positions.walker.elapsedMs,240);
 await env.frame(720);assert.equal(env.motion.positions.walker.x,5);assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.pendingFrames,0);
});

for(const hz of [60,120])test(`${hz} Hz display publishes 60 accurate walking positions per second`,async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env),times=[];
 for(let frame=1;frame<=hz;frame++)if(await env.frame(1000/hz)){
  times.push(env.now);const position=env.motion.positions.walker,elapsed=env.now-start;
  assert.ok(Math.abs(position.x-(1+elapsed/240))<1e-9);assert.ok(Math.abs(position.elapsedMs-elapsed)<1e-9);
 }
 assert.equal(times.length,60);assert.equal(env.motion.positions.walker.moving,true);
 for(let index=1;index<times.length;index++)assert.ok(Math.abs(times[index]-times[index-1]-1000/60)<1e-8);
});

test('120 Hz timestamp jitter does not cause a third-frame delay or reduce running speed',async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env,20,'run'),times=[];
 for(let frame=1;frame<=120;frame++){
  const target=start+frame*1000/120+(frame%4===0?-.35:frame%4===2?.35:0);
  if(await env.frame(target-env.now)){
   times.push(env.now);assert.ok(Math.abs(env.motion.positions.walker.x-(1+(env.now-start)/150))<1e-9);
  }
 }
 assert.equal(times.length,60);
 for(let index=1;index<times.length;index++)assert.ok(times[index]-times[index-1]<18,'small clock jitter must not create 25 ms publication gaps');
});

test('a delayed frame publishes once without catch-up bursts and finishes on the first completed frame',async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env,4);
 assert.equal(await env.frame(137),true);assert.equal(env.motion.positions.walker.elapsedMs,137);
 assert.ok(Math.abs(env.motion.positions.walker.x-(1+137/240))<1e-9);
 assert.equal(env.pendingFrames,1);assert.equal(await env.frame(1000/120),false,'a late callback must not immediately publish another snapshot');
 assert.equal(await env.frame(1000/120),true);assert.equal(env.pendingFrames,1);
 await env.frame(start+950-env.now);assert.equal(env.motion.positions.walker.moving,true);
 assert.equal(await env.frame(10),true,'completion bypasses the ordinary publication deadline');
 assert.equal(env.motion.positions.walker.x,5);assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.motion.blocking,false);assert.equal(env.pendingFrames,0);
});

test('incremental movement keeps its gait between paid tiles and stops only when the queue ends',async t=>{
 const env=await mountMotion(t),continuing=new Set(['walker']);
 const width=8,before=createBattle([{id:'walker',x:1,y:1}],{width,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before,continuing);
 const first=actBattle(before,{type:'move',unitId:'walker',x:2,y:1});await env.draw(first,continuing);
 await env.frame(240);assert.equal(env.motion.positions.walker.x,2);assert.equal(env.motion.positions.walker.settled,true);
 assert.equal(env.motion.positions.walker.moving,true,'the sprite does not flash idle at a tile boundary');
 assert.equal(env.motion.positions.walker.elapsedMs,240);
 const second=actBattle(first,{type:'move',unitId:'walker',x:3,y:1});await env.draw(second,continuing);
 assert.equal(env.motion.positions.walker.settled,false);assert.equal(env.motion.positions.walker.elapsedMs,240,'the next step retains the gait phase');
 await env.frame(120);assert.equal(env.motion.positions.walker.x,2.5);assert.equal(env.motion.positions.walker.elapsedMs,360);
 await env.frame(120);assert.equal(env.motion.positions.walker.x,3);assert.equal(env.motion.positions.walker.moving,true);
 await env.draw(second,new Set());assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.motion.positions.walker.settled,true);assert.equal(env.pendingFrames,0);
});
