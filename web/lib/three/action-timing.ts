import profile from './locomotion-profile.json';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {spriteEquipment} from '../../../game/sprite-equipment.js';
import {resolveActorAction} from '../../../game/actor-action-contract.js';
import {actorPosture,semanticOrder} from './presentation';
import {animationPhaseRange,usesNativeActionTiming,type AnimationClockClip} from './animation-clock';

/** Only the admitted actor selects a native visual delay. Rules and simulation
 * time remain unchanged; unseen actions retain the ordinary playback delay. */
export function nativeActionFrameDuration(frame:any,requested:number){
  if(!frame.unitId||frame.performed===false)return requested;
  const unit=frame.state.units.find((unit:any)=>unit.id===frame.unitId);
  if(!unit||unit.hp<=0||unit.unconscious||unit.knockedDown)return requested;
  const action=semanticOrder(frame.action,frame,unit);
  if(!action||!usesNativeActionTiming(action))return requested;
  const capability=resolveActorAction({action,posture:actorPosture(unit),mounted:Boolean(unit.mounted),equipment:spriteEquipment(unit)});
  if(!capability)throw Error(`Unsupported action timing: ${action}`);
  const appearance=spriteAppearance(unit),bank=profile.appearances[appearance as keyof typeof profile.appearances];
  const actions=profile.banks[bank as keyof typeof profile.banks]?.actions;
  const clip:AnimationClockClip|undefined=actions?.[capability.clip as keyof typeof actions];
  if(!clip)throw Error(`Missing native action timing: ${appearance}:${capability.clip}`);
  const [begin,end]=animationPhaseRange(clip,action,frame.type);
  return Math.max(requested,(end-begin)*1000);
}
