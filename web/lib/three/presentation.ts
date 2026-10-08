import {ACTOR_ACTION_CAPABILITIES} from '../../../game/actor-action-contract.js';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {spriteSkinTone} from '../../../game/sprite-skin.js';
import {spriteEquipment} from '../../../game/sprite-equipment.js';
import {handLayout} from '../../../game/hand-layout.js';
import {fixedBayonetFor} from '../../../game/weapon-fittings.js';
import {wornOutfit} from '../../../game/outfits.js';
import {canSee,tileIllumination} from '../../../game/tactical.js';
import {relativeBodyHeight} from '../../../game/sight-geometry.js';
import {tacticalLevel,spaceKey,surfaceHeight,surfaceAt} from '../../../game/tactical-space.js';
import {propBlocksAt} from '../../../game/props.js';
import {isInteriorVisible} from '../../../game/tactical-visibility.js';
import {actorInteriorReadable} from '../../../game/scene-readability.js';
import {roomDressings} from '../../../game/room-dressing.js';
import {artilleryProfile} from '../../../game/artillery-definitions.js';
import {groundLootPiles} from '../../../game/ja2-hud.js';
import {renderedSurfaceHeight} from '../tactical-elevation';
import type {Motion} from '../../app/useUnitMotion';
import {TILE_METRES,actorYaw} from './projection';
import type {WorldInput} from './world-types';
import {climbOpenings,surfaceRectangles} from './world-climb-openings';
import type {AnimationWork} from './animation-clock';

