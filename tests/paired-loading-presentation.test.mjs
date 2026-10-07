import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {createPairedLoadingBattle} from '../web/app/renderer-sandbox/paired-loading-fixture.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {admittedReloadWork}=await import('../web/lib/three/action-timing.ts');
const {sampleAnimationTime:sample}=await import('../web/lib/three/animation-clock.ts');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalThreeScene}=await import('../web/app/TacticalThreeScene.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const actor=s=>s.units.find(unit=>unit.id==='loader'),nearly=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function field(appearance='granadero',patch={}){
 return createBattle([{id:'loader',name:'Tirador',x:2,y:2,weapon:1805,loaded:0,ammo:8,blade:0,weaponInstanceId:'owned-right',condition:81,offHand:{weapon:1806,loaded:0,condition:57,jammed:false,count:1,weight:1.2,instanceId:'owned-left'},spriteAppearance:appearance,...patch}],{width:24,height:8,seed:45,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',cover:0,blocked:false})),enemies:[{id:'reserve',x:22,y:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}]});
}
function recorded(state){
 const before=structuredClone(state),result=presentedActBattle(state,{type:'reload',unitId:'loader'}),frames=admittedReloadWork(result.frames),delays=frames.map(frame=>presentedFrameDuration(frame,state));
 assert.equal(result.state.lastError,null);assert.deepEqual(result.state,actBattle(before,{type:'reload',unitId:'loader'}));assert.deepEqual(state,before);return {result,frames,delays};
}
function visual(frame,start,duration){
 const unit=actor(frame.state);return presentActors(frame.state,[{kind:'unit',key:'unit:loader',actor:unit}],{},new Set(),{frame:{...frame,sequenceId:'owned-load',actionId:1,startedAt:start,durationMs:duration,actionStartedAt:0},now:start})[0];
}
function local(runtime,name){runtime.root.updateMatrixWorld(true);return runtime.root.worldToLocal(runtime.model.getObjectByName(name).getWorldPosition(new Vector3()));}
function pose(runtime,shown,now){runtime.update(shown,now);runtime.tick(.1,now);runtime.tick(.1,now);runtime.root.updateMatrixWorld(true);}
function held(runtime,reference,id){return runtime.model.getObjectByName(`${reference}:${id}`);}
for(const appearance of ['granadero','woman-scout'])test(`${appearance} actual paired loading uses each owned pistol and mirrors its native loading hand`,async()=>{
 const state=field(appearance),before=structuredClone(state),{frames,delays,result}=recorded(state),asset=await publishedActor(appearance),clip=asset.clips.find(clip=>clip.name==='stand.reload.short-gun');
 assert.deepEqual(frames[0].actionWork,[{from:0,to:1,hand:'primary'},{from:0,to:1,hand:'offhand'}]);nearly(delays.reduce((a,b)=>a+b,0),clip.duration*2000);
 const shown=visual(frames[1],delays[0],delays[1]),runtime=new ActorRuntime(asset,shown),right=held(runtime,'primary','1805'),left=held(runtime,'offhand','1806'),sockets=asset.appearance.sockets;
 pose(runtime,shown,1900);assert.equal(right.parent.name,sockets.handRight_pistol.node);assert.equal(left.parent.name,sockets.hipRight.node,'The other pistol frees the working hand');
 const rightPalm=local(runtime,'hand_r'),rightGrip=local(runtime,right.name),native=new Map();asset.body.scene.traverse(node=>{if(node.isBone&&node.name!=='Root')native.set(node.name,{position:node.position.clone(),scale:node.scale.clone()});});
 pose(runtime,shown,clip.duration*1000+1900);assert.equal(left.parent.name,sockets.handLeft_pistol.node);assert.equal(right.parent.name,sockets.hipRight.node,'The finished pistol frees the next working hand');
 const leftPalm=local(runtime,'hand_l'),leftGrip=local(runtime,left.name),reflected=point=>point.clone().setX(-point.x);
 assert.ok(leftPalm.distanceTo(reflected(rightPalm))<.01,'The left arm follows the native reflected loading pose');assert.ok(leftGrip.distanceTo(reflected(rightGrip))<.01,'The real offhand grip remains fitted to the mirrored native palm');
 const muzzle=left.getObjectByName(asset.manifest.equipment.items['1806'].muzzle).getWorldPosition(new Vector3());assert.ok(runtime.anchor('muzzle').distanceTo(muzzle)<1e-8,'The active muzzle belongs to the gun currently being loaded');
 // Packed float tracks can differ by sub-micrometre rounding after reflection.
 // Every native joint must retain its position and scale, not only the hands.
 for(const [name,rest]of native){const bone=runtime.model.getObjectByName(name);assert.ok(bone.position.distanceTo(rest.position)<.000001,`${name} retains its native joint position`);assert.ok(bone.scale.distanceTo(rest.scale)<.000001,`${name} retains its native scale`);}
 assert.ok(left.scale.x>0&&left.scale.y>0&&left.scale.z>0,'Equipment geometry retains positive scale');
 // Rerendering the same recorded frame cannot reset the selected loading hand.
 pose(runtime,shown,clip.duration*1000+2100);assert.equal(left.parent.name,sockets.handLeft_pistol.node);
 runtime.tick(.1,delays[0]+delays[1]+1);assert.equal(left.parent.name,sockets.handLeft_pistol.node);assert.equal(right.parent.name,sockets.handRight_pistol.node);assert.deepEqual(state,before);assert.equal(actor(result.state).ap,40);assert.equal(totalReserveAmmunition(actor(result.state)),6);runtime.dispose();
});
test('offhand-only partial work resumes the same left-hand pose and charges without replaying primary loading',async()=>{
 let state=field('granadero',{loaded:1});actor(state).ap=10;const first=recorded(state),work=first.frames[1].actionWork;
 assert.deepEqual(work,[{from:0,to:10/28,hand:'offhand'}]);assert.equal(actor(first.result.state).loaded,1);assert.equal(actor(first.result.state).offHand.loaded,0);assert.equal(totalReserveAmmunition(actor(first.result.state)),8);
 const asset=await publishedActor('granadero'),clip=asset.clips.find(clip=>clip.name==='stand.reload.short-gun'),firstCue=visual(first.frames[1],first.delays[0],first.delays[1]).cue;
 const interrupted=sample({clip,action:'reload',cue:firstCue,now:first.delays[0]+first.delays[1]});nearly(interrupted.time,clip.duration*10/28);assert.equal(interrupted.workIndex,0);
 state=first.result.state;actor(state).ap=18;const continuation=recorded(state),next=continuation.frames[1].actionWork;
 assert.deepEqual(next,[{from:10/28,to:1,hand:'offhand'}]);assert.equal(continuation.delays[0],0);
 const shown=visual(continuation.frames[1],0,continuation.delays[1]),resumed=sample({clip,action:'reload',cue:shown.cue,now:0});nearly(resumed.time,interrupted.time);
 const runtime=new ActorRuntime(asset,shown);pose(runtime,shown,0);assert.equal(held(runtime,'offhand','1806').parent.name,asset.appearance.sockets.handLeft_pistol.node);assert.equal(held(runtime,'primary','1805').parent.name,asset.appearance.sockets.hipRight.node);
 assert.equal(actor(continuation.result.state).ap,0);assert.equal(actor(continuation.result.state).offHand.loaded,1);assert.equal(totalReserveAmmunition(actor(continuation.result.state)),7);runtime.dispose();
});
test('two-barrel pistols retain two primary then two offhand body intervals',()=>{
 const state=field('granadero',{weapon:1808,offHand:{weapon:1808,loaded:0,count:1,weight:1.3,condition:100,instanceId:'owned-left'}});state.mode='exploration';state.units=state.units.filter(unit=>unit.side==='player');
 const {frames,delays,result}=recorded(state);assert.deepEqual(frames[1].actionWork,[{from:0,to:1,hand:'primary',barrel:0},{from:0,to:1,hand:'primary',barrel:1},{from:0,to:1,hand:'offhand',barrel:0},{from:0,to:1,hand:'offhand',barrel:1}]);nearly(delays.reduce((a,b)=>a+b,0),19200);assert.equal(actor(result.state).loaded,2);assert.equal(actor(result.state).offHand.loaded,2);
 const cue=visual(frames[1],delays[0],delays[1]).cue,clip={duration:4.8,loop:false,markers:{contact:2.16}};
 for(const [index,now]of [1000,5800,10600,15400].entries())assert.equal(sample({clip,action:'reload',cue,now}).workIndex,index);
});
test('a partial second-barrel charge resumes the same owned bore without reloading the first',()=>{
 let state=field('granadero',{weapon:1808,loaded:1,offHand:{weapon:1806,loaded:1,count:1,weight:1.2,condition:100,instanceId:'owned-left'}});actor(state).ap=10;
 const first=recorded(state);assert.deepEqual(first.frames[1].actionWork,[{from:0,to:4/11,hand:'primary',barrel:1}]);assert.equal(actor(first.result.state).loaded,1);assert.equal(actor(first.result.state).offHand.loaded,1);assert.equal(totalReserveAmmunition(actor(first.result.state)),8);
 state=first.result.state;actor(state).ap=17.5;const next=recorded(state);assert.deepEqual(next.frames[1].actionWork,[{from:4/11,to:1,hand:'primary',barrel:1}]);assert.equal(next.delays[0],0);assert.equal(actor(next.result.state).loaded,2);assert.equal(actor(next.result.state).offHand.loaded,1);assert.equal(actor(next.result.state).ap,0);assert.equal(totalReserveAmmunition(actor(next.result.state)),7);
});
test('hidden, replaced or pocketed guns cannot establish offhand loading evidence',()=>{
 const {result}=recorded(field());
 for(const phase of [0,1]){const frames=structuredClone(result.frames);frames[phase].unitId=null;assert.ok(admittedReloadWork(frames).every(frame=>frame.actionWork===undefined));}
 for(const change of [{weapon:1808},{instanceId:'replacement'}]){
  const frames=structuredClone(result.frames);Object.assign(actor(frames[1].state).offHand,change);assert.ok(admittedReloadWork(frames)[1].actionWork.every(work=>work.hand==='primary'));
 }
 const frames=structuredClone(result.frames);actor(frames[0].state).leftHandItem=null;assert.ok(admittedReloadWork(frames)[1].actionWork.every(work=>work.hand==='primary'));
});
test('mounted Battlefield completes one paired loading order and ignores input during both native charges',async t=>{
 let battle=field(),before=structuredClone(battle);const expected=recorded(battle),commits=[],mounted=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const panel=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn),scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalThreeScene);
 await mounted.act(async()=>panel().props.onOrder({type:'reload'}));
 for(const [index,frame]of expected.frames.entries()){
  assert.equal(panel().props.busy,true);assert.deepEqual(commits,[]);assert.deepEqual(scene().props.actors.find(actor=>actor.id==='loader').cue.work,frame.actionWork);
  await mounted.act(async()=>panel().props.onOrder({type:'reload'}));assert.equal(await mounted.nextDelay(),expected.delays[index]);
 }
 assert.deepEqual(commits,[expected.result.state]);assert.deepEqual(battle,actBattle(before,{type:'reload',unitId:'loader'}));
});
test('playable paired loading review starts with valid finite weapons and uses real reload orders',()=>{
 const state=createPairedLoadingBattle(),before=structuredClone(state);assert.doesNotThrow(()=>validateBattleSnapshot(state));
 for(const id of ['paired-loader','offhand-loader']){
  const unit=state.units.find(unit=>unit.id===id),result=presentedActBattle(state,{type:'reload',unitId:id}),frames=admittedReloadWork(result.frames),next=result.state.units.find(unit=>unit.id===id);
  assert.equal(result.state.lastError,null);assert.equal(unit.ap,100);assert.equal(next.loaded,1);assert.equal(next.offHand.loaded,1);assert.equal(totalReserveAmmunition(next),id==='paired-loader'?6:7);assert.ok(next.ap<unit.ap);
  assert.deepEqual(frames[0].actionWork.map(work=>work.hand),id==='paired-loader'?['primary','offhand']:['offhand']);assert.doesNotThrow(()=>validateBattleSnapshot(result.state));
 }
 assert.deepEqual(state,before);assert.deepEqual(createPairedLoadingBattle(),state,'Reset recreates the same review without free cartridges or persistent cue work');
});
