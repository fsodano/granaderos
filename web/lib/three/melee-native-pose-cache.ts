import {AnimationClip,Object3D,Mesh,Quaternion,Vector3} from 'three';
import type {NativeMeleeContactFit} from './melee-contact-fit';
export type NativePoseCache={names:string[];rows:{time:number;values:Float64Array}[]};
function nodes(model:Object3D){const result:Object3D[]=[];model.traverse(node=>{if(!(node instanceof Mesh))result.push(node);});return result;}
/** Reuse only the exact authored native clip samples. The complete current
 * calibrated leg/hand, skin/floor/speed/body admission remains original. */
export function nativePoseCacheFor(fit:NativeMeleeContactFit,clip:AnimationClip,contact:number):NativePoseCache{
 const source=fit as any,list=nodes(source.sample),action=source.sampleMixer.clipAction(clip);source.previewFit.restore();source.sampleMixer.stopAllAction();action.reset().play();action.timeScale=0;
 const times=[contact,0,clip.duration,...Array.from({length:Math.ceil(clip.duration*240)+1},(_,i)=>Math.min(clip.duration,i/240))],rows:NativePoseCache['rows']=[];
 for(const time of new Set(times)){source.previewFit.restore();action.time=time;source.sampleMixer.update(0);source.sampleRoot.updateMatrixWorld(true);const values=new Float64Array(list.length*10);let offset=0;for(const node of list){values.set(node.position.toArray(),offset);values.set(node.quaternion.toArray(),offset+3);values.set(node.scale.toArray(),offset+7);offset+=10;}rows.push({time,values});}
 return {names:list.map(node=>node.name),rows};
}
export function replayNativeMixer(fit:NativeMeleeContactFit,cache:NativePoseCache,clip:AnimationClip){
 const source=fit as any,list=nodes(source.sample),mixer=source.sampleMixer,update=mixer.update,rows=new Map(cache.rows.map(row=>[row.time,row.values]));
 if(list.length!==cache.names.length||list.some((node,index)=>node.name!==cache.names[index]))throw Error('MELEE_NATIVE_CACHE_HIERARCHY');
 mixer.update=function(delta:number){const action=mixer.existingAction(clip),values=delta===0&&action?.enabled&&!action.paused&&action.isScheduled()&&rows.get(action.time);if(!values)return update.call(this,delta);let offset=0;for(const node of list){node.position.fromArray(values,offset);node.quaternion.fromArray(values,offset+3);node.scale.fromArray(values,offset+7);offset+=10;}return this;};
 return ()=>{mixer.update=update;};
}

export type SettledPoseRow={time:number;values:Float64Array;right:number[];left:number[];feet:number[][];rotation:number[]};
export type SettledPoseCache={names:string[];rows:SettledPoseRow[]};
/** Cache only the native football settling and ground baseline, which depend
 * on clip time/retained facing and owned bind support. Body/step/hand/reach
 * remain current source values and are solved again at admission. */
