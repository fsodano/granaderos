import {AnimationMixer,AnimationAction,Group,Mesh,SkinnedMesh,Skeleton,Material,MeshStandardMaterial,LoopOnce,LoopRepeat,Vector3,Object3D} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {resolveActorAction} from '../../../game/actor-action-contract.js';
import {boundClip,type LoadedActor,type SocketSpec,type ClipSpec,type EquipmentSpec} from './actor-assets';
import {sampleAnimationTime,cueControlsAction} from './animation-clock';
import {TILE_METRES} from './projection';
import type {ActorVisual} from './presentation';

type HandRole='handRight'|'handLeft';
// Authored gesture requirements are presentation metadata, not inventory moves.
// A replacement clip can override them with freeHands, including an empty list.
const gestureHands:Record<string,HandRole[]>={
  heal:['handRight','handLeft'],fitting:['handRight','handLeft'],tool:['handRight','handLeft'],breach:['handRight','handLeft'],free:['handRight','handLeft'],
  offer:['handRight'],grab:['handRight'],pickup:['handRight'],equip:['handRight'],door:['handRight'],ration:['handRight'],throw:['handRight'],throwKnife:['handRight'],bolas:['handRight'],signal:['handRight'],
};

/** Separate mesh parts can share one palette when their bind data is equal.
 * Bone identity is checked, so another actor or a horse can never share it. */
function shareSkeletons(root:Object3D){
  const palettes:Skeleton[]=[];
  root.traverse(node=>{
    if(!(node instanceof SkinnedMesh))return;
    const source=node.skeleton;
    const shared=palettes.find(other=>other===source||other.bones.length===source.bones.length&&other.boneInverses.length===source.boneInverses.length&&other.bones.every((bone,index)=>bone===source.bones[index]&&other.boneInverses[index].equals(source.boneInverses[index])));
    if(shared){if(shared!==source){node.skeleton=shared;source.dispose();}}
    else palettes.push(source);
  });
}

