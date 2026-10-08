import {AnimationClip,Matrix4,Object3D,Quaternion,Vector3} from 'three';
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../../../game/climb-geometry.js';
import type {ClipSpec} from './actor-assets';
import {NativeClimbBodyPhase} from './climb-body-phase';
export type ClimbGeometry={height:number;span:number;baseSpan?:number;edgeSpan:number;ladderSpan:number;steps:number;kind?:string};
const phase=(t:number,a:number,b:number)=>{const f=Math.max(0,Math.min(1,(t-a)/(b-a)));return f*f*(3-2*f);};
const finiteGeometry=(g:ClimbGeometry)=>Number.isFinite(g.height)&&Number.isFinite(g.span)&&Number.isFinite(g.edgeSpan)&&Number.isFinite(g.ladderSpan)&&Number.isFinite(g.steps)&&Number.isFinite(g.baseSpan??0);
type Limb={base:Object3D;middle:Object3D;end:Object3D;first:number;second:number;contact:Vector3;nativeEndRotation:Quaternion;bindEndRotation:Quaternion;bindBaseRotation:Quaternion;bindMiddleRotation:Quaternion;bindFirstDirection:Vector3;bindSecondDirection:Vector3;bindHandContactRotation?:Quaternion};
/** Different rung counts use the source contact/pole recipe and a bounded
 * rung-section blend toward the paid body phase.
 * The reference ladder uses its stored native clips without a runtime fit. */
