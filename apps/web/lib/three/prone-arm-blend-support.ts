import {Object3D,SkinnedMesh,Vector3,Quaternion,type BufferGeometry} from 'three';
import type {ClipSpec} from './actor-assets';

type Part={joint:number;weight:number;x:number;y:number;z:number;deltas?:{slot:number;x:number;y:number;z:number}[]};
type Template={side:'l'|'r';parts:Part[]};
type Point={mesh:SkinnedMesh;parts:Part[]};
type Limb={side:'l'|'r';upper:Object3D;lower:Object3D;hand:Object3D;points:Point[];saved:[Quaternion,Quaternion,Quaternion];adjusted:boolean;direction?:number;angle:number};
const cache=new WeakMap<BufferGeometry,Map<string,Template[]>>();
const roles=['upperarm','lowerarm','hand'];
const floor=.0015,trigger=.0015,maxAngle=.72;

/** Clear complete weighted forearms and hands without moving a wrist or held object.
 * Stored source poses remain the authority. Restore before the mixer, then
 * fit at most one bounded elbow arc on each affected side. */
export class NativeProneArmBlendSupport {
 private limbs=new Map<'l'|'r',Limb>();private ready=false;private until=-Infinity;private fitted=false;private activeWork=false;private loading=false;private workStarted=0;private time=0;private lastTime?:number;private delta=0;
 rejectedFits=0;maximumAngle=0;maximumHandDrift=0;surfaceEvaluations=0;
 constructor(private model:Object3D,private root:Object3D){}
 private accepted(spec?:ClipSpec){return !!spec&&spec.name.startsWith('prone.')&&spec.name.includes('.short-gun')&&['idle','aim','fire','reload','reprime','repair','unload'].includes(spec.gesture??'');}
 begin(before:ClipSpec|undefined,after:ClipSpec,time:number){if(!Number.isFinite(time)){this.until=-Infinity;this.activeWork=false;this.loading=false;for(const limb of this.limbs.values()){limb.angle=0;limb.direction=undefined;}return;}this.until=this.accepted(before)&&this.accepted(after)?time+.12:-Infinity;this.activeWork=this.accepted(after)&&['reload','fire'].includes(after.gesture??'');this.loading=this.accepted(after)&&after.gesture==='reload';this.workStarted=time;if(!this.accepted(after))for(const limb of this.limbs.values()){limb.angle=0;limb.direction=undefined;}}
 restore(){if(!this.fitted)return;for(const limb of this.limbs.values()){if(!limb.adjusted)continue;for(const[i,bone]of[limb.upper,limb.lower,limb.hand].entries())bone.quaternion.copy(limb.saved[i]);limb.adjusted=false;}this.fitted=false;}
 dispose(){this.restore();this.limbs.clear();}
 private prepare(){
  if(this.ready)return;this.ready=true;this.root.updateMatrixWorld(true);
  for(const side of ['l','r']as const){const bones=roles.map(role=>this.model.getObjectByName(role+'_'+side));if(bones.some(b=>!b))continue;this.limbs.set(side,{side,upper:bones[0]!,lower:bones[1]!,hand:bones[2]!,points:[],saved:[new Quaternion(),new Quaternion(),new Quaternion()],adjusted:false,angle:0});}
  this.model.traverse(node=>{
   if(!(node instanceof SkinnedMesh)||node.bindMode!=='attached')return;
   const geometry=node.geometry,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,positions=geometry.attributes.position;if(!indices||!weights||!positions)return;
   const signature=['complete-native-arm-hand-v1',positions.version,indices.version,weights.version,...node.bindMatrix.elements,...node.skeleton.boneInverses.flatMap(matrix=>matrix.elements)].join(','),byGeometry=cache.get(geometry)??new Map<string,Template[]>();cache.set(geometry,byGeometry);let template=byGeometry.get(signature);
   if(!template){template=[];const point=new Vector3(),delta=new Vector3(),targets=geometry.morphAttributes.position??[];
    for(let index=0;index<positions.count;index++)for(const side of ['l','r']as const){let total=0;for(let j=0;j<4;j++){const bone=node.skeleton.bones[indices.getComponent(index,j)],weight=weights.getComponent(index,j);if(bone?.name.endsWith('_'+side)){if(/^(upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/.test(bone.name))total+=weight;}}if(total<=.7)continue;
     point.fromBufferAttribute(positions,index).applyMatrix4(node.bindMatrix);const parts:Part[]=[];
     for(let j=0;j<4;j++){const joint=indices.getComponent(index,j),weight=weights.getComponent(index,j);if(weight<=1e-7)continue;const local=point.clone().applyMatrix4(node.skeleton.boneInverses[joint]),part:Part={joint,weight,x:local.x,y:local.y,z:local.z};
      for(let slot=0;slot<targets.length;slot++){delta.fromBufferAttribute(targets[slot],index);if(!geometry.morphTargetsRelative)delta.sub(new Vector3().fromBufferAttribute(positions,index));if(delta.lengthSq()<1e-16)continue;const e=node.bindMatrix.elements,x=delta.x,y=delta.y,z=delta.z;delta.set(e[0]*x+e[4]*y+e[8]*z,e[1]*x+e[5]*y+e[9]*z,e[2]*x+e[6]*y+e[10]*z);const m=node.skeleton.boneInverses[joint].elements,a=delta.x,b=delta.y,c=delta.z;(part.deltas??=[]).push({slot,x:m[0]*a+m[4]*b+m[8]*c,y:m[1]*a+m[5]*b+m[9]*c,z:m[2]*a+m[6]*b+m[10]*c});}
      parts.push(part);
     }template.push({side,parts});
    }byGeometry.set(signature,template);
   }
   for(const entry of template)this.limbs.get(entry.side)?.points.push({mesh:node,parts:entry.parts});
  });
 }
 private lowest(limb:Limb){
  this.surfaceEvaluations++;let minimum=Infinity;
  for(const{mesh,parts}of limb.points){if(!mesh.visible)continue;let y=0;for(const p of parts){const e=mesh.skeleton.bones[p.joint].matrixWorld.elements;let x=p.x,a=p.y,z=p.z;for(const d of p.deltas??[]){const weight=mesh.morphTargetInfluences?.[d.slot]??0;x+=d.x*weight;a+=d.y*weight;z+=d.z*weight;}y+=p.weight*(e[1]*x+e[5]*a+e[9]*z+e[13]);}minimum=Math.min(minimum,y);}return minimum;
 }
 private fit(limb:Limb,height:number){
  const u=limb.upper,m=limb.lower,h=limb.hand,s=u.getWorldPosition(new Vector3()),e=m.getWorldPosition(new Vector3()),w=h.getWorldPosition(new Vector3()),uq=u.getWorldQuaternion(new Quaternion()),mq=m.getWorldQuaternion(new Quaternion()),hq=h.getWorldQuaternion(new Quaternion()),a=e.distanceTo(s),b=w.distanceTo(e),d=w.distanceTo(s),dir=w.clone().sub(s).normalize(),along=(a*a-b*b+d*d)/(2*d),center=s.clone().addScaledVector(dir,along),bend=e.clone().sub(center);
  const native=[u.quaternion.clone(),m.quaternion.clone(),h.quaternion.clone()];const reset=()=>{u.quaternion.copy(native[0]);m.quaternion.copy(native[1]);h.quaternion.copy(native[2]);u.updateWorldMatrix(false,true);};
  if(![a,b,d,...s.toArray(),...e.toArray(),...w.toArray(),...hq.toArray()].every(Number.isFinite)||a<.1||b<.1||d<Math.abs(a-b)+.0005||d>a+b-.0005||bend.length()<.003){this.rejectedFits++;limb.angle=0;limb.direction=undefined;return;}
  const evaluate=(angle:number)=>{reset();const joint=center.clone().add(bend.clone().applyAxisAngle(dir,angle)),upper=new Quaternion().setFromUnitVectors(e.clone().sub(s).normalize(),joint.clone().sub(s).normalize()).multiply(uq),lower=new Quaternion().setFromUnitVectors(w.clone().sub(e).normalize(),w.clone().sub(joint).normalize()).multiply(mq);u.quaternion.copy(u.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(upper));u.updateWorldMatrix(false,true);m.quaternion.copy(m.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(lower));m.updateWorldMatrix(false,true);h.quaternion.copy(h.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(hq));h.updateWorldMatrix(false,true);return this.lowest(limb);};
  // A bent sleeve can have separate safe arcs. Choose the safe arc nearest
  // the prior correction; a monotone floor search can jump to the other arc.
  // Keep a 65 mrad loading bend while the working hand follows its source
  // path. This avoids stopping at a tangent sleeve contact between pulls.
  // Both admission and return are continuous; the wrist remains exact.
  const previous=limb.angle,bias=this.loading?(limb.side==='l'?1:-1)*.065*Math.min(1,Math.max(0,(this.time-this.workStarted)/.12)):0,goal=previous+Math.max(-3*this.delta,Math.min(3*this.delta,bias-previous));let angle=goal;
  if(evaluate(goal)<height+floor){let found=false,unsafe=goal,safe=goal;
   for(let distance=.025;distance<=2*maxAngle+.025&&!found;distance+=.025){let best=-Infinity;for(const sign of[1,-1]){const candidate=goal+distance*sign;if(Math.abs(candidate)>maxAngle)continue;const value=evaluate(candidate);if(value>=height+floor&&value>best){best=value;safe=candidate;found=true;}}}
   if(!found){reset();this.rejectedFits++;limb.angle=0;limb.direction=undefined;return;}
   for(let i=0;i<9;i++){const middle=(unsafe+safe)*.5;if(evaluate(middle)>=height+floor)safe=middle;else unsafe=middle;}angle=safe;
  }
  if(Math.abs(angle)<1e-7){reset();limb.angle=0;limb.direction=undefined;return;}evaluate(angle);const drift=h.getWorldPosition(new Vector3()).distanceTo(w),rotation=1-Math.abs(h.getWorldQuaternion(new Quaternion()).dot(hq));this.maximumHandDrift=Math.max(this.maximumHandDrift,drift);
  if(!Number.isFinite(drift)||drift>1e-6||rotation>1e-6){reset();this.rejectedFits++;limb.angle=0;limb.direction=undefined;return;}
  [u,m,h].forEach((bone,index)=>limb.saved[index].copy(native[index]));limb.angle=angle;limb.direction=Math.sign(angle);limb.adjusted=true;this.fitted=true;this.maximumAngle=Math.max(this.maximumAngle,Math.abs(angle));
 }
 apply(time:number){
  this.rejectedFits=0;this.maximumAngle=0;this.maximumHandDrift=0;this.surfaceEvaluations=0;if(!Number.isFinite(time))return;this.time=time;this.delta=this.lastTime===undefined?0:Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;if(time>this.until&&!this.activeWork&&![...this.limbs.values()].some(limb=>Math.abs(limb.angle)>1e-7))return;
  this.prepare();this.root.updateMatrixWorld(true);const height=this.root.matrixWorld.elements[13];if(!Number.isFinite(height))return;
  for(const limb of this.limbs.values()){const lowest=this.lowest(limb);if(Number.isFinite(lowest)&&(lowest<height+trigger||Math.abs(limb.angle)>1e-7))this.fit(limb,height);}
 }
}
