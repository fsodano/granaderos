import{register}from'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import assert from'node:assert/strict';import test from'node:test';import{Vector3,LoopOnce}from'../web/node_modules/three/build/three.module.js';import{publishedActor}from'./published-actor-fixture.mjs';
const{ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const wanted=new Set([...['reprime','repair','unload'].map(action=>'prone.'+action+'.long-gun'),...[1800,1801,1802,1803,1804,1807].map(id=>'prone.unload.long-gun.'+id),...['aim','fire','reload','reprime','repair','unload'].map(action=>'prone.'+action+'.short-gun'),...[1805,1806,1808].map(id=>'prone.reload.short-gun.'+id),'prone.reload.short-gun.1808.barrel1']);
for(const appearance of['granadero','woman-scout'])for(const lod of[0,1,2])test(`${appearance} LOD${lod} remaining prone firearm work keeps full native boot support`,async t=>{
 const asset=await publishedActor(appearance,lod),visual={key:'unit:work',id:'work',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'prone',mounted:false,action:'idle',idleAction:'idle',equipment:'long-gun',items:[{id:'1800',reference:'primary',socket:'handRight'}],garments:{},selected:false,bodyHeights:{}},actor=new ActorRuntime(asset,visual),mesh=actor.model.getObjectByName(asset.appearance.parts.footwear.replace('{lod}',String(lod)));let count=0,minimum=Infinity,maximumContact=0,maximumSpeed=0;
 try{for(const clip of asset.animation.animations.filter(c=>wanted.has(c.name))){
  const spec=asset.clips.find(c=>c.name===clip.name);assert.equal(spec.nativeBootSupport.surface,'complete-native-boot');assert.equal(spec.nativeBootSupport.retainedInputTimes,true);assert.equal(spec.nativeBootSupport.retainedNativeBodyAndWeapon,true);
  actor.mixer.stopAllAction();const action=actor.mixer.clipAction(clip).setLoop(LoopOnce,1).play();action.clampWhenFinished=true;let prior;
  for(let frame=0;frame<=120;frame++){
   action.time=clip.duration*frame/120;actor.mixer.update(0);actor.root.updateMatrixWorld(true);mesh.skeleton.update();const points=[],feet={l:Infinity,r:Infinity};
   for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);points.push(p);const side=mesh.geometry.attributes.position.getX(i)>0?'l':'r';feet[side]=Math.min(feet[side],p.y);if(prior)maximumSpeed=Math.max(maximumSpeed,p.distanceTo(prior[i])/(clip.duration/120));}
   minimum=Math.min(minimum,feet.l,feet.r);maximumContact=Math.max(maximumContact,feet.l,feet.r);assert.ok(Math.min(feet.l,feet.r)>0,clip.name+' complete boot floor');assert.ok(Math.max(feet.l,feet.r)<.003,clip.name+' both native contacts');prior=points;
  }count++;
 }assert.equal(count,19);assert.ok(maximumSpeed<.0001,'Static native support must not slide or jump');t.diagnostic(JSON.stringify({count,minimum,maximumContact,maximumSpeed}));}finally{actor.dispose();}
});
