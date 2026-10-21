import {AnimationClip,AnimationMixer,LoopOnce,Object3D,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';

const cache=new WeakMap<Object3D,WeakMap<AnimationClip,AnimationClip>>();
const breathsPerCycle=3;
const world=(node:Object3D)=>node.getWorldPosition(new Vector3());
const orientation=(node:Object3D)=>node.getWorldQuaternion(new Quaternion());
function skeletonCopy(node:Object3D):Object3D{
 const hasBone=(part:Object3D):boolean=>Boolean((part as any).isBone)||part.children.some(hasBone);
 const copy=node.clone(false);for(const child of node.children)if(hasBone(child))copy.add(skeletonCopy(child));return copy;
}
function worldRotation(node:Object3D,rotation:Quaternion){node.quaternion.copy(orientation(node.parent!).invert().multiply(rotation));node.updateWorldMatrix(false,true);}
function turn(node:Object3D,before:Vector3,after:Vector3){worldRotation(node,new Quaternion().setFromUnitVectors(before.normalize(),after.normalize()).multiply(orientation(node)));}
type Limb={upper:Object3D;elbow:Object3D;hand:Object3D};
type Arm=Limb&{shoulder:Object3D;side:number};
function keepContact(arm:Limb,target:Vector3,pole:Vector3,rotation:Quaternion){
 const {upper,elbow,hand}=arm,start=world(upper),middle=world(elbow),end=world(hand),a=start.distanceTo(middle),b=middle.distanceTo(end),direction=target.clone().sub(start),distance=direction.length();
 if(distance>=a+b-1e-7||distance<=Math.abs(a-b)+1e-7)return false;
 direction.normalize();pole.sub(start).addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-10)return false;
 const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along)),bend=start.clone().addScaledVector(direction,along).addScaledVector(pole.normalize(),rise);
 turn(upper,middle.sub(start),bend.clone().sub(start));turn(elbow,world(hand).sub(world(elbow)),target.clone().sub(world(elbow)));worldRotation(hand,rotation);return true;
}

/** A repeatable visual seed, unrelated to gameplay RNG or asset identity. */
export function idleBreathingTiming(key:string){
 let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
 hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);hash=(hash^(hash>>>16))>>>0;
 return {phase:hash/4294967296,period:breathsPerCycle*(3.6+((hash>>>8)&65535)/65535*.8)};
}

/** Bake breathing into standing rest only. The existing mixer then blends the
 * same pose that contact fitting sees. Native feet, grips and source data stay
 * intact; mounted, low stances, locomotion and paid actions keep their clips. */
