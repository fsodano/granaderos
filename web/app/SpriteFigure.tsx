'use client';
import {sitePath} from '../lib/site-path.js';
import {useEffect,useState,useId,useMemo,useRef} from 'react';
import {SKIN_PALETTES,spriteSkinTone} from '../../game/sprite-skin.js';
import {SPRITE_SKIN_MASKS} from '../../game/sprite-skin-masks.js';
import {startSpriteAnimation} from '../lib/sprite-animation-clock.js';
import {spriteRender,spriteMovementFrame,spriteViewport} from '../../game/sprite-render.js';
import {loadSpriteImage,spriteContinuity} from '../lib/sprite-image-cache.js';
type Motion={direction:number;frame:number;moving:boolean;elapsedMs?:number};
type Props={unit:any;position:{x:number;y:number};motion:Motion;pose?:string;drawSize?:number;appearance?:'soldier'|'civilian'};
/** Authored raster atlases. Each layout has a fixed logical ground origin. */
export default function SpriteFigure({unit,position,motion,pose='idle',drawSize=52,appearance='soldier'}:Props){
 const skinTone=spriteSkinTone(unit),skinPalette=SKIN_PALETTES[skinTone as keyof typeof SKIN_PALETTES],skinFilter='skin-'+useId().replace(/:/g,'');
 const [life,setLife]=useState({id:unit.id,dead:unit.hp<=0,collapse:false});
 if(life.id!==unit.id||life.dead!==(unit.hp<=0))setLife({id:unit.id,dead:unit.hp<=0,collapse:life.id===unit.id&&!life.dead&&unit.hp<=0});
 const requested=spriteRender(unit,motion,life.collapse?'collapse':pose,appearance);
 const loaded=useRef<any>(null),[readyHref,setReadyHref]=useState('');
 useEffect(()=>{let active=true;loadSpriteImage(sitePath(requested.href)).then((ready:boolean)=>{if(active&&ready){loaded.current=requested;setReadyHref(requested.href);}});return()=>{active=false;};},[requested.href]);
 // Changing gait/action must not remove a body while the browser decodes its
 // new atlas. Death never reuses a living pose, even while its art is loading.
 const sprite=spriteContinuity(requested,loaded.current,readyHref);
 useEffect(()=>{
  if(!life.collapse)return;
  const timer=setTimeout(()=>setLife(previous=>({...previous,collapse:false})),sprite.frames*1000/Math.max(1,sprite.fps));
  return()=>clearTimeout(timer);
 },[life.collapse,sprite.frames,sprite.fps]);
 const {name,playback,frames,fps,mounted}=sprite;
 const [clock,setClock]=useState({name:'',frame:0});
 const actionKey=playback==='action'?`${unit.ap}:${unit.loaded}`:'';
 useEffect(()=>{
  if(playback!=='action'&&playback!=='breathing')return;
  return startSpriteAnimation({playback,frames,fps,onFrame:(frame:number)=>{
   setClock(previous=>previous.name===name&&previous.frame===frame?previous:{name,frame});
  }});
 },[name,playback,actionKey,frames,fps]);
 const frame=playback==='movement'?spriteMovementFrame(motion,frames,fps):clock.name===name?clock.frame:0;
 const viewport=spriteViewport(sprite,position,motion.direction,frame,drawSize);
 // Preserve the authored raster density through camera and browser zoom. Both
 // layers must use the same sampling so skin edges stay aligned with the body.
 const imageRendering=sprite.style==='illustrated-pixel-art'?'auto':'pixelated';
 // Walking changes screen position on every display frame, but the authored
 // atlas changes only at its own frame rate. Move one group without laying out
 // and reconciling the nested SVG and skin filter again between atlas frames.
 const atlas=useMemo(()=>{
  const [skinX,skinY]=viewport.viewBox.split(' ').map(Number);
  return <svg x={0} y={0} width={viewport.width} height={viewport.height} viewBox={viewport.viewBox} overflow="hidden"><image href={sitePath(sprite.href)} width={sprite.size[0]} height={sprite.size[1]} style={{imageRendering}}/>{sprite.style==='illustrated-pixel-art'&&SPRITE_SKIN_MASKS.includes(name)&&<><defs><filter id={skinFilter} colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" x={skinX} y={skinY} width={sprite.cell} height={sprite.cell}><feComponentTransfer><feFuncR type="table" tableValues={skinPalette.r.join(' ')}/><feFuncG type="table" tableValues={skinPalette.g.join(' ')}/><feFuncB type="table" tableValues={skinPalette.b.join(' ')}/><feFuncA type="identity"/></feComponentTransfer></filter></defs><image data-skin-layer="true" href={sitePath(`/art/skin/${name}.png`)} width={sprite.size[0]} height={sprite.size[1]} filter={`url(#${skinFilter})`} style={{imageRendering}}/></>}</svg>;
 },[viewport.width,viewport.height,viewport.viewBox,sprite.href,sprite.size,sprite.style,sprite.cell,name,skinFilter,skinPalette,imageRendering]);
 return <g pointerEvents="none" data-skin-tone={skinTone} data-sprite={name} data-requested-sprite={requested.requestedName} data-playback={playback} data-sprite-style={sprite.style} data-sprite-fallback={sprite.fallbackReason??undefined}><ellipse cx={sprite.style==='illustrated-pixel-art'?position.x:Math.round(position.x)} cy={sprite.style==='illustrated-pixel-art'?position.y:Math.round(position.y)} rx={mounted?drawSize*.22:drawSize*.115} ry={drawSize*.045} fill="#171812" opacity=".36"/>{sprite===requested&&readyHref!==requested.href&&<g data-sprite-loading-body="true" transform={`translate(${position.x} ${position.y})`} fill={unit.side==='enemy'?'#956b57':'#748273'} stroke="#ddd2af" strokeWidth=".7">{unit.hp<=0||unit.unconscious||unit.stance==='prone'?<path d="M-17,-5l10,-5 14,2 11,6-4,5-13,-5-12,2Z"/>:<><circle cy="-39" r="4"/><path d="M-4,-34h8l5,18-6,1-1,14h-4l-1,-14-6,-1Z"/></>}</g>}<g data-sprite-position="true" transform={`translate(${viewport.x} ${viewport.y})`}>{atlas}</g></g>;
}