export type ActorKind='unit'|'npc';
export type ActorEntry={key:string;kind:ActorKind;actor:any};
export type ContactTarget={key:string;appearance:string;position:[number,number,number];yaw:number;posture:string;mounted:boolean;action:string;bodyHeights:Record<string,number>};
export type ContactSupport={floors:readonly {minX:number;maxX:number;minZ:number;maxZ:number;height:number}[]};
export type CareCue={mode:'self'}|{mode:'patient';target:ContactTarget;support:ContactSupport};
export type ActorCue={id:string;action:string;shotHand?:'primary'|'offhand';hand?:'handRight'|'handLeft';startedAt:number;durationMs?:number;phase?:string;phaseStartedAt?:number;phaseDurationMs?:number;fromPosture?:string;toPosture?:string;work?:readonly AnimationWork[];contactTurn?:{fromYaw:number;toYaw:number};contactTarget?:ContactTarget;contactSupport?:ContactSupport;care?:CareCue;healInterval?:true};
export type VisualItem={id:string;reference:string;socket:'handRight'|'handLeft'|'back'|'hip';fittings?:any};
export type ActorVisual={key:string;id:string;kind:ActorKind;appearance:string;skin:string;side:string;tacticalLevel:number;position:[number,number,number];yaw:number;posture:string;mounted:boolean;action:string;idleAction:string;equipment:string;items:VisualItem[];garments:Record<string,string|null>;cue?:ActorCue;contactWarm?:{targets:ContactTarget[];support:ContactSupport};motion?:Motion;selected:boolean;bodyHeights:Record<string,number>};
export const actorKey=(kind:ActorKind,id:string)=>`${kind}:${id}`;
export function admittedActors(state:any,players:any[],revealed:ReadonlySet<string>):ActorEntry[]{
  const result:ActorEntry[]=[];
  for(const [kind,roster] of [['unit',state.units??[]],['npc',state.npcs??[]]] as const)for(const actor of roster){
    if(actor.fled||actor.departure)continue;
    if(!(kind==='unit'&&actor.side==='player')&&!players.some(player=>canSee(state,player,actor)))continue;
    if(!isInteriorVisible(state,actor,revealed))continue;
    result.push({key:actorKey(kind,actor.id),kind,actor});
  }
  return result;
}
function equipmentItem(unit:any,reference:string,socket:VisualItem['socket']):VisualItem|null{
  const record=reference==='primary'?{id:unit.weapon,fittings:unit.weaponFittings}:reference==='blade'?{id:unit.blade,fittings:unit.bladeFittings}:reference==='offhand'?{id:unit.offHand?.weapon,fittings:unit.offHand?.fittings}:reference.startsWith('inventory:')?unit.inventory?.[reference.slice(10)]:{id:reference};
  if(!record)return null;
  // Inventory keys and authored content IDs are ownership identifiers, not
  // model names. Only the equipment kind or base weapon selects geometry.
  const raw=record.weapon??record.blade??record.id;
  const weapon=typeof raw==='object'?raw.template??raw.id:raw;
  const supply=['ammo','rations','medkits','boleadoras','torches'];
  const id=weapon!==undefined&&!reference.startsWith('inventory:')?weapon:
    record.weapon!==undefined?(typeof record.weapon==='object'?record.weapon.template??record.weapon.id:record.weapon):
    record.kind==='grenade'?'grenade':record.kind==='ammunition'?'ammunition':
    record.toolKey??(supply.includes(record.item)?record.item:supply.includes(reference)?reference:'item');
  return {id:String(id),reference,socket,fittings:record.fittings};
}
export function actorItems(unit:any):VisualItem[]{
  const hands=handLayout(unit),result:VisualItem[]=[];
  for(const [ref,socket]of [[hands.right,'handRight'],[hands.left,'handLeft'],...hands.stowed.map((ref:string)=>[ref,ref==='primary'?'back':'hip'])] as [string|null,VisualItem['socket']][]){
    if(!ref)continue;const item=equipmentItem(unit,ref,socket);if(item)result.push(item);
  }
  return result;
}
export function actorPosture(unit:any){return unit.stance==='prone'||unit.movementMode==='prone'?'prone':unit.stance==='crouched'||unit.movementMode==='crouch'?'crouched':'standing';}
export function semanticOrder(type:string,request:any={},actor?:any):string|null{
  const aliases:Record<string,string>={craftDressings:'heal',moveEquipment:'equip',movePocket:'equip',unloadEquipment:'unload',selectAmmunitionLoad:'equip',dropSupply:'drop',transferSupply:'transfer',inventoryMap:'equip',overwatch:'aim',firePoint:'fire',melee:'strike',meleePoint:'strike',charge:'strike',unloadAmmunition:'unload',lootBatch:'loot',pickupEquipment:'pickup',placeEquipment:'drop',dragEquipment:'equip',returnEquipmentCursor:'equip',prisonerFree:'free',torch:'throwTorch'};
  if(type==='artillery')return request.mode==='reload'?'artilleryReload':'artilleryFire';
  if(['move','groupMove','look','climb','endTurn','deployment','stance','mount','movement','stealth','weaponMode'].includes(type))return null;
  const action=aliases[type]??type;
  if(action==='strike'&&(request.meleeStyle==='bayonet'||fixedBayonetFor(actor)))return 'bayonet';
  return ACTOR_ACTION_CAPABILITIES.some(capability=>capability.action===action)?action:null;
}
/** Compare only actors admitted on both sides of an observed state change.
 * Missing/reappearing actors supply no evidence about when an injury occurred. */
