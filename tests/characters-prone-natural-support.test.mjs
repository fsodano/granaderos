import assert from 'node:assert/strict';
import test from 'node:test';
import {AnimationMixer,LoopOnce,Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';

for(const appearance of ['granadero','woman-scout'])test(`${appearance} static prone work keeps extended legs and a narrow knee stance`,async()=>{
 const asset=await publishedActor(appearance,0),scene=asset.body.scene,mixer=new AnimationMixer(scene);
 const clips=asset.animation.animations.filter(clip=>/^prone\.(idle|aim|fire|reload|unload|repair|reprime|gesture)\./.test(clip.name));
 const point=name=>scene.getObjectByName(name).getWorldPosition(new Vector3());
 let tested=0;
 try{
  for(const clip of clips){
   const spec=asset.clips.find(row=>row.name===clip.name);
   if(spec.nativeBootSupport?.surface!=='complete-native-boot')continue;
   mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(LoopOnce,1).play();action.clampWhenFinished=true;
   for(const fraction of [0,.25,.5,.75,1]){
    action.time=clip.duration*fraction;mixer.update(0);scene.updateMatrixWorld(true);
    const knees=['l','r'].map(side=>point('calf_'+side));
    assert.ok(knees[0].distanceTo(knees[1])<.40,clip.name+' must not spread both knees into a frog pose');
    for(const side of ['l','r']){
     const knee=point('calf_'+side),hip=point('thigh_'+side),ankle=point('foot_'+side);
     const angle=hip.sub(knee).angleTo(ankle.sub(knee))*180/Math.PI;
     assert.ok(angle>145,clip.name+' keeps the resting knee mostly extended: '+angle);
    }
   }tested++;
  }
  assert.equal(tested,46,'All compatible static prone work is covered');
 }finally{mixer.stopAllAction();mixer.uncacheRoot(scene);}
});
