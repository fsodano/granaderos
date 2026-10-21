import {AnimationClip,AnimationMixer,LoopOnce,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';

type Limb={upper:Object3D;joint:Object3D;end:Object3D;side:number};
const cache=new WeakMap<Object3D,WeakMap<AnimationClip,Map<string,AnimationClip>>>();
const world=(node:Object3D)=>node.getWorldPosition(new Vector3());
function skeletonCopy(node:Object3D):Object3D{
 const containsBone=(part:Object3D):boolean=>Boolean((part as any).isBone)||part.children.some(containsBone);
 const copy=node.clone(false);for(const child of node.children)if(containsBone(child))copy.add(skeletonCopy(child));return copy;
}
function turn(bone:Object3D,before:Vector3,after:Vector3){
 const rotation=new Quaternion().setFromUnitVectors(before.normalize(),after.normalize()).multiply(bone.getWorldQuaternion(new Quaternion()));
 bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);
}
function solve(limb:Limb,target:Vector3,pole:Vector3,orientation:Quaternion){
 const {upper,joint,end}=limb,start=world(upper),middle=world(joint),finish=world(end),a=start.distanceTo(middle),b=middle.distanceTo(finish);
 const direction=target.clone().sub(start),distance=direction.length();
 if(distance>=a+b-1e-7||distance<=Math.abs(a-b)+1e-7)return false;
 direction.normalize();pole.sub(start);pole.addScaledVector(direction,-pole.dot(direction));
 if(pole.lengthSq()<1e-10)return false;
 const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
 const bend=start.clone().addScaledVector(direction,along).addScaledVector(pole.normalize(),rise);
 turn(upper,middle.sub(start),bend.clone().sub(start));
 turn(joint,world(end).sub(world(joint)),target.clone().sub(world(joint)));
 end.quaternion.copy(end.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(orientation));end.updateWorldMatrix(false,true);return true;
}

/** Reuse native clocks and bone lengths. Baking the small pose changes into a
 * cached clip lets the existing crossfades and planted-foot forecasts see the
 * same poses as the visible body. Source clips, horse clips and work stay intact. */