export function observedActorTransitions(previous:readonly ActorEntry[],current:readonly ActorEntry[]){
  const before=new Map(previous.map(entry=>[entry.key,entry.actor]));
  return current.flatMap(({key,actor})=>{
    const old=before.get(key);if(!old)return [];
    const fromPosture=old.mounted?'mounted':actorPosture(old);
    let action:string|undefined,extra:Partial<ActorCue>={};
    if(actor.hp<=0&&old.hp>0){action='die';extra={fromPosture};}
    else if(actor.hp>0&&actor.unconscious&&!old.unconscious){action='collapse';extra={fromPosture};}
    else if(!actor.unconscious&&old.unconscious&&actor.hp>0)action='recover';
    else if(actor.hp>0&&!actor.unconscious&&actor.knockedDown&&!old.knockedDown){action='knockdown';extra={fromPosture,toPosture:actorPosture(actor)};}
    else if(actor.hp>0&&!actor.unconscious&&!actor.knockedDown&&Number.isFinite(actor.hp)&&Number.isFinite(old.hp)&&actor.hp<old.hp){action='hit';extra={fromPosture};}
    else if(actor.hp>0&&!actor.unconscious&&actor.mounted!==old.mounted){action=actor.mounted?'mount':'dismount';extra={fromPosture};}
    else if(actor.hp>0&&!actor.unconscious&&actorPosture(actor)!==actorPosture(old)){action=`stance:${actorPosture(old)}:${actorPosture(actor)}`;extra={fromPosture:actorPosture(old),toPosture:actorPosture(actor)};}
    return action?[{key,action,extra}]:[];
  });
}
const lifeCue=(cue?:ActorCue)=>Boolean(cue&&['die','dead','collapse','unconscious','recover','knockdown'].includes(cue.action));
/** Caller supplies an admitted actor; raw world bodies never enter this helper. */
export function admittedImpactCue({key,kind,actor}:ActorEntry,frame:any,now=0):ActorCue|undefined{
  if(!(actor.hp>0)||actor.unconscious||actor.knockedDown)return;
  const impact=frame?.impacts?.find((impact:any)=>(impact.victimKind??'unit')===kind&&String(impact.unitId)===String(actor.id)&&Number.isFinite(impact.damage)&&impact.damage>0&&!impact.fatal);
  if(impact)return {id:`${frame.sequenceId}:${frame.index??frame.actionId}:impact:${key}`,action:'hit',startedAt:frame.startedAt??now,durationMs:frame.durationMs??450};
}

/** Known support only; private bodies and unreadable props are not queried. */
function contactSupport(state:any,actor:any,visual:ActorVisual,revealed:ReadonlySet<string>,visible:readonly ActorVisual[]):ContactSupport{
  const floors:ContactSupport['floors'][number][]=[],level=tacticalLevel(actor),height=visual.position[1];
  const active=new Set(visible.flatMap(actor=>actor.motion?.moving&&actor.motion.kind==='climb'&&actor.motion.linkId?[actor.motion.linkId]:[]));
  const openings=active.size?climbOpenings({terrain:{width:state.width,height:state.height,tiles:state.tiles,upperSurfaces:state.upperSurfaces,climbLinks:state.climbLinks}},TILE_METRES).filter(opening=>active.has(opening.linkId)):[];
  const props={props:(state.props??[]).filter((prop:any)=>isInteriorVisible(state,prop,revealed))};
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const point={x:actor.x+dx,y:actor.y+dy,tacticalLevel:level},surface=surfaceAt(state,point);
    if(!surface||surface.blocked||['wall','window'].includes(surface.type)||surface.type==='door'&&!surface.open&&!surface.broken||Math.abs((surfaceHeight(state,point)??0)-height)>.001||propBlocksAt(props,point.x,point.y,level))continue;
    if((dx||dy)&&!isInteriorVisible(state,point,revealed))continue;
    floors.push(...surfaceRectangles({...point,elevation:height},TILE_METRES,openings).map(rect=>({...rect,height})));
  }
  return {floors};
}

