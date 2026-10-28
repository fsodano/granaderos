import {Object3D} from 'three';
import type {NativeMeleeContactFit} from './melee-contact-fit';
/** The native sampler needs current matrices for every original contact,
 * limb, complete boot and conservative body bound. Unused finger/socket
 * descendants do not enter those checks. Current actor rendering is untouched.
 * Multiplication/composition order of each required matrix stays unchanged. */
export function prunePreviewUpdates(fit:NativeMeleeContactFit){
 const source=fit as any,pf=source.previewFit,root: Object3D=source.sampleRoot,required=new Set<Object3D>(),saved:{node:Object3D;world:Object3D['updateWorldMatrix'];matrix:Object3D['updateMatrixWorld']}[]=[];
 const add=(node:Object3D|undefined)=>{for(let current=node;current;current=current.parent??undefined)required.add(current);};add(root);add(pf.body);for(const limb of pf.limbs.values()){add(limb.base);add(limb.middle);add(limb.end);}for(const name of pf.flatRest.keys())add(source.sample.getObjectByName(name));for(const bound of pf.core)add(bound.bone);
 const boot=pf.completeBoot;if(!boot||boot.mesh.bindMode!=='attached'||boot.mesh.geometry.morphAttributes.position?.length)return ()=>{};
 const indices=boot.mesh.geometry.attributes.skinIndex,weights=boot.mesh.geometry.attributes.skinWeight;for(let i=0;i<indices.count;i++)for(let slot=0;slot<4;slot++)if(weights.getComponent(i,slot)>0)add(boot.mesh.skeleton.bones[indices.getComponent(i,slot)]);
 root.traverse((node:Object3D)=>{saved.push({node,world:node.updateWorldMatrix,matrix:node.updateMatrixWorld});const children=node.children.filter(child=>required.has(child));let native:number[]|undefined;const compose=()=>{const p=node.position,q=node.quaternion,s=node.scale;if(!native||native[0]!==p.x||native[1]!==p.y||native[2]!==p.z||native[3]!==q.x||native[4]!==q.y||native[5]!==q.z||native[6]!==q.w||native[7]!==s.x||native[8]!==s.y||native[9]!==s.z){node.updateMatrix();native=[p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z];}else node.matrixWorldNeedsUpdate=true;};
  node.updateWorldMatrix=function(parents:boolean,descendants:boolean){if(parents&&this.parent)this.parent.updateWorldMatrix(true,false);if(this.matrixAutoUpdate)compose();if(this.matrixWorldAutoUpdate){if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);}if(descendants)for(const child of children)child.updateWorldMatrix(false,true);};
  node.updateMatrixWorld=function(force?:boolean){if(this.matrixAutoUpdate)compose();if(this.matrixWorldNeedsUpdate||force){if(this.matrixWorldAutoUpdate){if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);}this.matrixWorldNeedsUpdate=false;force=true;}for(const child of children)child.updateMatrixWorld(force);};
 });
 return ()=>{for(const record of saved){record.node.updateWorldMatrix=record.world;record.node.updateMatrixWorld=record.matrix;}};
}
