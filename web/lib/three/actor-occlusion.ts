import {AlwaysStencilFunc,EqualStencilFunc,GreaterDepth,KeepStencilOp,ReplaceStencilOp,Mesh,SkinnedMesh,MeshBasicMaterial,Object3D} from 'three';
import type {Material} from 'three';

/** Opaque world pixels carry 1. Visible actor pixels carry 0. The late overlay
 * draws only selected-body pixels hidden by the world, never through itself. */
export function markActorMaterials(root:Object3D){
 root.traverse(node=>{if(!(node instanceof Mesh)||node.userData.occlusionOverlay)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.stencilWrite=true;material.stencilRef=0;material.stencilFunc=AlwaysStencilFunc;material.stencilZPass=ReplaceStencilOp;}});
}
export class ActorOcclusion {
 private actor:Object3D|null=null;
 private meshes=new Map<Mesh,Mesh>();
 private material:Material=new MeshBasicMaterial({color:'#e4cf8b',transparent:true,opacity:.42,depthWrite:false,depthTest:true,depthFunc:GreaterDepth,stencilWrite:true,stencilRef:1,stencilFunc:EqualStencilFunc,stencilFail:KeepStencilOp,stencilZFail:KeepStencilOp,stencilZPass:KeepStencilOp,toneMapped:false});
 setActor(actor:Object3D|null){if(actor===this.actor)return;this.clear();this.actor=actor;}
 sync(){
  if(!this.actor)return;
  const sources=new Set<Mesh>();this.actor.traverse(node=>{if(node instanceof Mesh&&!node.userData.occlusionOverlay)sources.add(node);});
  markActorMaterials(this.actor);
  for(const [source,overlay]of this.meshes)if(!sources.has(source)){overlay.removeFromParent();this.meshes.delete(source);}
  for(const source of sources){
   if(this.meshes.has(source))continue;
   const overlay=source instanceof SkinnedMesh?new SkinnedMesh(source.geometry,this.material):new Mesh(source.geometry,this.material);
   if(overlay instanceof SkinnedMesh&&source instanceof SkinnedMesh){overlay.bindMode=source.bindMode;overlay.bind(source.skeleton,source.bindMatrix);}
   overlay.name='selected-actor-occlusion';overlay.userData.occlusionOverlay=true;overlay.renderOrder=100;overlay.frustumCulled=false;
   // A child shares the source transform and its visibility. The skeleton,
   // geometry and textures remain owned by the normal actor/asset cache.
   source.add(overlay);this.meshes.set(source,overlay);
  }
 }
 private clear(){for(const overlay of this.meshes.values())overlay.removeFromParent();this.meshes.clear();}
 dispose(){this.clear();this.actor=null;this.material.dispose();}
}
