import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
import {capsuleSurfaceGap,headSurface} from './skinned-surface-contact-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const postures={stand:'standing',crouch:'crouched',prone:'prone',mounted:'mounted'};
const poses=[...new Set([0,.12,.24,.36,.46,.50,.58,.66,.70,.79,.83,.86,.90,1,...Array.from({length:18},(_,frame)=>frame/144),...Array.from({length:15},(_,frame)=>(130+frame)/144)])].sort((a,b)=>a-b);

test('surface distance measures triangle interiors, crossings, edges and parallel segments',()=>{
 const face=[[new Vector3(0,0,0),new Vector3(1,0,0),new Vector3(0,1,0)]];
 assert.equal(capsuleSurfaceGap(new Vector3(.2,.2,-1),new Vector3(.2,.2,1),.1,face),-.1);
 assert.ok(Math.abs(capsuleSurfaceGap(new Vector3(.1,.1,.3),new Vector3(.2,.2,.3),.1,face)-.2)<1e-10);
 assert.ok(Math.abs(capsuleSurfaceGap(new Vector3(-1,.1,.3),new Vector3(1,.1,.3),.1,face)-.2)<1e-10);
 assert.ok(Math.abs(capsuleSurfaceGap(new Vector3(1,1,0),new Vector3(2,2,0),0,face)-Math.sqrt(.5))<1e-10);
});

for(const appearance of ['granadero','woman-scout'])test(`${appearance} published pistol barrels clear actual deformed face triangles`,async context=>{
 const asset=await publishedActor(appearance,0);let minimum=Infinity;
 for(const [prefix,posture]of Object.entries(postures))for(const id of ['1805','1806','1808'])for(const hand of ['primary','offhand'])for(const barrel of id==='1808'?[0,1]:[0]){
  const visual={key:'unit:loader',id:'loader',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture,mounted:posture==='mounted',action:'reload',idleAction:'idle',equipment:'short-gun',items:[{id,reference:'primary',socket:'handRight'},{id,reference:'offhand',socket:'handLeft'}],garments:{},selected:false,bodyHeights:{},cue:{id:`${prefix}:${id}:${hand}:${barrel}`,action:'reload',startedAt:0,durationMs:4800,work:[{from:0,to:1,hand,barrel}]}},runtime=new ActorRuntime(asset,visual),surface=headSurface(runtime.model),spec=asset.clips.find(clip=>clip.name===`${prefix}.reload.short-gun.${id}${barrel?'.barrel1':''}`),stretch=spec.loadingContact.muzzle[0]/.275;
  // Use authored key poses plus every native 30 Hz sample during the gun's
  // approach and recovery. The held gun and head retain their pose between
  // .12 and .90; each physical bore is checked throughout both charge clips.
  for(const fraction of poses){
   const now=4800*fraction;runtime.update(visual,now);runtime.tick(.1,now);runtime.tick(.1,now);runtime.root.updateMatrixWorld(true);
   const gun=runtime.model.getObjectByName(`${hand}:${id}`),faces=surface();
   for(const nativeZ of id==='1808'?[-.011,.011]:[0]){
    const z=nativeZ*(hand==='offhand'?-1:1),start=gun.localToWorld(new Vector3(.025*stretch,.055,z)),end=gun.localToWorld(new Vector3(.27*stretch,.055,z)),gap=capsuleSurfaceGap(start,end,.015,faces);
    // The conservative capsule encloses the complete exported barrel with
    // its widest 15 mm radius. This is a surface gap, not a bone-pivot gap.
    minimum=Math.min(minimum,gap);assert.ok(gap>.02,`${appearance} ${prefix} ${id} ${hand} charge ${barrel}, bore ${nativeZ}, pose ${fraction}: actual face gap ${gap} m`);
   }
  }
  runtime.dispose();
 }
 context.diagnostic(`Minimum conservative barrel-to-face gap: ${(minimum*1000).toFixed(2)} mm over ${poses.length} native poses per charge/hand/posture.`);
});
