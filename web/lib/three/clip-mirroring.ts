import {AnimationClip,Matrix4,Object3D,PropertyBinding,Quaternion,Vector3} from 'three';
import type {KeyframeTrack} from 'three';
export type AnimationMirroring={axis:'x';bones:Record<string,string>};
const cache=new WeakMap<Object3D,WeakMap<AnimationClip,AnimationClip>>();
// Reflection in model X changes the axial quaternion components Y/Z. Rest
// corrections below preserve each destination bone's own roll and local basis.
const reflect=(q:Quaternion)=>q.set(q.x,-q.y,-q.z,q.w);

/** Mirror animation, never anatomy. Source clips and source bones stay intact. */
export function mirroredClip(clip:AnimationClip,rest:Object3D,spec:AnimationMirroring){
  if(spec.axis!=='x')throw Error(`Unsupported animation mirror axis: ${spec.axis}`);
  let clips=cache.get(rest);if(!clips){clips=new WeakMap();cache.set(rest,clips);}const found=clips.get(clip);if(found)return found;
  rest.updateMatrixWorld(true);
  const correction=(source:Object3D,target:Object3D)=>reflect(source.getWorldQuaternion(new Quaternion())).invert().multiply(target.getWorldQuaternion(new Quaternion())).normalize();
  const tracks:KeyframeTrack[]=clip.tracks.map(track=>{
    const parsed=PropertyBinding.parseTrackName(track.name),sourceName=parsed.nodeName??'',targetName=spec.bones[sourceName];
    const source=rest.getObjectByName(sourceName),target=targetName&&rest.getObjectByName(targetName);
    if(!source||!target||spec.bones[targetName]!==sourceName)throw Error(`Missing symmetric animation bone: ${sourceName}`);
    if(parsed.objectName||parsed.propertyIndex!==undefined)throw Error(`Unsupported mirrored track binding: ${track.name}`);
    const sourceParent=source.parent,targetParent=target.parent;
    if(!sourceParent||!targetParent)throw Error(`Missing animation bone parent: ${sourceName}`);
    const parentCorrection=correction(sourceParent,targetParent).invert(),boneCorrection=correction(source,target);
    const copy=track.clone();copy.name=`${targetName}.${parsed.propertyName}`;
    const size=track.getValueSize(),quaternion=new Quaternion(),position=new Vector3();
    if(parsed.propertyName==='quaternion'&&size===4){
      for(let index=0;index<copy.values.length;index+=4){quaternion.fromArray(track.values,index);reflect(quaternion).premultiply(parentCorrection).multiply(boneCorrection).normalize().toArray(copy.values,index);}
    }else if(parsed.propertyName==='position'&&size===3){
      for(let index=0;index<copy.values.length;index+=3){position.fromArray(track.values,index).sub(source.position);position.x*=-1;position.applyQuaternion(parentCorrection).add(target.position).toArray(copy.values,index);}
    }else if(parsed.propertyName==='scale'&&size===3){
      for(let index=0;index<copy.values.length;index+=3){position.fromArray(track.values,index).divide(source.scale).multiply(target.scale).toArray(copy.values,index);}
    }else throw Error(`Unsupported mirrored animation channel: ${track.name}`);
    return copy;
  });
  const mirrored=new AnimationClip(`${clip.name}:left-hand`,clip.duration,tracks,clip.blendMode);clips.set(clip,mirrored);return mirrored;
}

export type MirroredSocket={node:string;mirror?:{socket:string;localAxis:'x'|'y'|'z'}};
/** Fit the offhand grip from the matching right grip, without changing bones.
 * Two reflections keep a proper rotation and positive mesh scale. */
export function fitMirroredSockets(model:Object3D,sockets:Record<string,MirroredSocket>){
  model.updateMatrixWorld(true);
  for(const spec of Object.values(sockets)){
    if(!spec.mirror)continue;
    const sourceSpec=sockets[spec.mirror.socket],source=sourceSpec&&model.getObjectByName(sourceSpec.node),target=model.getObjectByName(spec.node);
    if(!source||!target?.parent)throw Error(`Missing mirrored grip socket: ${spec.node}`);
    const localAxis=spec.mirror.localAxis,modelReflection=new Matrix4().makeScale(-1,1,1),localReflection=new Matrix4().makeScale(localAxis==='x'?-1:1,localAxis==='y'?-1:1,localAxis==='z'?-1:1);
    const desired=modelReflection.multiply(source.matrixWorld).multiply(localReflection);
    desired.premultiply(target.parent.matrixWorld.clone().invert()).decompose(target.position,target.quaternion,target.scale);
    target.updateMatrixWorld(true);
  }
}
