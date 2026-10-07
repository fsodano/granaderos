import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle} from '../game/tactical.js';
const {useUnitMotion}=await import('../web/app/useUnitMotion.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
const {readFileSync}=await import('node:fs');
const manifest=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url),'utf8'));
const walkStep=movementStepDuration({weapon:1800},{x:1,y:1},{x:2,y:1}),runStep=movementStepDuration({weapon:1800,movementMode:'run'},{x:1,y:1},{x:2,y:1});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

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
 assert.ok(Math.abs(env.motion.positions.walker.x-(1+16/walkStep))<1e-9,'first visible movement starts at the first route cell after preparation');
 assert.equal(env.motion.positions.walker.elapsedMs,16);
 await env.frame(walkStep/2-16);close(env.motion.positions.walker.x,1.5);
 await env.draw({...after,log:[...after.log,'Otra actualización.']});
 close(env.motion.positions.walker.x,1.5);
 await env.frame(walkStep/2);assert.equal(env.motion.positions.walker.x,2);close(env.motion.positions.walker.elapsedMs,walkStep);
 await env.frame(walkStep*3);assert.equal(env.motion.positions.walker.x,5);assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.pendingFrames,0);
});

for(const hz of [60,120])test(`${hz} Hz display publishes 60 accurate walking positions per second`,async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env),times=[];
 for(let frame=1;frame<=hz;frame++)if(await env.frame(1000/hz)){
  times.push(env.now);const position=env.motion.positions.walker,elapsed=env.now-start;
  assert.ok(Math.abs(position.x-(1+elapsed/walkStep))<1e-9);assert.ok(Math.abs(position.elapsedMs-elapsed)<1e-9);
 }
 assert.equal(times.length,60);assert.equal(env.motion.positions.walker.moving,true);
 for(let index=1;index<times.length;index++)assert.ok(Math.abs(times[index]-times[index-1]-1000/60)<1e-8);
});

test('120 Hz timestamp jitter does not cause a third-frame delay or reduce running speed',async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env,20,'run'),times=[];
 for(let frame=1;frame<=120;frame++){
  const target=start+frame*1000/120+(frame%4===0?-.35:frame%4===2?.35:0);
  if(await env.frame(target-env.now)){
   times.push(env.now);assert.ok(Math.abs(env.motion.positions.walker.x-(1+(env.now-start)/runStep))<1e-9);
  }
 }
 assert.equal(times.length,60);
 for(let index=1;index<times.length;index++)assert.ok(times[index]-times[index-1]<18,'small clock jitter must not create 25 ms publication gaps');
});

test('a delayed frame publishes once without catch-up bursts and finishes on the first completed frame',async t=>{
 const env=await mountMotion(t),{start}=await beginWalk(env,4);
 assert.equal(await env.frame(137),true);assert.equal(env.motion.positions.walker.elapsedMs,137);
 assert.ok(Math.abs(env.motion.positions.walker.x-(1+137/walkStep))<1e-9);
 assert.equal(env.pendingFrames,1);assert.equal(await env.frame(1000/120),false,'a late callback must not immediately publish another snapshot');
 assert.equal(await env.frame(1000/120),true);assert.equal(env.pendingFrames,1);
 await env.frame(start+walkStep*4-10-env.now);assert.equal(env.motion.positions.walker.moving,true);
 assert.equal(await env.frame(10),true,'completion bypasses the ordinary publication deadline');
 assert.equal(env.motion.positions.walker.x,5);assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.motion.blocking,false);assert.equal(env.pendingFrames,0);
});