/** This object consumes presentation records. It cannot issue orders. */
export class ActorRuntime {
  readonly root=new Group();readonly model:Object3D;private mixer:AnimationMixer;private action:AnimationAction|null=null;private actionKey='';private clipSpec:any;private ownedMaterials=new Set<Material>();private equipment=new Group();private equipmentKey='';private clothesKey='';private colorKey='';private horse?:Object3D;private horseMixer?:AnimationMixer;private horseAction?:AnimationAction;private horseClip='';private visual:ActorVisual;private bones=new Map<string,Object3D>();private clothing?:Object3D;private ghost?:Group;private cueStartedAt=0;private temporaryProps=new Map<string,Object3D>();private completedCues=new Set<string>();
  constructor(readonly asset:LoadedActor,visual:ActorVisual,private onCueComplete?:(key:string,id:string)=>void){
    this.visual=visual;this.model=clone(asset.body.scene);this.root.add(this.model);this.root.name=visual.key;
    this.model.traverse(node=>{this.bones.set(node.name,node);if(node instanceof Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
    this.mixer=new AnimationMixer(this.model);
    if(asset.garments){
      this.clothing=clone(asset.garments.scene);
      const meshes:Mesh[]=[];this.clothing.traverse(node=>{if(node instanceof Mesh)meshes.push(node);});
      for(const mesh of meshes){
        if(mesh instanceof SkinnedMesh){const bones=mesh.skeleton.bones.map(bone=>this.bones.get(bone.name));if(bones.some(bone=>!bone))throw Error(`Garment rig does not match ${asset.appearance.id}`);mesh.bind(new Skeleton(bones as any,mesh.skeleton.boneInverses),mesh.bindMatrix);}
        mesh.visible=false;mesh.castShadow=true;mesh.frustumCulled=false;this.model.add(mesh);
      }
      this.clothing=new Group(); // Meshes use the character bones, never a second animation clock.
      this.clothing.userData.meshes=meshes;
    }
    if(asset.horse){this.horse=clone(asset.horse.scene);this.root.add(this.horse);this.horse.traverse(node=>{if(node instanceof Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});this.horseMixer=new AnimationMixer(this.horse);}
    shareSkeletons(this.root);
    this.update(visual,performance.now());
  }
  private socket(role:string,grip?:string){
    const sockets=this.asset.appearance.sockets??this.asset.manifest.sockets??this.asset.manifest.rig?.sockets??{};
    const spec:SocketSpec|undefined=sockets[grip?`${role}_${grip}`:role]??sockets[role];
    return spec?this.model.getObjectByName(spec.node):this.bones.get(this.asset.manifest.bones[role]??role);
  }
  private dress(visual:ActorVisual){
    const key=JSON.stringify(visual.garments);if(key===this.clothesKey)return;this.clothesKey=key;
    const garmentSpecs=this.asset.manifest.garments?.[this.asset.appearance.gender]?.items??{};
    const owned=Object.values(visual.garments).filter((id):id is string=>Boolean(id));
    const hidden=new Set(owned.flatMap(id=>garmentSpecs[id]?.hideAppearanceParts??[]));
    for(const [part,pattern]of Object.entries(this.asset.appearance.parts??{})){
      const node=this.model.getObjectByName(pattern.replace('{lod}',String(this.asset.lod)));if(node)node.visible=!hidden.has(part);
    }
    for(const mesh of (this.clothing?.userData.meshes??[]) as Mesh[])mesh.visible=owned.some(id=>mesh.name===garmentSpecs[id]?.node||mesh.name.startsWith(`${garmentSpecs[id]?.node}_`));
  }
  private palette(visual:ActorVisual){
    if(visual.skin===this.colorKey)return;this.colorKey=visual.skin;
    const skinName=this.asset.appearance.materials?.skin??'Skin';
    this.model.traverse(node=>{if(!(node instanceof Mesh))return;
      const materials=Array.isArray(node.material)?node.material:[node.material];
      const updated=materials.map(material=>{if(material.name!==skinName&&material.userData.role!=='skin')return material;let owned=material;if(!this.ownedMaterials.has(material)){owned=material.clone();this.ownedMaterials.add(owned);}if(owned instanceof MeshStandardMaterial)owned.color.set(this.asset.manifest.skinTones?.[visual.skin]??({light:'#d5a788',brown:'#965d40',dark:'#51301f'} as Record<string,string>)[visual.skin]);return owned;});
      node.material=Array.isArray(node.material)?updated:updated[0];
    });
  }
  private itemSpec(id:string){return this.asset.manifest.equipment.items[this.asset.manifest.equipment.aliases?.[id]??id];}
  private equip(visual:ActorVisual){
    const key=JSON.stringify(visual.items);if(key===this.equipmentKey)return;this.equipmentKey=key;
    for(const item of [...this.equipment.children])item.removeFromParent();
    // Equipment children are attached to bones, so retain their references separately.
    for(const item of this.equipment.userData.attached??[])item.removeFromParent();this.equipment.userData.attached=[];
    for(const item of visual.items){
      const spec=this.itemSpec(item.id);if(!spec)throw Error(`Missing carried item: ${item.id}`);
      const source=this.asset.equipment.scene.getObjectByName(spec.node);if(!source)throw Error(`Missing equipment geometry: ${spec.node}`);
      const role=item.socket==='hip'?(spec.stowedSocket??'hipLeft'):item.socket;
      const socket=this.socket(role,['handRight','handLeft'].includes(role)?spec.grip:undefined);if(!socket)throw Error(`Missing ${role} socket: ${visual.appearance}`);
      const object=source.clone(true);object.name=`${item.reference}:${item.id}`;
      object.position.fromArray(spec.position??[0,0,0]);object.rotation.fromArray([...(spec.rotation??[0,0,0]),'XYZ'] as any);object.scale.setScalar(spec.scale??1);
      for(const fitting of Object.values(item.fittings??{}) as any[]){
        const fit=this.asset.manifest.equipment.fittings?.[fitting.fittingPattern];
        if(!fit)throw Error(`Missing fitting: ${fitting.fittingPattern}`);
        const source=this.asset.equipment.scene.getObjectByName(fit.node);if(!source)throw Error(`Missing fitting geometry: ${fit.node}`);
        const attachment=source.clone(true);attachment.name=`fitting:${fitting.fittingPattern}`;attachment.position.fromArray(fit.position??[0,0,0]);attachment.rotation.fromArray([...(fit.rotation??[0,0,0]),'XYZ'] as any);attachment.scale.setScalar(fit.scale??1);object.add(attachment);
      }
      object.userData.hand=item.socket;object.userData.reference=item.reference;object.userData.itemId=item.id;
      object.traverse(node=>{if(node instanceof Mesh){node.castShadow=true;node.receiveShadow=true;}});
      socket.add(object);this.equipment.userData.attached.push(object);
    }
  }
  private itemTransform(object:Object3D,spec:EquipmentSpec){
    object.position.fromArray(spec.position??[0,0,0]);object.rotation.fromArray([...(spec.rotation??[0,0,0]),'XYZ'] as any);object.scale.setScalar(spec.scale??1);
  }
  private propHand(socketName:string):HandRole|undefined{
    const sockets=this.asset.appearance.sockets??this.asset.manifest.sockets??this.asset.manifest.rig?.sockets??{};
    for(const [role,spec]of Object.entries(sockets))if(spec.node===socketName){if(role.startsWith('handRight'))return 'handRight';if(role.startsWith('handLeft'))return 'handLeft';}
    let node=this.model.getObjectByName(socketName);
    while(node){for(const role of ['handRight','handLeft'] as const)if(node.name===this.asset.manifest.bones[role])return role;node=node.parent??undefined;}
    return undefined;
  }
  private placeEquipment(time:number){
    const spec:ClipSpec=this.clipSpec;if(!spec)return;
    const free=new Set(spec.freeHands??gestureHands[spec.gesture??'']??[]),propHands=new Set<HandRole>();
    for(const cue of spec.propCues??[])if(time>=cue.start&&time<=cue.end){const hand=this.propHand(cue.socket);if(hand)propHands.add(hand);}
    for(const object of (this.equipment.userData.attached??[]) as Object3D[]){
      const hand=object.userData.hand as string,item=this.itemSpec(object.userData.itemId);if(!item)continue;
      const held=hand==='handRight'||hand==='handLeft';
      const weapon=['rifle','pistol','sabre','knife','lance'].includes(item.category??'')||['rifle','pistol','sabre'].includes(item.grip??'');
      const handProp=spec.handProps?.find(prop=>prop.hand===hand&&prop.categories.includes(item.category??''));
      const release=handProp?.untilMarker?spec.markers?.[handProp.untilMarker]:undefined;
      if(handProp?.untilMarker&&!Number.isFinite(release))throw Error(`Missing held prop marker: ${handProp.untilMarker}`);
      // A thrown item stays in the hand through preparation, then leaves at
      // the authored release marker. This changes visibility, never ownership.
      object.visible=release===undefined||time<release;
      // Active tools and supplies remain visible for their own gestures. Timed
      // props claim their hand even when the current item is a tool.
      const stow=held&&(propHands.has(hand as HandRole)||weapon&&free.has(hand as HandRole)&&!handProp);
      const role=stow?(item.stowedSocket??'hipLeft'):hand==='hip'?(item.stowedSocket??'hipLeft'):hand;
      const target=this.socket(role,['handRight','handLeft'].includes(role)?item.grip:undefined);
      if(!target)throw Error(`Missing ${role} socket for presentation item: ${object.userData.itemId}`);
      if(object.parent!==target){target.add(object);this.itemTransform(object,item);}
      object.userData.presentationStowed=stow;
    }
  }
  update(visual:ActorVisual,now:number){
    if(!cueControlsAction(visual.action,visual.cue))visual={...visual,cue:undefined};
    const cueKey=visual.cue?`${visual.cue.id}:${visual.cue.phase??''}`:'';
    if(cueKey&&this.completedCues.has(cueKey))visual=this.restVisual(visual);
    this.visual=visual;this.root.position.fromArray(visual.position);this.root.rotation.y=visual.yaw;
    this.palette(visual);this.dress(visual);this.equip(visual);
    const request={action:visual.action,posture:visual.cue?.fromPosture??visual.posture,mounted:visual.cue?.fromPosture?visual.cue.fromPosture==='mounted':visual.mounted,equipment:visual.equipment};
    const spec=resolveActorAction(request);if(!spec)throw Error(`Unsupported character action: ${JSON.stringify(request)}`);
    const mainItem=visual.items.find(item=>item.socket==='handRight');
    const semantic=(mainItem&&this.itemSpec(mainItem.id)?.clipOverrides?.[spec.clip])??spec.clip;
    const {spec:clipSpec,clip}=boundClip(this.asset.clips,this.asset.animation.animations,semantic);
    const key=`${semantic}:${visual.cue?.id??''}`;
    if(key!==this.actionKey){
      const previous=this.action;this.action=this.mixer.clipAction(clip);this.action.reset();this.action.enabled=true;this.action.clampWhenFinished=!clipSpec.loop;this.action.setLoop(clipSpec.loop?LoopRepeat:LoopOnce,clipSpec.loop?Infinity:1);this.action.play();
      if(previous&&previous!==this.action){this.action.crossFadeFrom(previous,.12,false);}this.actionKey=key;this.clipSpec=clipSpec;this.cueStartedAt=visual.cue?.startedAt??now;
    }
    if(this.horse&&this.horseMixer){
      const horseAction=visual.action==='run'?'run':visual.action==='walk'?'walk':'idle',horseClip=this.asset.manifest.horse?.actions?.[horseAction];
      if(horseClip&&horseClip!==this.horseClip){const clip=this.asset.horse!.animations.find(clip=>clip.name===horseClip);if(!clip)throw Error(`Missing horse action: ${horseClip}`);const previous=this.horseAction;this.horseAction=this.horseMixer.clipAction(clip).reset().play();if(previous)this.horseAction.crossFadeFrom(previous,.15,false);this.horseClip=horseClip;}
      this.horse.visible=visual.mounted||['mount','dismount'].includes(visual.action)||visual.cue?.fromPosture==='mounted';

    }
    this.placeEquipment(this.action?.time??0);
  }
  private restVisual(visual:ActorVisual):ActorVisual{
    const life=visual.action==='die'?'dead':visual.action==='collapse'?'unconscious':visual.action==='dead'||visual.action==='unconscious'?visual.action:visual.idleAction;
    return {...visual,action:life,cue:undefined};
  }
  private timedProps(time:number){
    const desired=new Set<string>();
    for(const cue of this.clipSpec.propCues??[]){
      if(time<cue.start||time>cue.end)continue;const key=`${cue.item}:${cue.socket}`;desired.add(key);
      if(this.temporaryProps.has(key))continue;
      const spec=this.asset.manifest.equipment.items[cue.item],source=spec&&this.asset.equipment.scene.getObjectByName(spec.node),socket=this.model.getObjectByName(cue.socket);
      if(!source||!socket)throw Error(`Missing timed prop or socket: ${key}`);
      const object=source.clone(true);object.position.fromArray(spec.position??[0,0,0]);object.rotation.fromArray([...(spec.rotation??[0,0,0]),'XYZ'] as any);object.scale.setScalar(spec.scale??1);socket.add(object);this.temporaryProps.set(key,object);
    }
    for(const [key,object]of this.temporaryProps)if(!desired.has(key)){object.removeFromParent();this.temporaryProps.delete(key);}
  }
  tick(delta:number,now:number,reducedMotion=false){
    if(!this.action)return;
    const visual=this.visual,clip=this.action.getClip(),motion=visual.motion;
    const projected=(x=0,y=0)=>x*Math.sin(visual.yaw)+y*Math.cos(visual.yaw);
    const strafe=visual.action==='strafeLeft'||visual.action==='strafeRight';
    const direction=strafe?1:projected(motion?.travelX,motion?.travelY)<0?-1:1;
    // Total path length keeps gait phase through turns. Net displacement loses
    // distance on curved paths; projecting it onto a new facing loses more.
    const inputMotion=motion?{...motion,elapsedDistance:motion.elapsedDistance===undefined?undefined:motion.elapsedDistance*TILE_METRES,signedDistance:motion.elapsedDistance===undefined?undefined:motion.elapsedDistance*TILE_METRES*direction,speed:(motion.speed??0)*TILE_METRES,signedForwardSpeed:direction*(motion.speed??0)*TILE_METRES}:undefined;
    const timing=sampleAnimationTime({clip:{...this.clipSpec,duration:clip.duration},action:visual.action,cue:visual.cue,motion:inputMotion,now,reducedMotion});
    if(timing.complete&&visual.cue&&!this.clipSpec.loop){const id=visual.cue.id;this.completedCues.add(`${id}:${visual.cue.phase??''}`);this.update(this.restVisual(visual),now);this.onCueComplete?.(visual.key,id);this.tick(0,now,reducedMotion);return;}
    this.action.timeScale=timing.rate;if(timing.time!==undefined)this.action.time=timing.time;
    this.mixer.update(Math.min(delta,.1));this.placeEquipment(this.action.time);this.timedProps(this.action.time);
    if(this.horse&&this.horseMixer){
      if(this.horseAction){const horseSpec=this.asset.manifest.horse?.clips?.find(clip=>clip.name===this.horseClip),horseTime=sampleAnimationTime({clip:{duration:this.horseAction.getClip().duration,loop:true,locomotionSpeed:horseSpec?.locomotionSpeed},action:visual.action,motion:inputMotion,now});this.horseAction.timeScale=horseTime.rate;if(horseTime.time!==undefined)this.horseAction.time=horseTime.time;}
      this.horseMixer.update(Math.min(delta,.1));
      const anchor=this.clipSpec.seatAnchor,saddleSpec=this.asset.manifest.horse?.saddle;
      const socket=saddleSpec&&this.horse.getObjectByName(saddleSpec.node);
      // Read the animated saddle in actor-local space, after the horse mixer.
      this.root.updateMatrixWorld(true);
      const saddle=socket?this.root.worldToLocal(socket.getWorldPosition(new Vector3())).toArray():saddleSpec?.position;
      let weight=visual.mounted||visual.cue?.fromPosture==='mounted'?1:0;
      const keys=this.clipSpec.seatWeight;
      if(keys?.length){const t=this.action.time;weight=keys[0].weight;for(let index=1;index<keys.length;index++){const a=keys[index-1],b=keys[index];if(t>=b.time){weight=b.weight;continue;}weight=a.weight+(b.weight-a.weight)*Math.max(0,(t-a.time)/(b.time-a.time));break;}}
      this.model.position.set(anchor&&saddle?(saddle[0]-anchor[0])*weight:0,anchor&&saddle?(saddle[1]-anchor[1])*weight:0,anchor&&saddle?(saddle[2]-anchor[2])*weight:0);
    }
  }
  anchor(role:string){
    const right=this.visual.items.find(item=>item.socket==='handRight'),spec=right&&this.itemSpec(right.id);
    const instance=(this.equipment.userData.attached as Object3D[]).find(item=>item.userData.hand==='handRight');
    const node=role==='muzzle'&&spec?.muzzle?instance?.getObjectByName(spec.muzzle):this.socket(role);
    return node?.getWorldPosition(new Vector3())??null;
  }
  dispose(){
    this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.horseMixer?.stopAllAction();if(this.horse)this.horseMixer?.uncacheRoot(this.horse);
    const skeletons=new Set<Skeleton>();this.root.traverse(node=>{if(node instanceof SkinnedMesh)skeletons.add(node.skeleton);});for(const skeleton of skeletons)skeleton.dispose();
    for(const material of this.ownedMaterials)material.dispose();this.ownedMaterials.clear();this.root.removeFromParent();
  }
}
