import profile from './locomotion-profile.json';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {spriteEquipment} from '../../../game/sprite-equipment.js';
import {resolveActorAction} from '../../../game/actor-action-contract.js';
import {actorItems,actorPosture} from './presentation';
import {TILE_METRES,actorYaw} from './projection';

type Point={x:number;y:number;kind?:string;renderedHeight?:number};
// A supported ladder ascent raises the feet about 65 cm each second.
export const CLIMB_VERTICAL_METRES_PER_SECOND=.65;
/** Presentation travel uses the same measured metre/second speed as the gait.
 * AP, simulation time, positions and the paid route remain authoritative. */
export function movementStepDuration(unit:any,from:Point,to:Point,requested?:number,preserveFacing=false){
  const fallback=requested??(unit.mounted?150:unit.stance==='prone'||unit.movementMode==='prone'?420:unit.movementMode==='crouch'?320:unit.movementMode==='run'?150:240);
  const appearance=spriteAppearance(unit),bank=profile.appearances[appearance as keyof typeof profile.appearances];
  if(to.kind==='climb'){
    const height=(to.renderedHeight??0)-(from.renderedHeight??0),action=height<0?'life.climbDown':'life.climbUp';
    const native=profile.banks[bank as keyof typeof profile.banks]?.actions[action];
    if(!native)throw Error(`Missing climb profile: ${appearance}:${action}`);
    return Math.max(fallback,native.duration*1000,Math.abs(height)/CLIMB_VERTICAL_METRES_PER_SECOND*1000);
  }
  const posture=actorPosture(unit),equipment=spriteEquipment(unit);
  let action=!unit.mounted&&posture==='prone'?'crawl':unit.movementMode==='run'?'run':'walk';
  if(preserveFacing&&!unit.mounted&&['walk','run'].includes(action)){
    const yaw=actorYaw(Number.isInteger(unit.facing)?(unit.facing+1)%8:3),x=to.x-from.x,y=to.y-from.y;
    const forward=x*Math.sin(yaw)+y*Math.cos(yaw),left=x*Math.cos(yaw)-y*Math.sin(yaw);
    if(Math.abs(left)>Math.abs(forward)+.01)action=left>0?'strafeLeft':'strafeRight';
  }
  let gait:{nativeStrideSpeed:number;duration:number;playbackRate:number}|undefined;
  if(unit.mounted)gait=profile.horse[action as keyof typeof profile.horse];
  else{
    const capability=resolveActorAction({action,posture,equipment});
    if(!capability)throw Error(`Unsupported movement gait: ${action}:${posture}:${equipment}`);
    const held=actorItems(unit).find(item=>item.socket==='handRight'),id=held&&(profile.itemAliases[held.id as keyof typeof profile.itemAliases]??held.id);
    const overrides=id?profile.itemClips[id as keyof typeof profile.itemClips]:undefined;
    const semantic=overrides?.[capability.clip as keyof typeof overrides]??capability.clip;
    const clips=profile.banks[bank as keyof typeof profile.banks]?.clips;
    gait=clips?.[semantic as keyof typeof clips];
  }
  if(!gait)throw Error(`Missing movement profile: ${appearance}:${action}`);
  const distance=Math.hypot(to.x-from.x,to.y-from.y)*TILE_METRES;
  return Math.max(fallback,distance/(gait.nativeStrideSpeed*gait.playbackRate)*1000)*(preserveFacing?1.25:1);
}
