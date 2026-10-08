import {AnimationClip,Bone,BufferAttribute,BufferGeometry,Matrix4,Mesh,MeshBasicMaterial,Object3D,Quaternion,Skeleton,SkinnedMesh} from 'three';
import type {NativeMeleeContactFit} from './melee-contact-fit';

type Attribute={array:any;itemSize:number;normalized:boolean};
type NodeRecord={id:string;parent:number;name:string;bone:boolean;visible:boolean;position:number[];quaternion:number[];scale:number[];matrix:number[];auto:boolean;geometry?:{attributes:Record<string,Attribute>;index?:Attribute;morph:Attribute[];relative:boolean};material?:string;skin?:{bones:string[];inverse:number[][];bind:number[];bindInverse:number[];mode:string};morph?:number[];morphNames?:Record<string,number>;itemId?:string};
export type ActorSnapshot={parent:number[];nodes:NodeRecord[];model:string;root:string;weapon?:string};
export type Calibration={limbs:{name:string;first:number;second:number}[];flat:{name:string;quaternion:number[]}[];soles:{name:string;floor:number;outline:number[]}[]};
function shown(node:Object3D){for(let current:Object3D|null=node;current;current=current.parent)if(!current.visible)return false;return true;}
function attribute(source:any):Attribute{
 if(source.isInterleavedBufferAttribute){const array=new source.data.array.constructor(source.count*source.itemSize);for(let i=0;i<source.count;i++)for(let j=0;j<source.itemSize;j++)array[i*source.itemSize+j]=source.data.array[i*source.data.stride+source.offset+j];return {array,itemSize:source.itemSize,normalized:source.normalized};}
 return {array:source.array.slice(),itemSize:source.itemSize,normalized:source.normalized};
}

/** The explicit rendered actor subtree contains no roster, future frame,
 * ammunition, userData dump, image, material texture or hidden mesh. */
