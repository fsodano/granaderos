import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {presentActors}=await import('../web/lib/three/presentation.ts');
const {createBattle,presentedActBattle}=await import('../game/tactical.js');
const {presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
const {admittedReloadWork}=await import('../web/lib/three/action-timing.ts');
test('36 ordinary paid prone rifle reloads retain clear sleeves through entry, work and return',async t=>{const rows=[];
for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const weapon of [1800,1801,1802,1803,1804,1807]){
 const state=createBattle([{id:'worker',x:2,y:2,facing:2,weapon,activeSlot:'primary',weaponInstanceId:'owned-rifle',loaded:0,ammo:8,condition:90,energy:100,stance:'prone',movementMode:'prone',spriteAppearance:appearance,agility:90,dexterity:90,wisdom:90,experienceLevel:7}],{width:24,height:8,seed:45,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'far',x:22,y:6,weapon:0,patrol:false,overwatch:false}]});state.deploymentComplete=true;state.units[0].ap=100;const saved=JSON.stringify(state);
 const show=(s,f,now)=>presentActors(s,[{key:'unit:worker',kind:'unit',actor:s.units[0]}],{},new Set(),{selected:'worker',mode:'move',frame:f,now})[0],asset=await publishedActor(appearance,lod),actor=new ActorRuntime(asset,show(state,undefined,0)),meshes=[],surface=[];actor.model.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n);});
 for(const mesh of meshes){const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<mesh.geometry.attributes.position.count;i++){let arm=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[indices.getComponent(i,j)].name;if(/^(upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/.test(name))arm+=weights.getComponent(i,j);}if(arm>.7)surface.push({mesh,index:i});}}
 let minimum=Infinity,minimumAt,priorNow,seen=new Set();
 function sample(s,f,now){const visual=show(s,f,now);actor.update(visual,now);actor.tick(priorNow===undefined?0:Math.min(.1,(now-priorNow)/1000),now);priorNow=now;actor.root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();let low=Infinity;for(const {mesh,index}of surface)low=Math.min(low,mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y-visual.position[1]);if(low<minimum){minimum=low;minimumAt={now,clip:actor.action.getClip().name,phase:actor.action.time};}seen.add(actor.action.getClip().name);assert.deepEqual(actor.root.position.toArray(),visual.position);assert.equal(actor.root.rotation.y,visual.yaw);}
 for(let i=0;i<=80;i++)sample(state,undefined,i*1000/120);
 const out=presentedActBattle(state,{type:'reload',unitId:'worker'});if(out.state.lastError)throw Error(out.state.lastError);const frames=admittedReloadWork(out.frames),duration=frames.reduce((n,f)=>n+presentedFrameDuration(f,state),0);let start=700;
 for(const [index,f]of frames.entries()){const d=presentedFrameDuration(f,state),frame={...f,index,sequenceId:'rifle-arm-floor',actionId:1,startedAt:start,durationMs:d,actionStartedAt:700,actionDurationMs:duration};for(let now=start;now<start+d-1e-5;now+=1000/120)sample(f.state,frame,now);if(!d)sample(f.state,frame,start);start+=d;}
 for(let i=1;i<=60;i++)sample(out.state,undefined,start+i*1000/120);
 assert.equal(JSON.stringify(state),saved);assert.ok(out.state.units[0].loaded>0 || out.state.units[0].reloadProgress>0,'Paid order retains real complete or partial loading progress');assert.ok(out.state.units[0].ap<state.units[0].ap);assert.ok(seen.has('prone.reload.long-gun.'+weapon));rows.push({appearance,lod,weapon,duration,minimum,minimumAt});actor.dispose();
}
assert.equal(rows.length,36);for(const r of rows)assert.ok(r.minimum>=.0015,`${r.appearance} LOD${r.lod} ${r.weapon}: ${r.minimum} at ${JSON.stringify(r.minimumAt)}`);t.diagnostic(JSON.stringify({cases:rows.length,minimum:Math.min(...rows.map(r=>r.minimum))}));});
