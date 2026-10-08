import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,LoopOnce} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {sampleAnimationTime}=await import('../web/lib/three/animation-clock.ts');
const {movementStepDuration}=await import('../web/lib/three/movement-timing.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const heldItem={unarmed:null,'long-gun':1800,'short-gun':1805,blade:1810,knife:1813,lance:1812};
async function fixture(appearance,equipment,lod){
 const asset=await publishedActor(appearance,lod),candidate=JSON.parse(readFileSync(new URL('../web/public/models/characters/manifest.json',import.meta.url))),gender=asset.appearance.gender,bytes=readFileSync(new URL('../web/public/models/characters/'+gender+'-animations.glb',import.meta.url)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);const data=Buffer.concat([header,padded,binary]);asset.animation=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.length),'');asset.clips=candidate.animationLibraries[gender].clips;
 const actor=new ActorRuntime(asset,{key:'unit:sideways',id:'sideways',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'crouched',mounted:false,action:'idle',idleAction:'idle',equipment:['knife','lance'].includes(equipment)?'blade':equipment,items:heldItem[equipment]?[{id:String(heldItem[equipment]),reference:'primary',socket:'handRight'}]:[],garments:{},selected:false,bodyHeights:{}});
 const mesh=actor.model.getObjectByName(`Human_footwear_LOD${lod}`),position=mesh.geometry.attributes.position,boots={l:[],r:[]},native=[];
 for(let index=0;index<position.count;index++)boots[position.getX(index)>0?'l':'r'].push(index);
 for(const side of ['l','r'])assert.ok(boots[side].length>20,'The complete sole, toe, heel and fitted boot are checked');
 actor.model.traverse(node=>{if(node.isBone&&node.name!=='Root')native.push({node,position:node.position.clone(),scale:node.scale.clone()});});
 let action,clip;
 function select(name){actor.mixer.stopAllAction();clip=asset.animation.animations.find(c=>c.name===name);assert.ok(clip,name);action=actor.mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();action.clampWhenFinished=true;return{clip,spec:asset.clips.find(c=>c.name===name)};}
 function pose(time){action.paused=false;action.enabled=true;actor.mixer.setTime(time);actor.root.updateMatrixWorld(true);mesh.skeleton.update();for(const shape of native){assert.ok(shape.node.position.distanceTo(shape.position)<.000001,shape.node.name+' keeps its native joint offset');assert.ok(shape.node.scale.distanceTo(shape.scale)<.000001,shape.node.name+' keeps its native scale');}}
 function point(index){return mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld);}
 function lowest(side){let height=Infinity,index;for(const candidate of boots[side]){const y=point(candidate).y;if(y<height){height=y;index=candidate;}}return{height,index};}
 return{asset,actor,select,pose,point,lowest};
}
for(const appearance of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const equipment of ['long-gun','short-gun','blade','knife','lance']){
 test(`${appearance} LOD${lod} crouched ${equipment} side steps support complete native boots through their retained loops`,async()=>{
  const f=await fixture(appearance,equipment,lod);try{for(const direction of ['Left','Right']){
   const {clip,spec}=f.select(`crouch.strafe${direction}.${equipment}`),support=spec.nativeSidewaysSupport;
   assert.equal(support.surface,'complete-native-boot');assert.equal(support.sampleRate,60);assert.equal(support.parentSampleRate,30);assert.equal(support.contactShiftSpace,'gltf-model-local');for(const shift of Object.values(support.contactShift)){assert.equal(shift[1],0,'The retained pelvis is never raised');assert.ok(Math.hypot(...shift)<=.080001,'Support adjusts within the authored horizontal reach bound');}assert.equal(clip.duration,Math.fround((direction==='Left'?48:41)/30),'The original stored cycle is retained');assert.equal(spec.duration,direction==='Left'?1.61666:1.399994,'The older nominal manifest field is retained');
   const recovery={l:0,r:0};
   for(let i=0;i<=240;i++){f.pose(clip.duration*i/240);const heights=[];for(const side of ['l','r']){const {height}=f.lowest(side);assert.ok(height>.0005,`${clip.name} ${side} at ${i}/240: complete boot height ${height}`);recovery[side]=Math.max(recovery[side],height);heights.push(height);}assert.ok(Math.min(...heights)<.0035,`${clip.name}: a boot supports the retained torso at every phase`);}
   for(const side of ['l','r']){assert.ok(recovery[side]>.035&&recovery[side]<.105,'Each recovering boot follows a raised arc');assert.ok(support.heelRoll[side]>=0&&support.heelRoll[side]<.20,'Support uses a small anatomical forefoot roll');}
  }}finally{f.actor.dispose();}
 });
 test(`${appearance} LOD${lod} ${equipment} normal lateral travel retains its pace and limits planted skin slip`,async()=>{
  const f=await fixture(appearance,equipment,lod);try{for(const direction of ['Left','Right']){
   const {clip,spec}=f.select(`crouch.strafe${direction}.${equipment}`),speed=spec.nativeStrideSpeed??spec.locomotionSpeed,sign=direction==='Left'?1:-1,action=`strafe${direction}`;
   const step=movementStepDuration({spriteAppearance:appearance,activeSlot:equipment==='unarmed'?'unarmed':'primary',weapon:heldItem[equipment]??1800,stance:'crouched',movementMode:'crouch',facing:2},{x:4,y:4},{x:4,y:4-sign},210,true),bodySpeed=TILE_METRES/(step/1000),rate=bodySpeed/speed;
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
