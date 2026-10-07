import {AnimationMixer,AnimationAction,Group,Mesh,SkinnedMesh,Skeleton,Material,MeshStandardMaterial,LoopOnce,LoopRepeat,Vector3,Object3D} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {resolveActorAction,selectActorClipVariant} from '../../../game/actor-action-contract.js';
import {boundClip,type LoadedActor,type SocketSpec,type ClipSpec,type EquipmentSpec} from './actor-assets';
import {mirroredClip,fitMirroredSockets,withMirroredProps} from './clip-mirroring';
import {sampleAnimationTime,cueControlsAction} from './animation-clock';
import {TILE_METRES} from './projection';
import {NativeClimbContactFit} from './climb-contact-fit';
import {NativeMeleeContactFit,type ContactActorResolver} from './melee-contact-fit';
import type {ActorVisual} from './presentation';

export type {ContactActorResolver} from './melee-contact-fit';

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
  private climbFit?:NativeClimbContactFit;
  private meleeFit:NativeMeleeContactFit;
  private clothMeshes:{mesh:Mesh;prone:number;crouched:number}[]=[];private clothProne=0;private clothCrouched=0;
  private actionHand:HandRole='handRight';private actionBarrel=0;
  private seatActions=new Map<AnimationAction,{spec:ClipSpec;mounted:boolean}>();private saddlePosition=new Vector3();
  readonly root=new Group();readonly model:Object3D;private mixer:AnimationMixer;private action:AnimationAction|null=null;private actionKey='';private clipSpec:any;private ownedMaterials=new Set<Material>();private equipment=new Group();private equipmentKey='';private clothesKey='';private colorKey='';private horse?:Object3D;private horseMixer?:AnimationMixer;private horseAction?:AnimationAction;private horseClip='';private visual:ActorVisual;private bones=new Map<string,Object3D>();private clothing?:Object3D;private ghost?:Group;private cueStartedAt=0;private temporaryProps=new Map<string,Object3D>();private completedCues=new Set<string>();
  constructor(readonly asset:LoadedActor,visual:ActorVisual,private onCueComplete?:(key:string,id:string)=>void,private contactActor?:ContactActorResolver){
    this.visual=visual;this.model=clone(asset.body.scene);this.root.add(this.model);this.root.name=visual.key;
    this.model.traverse(node=>{this.bones.set(node.name,node);if(node instanceof Mesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;const targets=node.morphTargetDictionary;if(targets?.cloth_prone!==undefined&&targets?.cloth_crouched!==undefined)this.clothMeshes.push({mesh:node,prone:targets.cloth_prone,crouched:targets.cloth_crouched});}});
    this.climbFit=new NativeClimbContactFit(this.model,this.root);
    const walkingClip=asset.animation.animations.find(clip=>clip.name==='stand.walk.blade'),walkingSpec=asset.clips.find(clip=>clip.name==='stand.walk.blade'),walkingSpeed=walkingSpec?.nativeStrideSpeed??walkingSpec?.locomotionSpeed;
    this.meleeFit=new NativeMeleeContactFit(this.model,this.root,asset.appearance.parts?.footwear?.replace('{lod}',String(asset.lod)),false,walkingClip&&walkingSpeed?{clip:walkingClip,speed:walkingSpeed}:undefined);
    fitMirroredSockets(this.model,asset.appearance.sockets??asset.manifest.sockets??asset.manifest.rig?.sockets??{});
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
  private loadingItem(visual:ActorVisual,index=0){
    const reference=visual.action==='reload'?visual.cue?.work?.[index]?.hand:undefined;
    if(!reference)return;
    const item=visual.items.find(item=>item.reference===reference&&['handRight','handLeft'].includes(item.socket));
    if(!item)throw Error(`Missing admitted loading hand: ${visual.key}:${reference}`);
    return item;
  }
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
    if(this.visual.action==='reload'&&this.visual.equipment==='short-gun')free.add(this.actionHand==='handLeft'?'handRight':'handLeft');
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
      const stowItem=stow?spec.stowItems?.find(fitting=>fitting.categories.includes(item.category??'')):undefined;
      const role=stow?(stowItem?.socket??item.stowedSocket??'hipLeft'):hand==='hip'?(item.stowedSocket??'hipLeft'):hand;
      const target=this.socket(role,['handRight','handLeft'].includes(role)?item.grip:undefined);
      if(!target)throw Error(`Missing ${role} socket for presentation item: ${object.userData.itemId}`);
      if(object.parent!==target)target.add(object);
      // Native loading clips slide the supporting palm along the barrel.
      // The authored offset follows that clip's clock and returns to zero;
      // inventory ownership and the geometry's dimensions stay unchanged.
      this.itemTransform(object,item);
      if(stowItem){
        if(stowItem.position){object.position.x+=stowItem.position[0];object.position.y+=stowItem.position[1];object.position.z+=stowItem.position[2];}
        if(stowItem.rotation)object.rotation.fromArray([...stowItem.rotation,'XYZ'] as any);
      }
      const grip=!stow&&held?spec.gripOffsets?.find(offset=>offset.hand===hand):undefined;
      if(grip?.keys.length){
        let position=grip.keys[0].position;
        for(let index=1;index<grip.keys.length;index++){
          const a=grip.keys[index-1],b=grip.keys[index];
          if(time>=b.time){position=b.position;continue;}
          const fraction=Math.max(0,(time-a.time)/(b.time-a.time));position=a.position.map((value,axis)=>value+(b.position[axis]-value)*fraction);break;
        }
        object.position.x+=position[0];object.position.y+=position[1];object.position.z+=position[2];
      }
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
    let workIndex:number|undefined;
    if(visual.action==='reload'&&visual.cue?.work?.length){
      const bound=boundClip(this.asset.clips,this.asset.animation.animations,spec.clip);
      workIndex=sampleAnimationTime({clip:{...bound.spec,duration:bound.clip.duration},action:visual.action,cue:visual.cue,now}).workIndex;
    }
    const loadingItem=this.loadingItem(visual,workIndex),mainItem=loadingItem??visual.items.find(item=>item.socket==='handRight');
    const itemSemantic=(mainItem&&this.itemSpec(mainItem.id)?.clipOverrides?.[spec.clip])??spec.clip;
    const barrel=loadingItem?visual.cue?.work?.[workIndex??0]?.barrel??0:0,barrelClips=this.asset.clips.find(clip=>clip.name===itemSemantic)?.barrelClips;
    if(barrelClips&&!barrelClips[barrel])throw Error(`Missing admitted loading barrel: ${visual.key}:${barrel}`);
    const semantic=selectActorClipVariant(barrelClips?.[barrel]??itemSemantic,visual.cue?.id);
    const {spec:sourceSpec,clip:sourceClip}=boundClip(this.asset.clips,this.asset.animation.animations,semantic);
    const hand=(loadingItem?.socket??visual.cue?.hand??'handRight') as HandRole,mirror=hand==='handLeft'&&visual.equipment==='short-gun'&&['aim','fire','reload'].includes(visual.action);
    if(mirror&&!this.asset.manifest.animationMirroring)throw Error(`Missing left-hand animation mapping: ${this.asset.appearance.id}`);
    const clip=mirror?mirroredClip(sourceClip,this.asset.body.scene,this.asset.manifest.animationMirroring!):sourceClip;
    const clipSpec=mirror?withMirroredProps(sourceSpec,this.asset.body.scene):sourceSpec;
    const key=`${semantic}:${hand}:${visual.cue?.id??''}`;
    if(key!==this.actionKey){
      const previous=this.action;this.action=this.mixer.clipAction(clip);this.action.reset();this.action.enabled=true;this.action.clampWhenFinished=!clipSpec.loop;this.action.setLoop(clipSpec.loop?LoopRepeat:LoopOnce,clipSpec.loop?Infinity:1);this.action.play();
      if(previous&&previous!==this.action){if(visual.action==='fire'&&visual.cue?.shotHand)previous.stop();else this.action.crossFadeFrom(previous,.12,false);}this.actionKey=key;this.clipSpec=clipSpec;this.cueStartedAt=visual.cue?.startedAt??now;
      if(this.horse)this.seatActions.set(this.action,{spec:clipSpec,mounted:visual.mounted||visual.cue?.fromPosture==='mounted'});
    }
    this.actionHand=hand;this.actionBarrel=barrel;
    if(this.horse&&this.horseMixer){
      const horseAction=visual.action==='run'?'run':visual.action==='walk'?'walk':'idle',horseClip=this.asset.manifest.horse?.actions?.[horseAction];
      if(horseClip&&horseClip!==this.horseClip){const clip=this.asset.horse!.animations.find(clip=>clip.name===horseClip);if(!clip)throw Error(`Missing horse action: ${horseClip}`);const previous=this.horseAction;this.horseAction=this.horseMixer.clipAction(clip).reset().play();if(previous)this.horseAction.crossFadeFrom(previous,.15,false);this.horseClip=horseClip;}
      this.horse.visible=visual.mounted||['mount','dismount'].includes(visual.action)||visual.cue?.fromPosture==='mounted';

    }
    this.placeEquipment(this.action?.time??0);
  }
  private restVisual(visual:ActorVisual):ActorVisual{
    const life=visual.action==='die'?'dead':visual.action==='collapse'?'unconscious':visual.action==='knockdown'?'idle':visual.action==='dead'||visual.action==='unconscious'?visual.action:visual.idleAction;
    return {...visual,action:life,cue:undefined};
  }
  private timedProps(time:number){
    const desired=new Set<string>();
    for(const cue of this.clipSpec.propCues??[]){
      if(time<cue.start||time>cue.end)continue;const key=`${cue.item}:${cue.socket}`;desired.add(key);
      const spec=this.asset.manifest.equipment.items[cue.item],source=spec&&this.asset.equipment.scene.getObjectByName(spec.node),socket=this.model.getObjectByName(cue.socket);
      if(!source||!socket)throw Error(`Missing timed prop or socket: ${key}`);
      if(cue.scale!==undefined&&!(Number.isFinite(cue.scale)&&cue.scale>0))throw Error(`Invalid timed prop scale: ${key}`);
      let object=this.temporaryProps.get(key);if(!object){object=source.clone(true);socket.add(object);this.temporaryProps.set(key,object);}
      object.position.fromArray(cue.position??spec.position??[0,0,0]);object.rotation.fromArray([...(cue.rotation??spec.rotation??[0,0,0]),'XYZ'] as any);object.scale.setScalar((spec.scale??1)*(cue.scale??1));
    }
    for(const [key,object]of this.temporaryProps)if(!desired.has(key)){object.removeFromParent();this.temporaryProps.delete(key);}
  }
  private poseCloth(delta:number){
    if(!this.clothMeshes.length||!this.action)return;
    const spec=this.clipSpec,time=this.action.time,duration=this.action.getClip().duration,posture=spec.posture??this.visual.posture;
    let prone=posture==='prone'?1:0,crouched=posture==='crouched'?1:0;
    if(spec.gesture==='transition'){
      const fraction=Math.max(0,Math.min(1,time/duration)),from=spec.fromPosture,to=spec.toPosture;
      prone=(from==='prone'?1-fraction:0)+(to==='prone'?fraction:0);crouched=(from==='crouched'?1-fraction:0)+(to==='crouched'?fraction:0);
    }else if(['dead','unconscious'].includes(spec.gesture)){prone=1;crouched=0;}
    else if(['die','collapse','knockdown'].includes(spec.gesture)){
      const fraction=Math.max(0,Math.min(1,time/(spec.markers?.ground??duration)));
      prone+=(1-prone)*fraction;crouched*=1-fraction;
    }else if(spec.gesture==='recover'){
      const fraction=Math.max(0,Math.min(1,time/duration));prone=1-fraction;crouched=0;
    }
    // The same animation clock drives body and cloth. This short smoothing
    // follows ordinary clip crossfades without adding a cloth simulation.
    const blend=1-Math.exp(-Math.max(0,delta)/.045);
    this.clothProne+=(prone-this.clothProne)*blend;this.clothCrouched+=(crouched-this.clothCrouched)*blend;
    for(const {mesh,prone,crouched}of this.clothMeshes){mesh.morphTargetInfluences![prone]=this.clothProne;mesh.morphTargetInfluences![crouched]=this.clothCrouched;}
  }
  private placeRider(saddle:number[]|undefined){
    this.model.position.set(0,0,0);let totalWeight=0;
    for(const [action,{spec,mounted}]of this.seatActions){
      if(!action.enabled||!action.isScheduled()){if(action!==this.action)this.seatActions.delete(action);continue;}
      const blend=action.getEffectiveWeight();totalWeight+=blend;
      if(!spec.seatAnchor||!saddle)continue;
      let weight=mounted?1:0;const keys=spec.seatWeight;
      if(keys?.length){
        weight=keys[0].weight;
        for(let index=1;index<keys.length;index++){
          const a=keys[index-1],b=keys[index];
          if(action.time>=b.time){weight=b.weight;continue;}
          weight=a.weight+(b.weight-a.weight)*Math.max(0,(action.time-a.time)/(b.time-a.time));break;
        }
      }
      this.model.position.x+=(saddle[0]-spec.seatAnchor[0])*weight*blend;
      this.model.position.y+=(saddle[1]-spec.seatAnchor[1])*weight*blend;
      this.model.position.z+=(saddle[2]-spec.seatAnchor[2])*weight*blend;
    }
    // Match the body's animation weights, including interrupted crossfades.
    // Mount clips already use horse coordinates; seated clips use native
    // body coordinates. Switching their offsets before the pose caused a jump.
    if(totalWeight>1)this.model.position.divideScalar(totalWeight);
  }
  tick(delta:number,now:number,reducedMotion=false){
    if(!this.action)return;
    this.meleeFit.restore();
    this.climbFit?.restore();
    const visual=this.visual,clip=this.action.getClip(),motion=visual.motion;
    const projected=(x=0,y=0)=>x*Math.sin(visual.yaw)+y*Math.cos(visual.yaw);
    const strafe=visual.action==='strafeLeft'||visual.action==='strafeRight';
    const direction=strafe?1:projected(motion?.travelX,motion?.travelY)<0?-1:1;
    // Total path length keeps gait phase through turns. Net displacement loses
    // distance on curved paths; projecting it onto a new facing loses more.
    const inputMotion=motion?{...motion,elapsedDistance:motion.elapsedDistance===undefined?undefined:motion.elapsedDistance*TILE_METRES,signedDistance:motion.elapsedDistance===undefined?undefined:motion.elapsedDistance*TILE_METRES*direction,speed:(motion.speed??0)*TILE_METRES,signedForwardSpeed:direction*(motion.speed??0)*TILE_METRES}:undefined;
    const timing=sampleAnimationTime({clip:{...this.clipSpec,duration:clip.duration},action:visual.action,cue:visual.cue,motion:inputMotion,now,reducedMotion});
    const loadingItem=this.loadingItem(visual,timing.workIndex);
    const barrel=visual.cue?.work?.[timing.workIndex??0]?.barrel??0;
    if(loadingItem&&(loadingItem.socket!==this.actionHand||barrel!==this.actionBarrel)){this.update(visual,now);this.tick(0,now,reducedMotion);return;}
    if(timing.complete&&visual.cue&&!this.clipSpec.loop){
      // Retain the exact terminal pose while it blends to the resting clip.
      this.action.time=timing.time??clip.duration;this.action.timeScale=0;this.mixer.update(0);
      const id=visual.cue.id;this.completedCues.add(`${id}:${visual.cue.phase??''}`);this.update(this.restVisual(visual),now);this.onCueComplete?.(visual.key,id);this.tick(0,now,reducedMotion);return;
    }
    this.action.timeScale=timing.rate;if(timing.time!==undefined)this.action.time=timing.time;
    if(motion?.moving&&motion.climbGeometry&&this.clipSpec.climbSupport){const down=visual.action==='climbDown',fraction=this.climbFit!.nativeFraction(motion.climbGeometry,down?1-(motion.segmentFraction??0):motion.segmentFraction??0,this.clipSpec);this.action.time=clip.duration*(down?1-fraction:fraction);}
    this.mixer.update(Math.min(delta,.1));
    if(motion?.moving&&motion.climbGeometry&&this.clipSpec.climbSupport)this.climbFit?.apply(motion.climbGeometry,visual.action==='climbDown'?1-(motion.segmentFraction??0):motion.segmentFraction??0,this.clipSpec);
    this.poseCloth(Math.min(delta,.1));
    const attached=this.equipment.userData.attached as Object3D[],freeGuard=!attached.some(item=>item.userData.hand==='handLeft');
    const meleeWeapon=attached.find(item=>item.userData.hand==='handRight'&&(this.itemSpec(item.userData.itemId)?.category==='sabre'||freeGuard&&this.itemSpec(item.userData.itemId)?.category==='pistol'));
    this.meleeFit.apply(visual.cue,clip,this.clipSpec,meleeWeapon,this.action.time,this.contactActor);
    this.placeEquipment(this.action.time);this.timedProps(this.action.time);
    if(this.horse&&this.horseMixer){
      const visibility=this.clipSpec.horseVisibility;
      if(visibility)this.horse.visible=this.action.time>=visibility.start&&this.action.time<=visibility.end;
      if(this.horseAction){const horseSpec=this.asset.manifest.horse?.clips?.find(clip=>clip.name===this.horseClip),horseTime=sampleAnimationTime({clip:{duration:this.horseAction.getClip().duration,loop:true,locomotionSpeed:horseSpec?.locomotionSpeed},action:visual.action,motion:inputMotion,now});this.horseAction.timeScale=horseTime.rate;if(horseTime.time!==undefined)this.horseAction.time=horseTime.time;}
      this.horseMixer.update(Math.min(delta,.1));
      const saddleSpec=this.asset.manifest.horse?.saddle;
      const socket=saddleSpec&&this.horse.getObjectByName(saddleSpec.node);
      // Read the animated saddle in actor-local space, after the horse mixer.
      this.root.updateMatrixWorld(true);
      const saddle=socket?this.root.worldToLocal(socket.getWorldPosition(this.saddlePosition)).toArray():saddleSpec?.position;
      this.placeRider(saddle);
    }
  }
  anchor(role:string){
    const hand=this.actionHand,held=this.visual.items.find(item=>item.socket===hand),spec=held&&this.itemSpec(held.id);
    const instance=(this.equipment.userData.attached as Object3D[]).find(item=>item.userData.hand===hand);
    const node=role==='muzzle'&&spec?.muzzle?instance?.getObjectByName(spec.muzzle):this.socket(role);
    return node?.getWorldPosition(new Vector3())??null;
  }
  dispose(){
    this.meleeFit.dispose();
    this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.horseMixer?.stopAllAction();if(this.horse)this.horseMixer?.uncacheRoot(this.horse);
    const skeletons=new Set<Skeleton>();this.root.traverse(node=>{if(node instanceof SkinnedMesh)skeletons.add(node.skeleton);});for(const skeleton of skeletons)skeleton.dispose();
    for(const material of this.ownedMaterials)material.dispose();this.ownedMaterials.clear();this.root.removeFromParent();
  }
}
