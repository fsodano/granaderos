/** Pure visual time mapping. No animation event is a gameplay command. */
export type AnimationClockClip={duration:number;loop:boolean;locomotionSpeed?:number;nativeStrideSpeed?:number;markers?:Record<string,number>};
export type AnimationClockCue={action:string;startedAt:number;durationMs?:number;phase?:string;phaseStartedAt?:number;phaseDurationMs?:number};
export type AnimationClockMotion={moving?:boolean;elapsedMs?:number;elapsedDistance?:number;signedDistance?:number;speed?:number;signedForwardSpeed?:number;segmentFraction?:number};
export type AnimationClockInput={clip:AnimationClockClip;action:string;cue?:AnimationClockCue;motion?:AnimationClockMotion;now:number;reducedMotion?:boolean};
export type AnimationClockSample={time?:number;rate:number;complete:boolean;phaseComplete:boolean;cueControlsAction:boolean};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const wrap=(time:number,duration:number)=>(time%duration+duration)%duration;
const locomotion=new Set(['walk','run','crawl','artilleryMove']);

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
    const marker=clip.markers??{};const contact=marker.contact,release=marker.shot??marker.release;
    let begin=0,end=duration;
    if(Number.isFinite(contact)){
      const ready=contact*.45;
      if(phase==='prepare'){begin=0;end=ready;}
      else if(phase==='contact'){begin=ready;end=contact;}
      else if(phase==='impact'){begin=contact;end=duration;}
    }else if(Number.isFinite(release)){
      const recovery=release+(duration-release)*.55;
      if(phase==='prepare'){begin=0;end=release;}
      else if(phase==='projectile'){begin=release;end=recovery;}
      else if(phase==='impact'){begin=recovery;end=duration;}
      else if(phase==='release'||phase==='result'){begin=release;end=duration;}
    }
    const intermediate=hasPhase&&['prepare','contact','projectile'].includes(phase);
    return {...result,time:clamp(begin+(end-begin)*fraction,0,duration),rate:0,phaseComplete:elapsed>=span,complete:elapsed>=span&&!intermediate};
  }
  // Accessibility suppresses idle breathing only. Gaits, recovery, weapon use,
  // reactions and stance changes keep their real visual timing.
  if(reducedMotion&&action==='idle')return {...result,time:0,rate:0};
  return result;
}
