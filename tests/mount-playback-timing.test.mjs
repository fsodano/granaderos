import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,presentedActBattle,visibleRooms} from '../game/tactical.js';
import {battleFrameDuration} from '../game/battle-playback.js';
const {admittedMountTransitions,mountFrameDuration}=await import('../web/lib/three/mount-presentation.ts');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {presentActors,admittedActors}=await import('../web/lib/three/presentation.ts');
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
function fixture(mounted=false){
 return createBattle([{id:'rider',x:2,y:2,weapon:1812,horse:true,mounted,ridingSkill:90,mount:{id:'horse',condition:100,stamina:100}}],{width:8,height:8,tiles:Array.from({length:64},(_,index)=>({x:index%8,y:Math.floor(index/8),type:'grass',cover:0,blocked:false})),enemies:[],exploration:true});
}
for(const mounted of [false,true])test(`actual ${mounted?'dismount':'mount'} recording plays one full protected body path`,()=>{
 const state=fixture(mounted),before=structuredClone(state),recorded=presentedActBattle(state,{type:'mount',unitId:'rider'}),original=structuredClone(recorded.frames),frames=admittedMountTransitions(recorded.frames);
 assert.deepEqual(state,before);assert.deepEqual(recorded.frames,original);assert.equal(recorded.state.lastError,null);
 assert.equal(frames.length,2);assert.equal(frames[0].mountAction,mounted?'dismount':'mount');assert.equal(frames[1].mountComplete,true);
 assert.equal(presentedFrameDuration(frames[0],state),2300);assert.equal(presentedFrameDuration(frames[1],state),battleFrameDuration(frames[1]));
 const prepare={...frames[0],sequenceId:'one',actionId:1,startedAt:100,durationMs:2300},players=prepare.state.units.filter(unit=>unit.side==='player'),revealed=new Set(visibleRooms(prepare.state));
 const visual=presentActors(prepare.state,admittedActors(prepare.state,players,revealed),{},revealed,{frame:prepare})[0];
 assert.equal(visual.action,mounted?'dismount':'mount');assert.equal(visual.cue.fromPosture,mounted?'mounted':'standing');
 const sample=sampleAnimationTime({clip:{duration:2.3,loop:false},action:visual.action,cue:visual.cue,now:2400});
 assert.equal(sample.time,2.3);assert.equal(sample.complete,false,'The held preparation endpoint cannot jump back before the committed result');
 const result={...frames[1],sequenceId:'one',actionId:1,startedAt:2400,durationMs:260},resultEntries=admittedActors(result.state,result.state.units.filter(unit=>unit.side==='player'),revealed);
 const after=presentActors(result.state,resultEntries,{},revealed,{frame:result,cues:{'unit:rider':{id:'stale',action:visual.action,startedAt:2400}}})[0];
 assert.equal(after.action,'idle');assert.equal(after.cue,undefined);assert.equal(after.mounted,!mounted);
 assert.deepEqual([recorded.state.units[0].x,recorded.state.units[0].y],[2,2]);
});

test('admitted enemy mounting uses the same interval and cannot disclose hidden or cancelled motion',()=>{
 const before={id:'enemy',side:'enemy',hp:80,weapon:1800,spriteAppearance:'royalist',mounted:false},after={...before,mounted:true};
 const original=[{type:'prepare',action:'mount',unitId:'enemy',state:{units:[before]}},{type:'result',action:'mount',unitId:'enemy',state:{units:[after]}}];
 const frames=admittedMountTransitions(original);assert.equal(mountFrameDuration(frames[0],260),2300);assert.equal(frames[0].mountAction,'mount');assert.equal(frames[1].mountComplete,true);
 for(const change of [{unitId:null},{unitId:'hidden'},{state:{units:[]}},{state:{units:[{...before,hp:0}]}},{state:{units:[{...before,unconscious:true}]}}]){
  const hidden=admittedMountTransitions([{...original[0],...change},original[1]]);assert.equal(hidden[0].mountAction,undefined);assert.equal(hidden[1].mountComplete,undefined);assert.equal(mountFrameDuration(hidden[0],260),260);
 }
 for(const change of [{performed:false},{unitId:null},{state:{units:[before]}},{state:{units:[{...after,hp:0}]}},{state:{units:[{...after,knockedDown:true}]}}]){
  const cancelled=admittedMountTransitions([original[0],{...original[1],...change}]);assert.equal(cancelled[0].mountAction,undefined);assert.equal(cancelled[1].mountComplete,undefined);
 }
 assert.equal(mountFrameDuration(frames[0],5000),5000);
});

test('committed mounted-state observation cannot replay a completed recorded transition',async()=>{
 const [{JSDOM},React,{createRoot},{useActorCues}]=await Promise.all([import('../web/node_modules/jsdom/lib/api.js'),import('../web/node_modules/react/index.js'),import('../web/node_modules/react-dom/client.js'),import('../web/lib/three/useActorCues.ts')]);
 const dom=new JSDOM('<div id="root"></div>'),saved=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 const root=createRoot(dom.window.document.getElementById('root'));let hook;
 function Probe({entries,frame}){hook=useActorCues('mount-sector',entries,frame);return null;}
 const render=async(entries,frame)=>React.act(async()=>root.render(React.createElement(Probe,{entries,frame}))),actor={id:'rider',hp:80,mounted:false,stance:'standing'},entry=()=>({key:'unit:rider',kind:'unit',actor:{...actor}});
 try{
  await render([entry()]);actor.mounted=true;await render([entry()],{unitId:'rider',mountComplete:true});assert.deepEqual(hook.cues,{});
  await render([entry()]);assert.deepEqual(hook.cues,{},'Commit after the frame does not create a second clip');
  actor.mounted=false;await render([entry()],{unitId:'rider',mountComplete:true});await render([entry()]);assert.deepEqual(hook.cues,{});
  actor.mounted=true;await render([entry()]);assert.equal(hook.cues['unit:rider'].action,'mount','An independent observed transition still receives its native cue');
 }finally{
  await React.act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});
