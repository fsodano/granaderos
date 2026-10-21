import {AnimationClip,AnimationMixer,LoopOnce,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';
import {mirroredClip,type AnimationMirroring} from './clip-mirroring';

type Arm={upper:Object3D;elbow:Object3D;hand:Object3D};
type Grip={position:Vector3;rotation:Quaternion;pole:Vector3};
const cache=new WeakMap<Object3D,WeakMap<AnimationClip,Map<string,AnimationClip>>>();
const point=(node:Object3D)=>node.getWorldPosition(new Vector3());
const rotation=(node:Object3D)=>node.getWorldQuaternion(new Quaternion());
function skeletonCopy(node:Object3D):Object3D{
 const hasBone=(part:Object3D):boolean=>Boolean((part as any).isBone)||part.children.some(hasBone);
 const copy=node.clone(false);for(const child of node.children)if(hasBone(child))copy.add(skeletonCopy(child));return copy;
}
function turn(node:Object3D,from:Vector3,to:Vector3){
 const world=new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(rotation(node));
 node.quaternion.copy(rotation(node.parent!).invert().multiply(world));node.updateWorldMatrix(false,true);
}
function fitArm(arm:Arm,grip:Grip){
 const start=point(arm.upper),middle=point(arm.elbow),end=point(arm.hand),target=grip.position.clone(),pole=grip.pole.clone();
 const a=start.distanceTo(middle),b=middle.distanceTo(end),direction=target.clone().sub(start),distance=direction.length();
 if(distance>=a+b-1e-7||distance<=Math.abs(a-b)+1e-7)return false;
 direction.normalize();pole.sub(start);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-10)return false;
 const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
 const elbow=start.clone().addScaledVector(direction,along).addScaledVector(pole.normalize(),rise);
 turn(arm.upper,middle.sub(start),elbow.sub(start));turn(arm.elbow,point(arm.hand).sub(point(arm.elbow)),target.sub(point(arm.elbow)));
 arm.hand.quaternion.copy(rotation(arm.hand.parent!).invert().multiply(grip.rotation));arm.hand.updateWorldMatrix(false,true);return true;
}

/** Standing rest uses the native neutral upper body and the authored carry
 * grips. Both rifle hands move as one rigid grip pair. Admitted noncombat
 * blades rest outside the leg with their native finger and socket bindings.
 * Noncombat rest can use neutral feet. Paid actions, locomotion, mounted
 * poses and source assets stay unchanged. */
