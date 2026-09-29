import {spriteAnimationFrame} from '../../game/sprite-state.js';

// Wake only when an authored frame can change. Derive phase from elapsed time
// so delayed background-tab timers skip old frames instead of replaying them.
export function startSpriteAnimation({playback,frames,fps,onFrame},clock={
 now:()=>performance.now(),schedule:(callback,delay)=>setTimeout(callback,delay),cancel:handle=>clearTimeout(handle),
}){
 const start=clock.now(),count=Math.max(1,Math.floor(frames));
 let handle,stopped=false,last=-1;
 const tick=()=>{
  if(stopped)return;
  const elapsed=Math.max(0,clock.now()-start),frame=spriteAnimationFrame(playback,elapsed,count,fps);
  if(frame!==last){last=frame;onFrame(frame);}
  if(stopped||count<=1||!(fps>0)||!['action','breathing'].includes(playback)||playback==='action'&&frame===count-1)return;
  const next=(Math.floor(elapsed*fps/1000)+1)*1000/fps;
  handle=clock.schedule(tick,Math.max(1,next-elapsed));
 };
 tick();
 return ()=>{stopped=true;if(handle!==undefined)clock.cancel(handle);};
}