export function settledPoseCacheFor(fit:NativeMeleeContactFit,clip:AnimationClip,plan:any):SettledPoseCache{
 const source=fit as any,pf=source.previewFit,root: Object3D=source.sampleRoot,model:Object3D=source.sample,list=[root,...nodes(model)],position=pf.position,rows:SettledPoseRow[]=[],action=source.sampleMixer.clipAction(clip);source.sampleMixer.stopAllAction();action.reset().play();action.timeScale=0;
 let row:SettledPoseRow|undefined;
 pf.position=function(node:Object3D,target:Vector3){if(node===pf.limbs.get('hand_r').end&&!row){const values=new Float64Array(list.length*26);let offset=0;for(const n of list){values.set(n.position.toArray(),offset);values.set(n.quaternion.toArray(),offset+3);values.set(n.scale.toArray(),offset+7);values.set(n.matrixWorld.elements,offset+10);offset+=26;}const transfer=source.transfer(plan,action.time),feet=['l','r'].map(side=>{const sole=pf.soles.get(side),point=position.call(this,pf.limbs.get('foot_'+side).end,new Vector3()),minimum=Math.min(...sole.vertices.map((index:number)=>pf.solePoint(sole,index,new Vector3()).y));point.y+=(position.call(this,root,new Vector3()).y+sole.floor-minimum)*transfer.groundWeight;return point.toArray();});row={time:action.time,values,right:position.call(this,pf.limbs.get('hand_r').end,new Vector3()).toArray(),left:position.call(this,pf.limbs.get('hand_l').end,new Vector3()).toArray(),feet,rotation:root.getWorldQuaternion(new Quaternion()).toArray()};}return position.call(this,node,target);};
 try{for(const time of new Set([plan.contact,...Array.from({length:Math.ceil(clip.duration*240)+1},(_,i)=>Math.min(clip.duration,i/240))])){pf.restore();action.time=time;row=undefined;if(plan.turn)root.rotation.set(0,plan.turn.fromYaw+Math.atan2(Math.sin(plan.turn.toYaw-plan.turn.fromYaw),Math.cos(plan.turn.toYaw-plan.turn.fromYaw))*((t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);})(time/plan.turn.until),0);source.sampleMixer.update(0);root.updateMatrixWorld(true);pf.pose(plan,time);if(row)rows.push(row);}}
 finally{pf.position=position;pf.restore();}
 return {names:list.map(n=>n===root?'@root':n.name),rows};
}
export function replaySettledPose(fit:NativeMeleeContactFit,cache:SettledPoseCache){
 const source=fit as any,pf=source.previewFit,root=source.sampleRoot,model=source.sample,list=[root,...nodes(model)],pose=pf.pose,rows=new Map(cache.rows.map(row=>[row.time,row]));
 if(list.length!==cache.names.length||list.some((node,index)=>(node===root?'@root':node.name)!==cache.names[index]))throw Error('MELEE_SETTLED_CACHE_HIERARCHY');
 pf.pose=function(plan:any,time:number){const row=rows.get(time);if(!row)return pose.call(this,plan,time);this.maximumReachError=0;this.footReachError=0;this.handReachError=0;const modified=new Set<Object3D>([this.body]);for(const name of ['foot_l','foot_r','hand_r','hand_l']){const limb=this.limbs.get(name);modified.add(limb.base);modified.add(limb.middle);modified.add(limb.end);}for(const side of ['l','r']){const ball=model.getObjectByName('ball_'+side);if(ball)modified.add(ball);}this.nativePose=[...modified].map(node=>({node,position:node.position.clone(),quaternion:node.quaternion.clone()}));for(let index=0;index<list.length;index++){const node=list[index];if(!/^(foot|ball)_[lr]$/.test(node.name))continue;const offset=index*26;node.quaternion.fromArray(row.values,offset+3);node.matrixWorld.fromArray(row.values,offset+10);}
  const rootRotation=new Quaternion().fromArray(row.rotation),{weight,handWeight,rearWeight,leadWeight,rearArc,leadArc}=source.transfer(plan,time),footTargets=new Map<string,Vector3>([['l',new Vector3().fromArray(row.feet[0])],['r',new Vector3().fromArray(row.feet[1])]]),handDelta=plan.hand.clone().applyQuaternion(rootRotation).multiplyScalar(handWeight),handTarget=new Vector3().fromArray(row.right).add(handDelta),leftTarget=new Vector3().fromArray(row.left).add(handDelta),body=plan.body.clone().applyQuaternion(rootRotation).multiplyScalar(weight),turnRear=plan.turn?Math.atan2(Math.sin(plan.turn.fromYaw-root.rotation.y),Math.cos(plan.turn.fromYaw-root.rotation.y))*(time<plan.contact?1-rearWeight:0):0,lead=footTargets.get('r')!,rear=footTargets.get('l')!;
  if(plan.turn)rear.sub(this.position(root,new Vector3())).applyAxisAngle(new Vector3(0,1,0),turnRear).add(this.position(root,new Vector3()));lead.add(plan.step.clone().applyQuaternion(rootRotation).multiplyScalar(leadWeight));rear.add(plan.rearStep.clone().applyQuaternion(rootRotation).multiplyScalar(rearWeight));rear.y+=rearArc*Math.min(.035,(plan.rearStep.length()+(plan.turn?.footDistance??0))*.1);lead.y+=leadArc*Math.min(.045,plan.step.length()*.1);
  let kneeDrop=0;for(const side of ['l','r']){const leg=this.limbs.get('foot_'+side),hip=this.position(leg.base,new Vector3()).add(body),foot=footTargets.get(side)!,dx=hip.x-foot.x,dz=hip.z-foot.z,height=Math.sqrt(Math.max(0,(leg.first+leg.second-.002)**2-dx*dx-dz*dz));kneeDrop=Math.max(kneeDrop,hip.y-foot.y-height);}body.y-=Math.max(0,kneeDrop);this.position(this.body,this.start).add(body);this.start.applyMatrix4(this.inverseParent.copy(this.body.parent.matrixWorld).invert());this.body.position.copy(this.start);this.body.updateWorldMatrix(false,true);
  for(const side of ['l','r']){const foot=this.limbs.get('foot_'+side);this.solve(foot,footTargets.get(side)!);if(side==='l'&&plan.turn){this.quaternion(foot.end,this.endRotation);this.endRotation.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),turnRear));this.quaternion(foot.end.parent,this.parentRotation);foot.end.quaternion.copy(this.parentRotation.invert().multiply(this.endRotation));foot.end.updateWorldMatrix(false,true);}}this.solve(this.limbs.get('hand_r'),handTarget);this.solve(this.limbs.get('hand_l'),leftTarget);
 };
 return ()=>{pf.pose=pose;};
}