test('incremental movement keeps its gait between paid tiles and stops only when the queue ends',async t=>{
 const env=await mountMotion(t),continuing=new Set(['walker']);
 const width=8,before=createBattle([{id:'walker',x:1,y:1}],{width,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before,continuing);
 const first=actBattle(before,{type:'move',unitId:'walker',x:2,y:1});await env.draw(first,continuing);
 await env.frame(walkStep);assert.equal(env.motion.positions.walker.x,2);assert.equal(env.motion.positions.walker.settled,true);
 assert.equal(env.motion.positions.walker.moving,true,'the sprite does not flash idle at a tile boundary');
 close(env.motion.positions.walker.elapsedMs,walkStep);
 const second=actBattle(first,{type:'move',unitId:'walker',x:3,y:1});await env.draw(second,continuing);
 assert.equal(env.motion.positions.walker.settled,false);close(env.motion.positions.walker.elapsedMs,walkStep);
 await env.frame(walkStep/2);close(env.motion.positions.walker.x,2.5);close(env.motion.positions.walker.elapsedMs,walkStep*1.5);
 await env.frame(walkStep/2);assert.equal(env.motion.positions.walker.x,3);assert.equal(env.motion.positions.walker.moving,true);
 await env.draw(second,new Set());assert.equal(env.motion.positions.walker.moving,false);assert.equal(env.motion.positions.walker.settled,true);assert.equal(env.pendingFrames,0);
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} crawl travels at its measured body pace and retains the paid state`,async t=>{
 const env=await mountMotion(t),before=createBattle([{id:'crawler',x:1,y:1,stance:'prone',movementMode:'prone',spriteAppearance:appearance}],{width:8,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before);const after=actBattle(before,{type:'move',unitId:'crawler',x:2,y:1,movement:'prone'}),paid=structuredClone(after);
 assert.equal(after.lastError,null);await env.draw(after);
 const clip=manifest.animationLibraries[manifest.appearances[appearance].animationLibrary].clips.find(clip=>clip.name==='prone.crawl.unarmed');
 const duration=movementStepDuration(after.units[0],before.units[0],after.units[0]);
 assert.ok(duration>4000,'One cell cannot run nearly eight crawl cycles in 420 ms');
 await env.frame(500);const position=env.motion.positions.crawler;
 assert.ok(Math.abs(position.x-(1+.5*clip.nativeStrideSpeed/TILE_METRES))<1e-8);
 const gait=sampleAnimationTime({clip,action:'crawl',now:env.now,motion:{moving:true,elapsedDistance:position.elapsedDistance*TILE_METRES,speed:position.speed*TILE_METRES}});
 assert.ok(Math.abs(gait.time-.5)<1e-8,'One second of natural travel advances one second of the authored gait');
 assert.equal(env.motion.blocking,true);
 await env.frame(duration-500);assert.equal(env.motion.positions.crawler.x,2);assert.equal(env.motion.positions.crawler.moving,false);assert.equal(env.motion.blocking,false);
 assert.deepEqual(after,paid,'Visual travel cannot alter paid AP, positions or simulation state');
});

test('diagonal crawl uses distance while a recorded short delay cannot accelerate it',()=>{
 const actor={stance:'prone',movementMode:'prone',spriteAppearance:'granadero'},from={x:1,y:1};
 const cardinal=movementStepDuration(actor,from,{x:2,y:1},210),diagonal=movementStepDuration(actor,from,{x:2,y:2},210);
 assert.ok(Math.abs(diagonal/cardinal-Math.SQRT2)<1e-9);
 assert.equal(movementStepDuration(actor,from,{x:2,y:1},cardinal),cardinal,'The playback duration and position interpolation use the same clock');
 assert.equal(movementStepDuration(actor,from,{x:2,y:1},undefined,true),cardinal*1.25,'Preserved facing keeps its slower travel');
 assert.ok(movementStepDuration({...actor,mounted:true},from,{x:2,y:1},210)>1000,'Mounted movement uses the horse stride');
 assert.equal(movementStepDuration(actor,from,{x:2,y:1,kind:'climb'},210),210,'A climb uses its recorded link fraction');
});

for(const [gender,appearance]of [['male','granadero'],['female','woman-scout']])test(`${gender} movement uses the matching equipment gait and accepted pace`,()=>{
 const from={x:1,y:1},forward={x:2,y:1},left={x:1,y:0},right={x:1,y:2};
 const cases=[
  [{activeSlot:'unarmed'},forward,'stand.walk.unarmed',false],
  [{weapon:1800},forward,'stand.walk.long-gun',false],
  [{weapon:1805},forward,'stand.walk.short-gun',false],
  [{weapon:1813},forward,'stand.walk.knife',false],
  [{weapon:1812},forward,'stand.walk.lance',false],
  [{weapon:1800,movementMode:'run'},forward,'stand.run.long-gun',false],
  [{weapon:1813,movementMode:'run'},forward,'stand.run.knife',false],
  [{weapon:1800,stance:'crouched',movementMode:'crouch'},forward,'crouch.walk.long-gun',false],
  [{weapon:1800},left,'stand.strafeLeft.long-gun',true],
  [{weapon:1800},right,'stand.strafeRight.long-gun',true],
  [{weapon:1805,stance:'crouched',movementMode:'crouch'},left,'crouch.strafeLeft.short-gun',true],
 ];
 for(const [changes,to,name,preserve]of cases){
  const actor={spriteAppearance:appearance,facing:2,...changes},clip=manifest.animationLibraries[gender].clips.find(clip=>clip.name===name);
  const expected=TILE_METRES/((clip.nativeStrideSpeed??clip.locomotionSpeed)*(clip.playbackRate??1))*1000*(preserve?1.25:1);
  close(movementStepDuration(actor,from,to,210,preserve),expected);
  assert.equal(movementStepDuration(actor,from,to,10000,preserve),10000*(preserve?1.25:1),'A longer supplied presentation delay remains authoritative');
 }
});

test('mounted walk and run use the horse hoof stride instead of the rider leg clip',()=>{
 for(const action of ['walk','run']){
  const clip=manifest.horse.clips.find(clip=>clip.name===manifest.horse.actions[action]);
  const duration=movementStepDuration({mounted:true,movementMode:action,weapon:1812},{x:1,y:1},{x:2,y:1},210);
  close(duration,TILE_METRES/clip.locomotionSpeed*1000);assert.ok(duration>400);
 }
});

test('cardinal and diagonal walking segments keep one physical speed and finish in path order',async t=>{
 const env=await mountMotion(t),before=createBattle([{id:'walker',x:1,y:1}],{width:8,height:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 await env.draw(before);const after=actBattle(before,{type:'move',unitId:'walker',x:3,y:2});assert.equal(after.lastError,null);
 after.units[0].lastMovePath=[{x:2,y:1},{x:3,y:2}];await env.draw(after);
 await env.frame(walkStep);assert.equal(env.motion.positions.walker.x,2);assert.equal(env.motion.positions.walker.y,1);
 await env.frame(walkStep*Math.SQRT2/2);close(env.motion.positions.walker.x,2.5);close(env.motion.positions.walker.y,1.5);
 close(env.motion.positions.walker.speed,1000/walkStep);close(env.motion.positions.walker.elapsedDistance,1+Math.SQRT2/2);
 await env.frame(walkStep*Math.SQRT2/2);assert.equal(env.motion.positions.walker.x,3);assert.equal(env.motion.positions.walker.y,2);assert.equal(env.motion.positions.walker.moving,false);
});
