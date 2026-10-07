import {AnimationAction,AnimationClip,AnimationMixer,Matrix4,Mesh,Object3D,Quaternion,Skeleton,SkinnedMesh,Triangle,Vector3} from 'three';
import type {ClipSpec} from './actor-assets';
import type {ActorCue,ContactTarget,ContactSupport} from './presentation';

export type ContactActorResolver=(target:ContactTarget)=>{model:Object3D;root:Object3D}|undefined;
type Limb={base:Object3D;middle:Object3D;end:Object3D;first:number;second:number};
type Sole={mesh:SkinnedMesh;vertices:number[];outline:number[];floor:number};
type Plan={key:string;cueId:string;target:Object3D;hand:Vector3;body:Vector3;step:Vector3;rearStep:Vector3;contact:number;duration:number;pistol?:boolean};
const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
function visible(node:Object3D){let current:Object3D|null=node;while(current){if(!current.visible)return false;current=current.parent;}return true;}
function poseTree(source:Object3D):Object3D|undefined{
 if(source instanceof Mesh)return;
 const node=new Object3D();node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);
 for(const child of source.children){const copy=poseTree(child);if(copy)node.add(copy);}return node;
}

/** A paired standing sabre or primary pistol-butt strike uses the current admitted body surface.
 * The actor's gameplay transform stays fixed. The native pelvis advances
 * between a planted rear boot and a stepping lead boot; all limb lengths,
 * the authored cut rotation and the single contact marker are preserved. */
export class NativeMeleeContactFit {
 maximumReachError=0;footReachError=0;handReachError=0;bodyAdvance=0;rejectedFits=0;
 private limbs=new Map<string,Limb>();private body:Object3D;
 private soles=new Map<string,Sole>();
 private soleVertices=new WeakMap<Sole,Map<number,{bone:Object3D;point:Vector3;weight:number}[]>>();
 private soleScratch=new Vector3();
 // Native attached footwear shares its bone world transform. Cache the
 // immutable inverse-bind coordinates, keeping each current bone rotation.
 // Morph or detached footwear keeps Three's full vertex deformation.
 private solePoint(sole:Sole,index:number,point:Vector3){
  const mesh=sole.mesh;
  if(mesh.bindMode!=='attached'||mesh.geometry.morphAttributes.position?.length)return mesh.localToWorld(mesh.getVertexPosition(index,point));
  let vertices=this.soleVertices.get(sole);if(!vertices){vertices=new Map();this.soleVertices.set(sole,vertices);}
  let influences=vertices.get(index);
  if(!influences){
   const position=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(mesh.bindMatrix),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   influences=[];for(let slot=0;slot<4;slot++){const weight=weights.getComponent(index,slot);if(weight>0){const boneIndex=indices.getComponent(index,slot);influences.push({bone:mesh.skeleton.bones[boneIndex],point:position.clone().applyMatrix4(mesh.skeleton.boneInverses[boneIndex]),weight});}}
   vertices.set(index,influences);
  }
  point.set(0,0,0);for(const influence of influences)point.addScaledVector(this.soleScratch.copy(influence.point).applyMatrix4(influence.bone.matrixWorld),influence.weight);return point;
 }


