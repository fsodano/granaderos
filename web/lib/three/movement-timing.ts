import profile from './locomotion-profile.json';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {TILE_METRES} from './projection';

type Point={x:number;y:number;kind?:string};
/** Presentation travel uses the same measured metre/second speed as the gait.
 * AP, simulation time, positions and the paid route remain authoritative. */
export function movementStepDuration(unit:any,from:Point,to:Point,requested?:number,preserveFacing=false){
  const fallback=requested??(unit.mounted?150:unit.stance==='prone'||unit.movementMode==='prone'?420:unit.movementMode==='crouch'?320:unit.movementMode==='run'?150:240);
  const prone=!unit.mounted&&(unit.stance==='prone'||unit.movementMode==='prone');
  if(!prone||to.kind==='climb')return fallback*(preserveFacing?1.25:1);
  const appearance=spriteAppearance(unit),bank=profile.appearances[appearance as keyof typeof profile.appearances];
  const crawl=profile.banks[bank as keyof typeof profile.banks]?.crawl;
  if(!crawl)throw Error(`Missing crawl movement profile: ${appearance}`);
  const distance=Math.hypot(to.x-from.x,to.y-from.y)*TILE_METRES;
  return Math.max(fallback,distance/(crawl.nativeStrideSpeed*crawl.playbackRate)*1000)*(preserveFacing?1.25:1);
}
