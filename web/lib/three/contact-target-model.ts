import type {Object3D} from 'three';
import type {ActorVisual,ContactTarget} from './presentation';

export type ContactActorModel={model:Object3D;root:Object3D};
type ContactEntry={visual?:ActorVisual;runtime?:ContactActorModel&{asset:{appearance:{id:string}}};pending?:boolean;error?:boolean};

/** Resolve only the current loaded form of a body admitted by presentation. */
export function resolveContactTargetModel(target:ContactTarget,admitted:readonly ActorVisual[],entry?:ContactEntry):ContactActorModel|undefined{
  const matches=admitted.filter(visual=>visual.key===target.key),visual=matches.length===1?matches[0]:undefined,runtime=entry?.runtime;
  if(!visual||entry?.pending||entry?.error||entry?.visual!==visual||!runtime||!runtime.root.visible||runtime.asset.appearance.id!==target.appearance)return;
  if(visual.appearance!==target.appearance||visual.posture!==target.posture||visual.mounted!==target.mounted||visual.action!==target.action||visual.yaw!==target.yaw||visual.position.some((value,index)=>value!==target.position[index]))return;
  return {model:runtime.model,root:runtime.root};
}