 private core:{bone:Object3D;low:Vector3;high:Vector3}[]=[];
 private sample?:Object3D;private sampleRoot=new Object3D();private sampleMixer?:AnimationMixer;
 private previewFit?:NativeMeleeContactFit;
 private plan?:Plan;
 private attemptedKey='';private attemptedTarget?:Object3D;
 private nativePose:{node:Object3D;position:Vector3;quaternion:Quaternion}[]=[];
 private pathPrevious?:Vector3[];
 private target=new Vector3();private start=new Vector3();private joint=new Vector3();private end=new Vector3();private direction=new Vector3();private pole=new Vector3();private elbow=new Vector3();private before=new Vector3();private after=new Vector3();
 private rotation=new Quaternion();private worldRotation=new Quaternion();private parentRotation=new Quaternion();private endRotation=new Quaternion();
 constructor(private model:Object3D,private root:Object3D,footwearName?:string,preview=false){
  this.body=model.getObjectByName('Root')!;model.updateWorldMatrix(true,false);model.updateMatrixWorld(true);
  for(const side of ['l','r'])for(const role of ['foot','hand']){
   const names=role==='foot'?['thigh','calf','foot']:['upperarm','lowerarm','hand'],nodes=names.map(name=>model.getObjectByName(`${name}_${side}`));
   if(nodes.some(node=>!node))continue;const [base,middle,end]=nodes as Object3D[];
   this.limbs.set(`${role}_${side}`,{base,middle,end,first:base.getWorldPosition(new Vector3()).distanceTo(middle.getWorldPosition(new Vector3())),second:middle.getWorldPosition(new Vector3()).distanceTo(end.getWorldPosition(new Vector3()))});
  }
  const footwear=footwearName?model.getObjectByName(footwearName):undefined;
  if(footwear instanceof SkinnedMesh){
   const indices=footwear.geometry.attributes.skinIndex,weights=footwear.geometry.attributes.skinWeight;
   for(const side of ['l','r']){
    const vertices=[];for(let index=0;index<indices.count;index++){
     let weight=0;for(let slot=0;slot<4;slot++)if([`foot_${side}`,`ball_${side}`].includes(footwear.skeleton.bones[indices.getComponent(index,slot)].name))weight+=weights.getComponent(index,slot);
     if(weight>.99)vertices.push(index);
    }
    if(vertices.length){const points=vertices.map(index=>root.worldToLocal(footwear.localToWorld(footwear.getVertexPosition(index,new Vector3())))),floor=Math.min(...points.map(point=>point.y)),outline=vertices.filter((_,index)=>points[index].y<=floor+.003);this.soles.set(side,{mesh:footwear,vertices,outline,floor});}
   }
  }
  const bounds=new Map<Object3D,{bone:Object3D;low:Vector3;high:Vector3}>();if(preview)model.traverse(mesh=>{
   if(!(mesh instanceof SkinnedMesh)||!visible(mesh)||mesh===footwear)return;
   const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,positions=mesh.geometry.attributes.position;
   for(let index=0;index<indices.count;index++){
    let weight=0;for(let slot=0;slot<4;slot++)if(/^(pelvis|spine_0[123]|neck_01|head|thigh_[lr]|calf_[lr])$/.test(mesh.skeleton.bones[indices.getComponent(index,slot)].name))weight+=weights.getComponent(index,slot);
    if(weight<=.5)continue;
    for(let slot=0;slot<4;slot++){
     if(weights.getComponent(index,slot)<=0)continue;
     const boneIndex=indices.getComponent(index,slot),bone=mesh.skeleton.bones[boneIndex],point=new Vector3().fromBufferAttribute(positions,index).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[boneIndex]);
     const bound=bounds.get(bone);if(bound){bound.low.min(point);bound.high.max(point);}else bounds.set(bone,{bone,low:point.clone(),high:point.clone()});
    }
   }
  });
  this.core=[...bounds.values()];
 }
 private rotateToward(bone:Object3D,before:Vector3,after:Vector3){
  this.rotation.setFromUnitVectors(before.normalize(),after.normalize());bone.getWorldQuaternion(this.worldRotation);this.rotation.multiply(this.worldRotation);
  bone.parent!.getWorldQuaternion(this.parentRotation);bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));bone.updateWorldMatrix(false,true);
 }
 private solve(limb:Limb,target:Vector3){
  const {base,middle,end,first:a,second:b}=limb;
  base.getWorldPosition(this.start);middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);end.getWorldQuaternion(this.endRotation);
  const requested=this.direction.subVectors(target,this.start).length(),distance=Math.min(a+b-.001,Math.max(Math.abs(a-b)+.001,requested));this.direction.normalize();
  this.maximumReachError=Math.max(this.maximumReachError,Math.max(0,requested-(a+b-.001)));
  if(end.name.startsWith('foot'))this.footReachError=Math.max(this.footReachError,Math.max(0,requested-(a+b-.001)));
  else this.handReachError=Math.max(this.handReachError,Math.max(0,requested-(a+b-.001)));
  this.pole.subVectors(this.joint,this.start).addScaledVector(this.direction,-this.pole.dot(this.direction));
  if(this.pole.lengthSq()<1e-7)this.pole.set(1,0,0).addScaledVector(this.direction,-this.direction.x);
  if(this.pole.lengthSq()<1e-7)this.pole.set(0,0,1).addScaledVector(this.direction,-this.direction.z);this.pole.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
  this.elbow.copy(this.start).addScaledVector(this.direction,along).addScaledVector(this.pole,rise);
  this.target.copy(this.start).addScaledVector(this.direction,distance);
  this.rotateToward(base,this.before.subVectors(this.joint,this.start),this.after.subVectors(this.elbow,this.start));
  middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);
  this.rotateToward(middle,this.before.subVectors(this.end,this.joint),this.after.subVectors(this.target,this.joint));
  end.parent!.getWorldQuaternion(this.parentRotation);end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));end.updateWorldMatrix(false,true);
 }
 private contactPoints(weapon:Object3D,hilt:boolean,pistol=false){
  const cap=pistol?weapon.children.find(node=>/Pistol_Butt_Cap/.test(node.name)) as Mesh|undefined:undefined;
  if(pistol&&!cap)return [];
  if(cap){
   const positions=cap.geometry.attributes.position;let bottom=Infinity;for(let index=0;index<positions.count;index++)bottom=Math.min(bottom,positions.getY(index));
   const ring=new Map<string,Vector3>();for(let index=0;index<positions.count;index++)if(Math.abs(positions.getY(index)-bottom)<1e-6){const point=new Vector3().fromBufferAttribute(positions,index);ring.set(`${Math.round(point.x*1e6)}:${Math.round(point.z*1e6)}`,point);}
   return [...ring.values()];
  }

  if(hilt){
   const grip=weapon.children.find(node=>/Leather_Grip/.test(node.name)) as Mesh|undefined,guard=weapon.children.find(node=>/Crossguard/.test(node.name)) as Mesh|undefined;
   if(!grip||!guard)return [];
   const gripPositions=grip.geometry.attributes.position,guardPositions=guard.geometry.attributes.position;
   let low=Infinity,high=-Infinity;for(let i=0;i<gripPositions.count;i++)low=Math.min(low,gripPositions.getY(i));
   for(let i=0;i<guardPositions.count;i++)if(Math.abs(guardPositions.getX(i))<.002)high=Math.max(high,guardPositions.getY(i));
   return Array.from({length:9},(_,i)=>new Vector3(0,low+(high-low)*i/8,0));
  }
  const blade=weapon.children.find(node=>/Curved_Blade/.test(node.name)) as Mesh|undefined;if(!blade)return [];
  const positions=blade.geometry.attributes.position,rings=new Map<number,{low:Vector3;high:Vector3}>();
  for(let i=0;i<positions.count;i++){
   const point=new Vector3().fromBufferAttribute(positions,i),key=Math.round(point.y*1e6),ring=rings.get(key);
   if(ring){ring.low.min(point);ring.high.max(point);}else rings.set(key,{low:point.clone(),high:point.clone()});
  }
  return [...rings.values()].sort((a,b)=>a.low.y-b.low.y).map(ring=>ring.low.clone().add(ring.high).multiplyScalar(.5));
 }
 private correction(points:Vector3[],target:Object3D){
  target.updateWorldMatrix(true,false);target.updateMatrixWorld(true);
  let distance=Infinity;const closest=new Vector3(),delta=new Vector3(),base=new Vector3(),triangle=new Triangle();
  target.traverse(node=>{
   if(!(node instanceof SkinnedMesh)||!visible(node))return;
   const positions=node.geometry.attributes.position,index=node.geometry.index;if(!index)return;
   // Compose each current native palette once. Mesh's base method includes
   // all active clothing morphs; the same four exported weights then skin it.
   const indices=node.geometry.attributes.skinIndex,weights=node.geometry.attributes.skinWeight,
    meshToWorld=new Matrix4().multiplyMatrices(node.matrixWorld,node.bindMatrixInverse),matrices=node.skeleton.bones.map((bone,i)=>new Matrix4().copy(meshToWorld).multiply(bone.matrixWorld).multiply(node.skeleton.boneInverses[i]).multiply(node.bindMatrix));
   const vertices=Array.from({length:positions.count},(_,i)=>{
    Mesh.prototype.getVertexPosition.call(node,i,base);const x=base.x,y=base.y,z=base.z,point=new Vector3();
    for(let slot=0;slot<4;slot++){
     const weight=weights.getComponent(i,slot);if(weight===0)continue;const m=matrices[indices.getComponent(i,slot)].elements;
     point.x+=weight*(m[0]*x+m[4]*y+m[8]*z+m[12]);point.y+=weight*(m[1]*x+m[5]*y+m[9]*z+m[13]);point.z+=weight*(m[2]*x+m[6]*y+m[10]*z+m[14]);
    }return point;
   });
   for(let i=0;i<index.count;i+=3){
    const a=vertices[index.getX(i)],b=vertices[index.getX(i+1)],c=vertices[index.getX(i+2)];triangle.set(a,b,c);if(triangle.getArea()<1e-10)continue;
    const minX=Math.min(a.x,b.x,c.x),maxX=Math.max(a.x,b.x,c.x),minY=Math.min(a.y,b.y,c.y),maxY=Math.max(a.y,b.y,c.y),minZ=Math.min(a.z,b.z,c.z),maxZ=Math.max(a.z,b.z,c.z);
    for(const point of points){
     const dx=Math.max(0,minX-point.x,point.x-maxX),dy=Math.max(0,minY-point.y,point.y-maxY),dz=Math.max(0,minZ-point.z,point.z-maxZ);if(dx*dx+dy*dy+dz*dz>=distance)continue;
     triangle.closestPointToPoint(point,closest);const squared=closest.distanceToSquared(point);if(squared<distance){distance=squared;delta.subVectors(closest,point);}
    }
   }
  });
  return Number.isFinite(distance)?delta:undefined;
 }
 private prepare(key:string,cue:ActorCue,clip:AnimationClip,spec:ClipSpec,weapon:Object3D,target:Object3D){
  this.plan=undefined;this.bodyAdvance=0;this.attemptedKey=key;this.attemptedTarget=target;
  const support=cue.contactSupport;if(!support?.floors.some(floor=>Math.abs(floor.height-this.root.getWorldPosition(new Vector3()).y)<.001))return;
  const contact=spec.markers?.contact;if(!Number.isFinite(contact))return;
  // Sample only this actor's known native clip. This hierarchy has no meshes
  // or second skinning palette, and is allocated only for a paired strike.
  if(!this.sample){
   this.sample=poseTree(this.model)!;this.sampleRoot.add(this.sample);this.sampleMixer=new AnimationMixer(this.sample);
   const meshes:SkinnedMesh[]=[];this.model.traverse(node=>{if(node instanceof SkinnedMesh&&visible(node))meshes.push(node);});
   for(const mesh of meshes){
    const copy=mesh.clone(false),bones=mesh.skeleton.bones.map(bone=>this.sample!.getObjectByName(bone.name)!);
    const parent=mesh.parent===this.model?this.sample:this.sample.getObjectByName(mesh.parent!.name)??this.sample;parent.add(copy);copy.bind(new Skeleton(bones as any,mesh.skeleton.boneInverses),mesh.bindMatrix);
   }
   this.previewFit=new NativeMeleeContactFit(this.sample,this.sampleRoot,[...this.soles.values()][0]?.mesh.name,true);
   for(const [side,sole]of this.previewFit.soles){const native=this.soles.get(side)!;sole.floor=native.floor;sole.outline=[...native.outline];}
  }
  this.root.getWorldPosition(this.sampleRoot.position);this.root.getWorldQuaternion(this.sampleRoot.quaternion);this.sample.position.copy(this.model.position);
  this.previewFit!.restore();this.sampleMixer!.stopAllAction();const action=this.sampleMixer!.clipAction(clip).reset().play();action.time=contact!;action.timeScale=0;this.sampleMixer!.update(0);this.sampleRoot.updateMatrixWorld(true);
  const hand=this.model.getObjectByName('hand_r')!,sampleHand=this.sample.getObjectByName('hand_r')!,arm=this.limbs.get('hand_r')!;
  this.root.updateWorldMatrix(true,false);this.root.updateMatrixWorld(true);
  const relative=new Matrix4().copy(hand.matrixWorld).invert().multiply(weapon.matrixWorld),transform=new Matrix4().multiplyMatrices(sampleHand.matrixWorld,relative);
  const points=this.contactPoints(weapon,spec.name.endsWith('.hilt'),spec.name==='stand.butt.short-gun').map(point=>point.applyMatrix4(transform)),correction=this.correction(points,target);if(!correction)return;
  const rootRotation=this.root.getWorldQuaternion(new Quaternion()),shoulder=this.sample.getObjectByName('upperarm_r')!.getWorldPosition(new Vector3()),desired=sampleHand.getWorldPosition(new Vector3()).add(correction),forward=new Vector3(0,0,1).applyQuaternion(rootRotation),body=new Vector3(),step=new Vector3(),rearStep=new Vector3();
  const hips=new Map(['l','r'].map(side=>[side,this.sample!.getObjectByName(`thigh_${side}`)!.getWorldPosition(new Vector3())])),feet=new Map(['l','r'].map(side=>[side,this.sample!.getObjectByName(`foot_${side}`)!.getWorldPosition(new Vector3())]));
  // Choose the smallest supported advance that puts the contact wrist within
  // the measured native arm. Bending the knees makes room for the rear leg;
  // an exported joint translation or a stretched bone is never used.
  let accepted=false,acceptedPlan:Plan|undefined;
  for(let advance=0;advance<=.8001;advance+=.01){
   for(let drop=0;drop<=.3801;drop+=.01){
    body.copy(forward).multiplyScalar(advance);body.y=-drop;rearStep.set(0,0,0);
    if(shoulder.clone().add(body).distanceTo(desired)>arm.first+arm.second-.008)continue;
    let supported=true;
    for(const side of ['l','r']){
     const leg=this.limbs.get(`foot_${side}`)!,hip=hips.get(side)!.clone().add(body),foot=feet.get(side)!.clone();
     if(side==='l'){
      const relative=hip.clone().sub(foot),height=relative.y,along=relative.dot(forward),lateral=relative.clone().addScaledVector(forward,-along);lateral.y=0;
      const available=(leg.first+leg.second-.008)**2-height*height-lateral.lengthSq();
      if(available<0){supported=false;continue;}
      const gather=Math.max(0,along-Math.sqrt(available));if(gather>advance){supported=false;continue;}
      rearStep.copy(forward).multiplyScalar(gather);foot.add(rearStep);
     }
     if(side==='l'&&hip.distanceTo(foot)>leg.first+leg.second-.0079)supported=false;
    }
    if(!supported)continue;
    for(const fraction of [1,.85,.7,.55,.4,.25,0]){
     step.copy(forward).multiplyScalar(advance*fraction);
     const leg=this.limbs.get('foot_r')!,hip=hips.get('r')!.clone().add(body),foot=feet.get('r')!.clone().add(step);
     if(hip.distanceTo(foot)>leg.first+leg.second-.008)continue;
     const local=(value:Vector3)=>value.clone().applyQuaternion(rootRotation.clone().invert()),plan={key,cueId:cue.id,target,hand:local(correction),body:local(body),step:local(step),rearStep:local(rearStep),contact:contact!,duration:clip.duration,pistol:spec.name==='stand.butt.short-gun'};
     if(!this.pathAllowed(plan,clip,support,action))continue;
     accepted=true;acceptedPlan=plan;break;
    }
    if(accepted)break;
   }
   if(accepted)break;
  }
  if(!accepted){this.rejectedFits++;return;}
  this.plan=acceptedPlan;this.bodyAdvance=Math.hypot(body.x,body.z);
 }
 private floorAllowed(support:ContactSupport){
  const point=new Vector3(),height=this.sampleRoot.position.y,current:Vector3[]=[];
  for(const sole of this.previewFit!.soles.values()){
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const index of sole.outline){
    this.previewFit!.solePoint(sole,index,point);const before=this.pathPrevious?.[current.length];
    minX=Math.min(minX,point.x,before?.x??point.x);maxX=Math.max(maxX,point.x,before?.x??point.x);minZ=Math.min(minZ,point.z,before?.z??point.z);maxZ=Math.max(maxZ,point.z,before?.z??point.z);current.push(point.clone());
   }
   // This swept rectangle encloses every exported sole vertex and its
   // segment between the 120 Hz samples. Checking its complete area is
   // stricter than testing only vertex endpoints at a blocked corner.
   minX-=.003;maxX+=.003;minZ-=.003;maxZ+=.003;
   const floors=support.floors.filter(floor=>Math.abs(floor.height-height)<.001),cuts=[minX,maxX,...floors.flatMap(floor=>[floor.minX,floor.maxX]).filter(x=>x>minX&&x<maxX)].sort((a,b)=>a-b);
   for(let index=1;index<cuts.length;index++){
    if(cuts[index]-cuts[index-1]<1e-10)continue;
    const x=(cuts[index]+cuts[index-1])/2,spans=floors.filter(floor=>x>=floor.minX&&x<=floor.maxX).map(floor=>[Math.max(minZ,floor.minZ),Math.min(maxZ,floor.maxZ)]).filter(([a,b])=>b>=a).sort((a,b)=>a[0]-b[0]);
    let covered=minZ;for(const [a,b]of spans){if(a>covered+1e-8)break;covered=Math.max(covered,b);}if(covered<maxZ-1e-8)return false;
   }
  }
  this.pathPrevious=current;return this.previewFit!.soles.size===2;
 }
 private bodyAllowed(support:ContactSupport){
  const low=new Vector3(Infinity,Infinity,Infinity),high=new Vector3(-Infinity,-Infinity,-Infinity),point=new Vector3();
  // Skinning is a convex blend of these bone-local exported vertex bounds.
  // Transforming their eight corners encloses the actual skin and clothing
  // without running a second full-body skinning pass for every path sample.
  for(const bound of this.previewFit!.core)for(const x of [bound.low.x,bound.high.x])for(const y of [bound.low.y,bound.high.y])for(const z of [bound.low.z,bound.high.z]){point.set(x,y,z).applyMatrix4(bound.bone.matrixWorld);low.min(point);high.max(point);}
  if(!Number.isFinite(low.x))return false;
  // A conservative rectangle encloses the actual head, trunk and legs. It
  // prevents a new lunge from putting the body through a blocked corner even
  // when its two narrower sole footprints could remain on adjacent floors.
  low.x-=.003;low.z-=.003;high.x+=.003;high.z+=.003;
  const floors=support.floors.filter(floor=>Math.abs(floor.height-this.sampleRoot.position.y)<.001),cuts=[low.x,high.x,...floors.flatMap(floor=>[floor.minX,floor.maxX]).filter(x=>x>low.x&&x<high.x)].sort((a,b)=>a-b);
  for(let index=1;index<cuts.length;index++){
   if(cuts[index]-cuts[index-1]<1e-10)continue;
   const x=(cuts[index]+cuts[index-1])/2,spans=floors.filter(floor=>x>=floor.minX&&x<=floor.maxX).map(floor=>[Math.max(low.z,floor.minZ),Math.min(high.z,floor.maxZ)]).filter(([a,b])=>b>=a).sort((a,b)=>a[0]-b[0]);
   let covered=low.z;for(const [a,b]of spans){if(a>covered+1e-8)break;covered=Math.max(covered,b);}if(covered<high.z-1e-8)return false;
  }
  return true;
 }
 private pathAllowed(plan:Plan,clip:AnimationClip,support:ContactSupport,action:AnimationAction){
  // A held pistol still keeps its wrist socket when the arm solver clamps.
  // Require the complete native wrist path to be reachable, beyond contact
  // and grip alone. Other weapon families retain their existing admission.
  const sample=(time:number)=>{this.previewFit!.restore();action.time=time;action.timeScale=0;this.sampleMixer!.update(0);this.sampleRoot.updateMatrixWorld(true);this.previewFit!.pose(plan,time);this.sampleRoot.updateMatrixWorld(true);return this.floorAllowed(support)&&this.previewFit!.footReachError<.001&&(!plan.pistol||this.previewFit!.handReachError<1e-7);};
  // Reject an obstructed contact footprint before checking its whole path.
  this.pathPrevious=undefined;
  if(!sample(plan.contact)||!this.bodyAllowed(support))return false;
  this.pathPrevious=undefined;
  for(let index=0;index<=Math.ceil(clip.duration*120);index++)if(!sample(Math.min(clip.duration,index/120))||index%4===0&&!this.bodyAllowed(support))return false;
  return true;
 }
 apply(cue:ActorCue|undefined,clip:AnimationClip,spec:ClipSpec,weapon:Object3D|undefined,time:number,resolve?:ContactActorResolver){
  this.maximumReachError=0;this.footReachError=0;this.handReachError=0;
  if(!cue||!weapon||!this.body||!['hand_r','foot_l','foot_r'].every(name=>this.limbs.has(name))||this.soles.size!==2||!(spec.name.startsWith('stand.slash.blade')||spec.name==='stand.butt.short-gun')||cue.contactTarget&&(cue.contactTarget.mounted||!['standing','crouched'].includes(cue.contactTarget.posture))){this.plan=undefined;this.attemptedKey='';return;}
  const key=cue.id;
  if(cue.contactTarget){
   const admitted=resolve?.(cue.contactTarget);if(!admitted||!visible(admitted.root)||!visible(admitted.model)){this.plan=undefined;this.attemptedKey='';return;}
   // Contact starts from the current rendered target posture. A cached body
   // recovery can finish without reading an absent impact/result target.
   const floors=cue.contactSupport?.floors,floorKey=floors?.map(floor=>`${floor.minX},${floor.maxX},${floor.minZ},${floor.maxZ},${floor.height}`).join(';')??'';
   const phaseKey=`${key}:${spec.name}:${weapon.userData.itemId}:${cue.contactTarget.key}:${cue.contactTarget.appearance}:${cue.contactTarget.posture}:${cue.contactTarget.position.join(',')}:${floorKey}:${cue.phase==='contact'?'contact':'prepare'}`;
   if(this.attemptedKey!==phaseKey||this.attemptedTarget!==admitted.model)this.prepare(phaseKey,cue,clip,spec,weapon,admitted.model);
  }else if(this.plan?.cueId!==key){this.plan=undefined;return;}
  const plan=this.plan;if(!plan)return;this.pose(plan,time);
 }
 private pose(plan:Plan,time:number){
  this.maximumReachError=0;this.footReachError=0;this.handReachError=0;
  const contact=plan.contact,end=plan.duration,weight=time<=contact?smooth(time/contact):1-smooth((time-contact)/(end*.9-contact));
  if(weight<=0)return;
  const modified=new Set<Object3D>([this.body]);for(const name of ['foot_l','foot_r','hand_r']){const limb=this.limbs.get(name)!;modified.add(limb.base);modified.add(limb.middle);modified.add(limb.end);}
  this.nativePose=[...modified].map(node=>({node,position:node.position.clone(),quaternion:node.quaternion.clone()}));
  this.root.updateWorldMatrix(true,false);this.root.updateMatrixWorld(true);
  const rootRotation=this.root.getWorldQuaternion(new Quaternion());
  const footTargets=new Map<string,Vector3>();for(const side of ['l','r'])footTargets.set(side,this.limbs.get(`foot_${side}`)!.end.getWorldPosition(new Vector3()));
  const handTarget=this.limbs.get('hand_r')!.end.getWorldPosition(new Vector3()).add(plan.hand.clone().applyQuaternion(rootRotation).multiplyScalar(weight));
  const body=plan.body.clone().applyQuaternion(rootRotation).multiplyScalar(weight);
  const stepStart=Math.min(.1,contact*.28),stepWeight=time<=contact*.8?smooth((time-stepStart)/(contact*.8-stepStart)):time<end*.62?1:1-smooth((time-end*.62)/(end*.9-end*.62));
  const lead=footTargets.get('r')!;lead.add(plan.step.clone().applyQuaternion(rootRotation).multiplyScalar(stepWeight));
  const rearWeight=time<stepStart?smooth(time/stepStart):time<end*.52?1:1-smooth((time-end*.52)/(end*.62-end*.52)),rear=footTargets.get('l')!;
  rear.add(plan.rearStep.clone().applyQuaternion(rootRotation).multiplyScalar(rearWeight));
  // The rear boot gathers first and plants before the lead boot lifts. On
  // recovery it returns first while the lead boot still supports the body.
  const rearAdvanceArc=time<stepStart?Math.sin(Math.PI*time/stepStart):0,rearRecoveryArc=time>end*.52&&time<end*.62?Math.sin(Math.PI*(time-end*.52)/(end*.62-end*.52)):0;
  rear.y+=Math.max(rearAdvanceArc,rearRecoveryArc)*Math.min(.035,plan.rearStep.length()*.1);
  const advanceArc=time>stepStart&&time<contact*.8?Math.sin(Math.PI*(time-stepStart)/(contact*.8-stepStart)):0,recoveryArc=time>end*.62&&time<end*.9?Math.sin(Math.PI*(time-end*.62)/(end*.9-end*.62)):0;
  lead.y+=Math.max(advanceArc,recoveryArc)*Math.min(.045,plan.step.length()*.1);
  const support=plan.rearStep.length()>.005&&Math.max(rearAdvanceArc,rearRecoveryArc)>0?'r':'l',sole=this.soles.get(support);
  if(sole){
   const minimum=Math.min(...sole.vertices.map(index=>this.solePoint(sole,index,new Vector3()).y)),floor=this.root.getWorldPosition(new Vector3()).y+sole.floor;
   footTargets.get(support)!.y+=floor-minimum;
  }
  // Flex the knees by the amount the measured leg reach needs at this
  // sample, including the two recovery steps. Clamping the foot target
  // would pull a planted sole upward or make it skate along the floor.
  let kneeDrop=0;
  for(const side of ['l','r']){
   const leg=this.limbs.get(`foot_${side}`)!,hip=leg.base.getWorldPosition(new Vector3()).add(body),foot=footTargets.get(side)!,dx=hip.x-foot.x,dz=hip.z-foot.z;
   const height=Math.sqrt(Math.max(0,(leg.first+leg.second-.002)**2-dx*dx-dz*dz));kneeDrop=Math.max(kneeDrop,hip.y-foot.y-height);
  }
  body.y-=Math.max(0,kneeDrop);this.body.getWorldPosition(this.start).add(body);this.body.parent!.worldToLocal(this.start);this.body.position.copy(this.start);this.body.updateWorldMatrix(false,true);
  for(const side of ['l','r'])this.solve(this.limbs.get(`foot_${side}`)!,footTargets.get(side)!);
  this.solve(this.limbs.get('hand_r')!,handTarget);
 }
 /** PropertyMixer does not rewrite an unchanged track value. Restore its
  * native input before the next sample, including a held contact phase. */
 restore(){for(const pose of this.nativePose){pose.node.position.copy(pose.position);pose.node.quaternion.copy(pose.quaternion);}this.nativePose=[];}
 dispose(){this.restore();if(this.sample&&this.sampleMixer){this.sampleMixer.stopAllAction();this.sampleMixer.uncacheRoot(this.sample);this.sample.traverse(node=>{if(node instanceof SkinnedMesh)node.skeleton.dispose();});}}
}
