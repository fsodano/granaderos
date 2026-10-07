/** Pure visual time mapping. No animation event is a gameplay command. */
export type AnimationClockClip={duration:number;loop:boolean;playbackRate?:number;locomotionSpeed?:number;nativeStrideSpeed?:number;markers?:Record<string,number>};
export type AnimationWork={from:number;to:number;hand?:'primary'|'offhand'};
export type AnimationClockCue={action:string;startedAt:number;durationMs?:number;phase?:string;phaseStartedAt?:number;phaseDurationMs?:number;work?:readonly AnimationWork[]};
export type AnimationClockMotion={moving?:boolean;elapsedMs?:number;elapsedDistance?:number;signedDistance?:number;speed?:number;signedForwardSpeed?:number;segmentFraction?:number};
export type AnimationClockInput={clip:AnimationClockClip;action:string;cue?:AnimationClockCue;motion?:AnimationClockMotion;now:number;reducedMotion?:boolean};
export type AnimationClockSample={time?:number;rate:number;complete:boolean;phaseComplete:boolean;cueControlsAction:boolean;workIndex?:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const wrap=(time:number,duration:number)=>(time%duration+duration)%duration;
const locomotion=new Set(['walk','run','crawl','strafeLeft','strafeRight','artilleryMove']);
const nativeActions=new Set(['reload','reprime','repair','unload','artilleryReload','throwGrenade','throwKnife','throwTorch','boleadoras']);
export const usesNativeActionTiming=(action:string)=>nativeActions.has(action);

/** A recorded phase and the body clock share the same native pose interval. */
export function animationPhaseRange(clip:AnimationClockClip,action:string,phase=''){
  const duration=Math.max(.000001,clip.duration),marker=clip.markers??{};
  const contact=marker.contact,release=marker.shot??marker.release;
  if(Number.isFinite(contact)){
    const ready=contact*.45;
    if(phase==='prepare')return [0,ready] as const;
    if(phase==='contact')return [ready,contact] as const;
    if(phase==='impact')return [contact,duration] as const;
    // These actions record preparation followed by a result, without a
    // separate contact frame. Continue the preparation pose once.
    if(phase==='result'&&usesNativeActionTiming(action))return [ready,duration] as const;
  }else if(Number.isFinite(release)){
    const recovery=release+(duration-release)*.55;
    if(phase==='prepare')return [0,release] as const;
    if(phase==='projectile')return [release,recovery] as const;
    if(phase==='impact')return [recovery,duration] as const;
    if(phase==='release'||phase==='result'||phase==='effect')return [release,duration] as const;
  }
  return [0,duration] as const;
}

/** A charge may stop partway or resume an earlier paid portion. Multiple
 * charges retain their separate native intervals instead of inventing work. */
export function animationPhaseRanges(clip:AnimationClockClip,action:string,phase='',work?:readonly AnimationWork[]){
  if(!work?.length||!['reload','artilleryReload'].includes(action))return [animationPhaseRange(clip,action,phase)];
  const duration=clip.duration,ready=(clip.markers?.contact??duration*.45)*.45/duration;
  const ranges=work.map(({from,to})=>[clamp(from,0,1),clamp(to,from,1)] as const);
  const first=ranges[0],split=clamp(ready,first[0],first[1]);
  if(phase==='prepare')return [[first[0]*duration,split*duration] as const];
  const remaining=phase==='result'?[[split,first[1]] as const,...ranges.slice(1)]:ranges;
  return remaining.map(([from,to])=>[from*duration,to*duration] as const);
}

/** A queued gesture must not change the clock of movement or a life state. */
export function cueControlsAction(action:string,cue?:Pick<AnimationClockCue,'action'>){return Boolean(cue&&cue.action===action);}

/** Inputs use seconds/metres for clips and movement, milliseconds for clocks. */
export function sampleAnimationTime({clip,action,cue,motion,now,reducedMotion=false}:AnimationClockInput):AnimationClockSample{
  const duration=Math.max(.000001,clip.duration),controls=cueControlsAction(action,cue);
  const result:AnimationClockSample={rate:1,complete:false,phaseComplete:false,cueControlsAction:controls};
  if((action==='climbUp'||action==='climbDown')&&motion?.moving&&Number.isFinite(motion.segmentFraction))return {...result,time:clamp(motion.segmentFraction!,0,1)*duration,rate:0};
  const stride=clip.nativeStrideSpeed??clip.locomotionSpeed;
  if(locomotion.has(action)&&motion?.moving&&stride&&stride>0){
    // Accumulated distance survives the brief stationary boundary between paid
    // tiles. It also handles different cardinal and diagonal segment speeds.
    const sign=motion.signedForwardSpeed!==undefined&&motion.signedForwardSpeed<0?-1:1;
    const distance=motion.signedDistance??(motion.elapsedDistance!==undefined?motion.elapsedDistance*sign:undefined);
    const seconds=distance!==undefined?distance/stride:motion.elapsedMs!==undefined?motion.elapsedMs/1000*(motion.speed??0)/stride*sign:undefined;
    if(seconds!==undefined)return {...result,time:clip.loop?wrap(seconds,duration):clamp(seconds,0,duration),rate:0};
    return {...result,rate:(motion.signedForwardSpeed??motion.speed??0)/stride};
  }
  if(controls&&cue){
    const phase=cue.phase??'',hasPhase=Boolean(phase);
    const start=cue.phaseStartedAt??cue.startedAt;
    const span=Math.max(.001,(cue.phaseDurationMs??cue.durationMs??duration*1000)/1000);
    const elapsed=Math.max(0,(now-start)/1000),fraction=clamp(elapsed/span,0,1);
    const ranges=animationPhaseRanges(clip,action,phase,cue.work);
    const length=ranges.reduce((sum,[begin,end])=>sum+end-begin,0);
    let distance=length*fraction,time=ranges.at(-1)![1],rangeIndex=ranges.length-1;
    for(let index=0;index<ranges.length;index++){
      const [begin,end]=ranges[index],segment=end-begin;
      // A completed charge hands over to the next one at the boundary. Empty
      // preparation remnants cannot select the gun whose paid work has ended.
      if(distance<segment-1e-9||index===ranges.length-1){time=begin+Math.min(segment,distance);rangeIndex=index;break;}distance-=segment;
    }
    const workIndex=cue.work?.length&&['reload','artilleryReload'].includes(action)?phase==='prepare'?0:rangeIndex:undefined;
    const intermediate=hasPhase&&['prepare','contact','projectile'].includes(phase);
    return {...result,time:clamp(time,0,duration),rate:0,phaseComplete:elapsed>=span,complete:elapsed>=span&&!intermediate,...(workIndex!==undefined?{workIndex}:{})};
  }
  // Accessibility suppresses idle breathing only. Gaits, recovery, weapon use,
  // reactions and stance changes keep their real visual timing.
  if(reducedMotion&&action==='idle')return {...result,time:0,rate:0};
  // Reviewed free playback has its own pace. Paid cue phases and travelled
  // distance above remain authoritative and never receive this multiplier.
  const playbackRate=clip.playbackRate??1;
  return {...result,rate:Number.isFinite(playbackRate)&&playbackRate>0?playbackRate:1};
}
