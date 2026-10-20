import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AnimationMixer,Quaternion,Vector3} from '../web/node_modules/three/build/three.module.js';
import {clone} from '../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {readableHumanClip}=await import('../web/lib/three/readable-human-stance.ts');
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const point=(model,name)=>model.getObjectByName(name).getWorldPosition(new Vector3());
const orientation=(model,name)=>model.getObjectByName(name).getWorldQuaternion(new Quaternion());
const assets=new Map();
async function assetFor(name){if(!assets.has(name))assets.set(name,await publishedActor(name,2));return assets.get(name);}
function pair(asset,name){
 const original=asset.animation.animations.find(clip=>clip.name===name);assert.ok(original,name);
 const hash=createHash('sha256').update(JSON.stringify(original.toJSON())).digest('hex');
 const adjusted=readableHumanClip(original,asset.body.scene,asset.manifest.bones,name);
 const make=clip=>{const model=clone(asset.body.scene),mixer=new AnimationMixer(model),action=mixer.clipAction(clip).play();action.timeScale=0;return {model,mixer,action};};
 const before=make(original),after=make(adjusted);
 return {original,adjusted,before,after,sample(fraction){for(const {model,mixer,action}of [before,after]){action.time=original.duration*fraction;mixer.update(0);model.updateMatrixWorld(true);model.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});}},dispose(){for(const {mixer,model}of [before,after]){mixer.stopAllAction();mixer.uncacheRoot(model);}assert.equal(createHash('sha256').update(JSON.stringify(original.toJSON())).digest('hex'),hash,'source animation bytes stay unchanged');}};
}
function bootFloor(model){const mesh=model.getObjectByName('Human_footwear_LOD2');let lowest=Infinity;for(let index=0;index<mesh.geometry.attributes.position.count;index++)lowest=Math.min(lowest,mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld).y);return lowest;}
for(const appearance of ['granadero','woman-scout'])test(`${appearance} idle and walking retain complete boot support while opening the stance`,async()=>{
 const asset=await assetFor(appearance);
 for(const action of ['idle','walk','run']){
  const f=pair(asset,`stand.${action}.unarmed`);assert.notEqual(f.adjusted,f.original);assert.equal(readableHumanClip(f.original,asset.body.scene,asset.manifest.bones,f.original.name),f.adjusted,'compiled pose is shared');
  try{for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){
   f.sample(phase);const before=f.before.model,after=f.after.model,shoulderWidth=Math.abs(point(after,'upperarm_l').x-point(after,'upperarm_r').x),footWidth=point(after,'foot_l').x-point(after,'foot_r').x;
   assert.ok(footWidth>=shoulderWidth*.91,`${action} ${phase}: feet ${footWidth}, shoulders ${shoulderWidth}`);
   assert.ok(Math.abs(bootFloor(after)-bootFloor(before))<.003,`${action} ${phase}: complete boot floor`);
   for(const side of ['l','r']){
    const oldFoot=point(before,'foot_'+side),foot=point(after,'foot_'+side);assert.ok(Math.abs(foot.y-oldFoot.y)<.0002);assert.ok(Math.abs(foot.z-oldFoot.z)<.0002);assert.ok(orientation(before,'foot_'+side).angleTo(orientation(after,'foot_'+side))<.001);
    for(const [a,b]of [['thigh','calf'],['calf','foot'],['upperarm','lowerarm'],['lowerarm','hand']])assert.ok(Math.abs(point(before,a+'_'+side).distanceTo(point(before,b+'_'+side))-point(after,a+'_'+side).distanceTo(point(after,b+'_'+side)))<.00001,'bone lengths do not stretch');
   }
  }}finally{f.dispose();}
 }
});

test('relaxed arms open without a T pose and held rifle hands retain their grip',async()=>{
 const asset=await assetFor('granadero');
 for(const equipment of ['unarmed','long-gun'])for(const action of ['idle','walk']){
  const f=pair(asset,`stand.${action}.${equipment}`);
  try{for(const phase of [0,.25,.5,.75]){
   f.sample(phase);const before=f.before.model,after=f.after.model,rootDelta=point(after,'Root').sub(point(before,'Root'));
   for(const [side,sign]of [['l',1],['r',-1]]){
    const hand=point(after,'hand_'+side),shoulder=point(after,'upperarm_'+side),elbow=point(after,'lowerarm_'+side);
    if(equipment==='unarmed'){assert.ok(sign*(hand.x-shoulder.x)>.075);assert.ok(shoulder.y-elbow.y>.18,'elbows remain relaxed below the shoulders');}
    else{assert.ok(hand.distanceTo(point(before,'hand_'+side).add(rootDelta))<.0002,'rifle hand position remains on its grip');assert.ok(orientation(before,'hand_'+side).angleTo(orientation(after,'hand_'+side))<.001,'rifle hand orientation stays fixed');}
   }
  }}finally{f.dispose();}
 }
});

