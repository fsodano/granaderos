import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {LoopOnce} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');

for(const appearance of ['granadero','woman-scout']){
 test(`${appearance} recovery turns the resting palms without a wrist or elbow flip`,async()=>{
  const source=await publishedActor(appearance,0);
  const visual={key:'unit:recovery',id:'recovery',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture:'standing',mounted:false,action:'idle',idleAction:'idle',equipment:'unarmed',items:[],garments:{},selected:false,bodyHeights:{}};
  const actor=new ActorRuntime(source,visual);
  try{
   const joints=['upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r'].map(name=>actor.model.getObjectByName(name));
   assert.ok(joints.every(Boolean),'The actual native arm and hand joints are present');
   for(const name of ['life.stand.recover','life.crouch.recover']){
    const clip=source.animation.animations.find(value=>value.name===name);
    assert.ok(clip,`The exported ${name} clip exists`);
    actor.mixer.stopAllAction();
    const action=actor.mixer.clipAction(clip).setLoop(LoopOnce,1);
    action.clampWhenFinished=true;action.play();
    const count=Math.ceil(clip.duration*120),dt=clip.duration/count;
    let previous;
    for(let frame=0;frame<=count;frame++){
     action.time=frame*dt;actor.mixer.update(0);actor.root.updateMatrixWorld(true);
     const current=joints.map(joint=>joint.quaternion.clone().normalize());
     if(previous)current.forEach((rotation,index)=>{
      const rate=rotation.angleTo(previous[index])*180/Math.PI/dt;
      // A slow supported rise has no strike phase. A 7.5-degree turn in
      // 1/120 s is already brisk; the old half-turn branch exceeded 20.
      assert.ok(rate<900,`${name} ${joints[index].name} at ${(frame*dt).toFixed(4)} s: recovery joint turns ${rate.toFixed(1)} degrees/s`);
     });
     previous=current;
    }
   }
  }finally{actor.dispose();}
 });
}