export function readableHumanClip(source:AnimationClip,body:Object3D,bones:Record<string,string>,semantic:string){
 const [posture,action,equipment]=semantic.split('.');
 if(!['stand','mounted'].includes(posture)||!['idle','walk','run','backwalk','strafeLeft','strafeRight'].includes(action))return source;
 // The wide relaxed stance is a rest pose. Preserve native foot crossings,
 // knee planes and arm swing while walking or running.
 if(posture==='stand'&&action!=='idle')return source;
 let clips=cache.get(body);if(!clips){clips=new WeakMap();cache.set(body,clips);}
 let variants=clips.get(source);if(!variants){variants=new Map();clips.set(source,variants);}
 const cached=variants.get(semantic);if(cached)return cached;
 const model=skeletonCopy(body),root=model.getObjectByName(bones.root),hips=model.getObjectByName(bones.hips);
 const limb=(role:string,side:number):Limb|undefined=>{const end=model.getObjectByName(bones[role]),joint=end?.parent,upper=joint?.parent;return end&&(end as any).isBone&&(joint as any)?.isBone&&(upper as any)?.isBone?{upper:upper!,joint:joint!,end,side}:undefined;};
 const legs=[limb('footLeft',1),limb('footRight',-1)],arms=[limb('handLeft',1),limb('handRight',-1)];
 // Replacement rigs without the native two-joint chains retain their own pose.
 if(!root||!hips||legs.some(leg=>!leg||leg.upper.parent!==hips)||arms.some(arm=>!arm)){variants.set(semantic,source);return source;}
 // Keep the mounted seat exact while opening the elbows.
 const widenLegs=posture==='stand';
 const nativeLegs=legs as Limb[],nativeArms=arms as Limb[],modified=[...(widenLegs?nativeLegs:[]),...nativeArms].flatMap(limb=>[limb.upper,limb.joint,limb.end]);
 if(widenLegs&&nativeLegs.some(leg=>!leg.end.children.some(child=>(child as any).isBone))){variants.set(semantic,source);return source;}
 const samples=Math.max(1,Math.ceil(source.duration*60)),times=[...new Set([...Array.from({length:samples+1},(_,n)=>source.duration*n/samples),...source.tracks.flatMap(track=>Array.from(track.times))].map(Math.fround))].sort((a,b)=>a-b);
 const values=new Map(modified.map(node=>[node,[] as number[]])),positions:number[]=[];
 const native=new Map(modified.map(node=>[node,node.quaternion.clone()])),nativeRoot=root.position.clone();
 const mixer=new AnimationMixer(model),playing=mixer.clipAction(source).setLoop(LoopOnce,1);playing.clampWhenFinished=true;playing.play();
 for(const time of times){
  for(const [node,rotation]of native)node.quaternion.copy(rotation);root.position.copy(nativeRoot);
  playing.enabled=true;playing.paused=false;playing.time=time;playing.timeScale=0;mixer.update(0);model.updateMatrixWorld(true);
  for(const [node,rotation]of native)rotation.copy(node.quaternion);nativeRoot.copy(root.position);
  // Held guards retain enough forward reach for the native paid care/loot
  // transition; their foot spread is smaller than the relaxed unarmed pose.
  const centre=world(hips).x,shoulders=nativeArms.map(arm=>world(arm.upper)),halfWidth=Math.abs(shoulders[0].x-shoulders[1].x)*(equipment==='unarmed'?.48:.34);
  if(widenLegs){
   const goals=nativeLegs.map(leg=>{
    const target=world(leg.end),orientation=leg.end.getWorldQuaternion(new Quaternion());
    target.x=centre+leg.side*Math.max(halfWidth,leg.side*(target.x-centre));
    const toe=leg.end.children.find(child=>(child as any).isBone)!,forward=world(toe).sub(world(leg.end));
    // Native feet face +Z. A preserved inward yaw becomes conspicuous once
    // the ankles spread; turn only that yaw out, retaining pitch and roll.
    const heading=Math.atan2(forward.x,forward.z),outward=leg.side*Math.max(leg.side*heading,Math.PI/180),yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),outward-heading);
    orientation.premultiply(yaw);forward.applyQuaternion(yaw);forward.y=0;forward.normalize();
    // A knee target at an absolute X can sit inside the hip-to-ankle axis.
    // Place its bend direction in the same forward plane as the toe instead.
    const pole=world(leg.upper).add(forward);
    return {leg,target,orientation,pole};
   });
   let drop=0;for(const {leg,target}of goals){const start=world(leg.upper),middle=world(leg.joint),reach=(start.distanceTo(middle)+middle.distanceTo(world(leg.end)))*.9995,horizontal=(start.x-target.x)**2+(start.z-target.z)**2;drop=Math.max(drop,start.y-target.y-Math.sqrt(Math.max(0,reach*reach-horizontal)));}
   if(drop<=.018){
    if(drop>0){const point=world(root);point.y-=drop;root.position.copy(root.parent!.worldToLocal(point));root.updateWorldMatrix(false,true);}
    for(const {leg,target,orientation,pole}of goals)solve(leg,target,pole,orientation);
   }
  }
  for(const arm of nativeArms){
   const start=world(arm.upper),target=world(arm.end),pole=world(arm.joint),orientation=arm.end.getWorldQuaternion(new Quaternion());
   // Unarmed hands may relax outward. Held hands and mounted rein positions
   // stay fixed, while the elbow bends away from the torso around that grip.
   if(posture==='stand'&&equipment==='unarmed')target.x=centre+arm.side*Math.max(arm.side*(target.x-centre),arm.side*(start.x-centre)+.10);
   pole.x=centre+arm.side*Math.max(arm.side*(pole.x-centre),arm.side*(start.x-centre)+.105);
   solve(arm,target,pole,orientation);
  }
  for(const node of modified){const row=values.get(node)!,q=node.quaternion;if(row.length&&row.slice(-4).reduce((sum,value,index)=>sum+value*q.toArray()[index],0)<0)row.push(-q.x,-q.y,-q.z,-q.w);else row.push(q.x,q.y,q.z,q.w);}
  positions.push(...root.position.toArray());
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);
 const replacements=new Map<string,QuaternionKeyframeTrack|VectorKeyframeTrack>(modified.map(node=>[node.name+'.quaternion',new QuaternionKeyframeTrack(node.name+'.quaternion',times,values.get(node)!)]));
 if(widenLegs)replacements.set(root.name+'.position',new VectorKeyframeTrack(root.name+'.position',times,positions));
 const clip=new AnimationClip(source.name,source.duration,[...source.tracks.filter(track=>!replacements.has(track.name)),...replacements.values()],source.blendMode);
 variants.set(semantic,clip);return clip;
}
