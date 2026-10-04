import {ACTOR_ACTION_CAPABILITIES} from '../../../game/actor-action-contract.js';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {spriteSkinTone} from '../../../game/sprite-skin.js';
import {spriteEquipment} from '../../../game/sprite-equipment.js';
import {handLayout} from '../../../game/hand-layout.js';
import {wornOutfit} from '../../../game/outfits.js';
import {canSee,tileIllumination} from '../../../game/tactical.js';
import {relativeBodyHeight} from '../../../game/sight-geometry.js';
import {tacticalLevel,spaceKey,surfaceHeight} from '../../../game/tactical-space.js';
import {isInteriorVisible} from '../../../game/tactical-visibility.js';
import {actorInteriorReadable} from '../../../game/scene-readability.js';
import {roomDressings} from '../../../game/room-dressing.js';
import {artilleryProfile} from '../../../game/artillery-definitions.js';
import {groundLootPiles} from '../../../game/ja2-hud.js';
import {renderedSurfaceHeight} from '../tactical-elevation';
import type {Motion} from '../../app/useUnitMotion';
import {TILE_METRES,actorYaw} from './projection';
import type {WorldInput} from './world-types';

export type ActorKind='unit'|'npc';
export type ActorEntry={key:string;kind:ActorKind;actor:any};
export type ActorCue={id:string;action:string;startedAt:number;durationMs?:number;phase?:string;phaseStartedAt?:number;phaseDurationMs?:number;fromPosture?:string;toPosture?:string};
export type VisualItem={id:string;reference:string;socket:'handRight'|'handLeft'|'back'|'hip';fittings?:any};
export type ActorVisual={key:string;id:string;kind:ActorKind;appearance:string;skin:string;side:string;tacticalLevel:number;position:[number,number,number];yaw:number;posture:string;mounted:boolean;action:string;idleAction:string;equipment:string;items:VisualItem[];garments:Record<string,string|null>;cue?:ActorCue;motion?:Motion;selected:boolean;bodyHeights:Record<string,number>};
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
export function semanticOrder(type:string,request:any={}):string|null{
  const aliases:Record<string,string>={craftDressings:'heal',moveEquipment:'equip',movePocket:'equip',unloadEquipment:'unload',selectAmmunitionLoad:'equip',dropSupply:'drop',transferSupply:'transfer',inventoryMap:'equip',overwatch:'aim',firePoint:'fire',melee:'strike',meleePoint:'strike',charge:'strike',unloadAmmunition:'unload',lootBatch:'loot',pickupEquipment:'pickup',placeEquipment:'drop',dragEquipment:'equip',returnEquipmentCursor:'equip',prisonerFree:'free',torch:'throwTorch'};
  if(type==='artillery')return request.mode==='reload'?'artilleryReload':'artilleryFire';
  if(['move','groupMove','look','climb','endTurn','deployment','stance','mount','movement','stealth','weaponMode'].includes(type))return null;
  const action=aliases[type]??type;return ACTOR_ACTION_CAPABILITIES.some(capability=>capability.action===action)?action:null;
}
export function presentActors(state:any,entries:readonly ActorEntry[],positions:Record<string,Motion>,revealed:ReadonlySet<string>,options:{selected?:string;mode?:string;cues?:Readonly<Record<string,ActorCue>>;frame?:any;now?:number}={}):ActorVisual[]{
  const result:ActorVisual[]=[];
  for(const {key,kind,actor}of entries){
    const motion=positions[key];if(!actorInteriorReadable(state,actor,motion,revealed))continue;
    const posture=actorPosture(actor),dead=actor.hp<=0,unconscious=Boolean(actor.unconscious),mounted=Boolean(actor.mounted&&!dead&&!unconscious);
    const equipment=spriteEquipment(actor),at=motion??actor;
    const idleAction=actor.braced&&equipment==='long-gun'?'brace':(actor.weaponReady||options.selected===actor.id&&kind==='unit'&&options.mode==='fire')&&['long-gun','short-gun'].includes(equipment)?'aim':'idle';
    let cue=options.cues?.[key],action=idleAction;
    const frame=options.frame;
    if(kind==='unit'&&frame?.unitId===actor.id&&frame.performed!==false){
      const semantic=semanticOrder(frame.action);
      if(semantic&&frame.type!=='step'&&!(frame.shotComplete||frame.contactComplete)&&frame.shotVisual?.discharge!==false){
        cue={id:`${frame.sequenceId}:${frame.actionId}:${key}`,action:frame.type==='prepare'&&['fire','firePoint'].includes(frame.action)?'aim':semantic,phase:frame.type,phaseStartedAt:frame.startedAt,phaseDurationMs:frame.durationMs,startedAt:['fire','firePoint'].includes(frame.action)?frame.startedAt:frame.actionStartedAt??frame.startedAt,durationMs:['fire','firePoint'].includes(frame.action)?frame.durationMs:frame.actionDurationMs??frame.durationMs};
      }
    }
    if(dead)action=cue?.action==='die'?'die':'dead';
    else if(unconscious)action=cue?.action==='collapse'?'collapse':'unconscious';
    else if(actor.knockedDown)action='knockdown';
    else if(motion?.moving)action=motion.kind==='climb'?(motion.climbDirection!<0?'climbDown':'climbUp'):posture==='prone'?'crawl':actor.movementMode==='run'?'run':'walk';
    else if(cue)action=cue.action;
    else if(options.selected===actor.id&&kind==='unit'&&options.mode==='fire'&&['long-gun','short-gun'].includes(equipment))action='aim';
    const direction=motion?.moving?motion.direction:Number.isInteger(actor.facing)?(actor.facing+1)%8:motion?.direction??(actor.side==='enemy'?7:3);
    if(motion?.moving&&!mounted&&['walk','run'].includes(action)){
      const yaw=actorYaw(direction),x=motion.travelX??0,y=motion.travelY??0,forward=x*Math.sin(yaw)+y*Math.cos(yaw),left=x*Math.cos(yaw)-y*Math.sin(yaw);
      if(Math.abs(left)>Math.abs(forward)+.01)action=left>0?'strafeLeft':'strafeRight';
    }
    result.push({key,id:actor.id,kind,appearance:spriteAppearance(actor,kind==='npc'?'civilian':'soldier'),skin:spriteSkinTone(actor),side:actor.side??'civilian',tacticalLevel:tacticalLevel(actor),position:[at.x*TILE_METRES,renderedSurfaceHeight(state,at),at.y*TILE_METRES],yaw:actorYaw(direction),posture,mounted,action,idleAction,equipment,items:actorItems(actor),garments:Object.fromEntries(['headwear','outfit','legwear'].map(slot=>[slot,wornOutfit(actor,slot)?.outfit??null])),cue,motion,selected:kind==='unit'&&actor.id===options.selected,bodyHeights:Object.fromEntries(['head','torso','legs','muzzle'].map(part=>[part,relativeBodyHeight(actor,part)]))});
  }
  return result;
}
/** Dynamic world records cross the same disclosure boundary as the old scene. */
export function presentWorld(state:any,terrain:any,players:any[],revealed:ReadonlySet<string>,entries:readonly ActorEntry[],cursorLevel:number):WorldInput{
  const visible=(point:any)=>isInteriorVisible(state,point,revealed)&&(!tacticalLevel(point)||players.some(player=>canSee(state,player,point)));
  const height=(point:any)=>({...point,elevation:surfaceHeight(state,point)??0});
  const lootKeys=new Set(groundLootPiles(state,players).filter(visible).map(spaceKey));
  const loot=[...(state.droppedWeapons??[]).filter((item:any)=>!item.taken),...(state.groundItems??[]).filter((item:any)=>item.count>0&&!item.heldBy&&!item.containerId)].filter((item:any)=>lootKeys.has(spaceKey(item))).map(height);
  return {terrain:{...terrain,climbLinks:state.climbLinks,props:[...(terrain.props??[]),...roomDressings(terrain)].filter(visible).map(height),lights:(state.lights??[]).filter(visible).map(height)},revealedRooms:revealed,cursorLevel,admittedActorPoints:entries.map(({actor})=>height(actor)),loot,cannons:(state.artillery??[]).filter(visible).map((gun:any)=>({...height(gun),profile:artilleryProfile(state,gun)})),smoke:(state.smoke??[]).filter(visible).map(height),illumination:new Map([...state.tiles,...(state.upperSurfaces??[])].map((tile:any)=>[spaceKey(tile),tileIllumination(state,tile.x,tile.y,tacticalLevel(tile))]))};
}
