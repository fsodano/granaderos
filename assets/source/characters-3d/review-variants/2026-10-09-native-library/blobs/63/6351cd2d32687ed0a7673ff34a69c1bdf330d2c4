import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedActor} from './published-actor-fixture.mjs';
import {skinnedSurface} from './skinned-surface-contact-fixture.mjs';
import {AnimationMixer,LoopOnce,Vector3,Box3,Ray} from '../web/node_modules/three/build/three.module.js';
import {clone} from '../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';

function tree(faces){
 const box=new Box3().setFromPoints(faces.flat());
 if(faces.length<=8)return {box,faces};
 const size=box.getSize(new Vector3()),axis=size.x>size.y?(size.x>size.z?'x':'z'):(size.y>size.z?'y':'z');
 faces.sort((a,b)=>a.reduce((sum,p)=>sum+p[axis],0)-b.reduce((sum,p)=>sum+p[axis],0));
 const middle=Math.floor(faces.length/2);
 return {box,children:[tree(faces.slice(0,middle)),tree(faces.slice(middle))]};
}
const ray=new Ray(),delta=new Vector3(),point=new Vector3(),box=new Box3();
function edgeCrossing(a,b){
 for(let i=0;i<3;i++){
  delta.subVectors(a[(i+1)%3],a[i]);const length=delta.length();ray.set(a[i],delta.normalize());
  if(ray.intersectTriangle(...b,false,point)){
   const distance=point.distanceTo(a[i]);
   // A shared edge or tangent is contact, not a crossing through the skin.
   if(distance<length-1e-6&&distance>1e-6)return point.clone();
  }
 }
}
function crossing(face,node){
 if(!box.setFromPoints(face).intersectsBox(node.box))return;
 if(node.faces){for(const other of node.faces){const hit=edgeCrossing(face,other)||edgeCrossing(other,face);if(hit)return hit;}}
 else for(const child of node.children){const hit=crossing(face,child);if(hit)return hit;}
}
const fingerNames=['index','middle','ring','pinky','thumb'];
function handSurfaces(model,side){
 const surface=pattern=>skinnedSurface(model,(mesh,bone)=>bone===undefined?mesh.material.name==='Skin':pattern.test(bone));
 return {
  palm:surface(new RegExp(`^(hand|lowerarm)_${side}$`)),
  fingers:Object.fromEntries(fingerNames.map(finger=>[finger,{
   all:surface(new RegExp(`^${finger}_0[123]_${side}$`)),
   // The distal two segments are separate from the connected palm/web root.
   distal:surface(new RegExp(`^${finger}_0[23]_${side}$`)),
  }])),
 };
}
for(const preset of ['granadero','woman-scout'])for(const gesture of ['idle','walk','run']){
 test(`${preset}: standing unarmed ${gesture} keeps relaxed fingers outside the palm and other digits`,async()=>{
  const asset=await publishedActor(preset,0),model=clone(asset.body.scene),name=`stand.${gesture}.unarmed`;
  const clip=asset.animation.animations.find(value=>value.name===name);assert.ok(clip,name);
  const mixer=new AnimationMixer(model),action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
  const hands=Object.fromEntries(['l','r'].map(side=>[side,handSurfaces(model,side)])),samples=Math.ceil(clip.duration*120);
  for(let sample=0;sample<=samples;sample++){
   const time=clip.duration*sample/samples;mixer.setTime(time);model.updateMatrixWorld(true);model.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
   for(const [side,hand]of Object.entries(hands)){
    const palm=tree(hand.palm()),fingers=Object.fromEntries(Object.entries(hand.fingers).map(([name,value])=>[name,{all:tree(value.all()),distal:value.distal()}]));
    for(const [finger,data]of Object.entries(fingers)){
     const targets=[['palm',palm],...Object.entries(fingers).filter(([other])=>other!==finger).map(([other,value])=>[other,value.all])];
     for(const [other,target]of targets)for(const face of data.distal){
      const hit=crossing(face,target);
      assert.ok(!hit,`${name} ${side} ${finger} crosses ${other} at ${time.toFixed(6)}s: ${hit?.toArray()}`);
     }
    }
   }
  }
 });
}
