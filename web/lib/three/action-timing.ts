import profile from './locomotion-profile.json';
import {spriteAppearance} from '../../../game/sprite-appearances.js';
import {spriteEquipment} from '../../../game/sprite-equipment.js';
import {resolveActorAction} from '../../../game/actor-action-contract.js';
import {actorItems,actorPosture,semanticOrder} from './presentation';
import {canSee} from '../../../game/tactical.js';
import {animationPhaseRanges,usesNativeActionTiming,type AnimationClockClip,type AnimationWork} from './animation-clock';

function loadingWork(before:any,after:any):AnimationWork[]{
  if(!before||!after)return [];
  const from=before.reloadProgress??0,to=after.reloadProgress??0,rounds=Number(after.loaded??0)-Number(before.loaded??0);
  const gain=rounds+to-from;
  if(!(gain>1e-9)||from<0||from>=1||to<0||to>=1||rounds<0)return [];
  const work:AnimationWork[]=[];
  for(let round=0;round<rounds;round++)work.push({from:round===0?from:0,to:1});
  if(to>0)work.push({from:rounds?0:from,to});
  return work;
}

function admittedGunWork(before:any,after:any,hand:'primary'|'offhand'):AnimationWork[]{
  const held=(actor:any)=>actorItems(actor).find(item=>item.reference===hand&&['handRight','handLeft'].includes(item.socket));
  const first=held(before),last=held(after);
  const identity=(actor:any)=>hand==='primary'?actor.weaponInstanceId:actor.offHand?.instanceId;
  // A dropped, replaced or pocketed gun does not establish observed loading
  // for that owned item. The two pistols retain their separate work intervals.
  if(!first||!last||first.id!==last.id||identity(before)!==identity(after))return [];
  const initial=hand==='primary'?before:before.offHand,final=hand==='primary'?after:after.offHand;
  return loadingWork(initial,final).map((work,index)=>({...work,hand,...(first.id==='1808'?{barrel:(Number(initial.loaded??0)+index)%2}:{})}));
}

/** Work is derived only when preparation and result admit the same actor.
 * Cannon work additionally requires the piece to be observed on both sides. */
export function admittedReloadWork(frames:readonly any[]){
  const result=frames.map(frame=>({...frame}));
  for(let index=0;index<frames.length;index++){
    const start=frames[index];
    if(start.type!=='prepare'||!start.unitId||!['reload','artilleryReload'].includes(start.action))continue;
    let endIndex=index+1;
    while(endIndex<frames.length&&frames[endIndex].type!=='prepare'&&frames[endIndex].type!=='result')endIndex++;
    const end=frames[endIndex];
    if(!end||end.type!=='result'||end.unitId!==start.unitId||end.action!==start.action||end.performed===false)continue;
    const before=start.state.units.find((unit:any)=>unit.id===start.unitId),after=end.state.units.find((unit:any)=>unit.id===end.unitId);
    if(!before||!after)continue;
    let work:AnimationWork[];
    if(start.action==='reload')work=[...admittedGunWork(before,after,'primary'),...admittedGunWork(before,after,'offhand')];
    else{
      const observed=(state:any,gun:any)=>state.units.some((unit:any)=>unit.side==='player'&&unit.hp>0&&!unit.unconscious&&canSee(state,unit,gun));
      work=(start.state.artillery??[]).flatMap((gun:any)=>{
        const next=end.state.artillery?.find((next:any)=>next.id===gun.id);
        return next&&observed(start.state,gun)&&observed(end.state,next)?loadingWork(gun,next):[];
      });
    }
    if(work.length)for(let cursor=index;cursor<=endIndex;cursor++)result[cursor].actionWork=work;
  }
  return result;
}

/** An observed thrown flight already contains the release and follow-through.
 * The final rules result may hold impacts, but cannot replay the throw. */
export function admittedThrownRelease(frames:readonly any[]){
  const result=frames.map(frame=>({...frame}));
  for(let index=0;index<frames.length;index++){
    const flight=frames[index];
    if(flight.type!=='effect'||!flight.unitId||!(flight.grenadeVisual?.visible||flight.knifeVisual?.visible)||!['throwGrenade','throwKnife'].includes(flight.action))continue;
    let endIndex=index+1;
    while(endIndex<frames.length&&frames[endIndex].type!=='prepare'&&frames[endIndex].type!=='result')endIndex++;
    const end=frames[endIndex];
    if(end?.type==='result'&&end.unitId===flight.unitId&&end.action===flight.action&&end.performed!==false&&flight.state.units.some((unit:any)=>unit.id===flight.unitId)&&end.state.units.some((unit:any)=>unit.id===end.unitId))result[endIndex].releaseComplete=true;
  }
  return result;
}

/** An accepted observed treatment has preparation and result for the same
 * current actor. This flag carries no patient state or hidden position. */
export function admittedHealingIntervals(frames:readonly any[]){
  const result=frames.map(frame=>({...frame}));
  for(let index=0;index<frames.length;index++){
    const start=frames[index];
    if(start.type!=='prepare'||start.action!=='heal'||!start.unitId||start.performed===false)continue;
    let endIndex=index+1;
    while(endIndex<frames.length&&frames[endIndex].type!=='prepare'&&frames[endIndex].type!=='result')endIndex++;
    const end=frames[endIndex];
    if(end?.type!=='result'||end.action!=='heal'||end.unitId!==start.unitId||end.performed===false)continue;
    if(!start.state.units.some((unit:any)=>unit.id===start.unitId)||!end.state.units.some((unit:any)=>unit.id===end.unitId))continue;
    result[index].healInterval=true;result[endIndex].healInterval=true;
  }
  return result;
}

/** Only the admitted actor selects a native visual delay. Rules and simulation
 * time remain unchanged; unseen actions retain the ordinary playback delay. */
export function nativeActionFrameDuration(frame:any,requested:number){
  if(!frame.unitId||frame.performed===false||frame.releaseComplete)return requested;
  const unit=frame.state.units.find((unit:any)=>unit.id===frame.unitId);
  if(!unit||unit.hp<=0||unit.unconscious||unit.knockedDown)return requested;
  const action=semanticOrder(frame.action,frame,unit);
  if(!action||!usesNativeActionTiming(action)||action==='heal'&&!frame.healInterval)return requested;
  const capability=resolveActorAction({action,posture:actorPosture(unit),mounted:Boolean(unit.mounted),equipment:spriteEquipment(unit)});
  if(!capability)throw Error(`Unsupported action timing: ${action}`);
  const appearance=spriteAppearance(unit),bank=profile.appearances[appearance as keyof typeof profile.appearances];
  const actions=profile.banks[bank as keyof typeof profile.banks]?.actions;
  const clip:AnimationClockClip|undefined=actions?.[capability.clip as keyof typeof actions];
  if(!clip)throw Error(`Missing native action timing: ${appearance}:${capability.clip}`);
  const ranges=animationPhaseRanges(clip,action,frame.type,frame.actionWork,frame.healInterval);
  const duration=ranges.reduce((sum,[begin,end])=>sum+end-begin,0)*1000;
  return frame.actionWork&&duration===0?0:Math.max(requested,duration);
}
