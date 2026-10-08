import {Object3D,SkinnedMesh,Quaternion,Vector3,AnimationClip,AnimationMixer,AnimationAction,LoopRepeat,Matrix4} from 'three';
type Spec={name:string;nativeBootSupport?:{surface?:string}};
type Influence={bone:Object3D;x:number;y:number;z:number;weight:number};
type Leg={thigh:Object3D;calf:Object3D;foot:Object3D;ball:Object3D;first:number;second:number;surface:Influence[][];toe:Vector3;normal:Vector3;forward:Vector3};
type Goal={p:Vector3;q:Quaternion;ball:Quaternion;toe:Vector3;low?:number;contactToe?:Vector3;bend?:Vector3};
type ContactPlan={started:number;entry:boolean;initial:Goal[];clip:AnimationClip;floor:number;world:Matrix4;last?:Goal[];landing?:Goal[];first?:number;returnDuration?:number;step?:boolean;resumedStep?:boolean};
// Cache immutable native endpoints by exact geometry, binding, clip and phase.
// Actor world targets and fitted poses never enter this shared source cache.
const endpointCache=new WeakMap<object,WeakMap<object,WeakMap<AnimationClip,Map<number,Goal[]>>>>();
const smooth=(u:number)=>{u=Math.max(0,Math.min(1,u));return u*u*u*(10+u*(-15+6*u));};
const gestures=new Set(['stand.gesture.heal','stand.gesture.pickup','stand.gesture.free']);
const guards=new Set(['stand.idle.unarmed','stand.idle.long-gun','stand.idle.short-gun','stand.idle.blade','stand.idle.knife','stand.idle.lance','stand.aim.long-gun','stand.aim.short-gun','stand.brace.long-gun']);
const finite=(p:Vector3)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);

/** Fit only ordinary standing guard/reach gestures. Contact targets use
 * quintic easing; the complete pose still retains the source body/mixer
 * motion. Root, pelvis, wrapper and paid clocks keep their native channels. */
