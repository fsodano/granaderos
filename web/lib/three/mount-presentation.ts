import profile from './locomotion-profile.json';
import {spriteAppearance} from '../../../game/sprite-appearances.js';

/** Admission must cover both sides of a successful mount-state change.
 * The helper cannot infer or disclose a hidden rider's preparation. */
export function admittedMountTransitions(frames:readonly any[]){
 const result=frames.map(frame=>({...frame}));
 for(let index=0;index<frames.length;index++){
  const start=frames[index];if(start.type!=='prepare'||start.action!=='mount'||!start.unitId)continue;
  let endIndex=index+1;while(endIndex<frames.length&&frames[endIndex].type!=='prepare'&&frames[endIndex].type!=='result')endIndex++;
  const end=frames[endIndex];if(end?.type!=='result'||end.action!=='mount'||end.unitId!==start.unitId||end.performed===false)continue;
  const before=start.state.units.find((unit:any)=>unit.id===start.unitId),after=end.state.units.find((unit:any)=>unit.id===end.unitId);
  if(!before||!after||before.hp<=0||after.hp<=0||before.unconscious||after.unconscious||after.knockedDown||Boolean(before.mounted)===Boolean(after.mounted))continue;
  const action=after.mounted?'mount':'dismount',from=before.mounted?'mounted':'standing';
  result[index].mountAction=action;result[index].mountFromPosture=from;
  result[endIndex].mountComplete=true;
 }
 return result;
}

/** One protected native preparation contains the complete physical move.
 * The result commits rules normally and holds the final idle pose. */
export function mountFrameDuration(frame:any,requested:number){
 if(frame.type!=='prepare'||!frame.mountAction||!frame.unitId)return requested;
 const unit=frame.state.units.find((unit:any)=>unit.id===frame.unitId);if(!unit)return requested;
 const appearance=spriteAppearance(unit),bank=profile.appearances[appearance as keyof typeof profile.appearances];
 const actions=profile.banks[bank as keyof typeof profile.banks]?.actions,name=`life.${frame.mountAction}`;
 const clip=actions?.[name as keyof typeof actions];if(!clip)throw Error(`Missing mount timing: ${appearance}:${name}`);
 return Math.max(requested,clip.duration*1000);
}
