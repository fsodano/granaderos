'use client';
import {useEffect,useState} from 'react';
import {spriteAnimationFrame} from '../../game/sprite-state.js';
import {spriteRender,spriteMovementFrame,spriteViewport} from '../../game/sprite-render.js';
type Motion={direction:number;frame:number;moving:boolean;elapsedMs?:number};
type Props={unit:any;position:{x:number;y:number};motion:Motion;pose?:string;drawSize?:number;appearance?:'soldier'|'civilian'};
/** Authored raster atlases. Each layout has a fixed logical ground origin. */
export default function SpriteFigure({unit,position,motion,pose='idle',drawSize=52,appearance='soldier'}:Props){
 const sprite=spriteRender(unit,motion,pose,appearance);
 const {name,playback,frames,fps,mounted}=sprite;
 const [clock,setClock]=useState({name:'',frame:0});
 const actionKey=playback==='action'?`${unit.ap}:${unit.loaded}`:'';
 useEffect(()=>{
  if(playback!=='action'&&playback!=='breathing')return;
  let handle=0;const start=performance.now();
  const tick=(now:number)=>{
   const frame=spriteAnimationFrame(playback,now-start,frames,fps);
   setClock(previous=>previous.name===name&&previous.frame===frame?previous:{name,frame});
   if(playback==='breathing'||now-start<frames*1000/fps)handle=requestAnimationFrame(tick);
  };
  setClock({name,frame:0});handle=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(handle);
 },[name,playback,actionKey,frames,fps]);
 const frame=playback==='movement'?spriteMovementFrame(motion,frames,fps):clock.name===name?clock.frame:0;
 const viewport=spriteViewport(sprite,position,motion.direction,frame,drawSize);
 return <g pointerEvents="none" data-sprite={name} data-requested-sprite={sprite.requestedName} data-playback={playback} data-sprite-style={sprite.style} data-sprite-fallback={sprite.fallbackReason??undefined}><ellipse cx={Math.round(position.x)} cy={Math.round(position.y)} rx={mounted?drawSize*.22:drawSize*.115} ry={drawSize*.045} fill="#171812" opacity=".36"/><svg {...viewport} overflow="hidden"><image href={sprite.href} width={sprite.size[0]} height={sprite.size[1]} style={{imageRendering:'pixelated'}}/></svg></g>;
}
