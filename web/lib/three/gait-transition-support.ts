import {Object3D,SkinnedMesh,Quaternion,Vector3,AnimationMixer,AnimationClip,AnimationAction,LoopRepeat,Group,Matrix4} from 'three';
type Influence={bone:Object3D;point:Vector3;weight:number};
type GaitClip={name:string;gesture?:string;locomotionSpeed?:number;nativeStrideSpeed?:number;playbackRate?:number}&{posture?:string;nativeSidewaysSupport?:{floor?:number;supportWindows?:Record<string,number[]>;heelRoll?:Record<string,number>}};
type Goal={p:Vector3;q:Quaternion;knee?:Vector3;height?:number};
type Plan={started:number;firstTime:number;secondTime:number;endTime:number;firstSide:string;initial:Map<string,Goal>;first:Map<string,Goal>;final:Map<string,Goal>;floor:number;moving:boolean;crouched:boolean;roll:Record<string,number>};
// Cache only an immutable source pose, never an actor world target or an IK result.
const sourceForecasts=new WeakMap<object,WeakMap<object,WeakMap<AnimationClip,Map<number,Map<string,Goal>>>>>();
type Leg={thigh:Object3D;calf:Object3D;foot:Object3D;first:number;second:number;surface:Influence[][];target:Vector3;toe:Vector3};
/** A native source loop can be supported while its quaternion crossfade is
 * not. Correct only the bounded idle/side-step blend, using the complete
 * actual footwear and native joint lengths. The actor wrapper is fixed.
 * Native Root Y may settle at most 50 mm for reach; upper transforms and
 * sockets retain their native local pose and ride with that temporary settle.
 * Restore the previous native values before the mixer, including held phases. */
