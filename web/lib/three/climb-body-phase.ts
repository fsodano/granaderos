import {AnimationClip,Object3D,Quaternion,Vector3} from 'three';
// A rung-count mapping changes the alternating limbs, not the global
// crouch/crest phase. During the admitted rung section, blend these exact
// native tracks toward the paid fraction. The existing crest remains native.
type Sample={evaluate(time:number):ArrayLike<number>};
type Channel={bone:Object3D;position?:Sample;rotation?:Sample;nativePosition:Vector3;nativeRotation:Quaternion};
export class NativeClimbBodyPhase {
 private clips=new WeakMap<AnimationClip,Channel[]|null>();private adjusted:Channel[]=[];
 private actualPosition=new Vector3();private mappedPosition=new Vector3();private actualRotation=new Quaternion();private mappedRotation=new Quaternion();private correction=new Quaternion();private identity=new Quaternion();
 constructor(private model:Object3D){}
 restore(){for(const channel of this.adjusted){channel.bone.position.copy(channel.nativePosition);channel.bone.quaternion.copy(channel.nativeRotation);}this.adjusted=[];}
 private channels(clip:AnimationClip){
  if(this.clips.has(clip))return this.clips.get(clip)??undefined;
  const channels:Channel[]=[];
  if(Number.isFinite(clip.duration)&&clip.duration>0)for(const name of ['Root','spine_01','spine_02','spine_03']){
   const bone=this.model.getObjectByName(name),track=clip.tracks.find(track=>track.name===name+(name==='Root'?'.position':'.quaternion'));
   if(!bone||!track||!track.times.length||track.getValueSize()!==(name==='Root'?3:4)||!Array.from(track.times).every(Number.isFinite)||!Array.from(track.values).every(Number.isFinite))continue;
   // Three's parsed native tracks expose createInterpolant at runtime.
   const sample=(track as unknown as {createInterpolant():Sample}).createInterpolant();
   channels.push({bone,position:name==='Root'?sample:undefined,rotation:name==='Root'?undefined:sample,nativePosition:new Vector3(),nativeRotation:new Quaternion()});
  }
  const valid=channels.length===4?channels:null;this.clips.set(clip,valid);return valid??undefined;
 }
 supports(clip:AnimationClip|undefined){return Boolean(clip&&this.channels(clip));}
 apply(clip:AnimationClip|undefined,paidFraction:number,mappedFraction:number,down:boolean,weight:number){
  if(!clip||![paidFraction,mappedFraction,weight].every(Number.isFinite)||paidFraction===mappedFraction||weight<=0)return;
  const channels=this.channels(clip);if(!channels)return;
  const phase=(f:number)=>clip.duration*(down?1-f:f),w=Math.min(1,weight);
  for(const channel of channels){const {bone,position,rotation}=channel;channel.nativePosition.copy(bone.position);channel.nativeRotation.copy(bone.quaternion);
   if(position){this.actualPosition.fromArray(position.evaluate(phase(paidFraction)));this.mappedPosition.fromArray(position.evaluate(phase(mappedFraction)));bone.position.addScaledVector(this.actualPosition.sub(this.mappedPosition),w);}
   if(rotation){this.actualRotation.fromArray(rotation.evaluate(phase(paidFraction)));this.mappedRotation.fromArray(rotation.evaluate(phase(mappedFraction)));this.correction.copy(this.actualRotation).multiply(this.mappedRotation.invert());this.actualRotation.copy(this.identity).slerp(this.correction,w);bone.quaternion.premultiply(this.actualRotation);}
  }
  this.adjusted=channels;this.model.updateWorldMatrix(true,true);
 }
}