export function idleBreathingClip(source:AnimationClip,body:Object3D,bones:Record<string,string>,semantic:string){
 if(!semantic.startsWith('stand.idle.'))return source;
 let clips=cache.get(body);if(!clips){clips=new WeakMap();cache.set(body,clips);}const cached=clips.get(source);if(cached)return cached;
 const model=skeletonCopy(body),hips=model.getObjectByName(bones.hips),spine=model.getObjectByName(bones.spine),chest=model.getObjectByName(bones.chest),neck=model.getObjectByName(bones.neck),head=model.getObjectByName(bones.head);
 const arm=(role:string,side:number):Arm|undefined=>{const hand=model.getObjectByName(bones[role]),elbow=hand?.parent,upper=elbow?.parent,shoulder=upper?.parent;return [hand,elbow,upper,shoulder].every(node=>(node as any)?.isBone)?{hand:hand!,elbow:elbow!,upper:upper!,shoulder:shoulder!,side}:undefined;};
 const arms=[arm('handLeft',1),arm('handRight',-1)];
 const legs=['footLeft','footRight'].map(role=>{const hand=model.getObjectByName(bones[role]),elbow=hand?.parent,upper=elbow?.parent;return [hand,elbow,upper].every(node=>(node as any)?.isBone)?{hand:hand!,elbow:elbow!,upper:upper!}:undefined;});
 if(!hips||!spine||!chest||!neck||!head||arms.some(arm=>!arm)||legs.some(leg=>!leg||leg.upper.parent!==hips)){clips.set(source,source);return source;}
 const nativeArms=arms as Arm[],nativeLegs=legs as Limb[],modified=[hips,spine,chest,neck,head,...nativeArms.flatMap(arm=>[arm.shoulder,arm.upper,arm.elbow,arm.hand]),...nativeLegs.flatMap(leg=>[leg.upper,leg.elbow,leg.hand])];
 const duration=source.duration*breathsPerCycle,count=Math.max(1,Math.ceil(duration*60)),times=Array.from({length:count+1},(_,i)=>Math.fround(duration*i/count));
 const rotations=new Map(modified.map(node=>[node,[] as number[]])),positions:number[]=[],hipPositions:number[]=[];
 const mixer=new AnimationMixer(model),playing=mixer.clipAction(source).setLoop(LoopOnce,1);playing.clampWhenFinished=true;playing.play();playing.timeScale=0;
 // Restore every changed property before sampling. Some authored idle clips
 // omit static tracks; those must not accumulate the previous sample's lift.
 const rest=new Map(modified.map(node=>[node,{q:node.quaternion.clone(),p:node.position.clone()}]));
 let referenceHead:Vector3|undefined,referenceHeadRotation:Quaternion|undefined;
 for(const time of times){
  for(const [node,value]of rest){node.quaternion.copy(value.q);node.position.copy(value.p);}
  playing.enabled=true;playing.paused=false;playing.time=time===times.at(-1)?source.duration:time%source.duration;mixer.update(0);model.updateMatrixWorld(true);
  for(const [node,value]of rest){value.q.copy(node.quaternion);value.p.copy(node.position);}
  const nativeHead=world(head),nativeHeadRotation=orientation(head);referenceHead??=nativeHead.clone();referenceHeadRotation??=nativeHeadRotation.clone();
  const feet=nativeLegs.map(leg=>({leg,target:world(leg.hand),pole:world(leg.elbow),rotation:orientation(leg.hand)}));
  // A slow transfer of weight spans three breaths. Only the skeleton moves;
  // the actor's cell, facing and planted foot contacts remain unchanged.
  const shift=.038*Math.sin(2*Math.PI*time/duration),offset=new Vector3(shift,0,0),hipPoint=world(hips).add(offset);
  let drop=.002*Math.abs(shift)/.038;
  for(const {leg,target}of feet){const start=world(leg.upper).add(offset),reach=(world(leg.upper).distanceTo(world(leg.elbow))+world(leg.elbow).distanceTo(target))*.9999,horizontal=(start.x-target.x)**2+(start.z-target.z)**2;drop=Math.max(drop,start.y-target.y-Math.sqrt(Math.max(0,reach*reach-horizontal)));}
  hipPoint.y-=drop;hips.position.copy(hips.parent!.worldToLocal(hipPoint));hips.updateWorldMatrix(false,true);
  for(const {leg,target,pole,rotation}of feet)if(!keepContact(leg,target,pole.add(offset),rotation)){mixer.stopAllAction();mixer.uncacheRoot(model);clips.set(source,source);return source;}
  // A smooth chest rise and slower release, with a short quiet end to each
  // breath. The chest/shoulder range remains readable at tactical scale;
  // the smaller head motion keeps a steady gaze instead of a repeated nod.
  const phase=(time/source.duration)%1,cycle=phase<.4?phase/.8:.5+(phase-.4)/1.2,breath=Math.pow((1-Math.cos(2*Math.PI*cycle))/2,1.4);
  worldRotation(spine,new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.022*breath).multiply(orientation(spine)));
  const lifted=world(chest).add(new Vector3(0,.026*breath,.022*breath));chest.position.copy(chest.parent!.worldToLocal(lifted));chest.updateWorldMatrix(false,true);
  // Two-hand grips follow the chest as one rigid pair. Opening each shoulder
  // separately can overextend a straight lance arm and break its held grip.
  if(!semantic.endsWith('.long-gun')&&!semantic.endsWith('.lance'))for(const arm of nativeArms)worldRotation(arm.shoulder,new Quaternion().setFromAxisAngle(new Vector3(0,0,1),arm.side*.05*breath).multiply(orientation(arm.shoulder)));
  const headTarget=referenceHead.clone().lerp(nativeHead,.2).add(new Vector3(shift*.75,.006*breath-drop,.003*breath));
  turn(neck,world(head).sub(world(neck)),headTarget.sub(world(neck)));worldRotation(head,referenceHeadRotation.clone().slerp(nativeHeadRotation,.2));
  for(const node of modified){const row=rotations.get(node)!,q=node.quaternion;if(row.length&&row.slice(-4).reduce((sum,value,index)=>sum+value*q.toArray()[index],0)<0)row.push(-q.x,-q.y,-q.z,-q.w);else row.push(q.x,q.y,q.z,q.w);}
  positions.push(...chest.position.toArray());
  hipPositions.push(...hips.position.toArray());
 }
 mixer.stopAllAction();mixer.uncacheRoot(model);
 const replacements=new Map<string,QuaternionKeyframeTrack|VectorKeyframeTrack>(modified.map(node=>[node.name+'.quaternion',new QuaternionKeyframeTrack(node.name+'.quaternion',times,rotations.get(node)!)]));
 replacements.set(chest.name+'.position',new VectorKeyframeTrack(chest.name+'.position',times,positions));
 replacements.set(hips.name+'.position',new VectorKeyframeTrack(hips.name+'.position',times,hipPositions));
 const repeated=source.tracks.filter(track=>!replacements.has(track.name)).map(track=>{
  const copy=track.clone(),trackTimes:number[]=[],values:number[]=[],size=track.getValueSize();
  for(let cycle=0;cycle<breathsPerCycle;cycle++)for(let index=0;index<track.times.length;index++){
   const time=track.times[index]+cycle*source.duration;if(trackTimes.at(-1)===time)continue;
   trackTimes.push(time);values.push(...track.values.slice(index*size,(index+1)*size));
  }
  copy.times=new Float32Array(trackTimes);copy.values=new Float32Array(values);return copy;
 });
 const clip=new AnimationClip(source.name,duration,[...repeated,...replacements.values()],source.blendMode);clips.set(source,clip);return clip;
}
