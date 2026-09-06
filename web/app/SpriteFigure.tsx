'use client';
import {useEffect,useState} from 'react';
import {spriteLayout} from '../../game/sprite-layouts.js';
import {selectSprite,spriteAnimationFrame} from '../../game/sprite-state.js';
type Motion={direction:number;frame:number;moving:boolean};
type Props={unit:any;position:{x:number;y:number};motion:Motion;pose?:string;drawSize?:number;appearance?:'soldier'|'civilian'};
/** Native pixel atlases, rendered offline. Each layout has a fixed ground origin. */
export default function SpriteFigure({unit,position,motion,pose='idle',drawSize=52,appearance='soldier'}:Props){
 const {name,playback}=selectSprite(unit,motion,pose,appearance);
 const [clock,setClock]=useState({name:'',frame:0});
 const actionKey=playback==='action'?`${unit.ap}:${unit.loaded}`:'';
 useEffect(()=>{
  if(playback!=='action'&&playback!=='breathing')return;
  let handle=0;const start=performance.now();
  const tick=(now:number)=>{
   const frame=spriteAnimationFrame(playback,now-start);
   setClock(previous=>previous.name===name&&previous.frame===frame?previous:{name,frame});
   if(playback==='breathing'||now-start<800)handle=requestAnimationFrame(tick);
  };
  setClock({name,frame:0});handle=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(handle);
 },[name,playback,actionKey]);
 const dir=((Math.round(motion.direction)||0)%8+8)%8;
 const frame=playback==='movement'?((Math.floor(motion.frame)||0)%8+8)%8:clock.name===name?clock.frame:0;
 const animated=playback!=='still',col=animated?frame:dir,row=animated?dir:0,rows=animated?8:1;
 const {cell,anchor}=spriteLayout(name),scale=drawSize/52,size=cell*scale;
 const mounted=name.startsWith('cavalry-');
 return <g pointerEvents="none" data-sprite={name} data-playback={playback} data-sprite-style="native-pixel"><ellipse cx={Math.round(position.x)} cy={Math.round(position.y)} rx={mounted?drawSize*.22:drawSize*.115} ry={drawSize*.045} fill="#171812" opacity=".36"/><svg x={Math.round(position.x-anchor[0]*scale)} y={Math.round(position.y-anchor[1]*scale)} width={size} height={size} viewBox={`${col*cell} ${row*cell} ${cell} ${cell}`} overflow="hidden"><image href={`/art/pixel/${name}-atlas.png`} width={cell*8} height={cell*rows} style={{imageRendering:'pixelated'}}/></svg></g>;
}
