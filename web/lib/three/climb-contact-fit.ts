import {Object3D,Quaternion,Vector3} from 'three';
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../../../game/climb-geometry.js';
import type {ClipSpec} from './actor-assets';
export type ClimbGeometry={height:number;span:number;baseSpan?:number;edgeSpan:number;ladderSpan:number;steps:number;kind?:string};
type Limb={base:Object3D;middle:Object3D;end:Object3D;first:number;second:number;contact:Vector3};
/** Only authored link height/rung differences change native limb rotations.
 * The reference ladder uses its stored native clips without a runtime fit. */
export class NativeClimbContactFit {
 readonly adjustmentLimit=.65;
 rejectedFits=0;maximumAdjustment=0;
 private limbs=new Map<string,Limb>();
 private nativeRotations=new Map<Object3D,Quaternion>();private adjusted=false;
 private start=new Vector3();private joint=new Vector3();private end=new Vector3();private direction=new Vector3();private pole=new Vector3();private elbow=new Vector3();private target=new Vector3();private origin=new Vector3();private current=new Vector3();private before=new Vector3();private after=new Vector3();
 private rotation=new Quaternion();private worldRotation=new Quaternion();private parentRotation=new Quaternion();private endRotation=new Quaternion();
 constructor(private model:Object3D,private root:Object3D){
  model.updateWorldMatrix(true,true);
  for(const side of ['l','r'])for(const role of ['foot','hand']){
   const names=role==='foot'?['thigh','calf','foot']:['upperarm','lowerarm','hand'],nodes=names.map(name=>model.getObjectByName(`${name}_${side}`));
   if(nodes.some(node=>!node))continue;const [base,middle,end]=nodes as Object3D[];
   const a=base.getWorldPosition(new Vector3()),b=middle.getWorldPosition(new Vector3()),c=end.getWorldPosition(new Vector3());
   const ball=model.getObjectByName(`ball_${side}`),finger=model.getObjectByName(`middle_01_${side}`);
   const point=role==='hand'?c.clone().lerp(finger!.getWorldPosition(new Vector3()),.72):ball!.getWorldPosition(new Vector3());
   if(role==='foot'){model.worldToLocal(point);point.y=.007;model.localToWorld(point);}
   this.limbs.set(`${role}_${side}`,{base,middle,end,first:a.distanceTo(b),second:b.distanceTo(c),contact:end.worldToLocal(point)});
   for(const bone of [base,middle,end])this.nativeRotations.set(bone,bone.quaternion.clone());
  }
 }
 /** Restore before mixing: unchanged property tracks need not write again. */
 restore(){
  if(!this.adjusted)return;
  for(const [bone,rotation]of this.nativeRotations)bone.quaternion.copy(rotation);
  this.model.updateWorldMatrix(true,true);this.adjusted=false;
 }
 nativeFraction(geometry:ClimbGeometry,fraction:number,spec:ClipSpec){
  const support=spec.climbSupport;if(!support)return fraction;
  return referenceClimbFraction(geometry,fraction,ladderGeometry([0,0,0],[0,support.height,support.span],support.span));
 }
 private rotateToward(bone:Object3D,before:Vector3,after:Vector3){
  this.rotation.setFromUnitVectors(before.normalize(),after.normalize());bone.getWorldQuaternion(this.worldRotation);this.rotation.multiply(this.worldRotation);
  bone.parent!.getWorldQuaternion(this.parentRotation);bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));bone.updateWorldMatrix(false,true);
 }
 private solve(limb:Limb){
  const {base,middle,end,first:a,second:b}=limb;
  base.getWorldPosition(this.start);middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);end.getWorldQuaternion(this.endRotation);
  const distance=Math.min(a+b-.0005,Math.max(Math.abs(a-b)+.0005,this.direction.subVectors(this.target,this.start).length()));this.direction.normalize();
  this.pole.subVectors(this.joint,this.start).addScaledVector(this.direction,-this.pole.dot(this.direction));
  if(this.pole.lengthSq()<1e-7)this.pole.set(1,0,0).addScaledVector(this.direction,-this.direction.x);
  if(this.pole.lengthSq()<1e-7)this.pole.set(0,0,1).addScaledVector(this.direction,-this.direction.z);this.pole.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
  this.elbow.copy(this.start).addScaledVector(this.direction,along).addScaledVector(this.pole,rise);
  this.rotateToward(base,this.before.subVectors(this.joint,this.start),this.after.subVectors(this.elbow,this.start));
  middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);
  this.rotateToward(middle,this.before.subVectors(this.end,this.joint),this.after.subVectors(this.target,this.joint));
  end.parent!.getWorldQuaternion(this.parentRotation);end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));end.updateWorldMatrix(false,true);
 }
 apply(geometry:ClimbGeometry,fraction:number,spec:ClipSpec){
  this.rejectedFits=0;this.maximumAdjustment=0;
  const support=spec.climbSupport;if(!support||/stair/.test(geometry.kind??''))return;
  if(Math.abs(geometry.height-support.height)<.001&&Math.abs(geometry.span-support.span)<.001)return;
  for(const [bone,rotation]of this.nativeRotations)rotation.copy(bone.quaternion);this.adjusted=true;
  const actual=sampleLadderClimb({...geometry,halfWidth:.23,rungRadius:.026},fraction,support.feetRest),reference=sampleLadderClimb(ladderGeometry([0,0,0],[0,support.height,support.span],support.span),this.nativeFraction(geometry,fraction,spec),support.feetRest);
  this.root.updateWorldMatrix(true,true);
  for(const side of ['l','r'])for(const role of ['foot','hand']){
   const limb=this.limbs.get(`${role}_${side}`);if(!limb)continue;
   const desired=role==='foot'?actual.feet[side]:actual.hands[side],native=role==='foot'?reference.feet[side]:reference.hands[side],weight=role==='hand'?actual.hands[side].weight:1;
   this.target.fromArray(desired.position).sub(this.origin.set(0,actual.root.height,actual.root.forward));
   if(role==='hand'&&weight<.999){
    this.before.fromArray(native.position).sub(this.origin.set(0,reference.root.height,reference.root.forward));
    this.target.sub(this.before).multiplyScalar(weight);this.current.copy(limb.contact);limb.end.localToWorld(this.current);this.root.worldToLocal(this.current);this.target.add(this.current);
   }
   this.root.localToWorld(this.target);limb.end.getWorldQuaternion(this.endRotation);this.current.copy(limb.contact).applyQuaternion(this.endRotation);this.target.sub(this.current);
   limb.end.getWorldPosition(this.current);
   const adjustment=this.target.distanceTo(this.current);this.maximumAdjustment=Math.max(this.maximumAdjustment,adjustment);
   if(adjustment>this.adjustmentLimit){this.rejectedFits++;continue;}
   this.solve(limb);
  }
 }
}
