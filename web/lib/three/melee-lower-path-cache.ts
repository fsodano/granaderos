import {AnimationClip,AnimationMixer,Mesh,Object3D,Quaternion,Skeleton,SkinnedMesh,Vector3} from 'three';
import {NativeMeleeContactFit as NativeFit} from './melee-contact-fit';
import type {NativeMeleeContactFit} from './melee-contact-fit';
import type {ActorCue,ContactSupport} from './presentation';

export type LowerPoseRow={time:number;values:Float64Array;nativeRight:number[];nativeLeft:number[];rotation:number[];handWeight:number;footError:number;maximumError:number;solves:boolean;bodyCheck:boolean};
export type LowerRecipe={key:string;accepted:boolean;rows:LowerPoseRow[]};
export type LowerPathCache={core:{name:string;low:number[];high:number[]}[];recipes:LowerRecipe[];names:string[];previewLegs:{name:string;first:number;second:number}[];gait:{step:number;foot:number;sole:number;boot:number};};
const recipeKey=(plan:any)=>JSON.stringify([plan.body.toArray(),plan.step.toArray(),plan.rearStep.toArray(),plan.contact,plan.duration,plan.twoHands,plan.sabre,plan.pistol,plan.handRecovery,plan.turn,plan.yaw]);
function nodes(model:Object3D,root:Object3D){const result=[root];model.traverse(node=>{if(!(node as any).isMesh)result.push(node);});return result;}

/** Compute the unchanged full chronological lower-body gate off-thread.
 * All source candidates are retained in their source search order. The hand
 * correction is not part of this proof and is always rechecked at admission. */
export function lowerCacheFor(fit:NativeMeleeContactFit,plans:any[],clip:AnimationClip,support:ContactSupport):LowerPathCache{
 const source=fit as any,pf=source.previewFit,model=source.sample,root=source.sampleRoot,list=nodes(model,root),names=list.map(node=>node===root?'@root':node.name);
 const path=source.pathAllowed,pose=pf.pose,solve=pf.solve,body=source.bodyAllowed,recipes:LowerRecipe[]=[];let row:LowerPoseRow|undefined,rows:LowerPoseRow[]=[];
 source.bodyAllowed=()=>{if(row)row.bodyCheck=true;return true;};
 pf.solve=function(limb:any,target:Vector3){if(limb.end.name==='hand_r'&&row){const values=new Float64Array(list.length*26);let offset=0;for(const node of list){values.set(node.position.toArray(),offset);values.set(node.quaternion.toArray(),offset+3);values.set(node.scale.toArray(),offset+7);values.set(node.matrixWorld.elements,offset+10);offset+=26;}row.values=values;row.footError=pf.footReachError;row.maximumError=pf.maximumReachError;row.solves=true;}return solve.call(this,limb,target);};
 pf.pose=function(plan:any,time:number){const right=model.getObjectByName('hand_r').getWorldPosition(new Vector3()),left=model.getObjectByName('hand_l').getWorldPosition(new Vector3()),rotation=root.getWorldQuaternion(new Quaternion()),transfer=source.transfer(plan,time);row={time,values:new Float64Array(),nativeRight:right.toArray(),nativeLeft:left.toArray(),rotation:rotation.toArray(),handWeight:transfer.handWeight,footError:0,maximumError:0,solves:false,bodyCheck:false};pose.call(this,plan,time);if(!row.solves){const values=new Float64Array(list.length*26);let offset=0;for(const node of list){values.set(node.position.toArray(),offset);values.set(node.quaternion.toArray(),offset+3);values.set(node.scale.toArray(),offset+7);values.set(node.matrixWorld.elements,offset+10);offset+=26;}row.values=values;row.footError=pf.footReachError;row.maximumError=pf.maximumReachError;}rows.push(row);pf.handReachError=0;};
 try{for(const plan of plans){rows=[];row=undefined;const action=source.sampleMixer.clipAction(clip);source.rifleSpeedPair=undefined;const accepted=path.call(source,plan,clip,support,action);recipes.push({key:recipeKey(plan),accepted,rows});}}
 finally{pf.pose=pose;pf.solve=solve;source.bodyAllowed=body;pf.restore();}
 return {core:pf.core.map((bound:any)=>({name:bound.bone.name,low:bound.low.toArray(),high:bound.high.toArray()})),recipes,names,previewLegs:['foot_l','foot_r'].map(name=>{const limb=pf.limbs.get(name);return {name,first:limb.first,second:limb.second};}),gait:{step:source.walkingStep,foot:source.walkingFootSpeed,sole:source.walkingSoleSpeed,boot:source.walkingBootSpeed}};
}

/** Recheck both current intended wrists and every original body-bound sample.
 * Lower geometry comes only from a matching, complete source proof. Missing
 * source candidates reject the entire fit, never skip to a later candidate. */
