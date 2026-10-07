import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,LoopOnce} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const heldItem={unarmed:null,'long-gun':1800,'short-gun':1805,blade:1810,knife:1813,lance:1812};
async function fixture(appearance,equipment){
 const asset=await publishedActor(appearance,0),actor=new ActorRuntime(asset,{key:'unit:sideways',id:'sideways',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:['knife','lance'].includes(equipment)?'blade':equipment,items:heldItem[equipment]?[{id:String(heldItem[equipment]),reference:'primary',socket:'handRight'}]:[],garments:{},selected:false,bodyHeights:{}});
 const mesh=actor.model.getObjectByName('Human_footwear_LOD0'),position=mesh.geometry.attributes.position,boots={l:[],r:[]},native=[];
 for(let index=0;index<position.count;index++)boots[position.getX(index)>0?'l':'r'].push(index);
 for(const side of ['l','r'])assert.ok(boots[side].length>200,'The complete sole, toe, heel and fitted boot are checked');
 actor.model.traverse(node=>{if(node.isBone&&node.name!=='Root')native.push({node,position:node.position.clone(),scale:node.scale.clone()});});
 let action,clip;
 function select(name){actor.mixer.stopAllAction();clip=asset.animation.animations.find(c=>c.name===name);assert.ok(clip,name);action=actor.mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;return{clip,spec:asset.clips.find(c=>c.name===name)};}
 function pose(time){action.paused=false;action.enabled=true;actor.mixer.setTime(time);actor.root.updateMatrixWorld(true);mesh.skeleton.update();for(const shape of native){assert.ok(shape.node.position.distanceTo(shape.position)<.000001,shape.node.name+' keeps its native joint offset');assert.ok(shape.node.scale.distanceTo(shape.scale)<.000001,shape.node.name+' keeps its native scale');}}
 function point(index){return mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);}
 function lowest(side){let height=Infinity,index;for(const candidate of boots[side]){const y=point(candidate).y;if(y<height){height=y;index=candidate;}}return{height,index};}
 return{asset,actor,select,pose,point,lowest};
}
for(const appearance of ['granadero','woman-scout'])test(`${appearance} rifle side steps retain the reviewed palm contact and native wrist bend`,async()=>{
 const f=await fixture(appearance,'long-gun');try{
  const point=name=>f.actor.model.getObjectByName(name).getWorldPosition(new Vector3());
  const rest=Object.fromEntries(['l','r'].map(side=>[side,f.actor.model.getObjectByName(`hand_${side}`).quaternion.clone().invert()]));
  const grip=f.asset.clips.find(spec=>spec.name==='stand.walk.long-gun').reviewedPose.nativeGrip;
  const support=new Vector3(...grip.supportPosition);
  for(const direction of ['Left','Right']){
   const {clip}=f.select(`stand.strafe${direction}.long-gun`),count=Math.ceil(clip.duration*120);
   for(let i=0;i<=count;i++){
    f.pose(clip.duration*i/count);
    const palm=f.actor.model.getObjectByName('socket_handRight_rifle').worldToLocal(point('socket_handLeft_rifle'));
    assert.ok(palm.distanceTo(support)<.006,`${clip.name}: supporting palm stays within 6 mm of the fore-end`);
    for(const side of ['l','r']){
     const long=point(`middle_01_${side}`).sub(point(`hand_${side}`)).normalize(),forearm=point(`hand_${side}`).sub(point(`lowerarm_${side}`)).normalize();
     assert.ok(long.angleTo(forearm)<Math.PI/4,`${clip.name}: the rifle carry must not fold the ${side} wrist`);
     const delta=new Quaternion().multiplyQuaternions(rest[side],f.actor.model.getObjectByName(`hand_${side}`).quaternion);
     const degrees=2*Math.atan2(delta.y,delta.w)*180/Math.PI,twist=((degrees+180)%360+360)%360-180;
     assert.ok(Math.abs(twist)<12,`${clip.name}: pronation stays in the native forearm`);
    }
    const long=point('middle_01_r').sub(point('hand_r')).normalize(),normal=point('index_01_r').sub(point('pinky_01_r')).cross(long).normalize(),hinge=long.clone().cross(normal).normalize();
    for(const [a,b]of [['index_01_r','index_02_r'],['index_02_r','index_03_r']])assert.ok(Math.abs(point(b).sub(point(a)).normalize().dot(hinge))<Math.sin(Math.PI/12),`${clip.name}: the trigger finger flexes in its native plane`);
   }
  }
 }finally{f.actor.dispose();}
});
for(const appearance of ['granadero','woman-scout'])for(const equipment of ['unarmed','long-gun','short-gun','blade','knife','lance']){
 test(`${appearance} standing ${equipment} side steps support complete native boots through their retained loops`,async()=>{
  const f=await fixture(appearance,equipment);try{for(const direction of ['Left','Right']){
   const {clip,spec}=f.select(`stand.strafe${direction}.${equipment}`),support=spec.nativeSidewaysSupport;
   assert.equal(support.surface,'complete-native-boot');assert.equal(clip.duration,Math.fround((direction==='Left'?35:38)/30),'The original stored cycle is retained');assert.equal(spec.duration,direction==='Left'?1.183329:1.283328,'The older nominal manifest field is retained');
   const recovery={l:0,r:0};
   for(let i=0;i<=240;i++){f.pose(clip.duration*i/240);const heights=[];for(const side of ['l','r']){const {height}=f.lowest(side);assert.ok(height>.0005,`${clip.name} ${side} at ${i}/240: complete boot height ${height}`);recovery[side]=Math.max(recovery[side],height);heights.push(height);}assert.ok(Math.min(...heights)<.0035,`${clip.name}: a boot supports the retained torso at every phase`);}
   for(const side of ['l','r']){assert.ok(recovery[side]>.035&&recovery[side]<.105,'Each recovering boot follows a raised arc');assert.ok(support.heelRoll[side]>=0&&support.heelRoll[side]<.20,'Support uses a small anatomical forefoot roll');}
  }}finally{f.actor.dispose();}
 });
 test(`${appearance} ${equipment} normal lateral travel retains its pace and limits planted skin slip`,async()=>{
  const f=await fixture(appearance,equipment);try{for(const direction of ['Left','Right']){
   const {clip,spec}=f.select(`stand.strafe${direction}.${equipment}`),speed=spec.nativeStrideSpeed??spec.locomotionSpeed,sign=direction==='Left'?1:-1,action=`strafe${direction}`;
   const step=movementStepDuration({spriteAppearance:appearance,activeSlot:equipment==='unarmed'?'unarmed':'primary',weapon:heldItem[equipment]??1800,facing:2},{x:4,y:4},{x:4,y:4-sign},210,true),bodySpeed=TILE_METRES/(step/1000),rate=bodySpeed/speed;
   assert.equal(spec.nativeSidewaysSupport.retainedNativeStrideSpeed,speed);assert.ok(Math.abs(rate-.8)<.000000001,'Preserved facing retains the existing slower travel');
   const poseAt=wallTime=>{const distance=bodySpeed*wallTime,sample=sampleAnimationTime({clip:{...spec,duration:clip.duration},action,motion:{moving:true,elapsedDistance:distance,speed:bodySpeed,signedForwardSpeed:0},now:wallTime*1000});assert.equal(sample.rate,0);f.pose(sample.time);return sign*distance;};
   for(const side of ['l','r']){const [start,stop]=spec.nativeSidewaysSupport.supportWindows[side];let squared=0,maximum=0,count=0;
    for(let i=1;i<480;i++){const phase=i/240,local=((phase-start)%.5+.5)%.5;if(local<=.015||local>=stop-start-.015)continue;
     const wall=phase*clip.duration/rate,delta=.0005*clip.duration/rate;poseAt(wall);const anchor=f.lowest(side).index,beforeTravel=poseAt(wall-delta),before=f.point(anchor);before.x+=beforeTravel;const afterTravel=poseAt(wall+delta),after=f.point(anchor);after.x+=afterTravel;const slip=(after.x-before.x)/(2*delta);squared+=slip*slip;maximum=Math.max(maximum,Math.abs(slip));count++;
    }
    assert.ok(count>60,'Each planted interval has a complete skin contact sample');assert.ok(Math.sqrt(squared/count)<.012,`${clip.name} ${side}: world lateral contact RMS stays below 12 mm/s`);assert.ok(maximum<.09,`${clip.name} ${side}: interpolation and handover residual stay below 9 cm/s`);
   }
  }}finally{f.actor.dispose();}
 });
}