export function snapshotActor(root:Object3D,model:Object3D,weapon?:Object3D):ActorSnapshot{
 root.updateWorldMatrix(true,true);root.updateMatrixWorld(true);const nodes:NodeRecord[]=[],weaponPath=new Set<Object3D>();for(let current:Object3D|null=weapon??null;current&&current!==root;current=current.parent)weaponPath.add(current);
 const visit=(node:Object3D,parent:number,insideModel=false,insideWeapon=false)=>{
  insideModel ||= node===model;insideWeapon ||= node===weapon;
  if(node instanceof Mesh&&(!(node instanceof SkinnedMesh)&&!insideWeapon||!shown(node)))return;
  const record:NodeRecord={id:node.uuid,parent,name:node.name,bone:node instanceof Bone,visible:node.visible,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),matrix:node.matrix.toArray(),auto:node.matrixAutoUpdate},index=nodes.push(record)-1;
  if(node instanceof Mesh){
   const attributes:Record<string,Attribute>={};for(const name of ['position','skinIndex','skinWeight'])if(node.geometry.attributes[name])attributes[name]=attribute(node.geometry.attributes[name]);
   record.geometry={attributes,index:node.geometry.index?attribute(node.geometry.index):undefined,morph:(node.geometry.morphAttributes.position??[]).map(attribute),relative:node.geometry.morphTargetsRelative};record.material=(node.material as any)?.name;
   if(node.morphTargetInfluences)record.morph=[...node.morphTargetInfluences];if(node.morphTargetDictionary)record.morphNames={...node.morphTargetDictionary};
   if(node instanceof SkinnedMesh)record.skin={bones:node.skeleton.bones.map(bone=>bone.uuid),inverse:node.skeleton.boneInverses.map(matrix=>matrix.toArray()),bind:node.bindMatrix.toArray(),bindInverse:node.bindMatrixInverse.toArray(),mode:node.bindMode};
  }
  if(node===weapon)record.itemId=String(weapon.userData.itemId);
  for(const child of node.children)if(insideModel||insideWeapon||child===model||weaponPath.has(child))visit(child,index,insideModel,insideWeapon);
 };
 visit(root,-1);return {parent:root.parent?.matrixWorld.toArray()??new Matrix4().toArray(),nodes,root:root.uuid,model:model.uuid,weapon:weapon?.uuid};
}
export function restoreActor(snapshot:ActorSnapshot){
 const objects=new Map<string,Object3D>(),parent=new Object3D();parent.matrixAutoUpdate=false;parent.matrix.fromArray(snapshot.parent);
 for(const record of snapshot.nodes){let node:Object3D;
  if(record.geometry){const geometry=new BufferGeometry();for(const [name,data]of Object.entries(record.geometry.attributes))geometry.setAttribute(name,new BufferAttribute(data.array,data.itemSize,data.normalized));if(record.geometry.index){const a=record.geometry.index;geometry.setIndex(new BufferAttribute(a.array,a.itemSize,a.normalized));}geometry.morphAttributes.position=record.geometry.morph.map(data=>new BufferAttribute(data.array,data.itemSize,data.normalized));geometry.morphTargetsRelative=record.geometry.relative;const material=new MeshBasicMaterial();material.name=record.material??'';node=record.skin?new SkinnedMesh(geometry,material):new Mesh(geometry,material);if(record.morph)(node as Mesh).morphTargetInfluences=[...record.morph];if(record.morphNames)(node as Mesh).morphTargetDictionary={...record.morphNames};}
  else node=record.bone?new Bone():new Object3D();
  node.uuid=record.id;node.name=record.name;node.visible=record.visible;node.position.fromArray(record.position);node.quaternion.fromArray(record.quaternion);node.scale.fromArray(record.scale);node.matrix.fromArray(record.matrix);node.matrixAutoUpdate=record.auto;if(record.itemId)node.userData.itemId=record.itemId;objects.set(record.id,node);
  (record.parent<0?parent:objects.get(snapshot.nodes[record.parent].id)!).add(node);
 }
 for(const record of snapshot.nodes)if(record.skin){const node=objects.get(record.id)! as SkinnedMesh,skin=record.skin;node.skeleton=new Skeleton(skin.bones.map(id=>objects.get(id)! as Bone),skin.inverse.map(matrix=>new Matrix4().fromArray(matrix)));node.bindMatrix.fromArray(skin.bind);node.bindMatrixInverse.fromArray(skin.bindInverse);node.bindMode=skin.mode as any;}
 parent.updateMatrixWorld(true);return {model:objects.get(snapshot.model)!,root:objects.get(snapshot.root)!,weapon:snapshot.weapon?objects.get(snapshot.weapon):undefined,parent};
}
export function snapshotCalibration(fit:NativeMeleeContactFit):Calibration{const source=fit as any;return {limbs:[...source.limbs].map(([name,limb]:any)=>({name,first:limb.first,second:limb.second})),flat:[...source.flatRest].map(([name,quaternion]:any)=>({name,quaternion:quaternion.toArray()})),soles:[...source.soles].map(([name,sole]:any)=>({name,floor:sole.floor,outline:[...sole.outline]}))};}
export function restoreCalibration(fit:NativeMeleeContactFit,calibration:Calibration){const target=fit as any;for(const value of calibration.limbs){const limb=target.limbs.get(value.name);if(limb){limb.first=value.first;limb.second=value.second;}}target.flatRest=new Map(calibration.flat.map(value=>[value.name,new Quaternion().fromArray(value.quaternion)]));for(const value of calibration.soles){const sole=target.soles.get(value.name);if(sole){sole.floor=value.floor;sole.outline=[...value.outline];}}}
export function clipSnapshot(clip:AnimationClip){const data=AnimationClip.toJSON(clip);for(let index=0;index<clip.tracks.length;index++)data.tracks[index].interpolation=clip.tracks[index].getInterpolation();return data;}