export function cachedPathAllowed(fit:NativeMeleeContactFit,cache:LowerPathCache,plan:any,support:ContactSupport){
 const source=fit as any,pf=source.previewFit,model=source.sample,root=source.sampleRoot,recipe=cache.recipes.find(item=>item.key===recipeKey(plan));
 if(!recipe)throw new Error('MELEE_CACHE_MISSING_RECIPE '+recipeKey(plan)+' available '+cache.recipes.map(item=>item.key).join('|'));
 if(!cache.previewLegs.every(value=>{const limb=pf.limbs.get(value.name);return limb.first===value.first&&limb.second===value.second;}))throw new Error('MELEE_CACHE_CHANGED_LEG '+JSON.stringify(cache.previewLegs.map(value=>({warm:value,current:{first:pf.limbs.get(value.name).first,second:pf.limbs.get(value.name).second}}))));
 if(!recipe.accepted)return false;
 const list=nodes(model,root);if(list.length!==cache.names.length||list.some((node,index)=>(node===root?'@root':node.name)!==cache.names[index]))throw new Error('MELEE_CACHE_CHANGED_HIERARCHY');
 for(const row of recipe.rows){let offset=0;for(const node of list){node.position.fromArray(row.values,offset);node.quaternion.fromArray(row.values,offset+3);node.scale.fromArray(row.values,offset+7);node.matrixWorld.fromArray(row.values,offset+10);offset+=26;}
  pf.maximumReachError=row.maximumError;pf.footReachError=row.footError;pf.handReachError=0;
  if(row.solves){const delta=plan.hand.clone().applyQuaternion(new Quaternion().fromArray(row.rotation)).multiplyScalar(row.handWeight),right=new Vector3().fromArray(row.nativeRight).add(delta),left=new Vector3().fromArray(row.nativeLeft).add(delta);pf.solve(pf.limbs.get('hand_r'),right);if(plan.twoHands)pf.solve(pf.limbs.get('hand_l'),left);}
  if(pf.handReachError>=1e-7||row.bodyCheck&&!source.bodyAllowed(support))return false;
 }
 return true;
}
export {recipeKey};

function hierarchy(source:Object3D):Object3D|undefined{if(source instanceof Mesh)return;const node=new Object3D();node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);for(const child of source.children){const copy=hierarchy(child);if(copy)node.add(copy);}return node;}
function shown(node:Object3D){for(let current:Object3D|null=node;current;current=current.parent)if(!current.visible)return false;return true;}
/** Preallocate only owned geometry. No paid pose or target plan is retained. */
export function initializeCachedSample(fit:NativeMeleeContactFit,cache:LowerPathCache){
 const source=fit as any;if(source.sample)return false;
 source.sample=hierarchy(source.model);source.sampleRoot.add(source.sample);source.sampleMixer=new AnimationMixer(source.sample);
 const meshes:SkinnedMesh[]=[];source.model.traverse((node:Object3D)=>{if(node instanceof SkinnedMesh&&shown(node))meshes.push(node);});
 for(const mesh of meshes){const copy=mesh.clone(false),bones=mesh.skeleton.bones.map(bone=>source.sample.getObjectByName(bone.name));const parent=mesh.parent===source.model?source.sample:source.sample.getObjectByName(mesh.parent!.name)??source.sample;parent.add(copy);copy.bind(new Skeleton(bones as any,mesh.skeleton.boneInverses),mesh.bindMatrix);}
 // The core bounds were compiled from these exact owned buffers in the
 // worker. Avoid rescanning thousands of vertices in the first paid RAF.
 source.previewFit=new NativeFit(source.sample,source.sampleRoot,[...source.soles.values()][0]?.mesh.name,false);const pf=source.previewFit;pf.preview=true;
 pf.core=cache.core.map(bound=>({bone:source.sample.getObjectByName(bound.name),low:new Vector3().fromArray(bound.low),high:new Vector3().fromArray(bound.high)}));
 pf.flatRest=new Map([...source.flatRest].map(([name,quaternion]:any)=>[name,quaternion.clone()]));for(const [side,sole]of pf.soles){const native=source.soles.get(side);sole.floor=native.floor;sole.outline=[...native.outline];}
 return true;
}
/** Match the original first constructor's actual mixed native inputs. The
 * cached geometry remains fixed; all53 native bones are copied immediately
 * after the paid consumer's mixer/cloth/gait work, before source admission. */
export function finalizeCachedSample(fit:NativeMeleeContactFit){
 const source=fit as any,pf=source.previewFit;source.sampleRoot.position.set(0,0,0);source.sampleRoot.quaternion.identity();source.sampleRoot.scale.set(1,1,1);
 source.model.traverse((node:Object3D)=>{if(node instanceof Mesh)return;const copy=source.sample.getObjectByName(node.name);if(copy){copy.position.copy(node.position);copy.quaternion.copy(node.quaternion);copy.scale.copy(node.scale);}});
 source.sampleRoot.updateMatrixWorld(true);
 for(const limb of pf.limbs.values()){limb.first=limb.base.getWorldPosition(new Vector3()).distanceTo(limb.middle.getWorldPosition(new Vector3()));limb.second=limb.middle.getWorldPosition(new Vector3()).distanceTo(limb.end.getWorldPosition(new Vector3()));}
}