export class NativeGestureBlendSupport {
 // Native playback needs 6.61 mm; the retained 300 ms paid phases with a
 // late first frame need 51.37 mm. Admit a measured 60 mm local correction.
 // Deeper unsupported poses keep native playback and cancel this fit.
 readonly adjustmentLimit=.06;
 // A planted forefoot needs up to 125 mm of leg-only stance adaptation.
 // The small heel roll keeps the real ankle within native leg reach.
 // A mirrored-hand return needs 194 mm while the unchanged mixer
 // reaches the opposite stance; admit 200 mm only during the two steps.
 readonly contactAdjustmentLimit=.13;readonly stepAdjustmentLimit=.20;readonly contactRollLimit=.07;
 maximumAdjustment=0;maximumReachError=0;rejectedFits=0;processedVertices=0;maximumContactError=0;maximumHeelRoll=0;
 private hasFrame=false;private plan?:ContactPlan;private forecasts?:WeakMap<AnimationClip,Map<number,Goal[]>>;private preview?:Object3D;private previewMixer?:AnimationMixer;private previewAction?:AnimationAction;private previewClip?:AnimationClip;private previewBones=new Map<string,Object3D>();
 private until=-Infinity;private began=-Infinity;private adjusted=false;private legs:Leg[]=[];private native=new Map<Object3D,Quaternion>();
 private start=new Vector3();private joint=new Vector3();private end=new Vector3();private target=new Vector3();private direction=new Vector3();private pole=new Vector3();private knee=new Vector3();private before=new Vector3();private after=new Vector3();private rootPoint=new Vector3();private scale=new Vector3();
 private rotation=new Quaternion();private worldRotation=new Quaternion();private parentRotation=new Quaternion();private footRotation=new Quaternion();private ballRotation=new Quaternion();
 constructor(private model:Object3D,private root:Object3D,footwearName?:string){
  const mesh=footwearName?model.getObjectByName(footwearName):undefined;
  if(!(mesh instanceof SkinnedMesh)||mesh.bindMode!=='attached'||mesh.geometry.morphAttributes.position?.length)return;
  model.updateWorldMatrix(true,true);const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  if(!p||!indices||!weights||p.itemSize<3||indices.itemSize<4||weights.itemSize<4||indices.count!==p.count||weights.count!==p.count)return;
  for(const side of ['l','r']){
   const nodes=['thigh','calf','foot','ball'].map(role=>model.getObjectByName(role+'_'+side));if(nodes.some(node=>!node))return;
   const [thigh,calf,foot,ball]=nodes as Object3D[],surface:Influence[][]=[],seen=new Set<string>();
   for(let i=0;i<p.count;i++){
    if((p.getX(i)>0)!==(side==='l'))continue;
    const signature=[p.getX(i),p.getY(i),p.getZ(i),...Array.from({length:4},(_,slot)=>[indices.getComponent(i,slot),weights.getComponent(i,slot)]).flat()].join(',');if(seen.has(signature))continue;seen.add(signature);
    const position=new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix),influences:Influence[]=[];let total=0;
    for(let slot=0;slot<4;slot++){
     const weight=weights.getComponent(i,slot);if(weight<=0)continue;const index=indices.getComponent(i,slot),bone=mesh.skeleton.bones[index],inverse=mesh.skeleton.boneInverses[index];if(!bone||!inverse||!Number.isFinite(weight))return;
     const point=position.clone().applyMatrix4(inverse);if(!finite(point))return;influences.push({bone,x:point.x,y:point.y,z:point.z,weight});total+=weight;
    }
    if(!influences.length||Math.abs(total-1)>1e-5)return;surface.push(influences);
   }
   const first=thigh.getWorldPosition(new Vector3()).distanceTo(calf.getWorldPosition(new Vector3())),second=calf.getWorldPosition(new Vector3()).distanceTo(foot.getWorldPosition(new Vector3()));
   if(!Number.isFinite(first+second)||first<=0||second<=0||!surface.length)return;
   const sole=Array.from({length:p.count},(_,i)=>i).filter(i=>(p.getX(i)>0)===(side==='l'));
   const minimum=Math.min(...sole.map(i=>p.getY(i))),ring=sole.filter(i=>p.getY(i)<minimum+.003),front=Math.max(...ring.map(i=>p.getZ(i))),back=Math.min(...ring.map(i=>p.getZ(i)));
   const inverse=mesh.skeleton.boneInverses[mesh.skeleton.bones.findIndex(bone=>bone===foot)];if(!inverse||ring.length<40)return;
   const nativePoint=(i:number)=>new Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse),toe=new Vector3(),heel=new Vector3();let toes=0,heels=0;
   for(const i of ring){for(let slot=0;slot<4;slot++)if(weights.getComponent(i,slot)>1e-6&&(mesh.skeleton.bones[indices.getComponent(i,slot)]!==foot||Math.abs(weights.getComponent(i,slot)-1)>1e-6))return;
    if(p.getZ(i)>front-.001){toe.add(nativePoint(i));toes++;}if(p.getZ(i)<back+.001){heel.add(nativePoint(i));heels++;}}
   if(!toes||!heels)return;toe.divideScalar(toes);heel.divideScalar(heels);
   const normal=new Vector3(0,1,0).transformDirection(mesh.bindMatrix).transformDirection(inverse),forward=toe.clone().sub(heel).normalize();
   this.legs.push({thigh,calf,foot,ball,first,second,surface,toe,normal,forward});for(const bone of nodes as Object3D[])this.native.set(bone,bone.quaternion.clone());
  }
  if(this.legs.length!==2)return;
  let binding=endpointCache.get(mesh.geometry);if(!binding)endpointCache.set(mesh.geometry,binding=new WeakMap());this.forecasts=binding.get(mesh.skeleton.boneInverses);if(!this.forecasts)binding.set(mesh.skeleton.boneInverses,this.forecasts=new WeakMap());
  const contains=(node:Object3D):boolean=>(node as any).isBone||node.children.some(contains),copy=(node:Object3D):Object3D=>{const result=node.clone(false);for(const child of node.children)if(contains(child))result.add(copy(child));return result;};
  this.preview=copy(model);this.preview.traverse(node=>this.previewBones.set(node.name,node));this.previewMixer=new AnimationMixer(this.preview);
 }
 private capture(){return this.legs.map(leg=>{const p=leg.foot.getWorldPosition(new Vector3()),q=leg.foot.getWorldQuaternion(new Quaternion()),hip=leg.thigh.getWorldPosition(new Vector3()),direction=p.clone().sub(hip).normalize(),bend=leg.calf.getWorldPosition(new Vector3()).sub(hip);bend.addScaledVector(direction,-bend.dot(direction)).normalize();return {p,q,bend,ball:leg.ball.getWorldQuaternion(new Quaternion()),toe:leg.toe.clone().applyMatrix4(leg.foot.matrixWorld)};});}
 private forecast(clip:AnimationClip,phase:number):Goal[]|undefined{
  if(!this.preview||!this.previewMixer||!Number.isFinite(phase)||!(clip.duration>0))return;
  const at=((phase%clip.duration)+clip.duration)%clip.duration;let cache=this.forecasts?.get(clip);if(!cache)this.forecasts?.set(clip,cache=new Map());let local=cache?.get(at);
  if(!local){if(this.previewClip!==clip){this.previewMixer.stopAllAction();this.previewMixer.uncacheRoot(this.preview);this.previewClip=clip;this.previewAction=this.previewMixer.clipAction(clip).reset().setLoop(LoopRepeat,Infinity).play();}
   const action=this.previewAction!;action.enabled=true;action.paused=false;action.time=at;action.timeScale=0;this.previewMixer.update(0);this.preview.updateWorldMatrix(true,true);
   local=this.legs.map(leg=>{const foot=this.previewBones.get(leg.foot.name)!,p=foot.getWorldPosition(new Vector3()),q=foot.getWorldQuaternion(new Quaternion());let low=Infinity;for(const vertex of leg.surface){let y=0;for(const point of vertex){const m=this.previewBones.get(point.bone.name)!.matrixWorld.elements;y+=(m[1]*point.x+m[5]*point.y+m[9]*point.z+m[13])*point.weight;}low=Math.min(low,y);}return {p,q,ball:this.previewBones.get(leg.ball.name)!.getWorldQuaternion(new Quaternion()),bend:(()=>{const hip=this.previewBones.get(leg.thigh.name)!.getWorldPosition(new Vector3()),direction=p.clone().sub(hip).normalize(),bend=this.previewBones.get(leg.calf.name)!.getWorldPosition(new Vector3()).sub(hip);return bend.addScaledVector(direction,-bend.dot(direction)).normalize();})(),toe:leg.toe.clone().applyQuaternion(q).add(p),contactToe:leg.toe.clone().applyMatrix4(foot.matrixWorld),low};});
   if(cache){if(cache.size>=24)cache.delete(cache.keys().next().value!);cache.set(at,local);}
  }
  const origin=this.root.getWorldPosition(new Vector3()),rotation=this.root.getWorldQuaternion(new Quaternion());
  return local.map(goal=>({p:goal.p.clone().applyQuaternion(rotation).add(origin),q:rotation.clone().multiply(goal.q),ball:rotation.clone().multiply(goal.ball),toe:goal.toe.clone().applyQuaternion(rotation).add(origin),low:goal.low===undefined?undefined:goal.low+origin.y,contactToe:goal.contactToe?.clone().applyQuaternion(rotation).add(origin),bend:goal.bend?.clone().applyQuaternion(rotation)}));
 }
 begin(previous:Spec|undefined,next:Spec,time:number,clip?:AnimationClip,previousClip?:AnimationClip,previousPhase=0){
  const old=this.plan;this.plan=undefined;this.until=-Infinity;this.began=-Infinity;if(!previous||this.legs.length!==2||!Number.isFinite(time))return;
  const gesture=gestures.has(next.name)?next:gestures.has(previous.name)?previous:undefined;
  if(!gesture||gesture.nativeBootSupport?.surface!=='complete-native-boots-all-lods')return;
  if(!(guards.has(previous.name)&&gestures.has(next.name)||gestures.has(previous.name)&&guards.has(next.name)))return;
  this.began=time;this.until=time+.12;
  if(clip&&this.preview){this.root.updateWorldMatrix(true,true);const entry=gestures.has(next.name),initial=!entry&&old?.entry&&old.last?old.last:!this.hasFrame&&previousClip?this.forecast(previousClip,previousPhase)??this.capture():this.capture();this.plan={started:time,entry,initial,clip,resumedStep:entry&&old?.step,floor:this.root.getWorldPosition(new Vector3()).y,world:this.root.matrixWorld.clone()};}
 }
 restore(){
  if(!this.adjusted)return;for(const [bone,q]of this.native)bone.quaternion.copy(q);this.model.updateWorldMatrix(true,true);this.adjusted=false;
 }
 private lowest(leg:Leg){
  let height=Infinity;
  for(const vertex of leg.surface){let value=0;for(const point of vertex){const m=point.bone.matrixWorld.elements;value+=(m[1]*point.x+m[5]*point.y+m[9]*point.z+m[13])*point.weight;}height=Math.min(height,value);this.processedVertices++;}
  return height;
 }
 private lift(height:number){
  if(height>=.0015)return 0;if(height<=0)return .001-height;
  const u=height/.0015,remainder=1-u;
  // Quintic Hermite interpolation joins a constant contact plane to the
  // untouched source with matching first and second derivatives.
  // Factored form stays positive near the untouched boundary without
  // cancellation of nearly equal polynomial terms.
  return .001*remainder*remainder*remainder*(1+1.5*u+1.5*u*u);
 }
 private rotateToward(bone:Object3D,before:Vector3,after:Vector3){
  this.rotation.setFromUnitVectors(before.normalize(),after.normalize());bone.getWorldQuaternion(this.worldRotation);this.rotation.multiply(this.worldRotation);bone.parent!.getWorldQuaternion(this.parentRotation);bone.quaternion.copy(this.parentRotation.invert().multiply(this.rotation));bone.updateWorldMatrix(false,true);
 }
 private solve(leg:Leg,poleTarget?:Vector3){
  const {thigh,calf,foot,ball,first:a,second:b}=leg;thigh.getWorldPosition(this.start);calf.getWorldPosition(this.joint);foot.getWorldPosition(this.end);
  if(!finite(this.start)||!finite(this.joint)||!finite(this.end)||!finite(this.target))return false;
  const distance=this.direction.subVectors(this.target,this.start).length();this.maximumReachError=Math.max(this.maximumReachError,Math.max(0,distance-(a+b-.0004),Math.abs(a-b)+.0004-distance));
  if(distance>=a+b-.0004||distance<=Math.abs(a-b)+.0004)return false;this.direction.normalize();
  this.pole.subVectors(poleTarget??this.joint,this.start);this.pole.addScaledVector(this.direction,-this.pole.dot(this.direction));if(this.pole.lengthSq()<1e-8)return false;this.pole.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),rise=Math.sqrt(Math.max(0,a*a-along*along));this.knee.copy(this.start).addScaledVector(this.direction,along).addScaledVector(this.pole,rise);
  this.rotateToward(thigh,this.before.subVectors(this.joint,this.start),this.after.subVectors(this.knee,this.start));calf.getWorldPosition(this.joint);foot.getWorldPosition(this.end);this.rotateToward(calf,this.before.subVectors(this.end,this.joint),this.after.subVectors(this.target,this.joint));
  foot.parent!.getWorldQuaternion(this.parentRotation);foot.quaternion.copy(this.parentRotation.invert().multiply(this.footRotation));foot.updateWorldMatrix(false,true);ball.parent!.getWorldQuaternion(this.parentRotation);ball.quaternion.copy(this.parentRotation.invert().multiply(this.ballRotation));ball.updateWorldMatrix(false,true);return true;
 }
 private rejectContact(){this.rejectedFits++;this.restore();this.plan=undefined;this.until=-Infinity;return true;}
 private contact(time:number,phase:number,rate:number){
  const plan=this.plan!;if(!Number.isFinite(time)||time<plan.started||!Number.isFinite(phase)||!Number.isFinite(rate)||rate<0){this.plan=undefined;this.until=-Infinity;return true;}
  const elapsed=time-plan.started;
  this.root.updateWorldMatrix(true,true);this.model.getWorldScale(this.scale);
  if(!finite(this.scale)||Math.hypot(this.scale.x-1,this.scale.y-1,this.scale.z-1)>1e-6||this.root.matrixWorld.elements.some((v,i)=>Math.abs(v-plan.world.elements[i])>1e-6)){return this.rejectContact();}
  if(plan.entry&&elapsed===0&&!plan.resumedStep){plan.last=this.capture();return true;}
  // Keep ordinary returns at 120 ms. A real stance change lifts and lands
  // one foot before the other, without changing the paid/mixer clock.
  if(!plan.entry&&plan.returnDuration===undefined){const goal=this.forecast(plan.clip,phase+Math.max(0,.12-elapsed)*rate);if(!goal)return this.rejectContact();plan.step=goal.some((g,i)=>Math.hypot(g.toe.x-plan.initial[i].toe.x,g.toe.z-plan.initial[i].toe.z)>.02);plan.returnDuration=plan.step?.48:.12;if(plan.step){plan.landing=this.forecast(plan.clip,phase+Math.max(0,plan.returnDuration-elapsed)*rate);if(!plan.landing)return this.rejectContact();for(const goal of plan.landing)if(goal.contactToe)goal.toe.copy(goal.contactToe);const supports=plan.landing.map(goal=>(goal.low??Infinity)<=plan.floor+.003);if(!supports.some(Boolean))return this.rejectContact();plan.first=supports[0]?0:1;}}
  if(!plan.entry&&elapsed>=plan.returnDuration!){this.plan=undefined;return false;}
  const weight=smooth(elapsed/(plan.entry?.12:plan.returnDuration!));
  for(const [bone,q]of this.native)q.copy(bone.quaternion);this.adjusted=true;
  for(let index=0;index<this.legs.length;index++){
   const leg=this.legs[index],initial=plan.initial[index],toe=initial.toe.clone(),q=initial.q.clone(),ball=initial.ball.clone();let poleTarget:Vector3|undefined,poleWeight=0;
   if(plan.entry){toe.y+=(plan.floor+.002-toe.y)*weight;const normal=leg.normal.clone().applyQuaternion(initial.q),flat=new Quaternion().setFromUnitVectors(normal,new Vector3(0,1,0)).multiply(initial.q);q.slerp(flat,weight);}
   else if(plan.step){const goal=plan.landing![index],half=plan.returnDuration!/2,u=Math.max(0,Math.min(1,(elapsed-(index===plan.first?0:half))/half)),travel=smooth((u-.2)/.6),distance=Math.hypot(goal.toe.x-initial.toe.x,goal.toe.z-initial.toe.z),height=Math.min(.05,.025+distance*.08),arc=64*u*u*u*(1-u)*(1-u)*(1-u);poleWeight=travel;toe.lerp(goal.toe,travel);toe.y+=height*arc;q.slerp(goal.q,travel);ball.slerp(goal.ball,travel);}
   else{const goal=this.forecast(plan.clip,phase);if(!goal)return this.rejectContact();toe.lerp(goal[index].toe,weight);q.slerp(goal[index].q,weight);ball.slerp(goal[index].ball,weight);}
   const forward=leg.forward.clone().applyQuaternion(q);forward.y=0;if(forward.lengthSq()<1e-8){return this.rejectContact();}forward.normalize();
   const axis=new Vector3(0,1,0).cross(forward).normalize(),hip=leg.thigh.getWorldPosition(new Vector3()),reserve=.0004+.0016*(plan.entry?weight:1-weight),limit=leg.first+leg.second-reserve;
   const orientation=(roll:number)=>new Quaternion().setFromAxisAngle(axis,roll).multiply(q),target=(rotation:Quaternion)=>toe.clone().sub(leg.toe.clone().applyQuaternion(rotation));
   let roll=0;const reachable=(rotation:Quaternion)=>{const distance=target(rotation).distanceTo(hip);return distance<limit&&distance>Math.abs(leg.first-leg.second)+reserve;};
   if(!reachable(q)){let low=0,high=this.contactRollLimit;if(!reachable(orientation(high))){return this.rejectContact();}for(let i=0;i<24;i++){const middle=(low+high)/2;if(reachable(orientation(middle)))high=middle;else low=middle;}roll=high+.00001;}
   const fitted=orientation(roll),delta=fitted.clone().multiply(q.clone().invert());if(plan.entry)ball.copy(initial.ball).premultiply(fitted.clone().multiply(initial.q.clone().invert()));else ball.premultiply(delta);this.footRotation.copy(fitted);this.ballRotation.copy(ball);this.target.copy(target(fitted));
   // Interpolate the signed bend angle in the actual leg plane. A linear
   // knee-point blend can cross the leg axis and flip the weighted shaft.
   if((plan.step||plan.resumedStep)&&initial.bend){const direction=this.target.clone().sub(hip).normalize(),start=initial.bend.clone().addScaledVector(direction,-initial.bend.dot(direction)).normalize(),end=plan.step?plan.landing![index].bend!.clone():leg.calf.getWorldPosition(new Vector3()).sub(hip);end.addScaledVector(direction,-end.dot(direction)).normalize();if(start.lengthSq()<.5||end.lengthSq()<.5||!finite(start)||!finite(end))return this.rejectContact();const angle=Math.atan2(direction.dot(start.clone().cross(end)),start.dot(end));if(plan.resumedStep)poleWeight=weight;poleTarget=start.applyQuaternion(new Quaternion().setFromAxisAngle(direction,angle*poleWeight)).add(hip);}

   const raw=leg.foot.getWorldPosition(new Vector3()),adjust=this.target.distanceTo(raw);this.maximumAdjustment=Math.max(this.maximumAdjustment,adjust);this.maximumHeelRoll=Math.max(this.maximumHeelRoll,roll);
   if(adjust>(plan.step||plan.resumedStep?this.stepAdjustmentLimit:this.contactAdjustmentLimit)||!finite(this.target))return this.rejectContact();
   let actual=new Vector3();for(let attempt=0;attempt<2;attempt++){
    if(!this.solve(leg,poleTarget))return this.rejectContact();actual.copy(leg.toe).applyMatrix4(leg.foot.matrixWorld);
    if(actual.distanceToSquared(toe)<1e-14||attempt===1)break;
    // Native float skin/rotation data can leave a sub-micrometre endpoint
    // residual. Correct the actual weighted contact, not a transform proxy.
    this.target.add(toe.clone().sub(actual));
   }
   this.maximumAdjustment=Math.max(this.maximumAdjustment,leg.foot.getWorldPosition(new Vector3()).distanceTo(raw));
   if(this.lowest(leg)<plan.floor+.0008)return this.rejectContact();this.maximumContactError=Math.max(this.maximumContactError,actual.distanceTo(toe));
  }
  plan.last=this.capture();return true;
 }
 apply(time:number,phase=0,rate=1){
  this.hasFrame=true;this.maximumAdjustment=0;this.maximumReachError=0;this.rejectedFits=0;this.processedVertices=0;this.maximumContactError=0;this.maximumHeelRoll=0;
  if(this.plan&&this.contact(time,phase,rate))return;
  if(!Number.isFinite(time)||time<this.began||time>=this.until)return;
  this.root.updateWorldMatrix(true,true);const floor=this.root.getWorldPosition(this.rootPoint).y;this.model.getWorldScale(this.scale);if(!Number.isFinite(floor)||!finite(this.scale)||Math.hypot(this.scale.x-1,this.scale.y-1,this.scale.z-1)>1e-6){this.until=-Infinity;this.rejectedFits++;return;}
  for(const [bone,q]of this.native)q.copy(bone.quaternion);
  for(const leg of this.legs){
   const low=this.lowest(leg),lift=this.lift(low-floor);if(!Number.isFinite(lift)||lift<0||lift>this.adjustmentLimit){this.rejectedFits++;this.restore();this.until=-Infinity;return;}if(lift<=1e-9)continue;
   this.adjusted=true;const desired=low+lift;leg.foot.getWorldPosition(this.target);const ankleHeight=this.target.y;this.target.y+=lift;leg.foot.getWorldQuaternion(this.footRotation);leg.ball.getWorldQuaternion(this.ballRotation);
   for(let attempt=0;attempt<2;attempt++){
    this.maximumAdjustment=Math.max(this.maximumAdjustment,this.target.y-ankleHeight);
    if(!this.solve(leg)){this.rejectedFits++;this.restore();this.until=-Infinity;return;}
    const residual=desired-this.lowest(leg);if(Math.abs(residual)<=1e-7||attempt===1)break;
    const nextAdjustment=this.target.y+residual-ankleHeight;if(nextAdjustment>this.adjustmentLimit||!Number.isFinite(residual)){this.rejectedFits++;this.restore();this.until=-Infinity;return;}
    // A sub-millimetre world-matrix difference can overshoot the very small
    // easing tail. Do not add a downward correction to an already clear boot.
    if(nextAdjustment<=0)break;this.target.y+=residual;
   }
   if(this.lowest(leg)<floor+.0009){this.rejectedFits++;this.restore();this.until=-Infinity;return;}
  }
 }
 dispose(){this.restore();this.until=-Infinity;this.plan=undefined;this.previewMixer?.stopAllAction();if(this.preview)this.previewMixer?.uncacheRoot(this.preview);}
}