export function relaxedStandingIdle(source:AnimationClip,body:Object3D,bones:Record<string,string>,semantic:string,neutral:AnimationClip,carry:AnimationClip,offhandPistol=false,mirroring?:AnimationMirroring,bladeSocket?:string,offhandBladeSocket?:string,neutralLegs=false){
 const blade=semantic==='stand.idle.blade'||semantic==='stand.idle.knife';
 if(semantic!=='stand.idle.long-gun'&&semantic!=='stand.idle.short-gun'&&!blade)return source;
 const key=`${semantic}:${neutral.uuid}:${carry.uuid}:${offhandPistol}:${bladeSocket??''}:${offhandBladeSocket??''}:${neutralLegs}`;
 let clips=cache.get(body);if(!clips){clips=new WeakMap();cache.set(body,clips);}let variants=clips.get(source);if(!variants){variants=new Map();clips.set(source,variants);}const cached=variants.get(key);if(cached)return cached;
 const model=skeletonCopy(body),donor=skeletonCopy(body),chest=model.getObjectByName(bones.chest),donorChest=donor.getObjectByName(bones.chest),hips=model.getObjectByName(bones.hips);
 const arm=(root:Object3D,role:string):Arm|undefined=>{const hand=root.getObjectByName(bones[role]),elbow=hand?.parent,upper=elbow?.parent;return [hand,elbow,upper].every(node=>(node as any)?.isBone)?{hand:hand!,elbow:elbow!,upper:upper!}:undefined;};
 const right=arm(model,'handRight'),left=arm(model,'handLeft'),donorRight=arm(donor,'handRight'),donorLeft=arm(donor,'handLeft');
 if(!chest||!donorChest||!hips||!right||!left||!donorRight||!donorLeft||offhandPistol&&!mirroring){variants.set(key,source);return source;}
 const gripRotation=(role:string,name?:string)=>{const hand=body.getObjectByName(bones[role]),socket=name?body.getObjectByName(name):undefined;return hand&&socket?rotation(hand).invert().multiply(rotation(socket)):undefined;};
 const rightSocket=blade?gripRotation('handRight',bladeSocket):undefined,leftSocket=blade&&offhandBladeSocket?gripRotation('handLeft',offhandBladeSocket):undefined;
 if(blade&&(!rightSocket||offhandBladeSocket&&!leftSocket||offhandPistol)){variants.set(key,source);return source;}
 const upperBody:Object3D[]=[];let ancestor:Object3D|undefined=chest;for(;ancestor&&ancestor!==hips;ancestor=ancestor.parent??undefined)upperBody.unshift(ancestor);
 if(ancestor!==hips||upperBody.some(node=>!(node as any).isBone)){variants.set(key,source);return source;}
 for(const role of ['neck','head']){const node=model.getObjectByName(bones[role]);if(!node){variants.set(key,source);return source;}upperBody.push(node);}
 const lowerBody:Object3D[]=[];
 if(blade||neutralLegs){
  const root=model.getObjectByName(bones.root),legs=['footLeft','footRight'].map(role=>model.getObjectByName(bones[role])?.parent?.parent);
  if(!root||legs.some(leg=>!leg||leg.parent!==hips)){variants.set(key,source);return source;}
  lowerBody.push(root,hips);for(const leg of legs)leg!.traverse(node=>{if((node as any).isBone)lowerBody.push(node);});
 }
 const offhandFingers:Object3D[]=[];if(semantic==='stand.idle.short-gun'&&offhandPistol)left.hand.traverse(node=>{if(node!==left.hand&&(node as any).isBone)offhandFingers.push(node);});
 // An empty left hand already has the reviewed native arm clearance. Only
 // replace that arm when a second blade needs its own lowered grip.
 const restingArms=blade&&!offhandBladeSocket?[right]:[right,left];
 const modified=[...new Set([...lowerBody,...upperBody,...restingArms.flatMap(arm=>[arm.upper.parent!,arm.upper,arm.elbow,arm.hand]),...offhandFingers])];
 if(modified.some(node=>!(node as any).isBone)){variants.set(key,source);return source;}
 const twins=modified.map(node=>donor.getObjectByName(node.name));if(twins.some(node=>!node)){variants.set(key,source);return source;}
 const rest=new Map<Object3D,{p:Vector3;q:Quaternion}>();for(const root of [model,donor])root.traverse(node=>rest.set(node,{p:node.position.clone(),q:node.quaternion.clone()}));
 const reset=(root:Object3D)=>root.traverse(node=>{const value=rest.get(node)!;node.position.copy(value.p);node.quaternion.copy(value.q);});
 const mixer=new AnimationMixer(model),donorMixer=new AnimationMixer(donor);
 const sample=(root:Object3D,mixer:AnimationMixer,clip:AnimationClip,time:number)=>{reset(root);mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();action.timeScale=0;action.time=time;mixer.update(0);root.updateMatrixWorld(true);};
 const grip=(arm:Arm):Grip=>({position:donorChest.worldToLocal(point(arm.hand)),rotation:rotation(donorChest).invert().multiply(rotation(arm.hand)),pole:donorChest.worldToLocal(point(arm.elbow))});
 sample(donor,donorMixer,carry,0);const rightGrip=grip(donorRight),leftGrip=grip(donorLeft),longGun=semantic==='stand.idle.long-gun';
 const offhandGrip=new Map<Object3D,Quaternion>();
 if(!longGun&&offhandPistol){
  sample(donor,donorMixer,mirroredClip(carry,body,mirroring!),0);Object.assign(leftGrip,grip(donorLeft));
  for(const node of offhandFingers)offhandGrip.set(node,donor.getObjectByName(node.name)!.quaternion.clone());
 }
 const count=Math.max(1,Math.ceil(source.duration*60)),times=[...new Set([...Array.from({length:count+1},(_,i)=>source.duration*i/count),...source.tracks.flatMap(track=>Array.from(track.times))].map(Math.fround))].sort((a,b)=>a-b);
 const values=new Map(modified.map(node=>[node,[] as number[]])),positions=new Map(lowerBody.map(node=>[node,[] as number[]]));let valid=true;
 for(const time of times){
  sample(model,mixer,source,time);sample(donor,donorMixer,neutral,time/source.duration*neutral.duration);
  for(let i=0;i<modified.length;i++){
   const node=modified[i];node.quaternion.copy(offhandGrip.get(node)??twins[i]!.quaternion);
   // Armed guards have staggered feet. Admitted noncombat rest replaces
   // the complete Root/hip/leg/toe pose, including translation channels.
   if(positions.has(node))node.position.copy(twins[i]!.position);
  }
  model.updateMatrixWorld(true);
  if(blade){
   for(const arm of restingArms){
    const start=point(arm.upper),middle=point(arm.elbow),target=point(arm.hand),pole=middle.clone(),side=Math.sign(start.x-point(hips).x)||(arm===right?-1:1);
    target.x=start.x+side*Math.max(side*(target.x-start.x),.06);target.z+=.035;
    // Leave a small elbow bend on both anatomies instead of extending the
    // neutral arm beyond its reach when the wrist moves outside the thigh.
    const reach=(start.distanceTo(middle)+middle.distanceTo(point(arm.hand)))*.96;
    target.sub(start).clampLength(0,reach).add(start);pole.x=start.x+side*Math.max(side*(pole.x-start.x),.10);
    const orientation=rotation(chest).multiply((arm===right?rightGrip:leftGrip).rotation),axis=new Vector3(0,1,0).applyQuaternion(orientation.clone().multiply(arm===right?rightSocket!:leftSocket!));
    // Native sabre and knife geometry runs along socket +Y. Keep its roll
    // from the carry grip and lower the point forward and away from the leg.
    orientation.premultiply(new Quaternion().setFromUnitVectors(axis,new Vector3(side*.20,-.68,.70).normalize()));
    if(!fitArm(arm,{position:target,rotation:orientation,pole})){valid=false;break;}
   }
   if(!valid)break;
  }else{
   const pivot=chest.localToWorld(rightGrip.position.clone()),pitch=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),longGun?.55:.60);
   const placed=(grip:Grip):Grip=>{
    const position=chest.localToWorld(grip.position.clone()),orientation=rotation(chest).multiply(grip.rotation),pole=chest.localToWorld(grip.pole.clone());
    // Use model +Y/+Z, not the chest bone's rolled local axes. One rigid
    // transform lowers the rifle pair and keeps the supporting palm fitted.
    if(longGun){position.sub(pivot).applyQuaternion(pitch).add(pivot);position.y-=.02;position.z-=.18;pole.y-=.02;pole.z-=.10;}
    orientation.premultiply(pitch);
    return {position,rotation:orientation,pole};
   };
   if(!fitArm(right,placed(rightGrip))||(longGun||offhandPistol)&&!fitArm(left,placed(leftGrip))){valid=false;break;}
  }
  for(const node of modified){const valuesForBone=values.get(node)!,q=node.quaternion,sign=valuesForBone.length&&valuesForBone.slice(-4).reduce((sum,value,index)=>sum+value*q.toArray()[index],0)<0?-1:1;valuesForBone.push(q.x*sign,q.y*sign,q.z*sign,q.w*sign);}
  for(const [node,row]of positions)row.push(...node.position.toArray());
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);donorMixer.stopAllAction();donorMixer.uncacheRoot(donor);
 if(!valid){variants.set(key,source);return source;}
 const replacements=new Map<string,QuaternionKeyframeTrack|VectorKeyframeTrack>(modified.map(node=>[node.name+'.quaternion',new QuaternionKeyframeTrack(node.name+'.quaternion',times,values.get(node)!)]));
 for(const [node,row]of positions)replacements.set(node.name+'.position',new VectorKeyframeTrack(node.name+'.position',times,row));
 const result=new AnimationClip(source.name,source.duration,[...source.tracks.filter(track=>!replacements.has(track.name)),...replacements.values()],source.blendMode);variants.set(key,result);return result;
}