test('mounted elbow clearance keeps native legs, saddle placement, and rein or weapon hands',async()=>{
 const asset=await assetFor('granadero');
 for(const equipment of ['unarmed','long-gun'])for(const action of ['idle','walk','run']){
  const f=pair(asset,`mounted.${action}.${equipment}`);
  try{for(const phase of [0,.25,.5,.75]){
   f.sample(phase);for(const name of ['Root','pelvis','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r','hand_l','hand_r']){
    assert.ok(point(f.before.model,name).distanceTo(point(f.after.model,name))<.0002,name+' position');
    assert.ok(orientation(f.before.model,name).angleTo(orientation(f.after.model,name))<.001,name+' orientation');
   }
   for(const track of f.original.tracks.filter(track=>/^(Root|pelvis|thigh_|calf_|foot_)/.test(track.name)))assert.ok(f.adjusted.tracks.includes(track),'mounted lower-body tracks are retained exactly');
  }}finally{f.dispose();}
 }
});

test('sideways loops keep their exact native footwork and backward playback shares the widened walk',async()=>{
 const asset=await assetFor('granadero');
 for(const direction of ['Left','Right'])for(const equipment of ['unarmed','long-gun']){
  const f=pair(asset,`stand.strafe${direction}.${equipment}`);try{for(const phase of [0,.125,.25,.5,.75]){
   f.sample(phase);for(const name of ['Root','pelvis','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']){
    assert.ok(point(f.before.model,name).distanceTo(point(f.after.model,name))<.0002,name+' position');
    assert.ok(orientation(f.before.model,name).angleTo(orientation(f.after.model,name))<.001,name+' orientation');
   }
   for(const track of f.original.tracks.filter(track=>/^(Root|pelvis|thigh_|calf_|foot_)/.test(track.name)))assert.ok(f.adjusted.tracks.includes(track));
  }}finally{f.dispose();}
 }
 const source=asset.animation.animations.find(clip=>clip.name==='stand.walk.unarmed');
 const forward=readableHumanClip(source,asset.body.scene,asset.manifest.bones,'stand.walk.unarmed'),backward=readableHumanClip(source,asset.body.scene,asset.manifest.bones,'stand.backwalk.unarmed');
 assert.deepEqual(backward.toJSON(),{...forward.toJSON(),uuid:backward.uuid});
});

test('paid work, aim, prone, crouched, and mount transitions keep their original clips',async()=>{
 const asset=await assetFor('granadero');let count=0;
 for(const source of asset.animation.animations.filter(clip=>! /^(stand|mounted)\.(idle|walk|run|backwalk|strafeLeft|strafeRight)\./.test(clip.name))){assert.equal(readableHumanClip(source,asset.body.scene,asset.manifest.bones,source.name),source,source.name);count++;}
 assert.ok(count>50,'cover the full retained action library');
});

test('runtime settles into the original paid aim and restores the cached wide idle without accumulating offsets',async()=>{
 const asset=await assetFor('granadero'),visual={key:'unit:stance',id:'stance',kind:'unit',appearance:'granadero',skin:'light',side:'player',position:[4,0,7],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'long-gun',items:[{id:'1800',reference:'primary',socket:'handRight'}],garments:{},selected:false,bodyHeights:{}};
 const actor=new ActorRuntime(asset,visual);actor.tick(0,0);const idle=actor.action.getClip();assert.notEqual(idle,asset.animation.animations.find(clip=>clip.name==='stand.idle.long-gun'));
 const snapshot=()=>{actor.root.updateMatrixWorld(true);return ['Root','foot_l','foot_r','hand_l','hand_r'].map(name=>[...point(actor.model,name).toArray(),...orientation(actor.model,name).toArray()]);};
 const held=snapshot();for(let i=0;i<5;i++){actor.tick(0,0);assert.deepEqual(snapshot(),held);}
 actor.update({...visual,action:'aim',idleAction:'aim'},100);for(let i=0;i<12;i++)actor.tick(1/60,100+i*1000/60);
 assert.equal(actor.action.getClip(),asset.animation.animations.find(clip=>clip.name==='stand.aim.long-gun'));
 actor.update(visual,400);for(let i=0;i<12;i++)actor.tick(1/60,400+i*1000/60);assert.equal(actor.action.getClip(),idle);assert.deepEqual(actor.root.position.toArray(),visual.position);actor.dispose();
});