export class NativeGaitTransitionSupport{
 maximumAdjustment=0;maximumBodyDrop=0;rejectedFits=0;maximumReachError=0;
 private forecasts?:WeakMap<AnimationClip,Map<number,Map<string,Goal>>>;
 private body:Object3D;private bodyPosition=new Vector3();private nativeBodyPosition=new Vector3();
 private legs:Leg[]=[];private native=new Map<Object3D,Quaternion>();private adjusted=false;private supportSide='';private pending?:{spec:GaitClip;clip:AnimationClip;moving:boolean;initial:Map<string,Goal>};private plan?:Plan;private lastRoot=new Matrix4();private hasFrame=false;private previewRoot=new Group();private preview:Object3D;private previewMixer:AnimationMixer;private previewBones=new Map<string,Object3D>();private previewClip?:AnimationClip;private previewAction?:AnimationAction;
 private initial=new Vector3();private point=new Vector3();private scratch=new Vector3();private start=new Vector3();private joint=new Vector3();private end=new Vector3();private target=new Vector3();private direction=new Vector3();private pole=new Vector3();private knee=new Vector3();private before=new Vector3();private after=new Vector3();private rootPoint=new Vector3();
 private rotation=new Quaternion();private worldRotation=new Quaternion();private parentRotation=new Quaternion();private footRotation=new Quaternion();
 constructor(private model:Object3D,private root:Object3D,footwearName?:string){
  const containsBone=(node:Object3D):boolean=>(node as any).isBone||node.children.some(containsBone),copy=(node:Object3D):Object3D=>{const clone=node.clone(false);for(const child of node.children)if(containsBone(child))clone.add(copy(child));return clone;};
  this.preview=copy(model);this.previewRoot.add(this.preview);this.preview.traverse(node=>this.previewBones.set(node.name,node));this.previewMixer=new AnimationMixer(this.preview);
  this.body=model.getObjectByName('Root')!;model.updateWorldMatrix(true,true);const mesh=footwearName&&model.getObjectByName(footwearName);
  if(!(mesh instanceof SkinnedMesh)||mesh.bindMode!=='attached'||mesh.geometry.morphAttributes.position?.length)return;
  let bindings=sourceForecasts.get(mesh.geometry);if(!bindings)sourceForecasts.set(mesh.geometry,bindings=new WeakMap());this.forecasts=bindings.get(mesh.skeleton.boneInverses);if(!this.forecasts)bindings.set(mesh.skeleton.boneInverses,this.forecasts=new WeakMap());
  const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(const side of ['l','r']){
   const nodes=['thigh','calf','foot'].map(name=>model.getObjectByName(name+'_'+side));if(nodes.some(node=>!node))continue;const [thigh,calf,foot]=nodes as Object3D[],surface:Influence[][]=[],seen=new Set<string>();
   for(let i=0;i<p.count;i++){
    if((p.getX(i)>0)!==(side==='l'))continue;
    // Duplicate face vertices have identical bind coordinates and weights.
    // Deduplicate exact signatures; every distinct complete boot point remains.
    const signature=[p.getX(i),p.getY(i),p.getZ(i),...Array.from({length:4},(_,slot)=>[indices.getComponent(i,slot),weights.getComponent(i,slot)]).flat()].join(',');if(seen.has(signature))continue;seen.add(signature);
    const position=new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix),influences:Influence[]=[];
    for(let slot=0;slot<4;slot++){const weight=weights.getComponent(i,slot);if(weight>0){const bone=indices.getComponent(i,slot);influences.push({bone:mesh.skeleton.bones[bone],point:position.clone().applyMatrix4(mesh.skeleton.boneInverses[bone]),weight});}}
    surface.push(influences);
   }
   const candidates=Array.from({length:p.count},(_,i)=>i).filter(i=>(p.getX(i)>0)===(side==='l')),low=Math.min(...candidates.map(i=>p.getY(i))),ring=candidates.filter(i=>p.getY(i)<low+.003),front=Math.min(...ring.map(i=>p.getZ(i))),toes=ring.filter(i=>p.getZ(i)<front+.001);const toe=new Vector3();for(const i of toes)toe.add(new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));toe.divideScalar(toes.length);foot.worldToLocal(toe);
   const first=thigh.getWorldPosition(new Vector3()).distanceTo(calf.getWorldPosition(new Vector3())),second=calf.getWorldPosition(new Vector3()).distanceTo(foot.getWorldPosition(new Vector3()));
   this.legs.push({thigh,calf,foot,first,second,surface,target:new Vector3(),toe});for(const bone of nodes as Object3D[])this.native.set(bone,bone.quaternion.clone());
  }
 }
 private capture(){
  this.root.updateWorldMatrix(true,true);const result=new Map<string,Goal>();for(const leg of this.legs)result.set(leg.foot.name.slice(-1),{p:leg.foot.getWorldPosition(new Vector3()),q:leg.foot.getWorldQuaternion(new Quaternion()),height:undefined,knee:leg.calf.getWorldPosition(new Vector3())});return result;
 }
 begin(previous:GaitClip|undefined,next:GaitClip,_time:number,clip:AnimationClip){
  this.pending=undefined;this.plan=undefined;
  if(!previous||this.legs.length!==2||previous.posture!==next.posture||!['standing','crouched'].includes(next.posture??''))return;
  const idle=(s:GaitClip)=>s.gesture==='idle',sideways=(s:GaitClip)=>['strafeLeft','strafeRight'].includes(s.gesture??'')&&Boolean(s.nativeSidewaysSupport);
  if(!(idle(previous)&&sideways(next)||sideways(previous)&&idle(next)))return;
  const initial=this.capture(),current=this.root.matrixWorld.clone(),delta=this.hasFrame?this.lastRoot.clone().multiply(current.clone().invert()):new Matrix4(),rotation=new Quaternion().setFromRotationMatrix(delta);for(const leg of this.legs){const goal=initial.get(leg.foot.name.slice(-1))!;goal.p.applyMatrix4(delta);goal.knee?.applyMatrix4(delta);goal.q.premultiply(rotation);goal.height=this.lowest(leg)+delta.elements[13];}this.pending={spec:next,clip,moving:sideways(next),initial};
 }
 private forecast(clip:AnimationClip,phase:number,delta:Vector3){
  const localPhase=((phase%clip.duration)+clip.duration)%clip.duration;
  const origin=this.root.getWorldPosition(new Vector3()),rotation=this.root.getWorldQuaternion(new Quaternion()),scale=this.root.getWorldScale(new Vector3());
  const rigidYaw=Math.abs(rotation.x)<1e-8&&Math.abs(rotation.z)<1e-8&&scale.distanceTo(new Vector3(1,1,1))<1e-8;
  let cache=rigidYaw?this.forecasts?.get(clip):undefined;if(rigidYaw&&!cache)this.forecasts?.set(clip,cache=new Map());
  let local=cache?.get(localPhase);
  if(!local){
   if(this.previewClip!==clip){this.previewMixer.stopAllAction();this.previewMixer.uncacheRoot(this.preview);this.previewClip=clip;this.previewAction=this.previewMixer.clipAction(clip).reset().setLoop(LoopRepeat,Infinity).play();}
   const action=this.previewAction!;action.enabled=true;action.paused=false;action.time=localPhase;action.timeScale=0;this.previewMixer.update(0);
   this.previewRoot.position.copy(rigidYaw?new Vector3():origin.clone().add(delta));this.previewRoot.quaternion.copy(rigidYaw?new Quaternion():rotation);this.previewRoot.updateWorldMatrix(true,true);
   local=new Map(this.legs.map(leg=>{const foot=this.previewBones.get(leg.foot.name)!;return [leg.foot.name.slice(-1),{p:foot.getWorldPosition(new Vector3()),q:foot.getWorldQuaternion(new Quaternion()),height:this.lowest(leg,true),knee:this.previewBones.get(leg.calf.name)!.getWorldPosition(new Vector3())}] as [string,Goal];}));
   if(cache){if(cache.size>=24)cache.delete(cache.keys().next().value!);cache.set(localPhase,local);}
  }
  if(!rigidYaw)return local;
  return new Map([...local].map(([side,goal])=>[side,{p:goal.p.clone().applyQuaternion(rotation).add(origin).add(delta),q:rotation.clone().multiply(goal.q),height:goal.height!+origin.y+delta.y,knee:goal.knee!.clone().applyQuaternion(rotation).add(origin).add(delta)}]));
 }
 private startPlan(time:number,phase:number,speed:number){
  const pending=this.pending!;this.pending=undefined;let firstTime=.3,secondTime=.6,firstSide='';const velocity=new Vector3();
  if(pending.moving){
   const stride=pending.spec.nativeStrideSpeed??pending.spec.locomotionSpeed,rate=stride&&stride>0?speed/stride:0;if(!(rate>0)){this.rejectedFits++;return;}
   const boundaries=[] as {time:number;side:string}[];
   for(const [side,range]of Object.entries(pending.spec.nativeSidewaysSupport?.supportWindows??{}))for(let turn=-2;turn<5;turn++){const at=(range[0]+turn*.5)*pending.clip.duration,wall=(at-phase)/rate;if(wall>=.15)boundaries.push({time:wall,side});}
   boundaries.sort((a,b)=>a.time-b.time);const first=boundaries[0],second=boundaries.find(b=>b.side!==first?.side&&b.time>first.time+.05);if(!first||!second||second.time>1.1){this.rejectedFits++;return;}
   firstTime=pending.spec.posture==='standing'?Math.min(first.time,.26):first.time;secondTime=second.time;firstSide=first.side;velocity.set(pending.spec.gesture==='strafeLeft'?speed:-speed,0,0).applyQuaternion(this.root.getWorldQuaternion(this.worldRotation));
   const final=this.forecast(pending.clip,phase+rate*secondTime,velocity.clone().multiplyScalar(secondTime));
   this.plan={started:time,firstTime,secondTime,endTime:secondTime,firstSide,initial:pending.initial,first:final,final,moving:true,crouched:pending.spec.posture==='crouched',roll:pending.spec.posture==='standing'?pending.spec.nativeSidewaysSupport?.heelRoll??{}:{},floor:this.root.getWorldPosition(this.rootPoint).y};
  }else{
   this.root.updateWorldMatrix(true,true);const planted=[...pending.initial.entries()].reduce((a,b)=>(a[1].height??Infinity)<(b[1].height??Infinity)?a:b)[0];firstSide=planted==='l'?'r':'l';const rate=pending.spec.playbackRate??1;
   const floor=this.root.getWorldPosition(this.rootPoint).y,endTime=.8,first=this.forecast(pending.clip,phase+rate*firstTime,velocity);const landing=first.get(firstSide)!;landing.p.y+=floor+.002-landing.height!;this.plan={started:time,firstTime,secondTime,endTime,firstSide,initial:pending.initial,moving:false,crouched:pending.spec.posture==='crouched',roll:{},first,final:this.forecast(pending.clip,phase+rate*endTime,velocity),floor};
  }
 }
 private planted(initial:Goal,side:string,fraction:number){
  const leg=this.legs.find(leg=>leg.foot.name.endsWith(side))!,plan=this.plan!;
  if(!plan.moving)return initial;
  const u=Math.max(0,Math.min(1,fraction)),weight=u*u*(3-2*u),forward=leg.toe.clone().applyQuaternion(initial.q);forward.y=0;forward.normalize();const axis=new Vector3(0,1,0).cross(forward).normalize(),q=new Quaternion().setFromAxisAngle(axis,(plan.roll[side]??0)*weight).multiply(initial.q),anchor=leg.toe.clone().applyQuaternion(initial.q).add(initial.p),p=anchor.sub(leg.toe.clone().applyQuaternion(q));return {p,q};
 }
 private rawGoal(side:string,elapsed:number):Goal{
  const plan=this.plan!,initial=plan.initial.get(side)!,first=plan.first.get(side)!,final=plan.final.get(side)!,move=side===plan.firstSide;
  const mix=(a:Goal,b:Goal,t:number,lift:number)=>{const u=Math.max(0,Math.min(1,t)),weight=u*u*(3-2*u),p=a.p.clone().lerp(b.p,weight),q=a.q.clone().slerp(b.q,weight);p.y+=lift*Math.sin(Math.PI*u)**2;return {p,q};};
  if(elapsed<=plan.firstTime){this.supportSide=move?(side==='l'?'r':'l'):side;return move?mix(initial,first,elapsed/plan.firstTime,.08):this.planted(initial,side,elapsed/plan.firstTime);}
  if(!plan.moving&&elapsed>plan.secondTime){this.supportSide=plan.firstSide==='l'?'r':'l';return move?mix(first,final,(elapsed-plan.secondTime)/(plan.endTime-plan.secondTime),0):final;}this.supportSide=plan.firstSide;return move?first:mix(this.planted(initial,side,1),final,(elapsed-plan.firstTime)/(plan.secondTime-plan.firstTime),.08);
 }
 private goal(side:string,elapsed:number){const result={...this.rawGoal(side,elapsed)},plan=this.plan!,initial=plan.initial.get(side)!,final=plan.final.get(side)!,u=Math.max(0,Math.min(1,elapsed/plan.endTime));result.knee=initial.knee!.clone().lerp(final.knee!,u*u*(3-2*u));return result;}
 private recordFrame(){this.root.updateWorldMatrix(true,false);this.lastRoot.copy(this.root.matrixWorld);this.hasFrame=true;}
 restore(){if(!this.adjusted)return;for(const [bone,q]of this.native)bone.quaternion.copy(q);this.body.position.copy(this.nativeBodyPosition);this.model.updateWorldMatrix(true,true);this.adjusted=false;}
 private lowest(leg:Leg,preview=false){let height=Infinity;for(const influences of leg.surface){this.point.set(0,0,0);for(const influence of influences)this.point.addScaledVector(this.scratch.copy(influence.point).applyMatrix4((preview?this.previewBones.get(influence.bone.name)!:influence.bone).matrixWorld),influence.weight);height=Math.min(height,this.point.y);}return height;}
 private rotateToward(bone:Object3D,before:Vector3,after:Vector3){
  this.rotation.setFromUnitVectors(before.normalize(),after.normalize());bone.getWorldQuaternion(this.worldRotation);this.rotation.multiply(this.worldRotation);bone.parent!.getWorldQuaternion(this.parentRotation);bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));bone.updateWorldMatrix(false,true);
 }
 private solve(leg:Leg,goal:Goal){
  const {thigh,calf,foot,first:a,second:b}=leg;thigh.getWorldPosition(this.start);calf.getWorldPosition(this.joint);foot.getWorldPosition(this.end);
  const distance=this.direction.subVectors(this.target,this.start).length();this.maximumReachError=Math.max(this.maximumReachError,Math.max(0,distance-(a+b-.0004),Math.abs(a-b)+.0004-distance));
  if(distance>=a+b-.0004||distance<=Math.abs(a-b)+.0004){this.rejectedFits++;return false;}this.direction.normalize();
  this.pole.subVectors(goal.knee??this.joint,this.start);this.pole.addScaledVector(this.direction,-this.pole.dot(this.direction));
  if(this.pole.lengthSq()<1e-8){this.rejectedFits++;return false;}this.pole.normalize();const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));
  this.knee.copy(this.start).addScaledVector(this.direction,along).addScaledVector(this.pole,rise);
  this.rotateToward(thigh,this.before.subVectors(this.joint,this.start),this.after.subVectors(this.knee,this.start));calf.getWorldPosition(this.joint);foot.getWorldPosition(this.end);
  this.rotateToward(calf,this.before.subVectors(this.end,this.joint),this.after.subVectors(this.target,this.joint));foot.parent!.getWorldQuaternion(this.parentRotation);foot.quaternion.copy(this.parentRotation.invert().multiply(this.footRotation));foot.updateWorldMatrix(false,true);return true;
 }
 apply(time:number,phase:number,speed:number){
  this.maximumAdjustment=0;this.maximumBodyDrop=0;this.rejectedFits=0;this.maximumReachError=0;
  if(this.pending)this.startPlan(time,phase,speed);
  const plan=this.plan;if(!plan){this.recordFrame();return;}const elapsed=time-plan.started;
  if(elapsed>=plan.endTime||Math.abs(this.root.getWorldPosition(this.rootPoint).y-plan.floor)>.002){this.plan=undefined;this.recordFrame();return;}
  this.root.updateWorldMatrix(true,true);for(const [bone,q]of this.native)q.copy(bone.quaternion);this.nativeBodyPosition.copy(this.body.position);this.adjusted=true;
  let drop=0;const goals=new Map<string,Goal>();
  for(const leg of this.legs){
   const goal=this.goal(leg.foot.name.slice(-1),elapsed);goals.set(leg.foot.name,goal);leg.target.copy(goal.p);leg.thigh.getWorldPosition(this.start);const dx=this.start.x-leg.target.x,dz=this.start.z-leg.target.z,reach=leg.first+leg.second-.0006;
   if(dx*dx+dz*dz>=reach*reach){this.rejectedFits++;this.restore();this.plan=undefined;this.recordFrame();return;}
   drop=Math.max(drop,this.start.y-leg.target.y-Math.sqrt(reach*reach-dx*dx-dz*dz));
  }
  if(plan.moving&&plan.roll){const at=elapsed<=plan.firstTime?elapsed/plan.firstTime:Math.max(0,1-(elapsed-plan.firstTime)/.25),curve=elapsed<=plan.firstTime?Math.sin(Math.PI*.5*Math.min(1,at))**2:Math.sin(Math.PI*.5*at)**2;const smooth=Object.keys(plan.roll).length?.05*curve:0;if(drop>smooth+.0001){this.rejectedFits++;this.restore();this.plan=undefined;this.recordFrame();return;}drop=smooth;}if(drop>.05){this.rejectedFits++;this.restore();this.plan=undefined;this.recordFrame();return;}this.maximumBodyDrop=Math.max(0,drop);
  if(drop>0){this.body.getWorldPosition(this.bodyPosition);this.bodyPosition.y-=drop;this.body.parent!.worldToLocal(this.bodyPosition);this.body.position.copy(this.bodyPosition);this.body.updateWorldMatrix(false,true);}
  for(const leg of this.legs){
   const goal=goals.get(leg.foot.name)!;this.target.copy(goal.p);this.footRotation.copy(goal.q);const adjustment=this.target.distanceTo(leg.foot.getWorldPosition(this.initial));this.maximumAdjustment=Math.max(this.maximumAdjustment,adjustment);
   if(adjustment>.65||!this.solve(leg,goal)){this.rejectedFits++;this.restore();this.plan=undefined;break;}
  }
  this.recordFrame();
 }
 dispose(){this.restore();this.previewMixer.stopAllAction();this.previewMixer.uncacheRoot(this.preview);}
}