export function presentActors(state:any,entries:readonly ActorEntry[],positions:Record<string,Motion>,revealed:ReadonlySet<string>,options:{selected?:string;mode?:string;cues?:Readonly<Record<string,ActorCue>>;frame?:any;now?:number}={}):ActorVisual[]{
  const result:ActorVisual[]=[];
  for(const {key,kind,actor}of entries){
    const motion=positions[key];if(!actorInteriorReadable(state,actor,motion,revealed))continue;
    const posture=actorPosture(actor),dead=actor.hp<=0,unconscious=Boolean(actor.unconscious),mounted=Boolean(actor.mounted&&!dead&&!unconscious);
    const equipment=spriteEquipment(actor),items=actorItems(actor),at=motion??actor;
    const idleAction=actor.braced&&equipment==='long-gun'?'brace':(actor.weaponReady||options.selected===actor.id&&kind==='unit'&&options.mode==='fire')&&['long-gun','short-gun'].includes(equipment)?'aim':'idle';
    let cue=options.cues?.[key],action=idleAction;
    const frame=options.frame;
    const assignedCrew=frame&&['artillery','artilleryReload','artilleryMove','artilleryPivot'].includes(frame.action)&&frame.crewIds?.includes(actor.id);
    if(kind==='unit'&&(frame?.unitId===actor.id||assignedCrew)&&frame.performed!==false&&!lifeCue(cue)){
      if(frame.releaseComplete||frame.mountComplete)cue=undefined;
      if(frame.mountAction)cue={id:`${frame.sequenceId}:${frame.actionId}:mount:${key}`,action:frame.mountAction,fromPosture:frame.mountFromPosture,phase:'prepare',startedAt:frame.startedAt,phaseStartedAt:frame.startedAt,phaseDurationMs:frame.durationMs,durationMs:frame.durationMs};
      const semantic=semanticOrder(frame.action,frame,actor);
      if(semantic&&frame.type!=='step'&&!(frame.shotComplete||frame.contactComplete||frame.releaseComplete)&&frame.shotVisual?.discharge!==false){
        const shotHand=frame.shotHand??frame.shotVisual?.shotHand,shotId=frame.shotId??frame.shotVisual?.shotId;
        const held=items.find(item=>item.reference===shotHand&&['handRight','handLeft'].includes(item.socket));
        if(shotHand&&!held)throw Error(`Missing admitted firing hand: ${key}:${shotHand}`);
        cue={id:`${frame.sequenceId}:${frame.actionId}${shotId===undefined?'':`:shot:${shotId}`}:${key}`,action:frame.type==='prepare'&&['fire','firePoint'].includes(frame.action)?'aim':semantic,...(held?{shotHand,hand:held.socket as 'handRight'|'handLeft'}:{}),...(frame.actionWork?{work:frame.actionWork}:{}),...(frame.healInterval?{healInterval:true as const}:{}),phase:frame.type,phaseStartedAt:frame.startedAt,phaseDurationMs:frame.durationMs,startedAt:['fire','firePoint'].includes(frame.action)?frame.startedAt:frame.actionStartedAt??frame.startedAt,durationMs:['fire','firePoint'].includes(frame.action)?frame.durationMs:frame.actionDurationMs??frame.durationMs};
      }
    }
    // Frame impacts are already disclosure-filtered by the recorder. The
    // current entry/readability checks provide the second admission boundary.
    const impactCue=admittedImpactCue({key,kind,actor},frame,options.now);
    if(impactCue&&!lifeCue(cue))cue=impactCue;
    if(dead)action=cue?.action==='die'?'die':'dead';
    else if(unconscious)action=cue?.action==='collapse'?'collapse':'unconscious';
    else if(actor.knockedDown)action=cue?.action==='knockdown'?'knockdown':'idle';
    else if(cue?.action==='hit'||cue?.action==='recover')action=cue.action;
    else if(motion?.moving)action=motion.kind==='climb'?(motion.climbDirection!<0?'climbDown':'climbUp'):posture==='prone'?'crawl':actor.movementMode==='run'?'run':'walk';
    else if(cue)action=cue.action;
    else if(options.selected===actor.id&&kind==='unit'&&options.mode==='fire'&&['long-gun','short-gun'].includes(equipment))action='aim';
    const direction=motion?.moving?motion.direction:Number.isInteger(actor.facing)?(actor.facing+1)%8:motion?.direction??(actor.side==='enemy'?7:3);
    if(motion?.moving&&!mounted&&['walk','run'].includes(action)){
      const yaw=actorYaw(direction),x=motion.travelX??0,y=motion.travelY??0,forward=x*Math.sin(yaw)+y*Math.cos(yaw),left=x*Math.cos(yaw)-y*Math.sin(yaw);
      if(Math.abs(left)>Math.abs(forward)+.01)action=left>0?'strafeLeft':'strafeRight';
    }
    result.push({key,id:actor.id,kind,appearance:spriteAppearance(actor,kind==='npc'?'civilian':'soldier'),skin:spriteSkinTone(actor),side:actor.side??'civilian',tacticalLevel:tacticalLevel(actor),position:[at.x*TILE_METRES,renderedSurfaceHeight(state,at),at.y*TILE_METRES],yaw:actorYaw(direction),posture,mounted,action,idleAction,equipment,items,garments:Object.fromEntries(['headwear','outfit','legwear'].map(slot=>[slot,wornOutfit(actor,slot)?.outfit??null])),cue,motion,selected:kind==='unit'&&actor.id===options.selected,bodyHeights:Object.fromEntries(['head','torso','legs','muzzle'].map(part=>[part,relativeBodyHeight(actor,part)]))});
  }
  // Contact fitting uses the bodies that passed both admission and room
  // readability. A frame's target coordinates cannot admit another body.
  const frame=options.frame,point=frame?.targetPoint;
  if(frame?.performed!==false&&['melee','charge'].includes(frame?.action)&&['prepare','contact'].includes(frame?.type)&&['unit','npc'].includes(point?.kind)&&typeof point.id==='string'&&point.id.length>0&&[point.x,point.y].every(Number.isFinite)){
    const key=actorKey(point.kind,String(point.id)),matches=result.filter(visual=>visual.key===key);
    const entry=entries.find(entry=>entry.key===key),target=matches.length===1?matches[0]:undefined;
    if(target&&entry&&entry.actor.x===point.x&&entry.actor.y===point.y&&tacticalLevel(entry.actor)===tacticalLevel(point)&&target.position.every(Number.isFinite)&&Number.isFinite(target.yaw)){
      for(const visual of result)if(visual.kind==='unit'&&visual.id===frame.unitId&&visual.key!==key&&visual.cue&&['strike','bayonet'].includes(visual.cue.action)){
        const source=entries.find(entry=>entry.key===visual.key)!;
        const toYaw=Math.atan2(target.position[0]-visual.position[0],target.position[2]-visual.position[2]);
        const deltaYaw=Math.atan2(Math.sin(toYaw-visual.yaw),Math.cos(toYaw-visual.yaw)),distance=(target.position[0]-visual.position[0])**2+(target.position[2]-visual.position[2])**2;
        const turn=visual.cue.phase==='prepare'&&(visual.equipment==='blade'||visual.equipment==='long-gun'&&visual.action==='strike')&&visual.posture==='standing'&&!visual.mounted&&!visual.motion?.moving&&distance>1e-10&&Math.abs(deltaYaw)>1e-7&&Math.abs(deltaYaw)<=Math.PI/4+1e-7?{fromYaw:visual.yaw,toYaw}:undefined;
        visual.cue={...visual.cue,...(turn?{contactTurn:turn}:{}),contactTarget:{key,appearance:target.appearance,position:[...target.position],yaw:target.yaw,posture:target.posture,mounted:target.mounted,action:target.action,bodyHeights:{...target.bodyHeights}},contactSupport:contactSupport(state,source.actor,visual,revealed,result)};
      }
    }
  }
  // A patient cue uses only the current admitted body, never a saved/future
  // model. The resolver reads its current animated pose at the point of use.
  if(frame?.action==='heal'&&frame.healInterval&&frame.performed!==false&&['prepare','result'].includes(frame.type)){
    for(const visual of result)if(visual.kind==='unit'&&visual.id===frame.unitId&&visual.cue?.action==='heal'){
      if(frame.careSelf===true){visual.cue={...visual.cue,care:{mode:'self'}};continue;}
      if(!['unit','npc'].includes(point?.kind)||typeof point.id!=='string'||!point.id||![point.x,point.y].every(Number.isFinite))continue;
      const key=actorKey(point.kind,point.id),matches=result.filter(target=>target.key===key),target=matches.length===1?matches[0]:undefined,entry=entries.find(entry=>entry.key===key);
      if(!target||!entry||key===visual.key||entry.actor.x!==point.x||entry.actor.y!==point.y||tacticalLevel(entry.actor)!==tacticalLevel(point)||!target.position.every(Number.isFinite)||!Number.isFinite(target.yaw))continue;
      const source=entries.find(entry=>entry.key===visual.key)!;
      visual.cue={...visual.cue,care:{mode:'patient',target:{key,appearance:target.appearance,position:[...target.position],yaw:target.yaw,posture:target.posture,mounted:target.mounted,action:target.action,bodyHeights:{...target.bodyHeights}},support:contactSupport(state,source.actor,visual,revealed,result)}};
    }
  }
  // Warm candidates contain only current rendered bodies and disclosed
  // support. They carry no order, impact or future state.
  for(const visual of result)if(visual.selected&&!visual.cue&&!visual.motion?.moving&&visual.posture==='standing'&&!visual.mounted&&visual.equipment==='long-gun'){
    const source=entries.find(entry=>entry.key===visual.key)!;
    const candidates=result.filter(target=>target.key!==visual.key&&target.side!==visual.side&&!target.mounted&&['standing','crouched'].includes(target.posture)&&target.tacticalLevel===visual.tacticalLevel&&(target.position[0]-visual.position[0])**2+(target.position[2]-visual.position[2])**2<=2*TILE_METRES**2+1e-8).sort((a,b)=>a.key.localeCompare(b.key));
    if(candidates.length)visual.contactWarm={targets:candidates.map(target=>({key:target.key,appearance:target.appearance,position:[...target.position],yaw:target.yaw,posture:target.posture,mounted:target.mounted,action:target.action,bodyHeights:{...target.bodyHeights}})),support:contactSupport(state,source.actor,visual,revealed,result)};
  }
  return result;
}
/** Dynamic world records cross the same disclosure boundary as the old scene. */
export function presentWorld(state:any,terrain:any,players:any[],revealed:ReadonlySet<string>,entries:readonly ActorEntry[],cursorLevel:number):WorldInput{
  const visible=(point:any)=>isInteriorVisible(state,point,revealed)&&(!tacticalLevel(point)||players.some(player=>canSee(state,player,point)));
  const seenPoints=new Map<string,boolean>();
  const observed=(point:any)=>{const key=spaceKey(point);if(!seenPoints.has(key))seenPoints.set(key,isInteriorVisible(state,point,revealed)&&players.some(player=>canSee(state,player,point)));return seenPoints.get(key)!;};
  const height=(point:any)=>({...point,elevation:surfaceHeight(state,point)??0});
  const lootKeys=new Set(groundLootPiles(state,players).filter(visible).map(spaceKey));
  const loot=[...(state.droppedWeapons??[]).filter((item:any)=>!item.taken),...(state.groundItems??[]).filter((item:any)=>item.count>0&&!item.heldBy&&!item.containerId)].filter((item:any)=>lootKeys.has(spaceKey(item))).map(height);
  return {terrain:{...terrain,climbLinks:state.climbLinks,props:[...(terrain.props??[]),...roomDressings(terrain)].filter(visible).map(height),lights:(state.lights??[]).filter(observed).map(height)},revealedRooms:revealed,cursorLevel,admittedActorPoints:entries.map(({actor})=>height(actor)),loot,cannons:(state.artillery??[]).filter(observed).map((gun:any)=>({...height(gun),profile:artilleryProfile(state,gun)})),smoke:(state.smoke??[]).filter(observed).map(height),illumination:new Map([...state.tiles,...(state.upperSurfaces??[])].map((tile:any)=>[spaceKey(tile),observed(tile)?tileIllumination(state,tile.x,tile.y,tacticalLevel(tile)):state.night?.08:1]))};
}
