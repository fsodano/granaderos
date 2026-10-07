import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,LoopOnce} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
async function actorFixture(appearance){
 const asset=await publishedActor(appearance,0);
 const actor=new ActorRuntime(asset,{key:'unit:review',id:'review',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'prone',mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],garments:{},selected:false,bodyHeights:{}}),meshes=[],bones=[];
 actor.model.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);if(node.isBone&&node.name!=='Root')bones.push({node,length:node.position.length()});});
 const surfaces={l:{arm:[],hand:[]},r:{arm:[],hand:[]}};
 for(const mesh of meshes){const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<p.count;i++)for(const side of['l','r']){let arm=0,hand=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[indices.getComponent(i,j)].name,weight=weights.getComponent(i,j);if(!name.endsWith('_'+side))continue;if(/^(upperarm_|lowerarm_)/.test(name))arm+=weight;if(/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(name))hand+=weight;}if(arm>.7)surfaces[side].arm.push({mesh,index:i});if(hand>.7)surfaces[side].hand.push({mesh,index:i});}}
 let action,animation;
 function select(name){actor.mixer.stopAllAction();animation=asset.animation.animations.find(clip=>clip.name===name);assert.ok(animation,name);action=actor.mixer.clipAction(animation).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;return animation;}
 function pose(f){action.paused=false;action.enabled=true;actor.mixer.setTime(animation.duration*f);actor.root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();for(const{node,length}of bones)assert.ok(Math.abs(node.position.length()-length)<.000001,`${node.name} retains its native dimensions`);}
 function point(p){return p.mesh.getVertexPosition(p.index,new Vector3()).applyMatrix4(p.mesh.matrixWorld);}
 function lowest(list){let height=Infinity,anchor;for(const p of list){const value=point(p).y;if(value<height){height=value;anchor=p;}}return{height,anchor};}
 return{actor,asset,surfaces,select,pose,point,lowest};
}
for(const appearance of['granadero','woman-scout']){
 test(`${appearance} published palms and complete sleeves clear prone idle and crawl`,async()=>{
  const f=await actorFixture(appearance);try{for(const name of['prone.idle.unarmed','prone.crawl.unarmed']){f.select(name);const maxima={l:0,r:0};for(let i=0;i<=120;i++){f.pose(i/120);const arm=[];for(const side of['l','r']){const sleeve=f.lowest(f.surfaces[side].arm).height,palm=f.lowest(f.surfaces[side].hand).height;assert.ok(sleeve>=.0015,`${name} ${side}: complete sleeve clears floor (${sleeve})`);assert.ok(palm>=.0015,`${name} ${side}: complete palm and all fingers clear floor (${palm})`);arm.push(sleeve);maxima[side]=Math.max(maxima[side],palm);}assert.ok(Math.min(...arm)<.008,`${name}: one forearm supports the body at every phase`);}if(name.includes('.crawl.'))for(const side of['l','r'])assert.ok(maxima[side]>.035&&maxima[side]<.047,`${side}: recovery leaves the ground by four centimetres`);}}finally{f.actor.dispose();}
 });
 test(`${appearance} stored planted skin pulls set the unarmed pace and limit forward slip`,async()=>{
  const f=await actorFixture(appearance);try{const clip=f.select('prone.crawl.unarmed'),spec=f.asset.clips.find(c=>c.name===clip.name);assert.equal(spec.strideMeasurement.method,'native forearm planted pull displacement');assert.ok(spec.nativeStrideSpeed>.13&&spec.nativeStrideSpeed<.17,'Pace follows the complete planted pull, including its duration');const speeds=[];
   for(const[side,start,end]of[['r',0,.5],['l',.5,1]]){f.pose((start+end)/2);const anchor=f.lowest(f.surfaces[side].arm).anchor;f.pose(start);const a=f.point(anchor);f.pose(end);const b=f.point(anchor),duration=clip.duration*(end-start);speeds.push((a.z-b.z)/duration);assert.ok(Math.abs(a.z-b.z-spec.nativeStrideSpeed*duration)<.005,'Body advance matches actual planted skin displacement');let total=0,maximum=0;for(let i=1;i<40;i++){const phase=start+(end-start)*i/40;f.pose(phase);const current=f.lowest(f.surfaces[side].arm).anchor;f.pose(phase-.0005);const before=f.point(current);f.pose(phase+.0005);const after=f.point(current),slip=(after.z-before.z)/(.001*clip.duration)+spec.nativeStrideSpeed;total+=slip*slip;maximum=Math.max(maximum,Math.abs(slip));}assert.ok(Math.sqrt(total/39)<.015,'Lowest current sleeve contact does not carry a stationary arm forward');assert.ok(maximum<.025,'Forward slip stays below 2.5 cm/s during the planted pull');}
   assert.ok(Math.abs(speeds.reduce((a,b)=>a+b)/2-spec.nativeStrideSpeed)<.004,'Published skin displacement agrees with its source calibration');assert.ok(Math.abs(spec.strideDistance-spec.nativeStrideSpeed*clip.duration)<.000002);for(const track of clip.tracks.filter(track=>/^(upperarm|lowerarm|hand)_[lr]\.quaternion$/.test(track.name))){const a=Array.from(track.values.slice(0,4)),b=Array.from(track.values.slice(-4));assert.ok(a.every((n,i)=>Math.abs(n-b[i])<.000001),`${track.name} closes at the original stored cycle`);}
   const sample=sampleAnimationTime({clip:{...spec,duration:clip.duration},action:'crawl',motion:{moving:true,elapsedDistance:spec.nativeStrideSpeed*clip.duration*.25},now:0});assert.ok(Math.abs(sample.time-clip.duration*.25)<.000001,'Ordinary travelled distance chooses the matching native pull phase');
  }finally{f.actor.dispose();}
 });
}