export class NativeClimbContactFit {
 readonly adjustmentLimit=.65;
 rejectedFits=0;maximumAdjustment=0;
 private limbs=new Map<string,Limb>();
 private nativeRotations=new Map<Object3D,Quaternion>();private adjusted=false;
 private start=new Vector3();private joint=new Vector3();private end=new Vector3();private direction=new Vector3();private pole=new Vector3();private elbow=new Vector3();private target=new Vector3();private origin=new Vector3();private current=new Vector3();private before=new Vector3();private after=new Vector3();
 private pelvis?:Object3D;private authoredPole=new Vector3();private sourceWeight=0;private idleRotations=new WeakMap<AnimationClip,Map<Object3D,Quaternion>>();private nativePole=new Vector3();private bendCross=new Vector3();private kneeRise=0;private footRoofWeight=0;private bodyPhase:NativeClimbBodyPhase;
 private frame=new Matrix4();private long=new Vector3();private normal=new Vector3();private across=new Vector3();private nativeWorldRotation=new Quaternion();private authoredWorldRotation=new Quaternion();private tilt=new Quaternion();private rootRotation=new Quaternion();private rotation=new Quaternion();private worldRotation=new Quaternion();private parentRotation=new Quaternion();private endRotation=new Quaternion();
 constructor(private model:Object3D,private root:Object3D){
  model.updateWorldMatrix(true,true);this.pelvis=model.getObjectByName('pelvis');this.bodyPhase=new NativeClimbBodyPhase(model);
  for(const side of ['l','r'])for(const role of ['foot','hand']){
   const names=role==='foot'?['thigh','calf','foot']:['upperarm','lowerarm','hand'],nodes=names.map(name=>model.getObjectByName(`${name}_${side}`));
   if(nodes.some(node=>!node))continue;const [base,middle,end]=nodes as Object3D[];
   const a=base.getWorldPosition(new Vector3()),b=middle.getWorldPosition(new Vector3()),c=end.getWorldPosition(new Vector3());
   const ball=model.getObjectByName(`ball_${side}`),finger=model.getObjectByName(`middle_01_${side}`);
   const point=role==='hand'?c.clone().lerp(finger!.getWorldPosition(new Vector3()),.72):ball!.getWorldPosition(new Vector3());
   if(role==='foot'){model.worldToLocal(point);point.y=.007;model.localToWorld(point);}
   let bindHandContactRotation:Quaternion|undefined;
   if(role==='hand'){
    const long=finger!.getWorldPosition(new Vector3()).sub(c).normalize(),across=model.getObjectByName(`index_01_${side}`)!.getWorldPosition(new Vector3()).sub(model.getObjectByName(`pinky_01_${side}`)!.getWorldPosition(new Vector3())),normal=across.cross(long).normalize().multiplyScalar(side==='l'?-1:1);
    const nativeFrame=new Quaternion().setFromRotationMatrix(this.frame.makeBasis(this.across.crossVectors(long,normal).normalize(),long,normal));
    const sourceFrame=new Quaternion().setFromRotationMatrix(this.frame.makeBasis(this.current.set(1,0,0),this.long.set(0,-1,0),this.normal.set(0,0,-1)));
    bindHandContactRotation=sourceFrame.multiply(nativeFrame.invert()).multiply(end.getWorldQuaternion(new Quaternion()));
   }
   this.limbs.set(`${role}_${side}`,{base,middle,end,first:a.distanceTo(b),second:b.distanceTo(c),contact:end.worldToLocal(point),nativeEndRotation:new Quaternion(),bindEndRotation:end.getWorldQuaternion(new Quaternion()),bindBaseRotation:base.getWorldQuaternion(new Quaternion()),bindMiddleRotation:middle.getWorldQuaternion(new Quaternion()),bindFirstDirection:b.clone().sub(a),bindSecondDirection:c.clone().sub(b),bindHandContactRotation});
   for(const bone of [base,middle,end])this.nativeRotations.set(bone,bone.quaternion.clone());
  }
 }
 /** Restore before mixing: unchanged property tracks need not write again. */
 restore(){
  this.bodyPhase.restore();
  if(!this.adjusted)return;
  for(const [bone,rotation]of this.nativeRotations)bone.quaternion.copy(rotation);
  this.model.updateWorldMatrix(true,true);this.adjusted=false;
 }
 nativeFraction(geometry:ClimbGeometry,fraction:number,spec:ClipSpec){
  const safeFraction=Number.isFinite(fraction)?Math.max(0,Math.min(1,fraction)):0;
  const support=spec.climbSupport;if(!support||!finiteGeometry(geometry)||!Number.isFinite(fraction))return safeFraction;
  return referenceClimbFraction(geometry,fraction,ladderGeometry([0,0,0],[0,support.height,support.span],support.span));
 }
 private idleRotation(clip:AnimationClip,bone:Object3D,down:boolean){
  let cached=this.idleRotations.get(clip);if(!cached){cached=new Map();this.idleRotations.set(clip,cached);}const found=cached.get(bone);if(found)return found;
  const chain:Object3D[]=[];for(let n:Object3D|null=bone;n&&n!==this.root;n=n.parent)chain.unshift(n);
  const result=new Quaternion();for(const node of chain){const track=clip.tracks.find(t=>t.name===node.name+'.quaternion');if(track){const sample=(track as unknown as {createInterpolant():{evaluate(t:number):ArrayLike<number>}}).createInterpolant();this.rotation.fromArray(sample.evaluate(down?clip.duration:0));result.multiply(this.rotation);}else result.multiply(node.quaternion);}
  cached.set(bone,result);return result;
 }
 private rotateAuthored(bone:Object3D,direction:Vector3,rotation:Quaternion,before:Vector3,after:Vector3){
  after.normalize();bone.getWorldQuaternion(this.worldRotation);this.rotation.setFromUnitVectors(before.normalize(),after).multiply(this.worldRotation);this.nativeWorldRotation.copy(this.rotation);
  this.before.copy(direction).applyQuaternion(this.rootRotation);this.rotation.setFromUnitVectors(this.before.normalize(),after);this.worldRotation.copy(this.rootRotation).multiply(rotation);this.authoredWorldRotation.copy(this.rotation).multiply(this.worldRotation);
  this.rotation.copy(this.nativeWorldRotation).slerp(this.authoredWorldRotation,this.sourceWeight);
  bone.parent!.getWorldQuaternion(this.parentRotation);bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));bone.updateWorldMatrix(false,true);
 }
 private solve(limb:Limb){
  const {base,middle,end,first:a,second:b}=limb;
  base.getWorldPosition(this.start);middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);this.endRotation.copy(limb.nativeEndRotation);
  const distance=Math.min(a+b-.0005,Math.max(Math.abs(a-b)+.0005,this.direction.subVectors(this.target,this.start).length()));this.direction.normalize();
  this.nativePole.subVectors(this.joint,this.start).addScaledVector(this.direction,-this.nativePole.subVectors(this.joint,this.start).dot(this.direction));
  if(this.pelvis){
   const sign=base.name.endsWith('_l')?1:-1;
   this.pelvis.getWorldPosition(this.authoredPole);this.root.worldToLocal(this.authoredPole);
   if(base.name.startsWith('upperarm_'))this.current.set(sign*.40,.35,.18);
   else {const crest=this.kneeRise/.70,forward=(-.35*this.footRoofWeight+.30*(1-this.footRoofWeight))*crest-.35*(1-crest);this.current.set(sign*(.10+.15*crest),-.25+crest,-forward);}
   this.authoredPole.add(this.current);this.root.localToWorld(this.authoredPole);this.pole.subVectors(this.authoredPole,this.start);
  }else this.pole.subVectors(this.joint,this.start);
  if(this.sourceWeight===0)this.pole.copy(this.nativePole);
  this.pole.addScaledVector(this.direction,-this.pole.dot(this.direction));
  if(this.pole.lengthSq()<1e-7)this.pole.set(1,0,0).addScaledVector(this.direction,-this.direction.x);
  if(this.pole.lengthSq()<1e-7)this.pole.set(0,0,1).addScaledVector(this.direction,-this.direction.z);this.pole.normalize();
  if(this.sourceWeight<1&&this.nativePole.lengthSq()>1e-7){
   this.nativePole.normalize();const angle=Math.atan2(this.direction.dot(this.bendCross.crossVectors(this.nativePole,this.pole)),this.nativePole.dot(this.pole));this.pole.copy(this.nativePole).applyAxisAngle(this.direction,angle*this.sourceWeight);
  }
  const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
  this.elbow.copy(this.start).addScaledVector(this.direction,along).addScaledVector(this.pole,rise);
  this.rotateAuthored(base,limb.bindFirstDirection,limb.bindBaseRotation,this.before.subVectors(this.joint,this.start),this.after.subVectors(this.elbow,this.start));
  middle.getWorldPosition(this.joint);end.getWorldPosition(this.end);
  this.rotateAuthored(middle,limb.bindSecondDirection,limb.bindMiddleRotation,this.before.subVectors(this.end,this.joint),this.after.subVectors(this.target,this.joint));
  end.parent!.getWorldQuaternion(this.parentRotation);end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));end.updateWorldMatrix(false,true);
 }
 apply(geometry:ClimbGeometry,fraction:number,spec:ClipSpec,clip?:AnimationClip,blendWeight=1){
  this.rejectedFits=0;this.maximumAdjustment=0;
  const support=spec.climbSupport;if(!support||!finiteGeometry(geometry)||!Number.isFinite(fraction)||/stair/.test(geometry.kind??''))return;
  if(Math.abs(geometry.height-support.height)<.001&&Math.abs(geometry.span-support.span)<.001)return;
  for(const [bone,rotation]of this.nativeRotations)rotation.copy(bone.quaternion);this.adjusted=true;
  const actual=sampleLadderClimb({...geometry,halfWidth:.23,rungRadius:.026},fraction,support.feetRest),reference=sampleLadderClimb(ladderGeometry([0,0,0],[0,support.height,support.span],support.span),this.nativeFraction(geometry,fraction,spec),support.feetRest);
  this.root.updateWorldMatrix(true,true);
  for(const limb of this.limbs.values())limb.end.getWorldQuaternion(limb.nativeEndRotation);
  this.kneeRise=actual.kneeRise;
  const endFade=.76-.32/(geometry.steps-2),sourceClip=geometry.steps>2&&clip?.name===spec.name&&this.bodyPhase.supports(clip);
  this.sourceWeight=sourceClip?phase(fraction,.02,.12)*(1-phase(fraction,endFade,.76)):0;
  if(sourceClip)this.bodyPhase.apply(clip,fraction,this.nativeFraction(geometry,fraction,spec),spec.name==='life.climbDown',blendWeight*this.sourceWeight);
  this.root.getWorldQuaternion(this.rootRotation);
  const contactWeight=sourceClip?phase(fraction,.12,.12+.32/(geometry.steps-2))*(1-phase(fraction,endFade,.76)):0;
  // Enter the exact source contact frame smoothly after approach. Return to
  // the original native crest before .76; the separate even-rung defect stays
  // unchanged until its own physical contact-plan correction.
  if(clip&&contactWeight>0)for(const side of ['l','r']){
   const foot=this.limbs.get(`foot_${side}`),contact=actual.feet[side];
   if(foot){this.tilt.setFromAxisAngle(this.current.set(1,0,0),-contact.tilt*Math.PI/180);this.authoredWorldRotation.copy(this.tilt).multiply(foot.bindEndRotation).slerp(this.idleRotation(clip,foot.end,spec.name==='life.climbDown'),contact.restWeight);this.authoredWorldRotation.premultiply(this.rootRotation);foot.nativeEndRotation.slerp(this.authoredWorldRotation,contactWeight);}
   const hand=this.limbs.get(`hand_${side}`);if(hand?.bindHandContactRotation&&actual.hands[side].weight>=.999){this.authoredWorldRotation.copy(this.rootRotation).multiply(hand.bindHandContactRotation);hand.nativeEndRotation.slerp(this.authoredWorldRotation,contactWeight);}
  }

  for(const side of ['l','r'])for(const role of ['foot','hand']){
   const limb=this.limbs.get(`${role}_${side}`);if(!limb)continue;
   this.footRoofWeight=actual.feet[side].roofWeight;
   const desired=role==='foot'?actual.feet[side]:actual.hands[side],native=role==='foot'?reference.feet[side]:reference.hands[side],weight=role==='hand'?actual.hands[side].weight:1;
   this.target.fromArray(desired.position).sub(this.origin.set(0,actual.root.height,actual.root.forward));
   if(role==='hand'&&weight<.999){
    this.before.fromArray(native.position).sub(this.origin.set(0,reference.root.height,reference.root.forward));
    this.target.sub(this.before).multiplyScalar(weight);this.current.copy(limb.contact);limb.end.localToWorld(this.current);this.root.worldToLocal(this.current);this.target.add(this.current);
   }
   this.root.localToWorld(this.target);this.endRotation.copy(limb.nativeEndRotation);this.current.copy(limb.contact).applyQuaternion(this.endRotation);this.target.sub(this.current);
   limb.end.getWorldPosition(this.current);
   const adjustment=this.target.distanceTo(this.current);
   if(!Number.isFinite(adjustment)){this.rejectedFits++;continue;}
   this.maximumAdjustment=Math.max(this.maximumAdjustment,adjustment);
   // A different rung count can select a lower native palm while the
   // actual rung trajectory remains inside this arm's unchanged reach.
   // Keep the displacement fallback for feet and fading hands.
   let reachableRungHand=false;
   if(role==='hand'&&weight>=.999&&Number.isFinite(adjustment)){
    limb.base.getWorldPosition(this.start);const reach=this.target.distanceTo(this.start);
    reachableRungHand=Number.isFinite(reach)&&reach>=Math.abs(limb.first-limb.second)+.0005&&reach<=limb.first+limb.second-.0005;
   }
   if(adjustment>this.adjustmentLimit&&!reachableRungHand){this.rejectedFits++;continue;}
   this.solve(limb);
  }
  if(this.rejectedFits===this.limbs.size){this.bodyPhase.restore();this.model.updateWorldMatrix(true,true);}
 }
}
