'use client';
import {propSize} from '../../game/props.js';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import type {ReactNode} from 'react';
type Props={state:any;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};light:(x:number,y:number)=>number};
/** Furniture shares the simulation's tile and depth; roofs conceal unknown interiors. */
export function buildPropObjects({state, revealed, project, light}:Props){
 return (state.props??[]).flatMap((prop:any)=>{
  if(!isInteriorVisible(state,prop,revealed))return [];
  const p=project(prop.x,prop.y),size=propSize(prop);let furniture:ReactNode;
  // Multi-cell furniture is projected from its actual ground footprint. Vertical
  // dimensions stay fixed rather than stretching with the floor area.
  const at=(x:number,y:number,z=0)=>{const v=project(prop.x+x,prop.y+y);return `${v.x-p.x},${v.y-p.y-z}`;};
  const x0=-.4,y0=-.4,x1=size.width-.6,y1=size.height-.6;
  const surface=(z:number)=>`${at(x0,y0,z)} ${at(x1,y0,z)} ${at(x1,y1,z)} ${at(x0,y1,z)}`;
  const plank=(x:number,y:number,width:number,depth:number,height:number)=><g transform={`translate(${x} ${y})`}><path d={`M${-width},0l${width},${depth} ${width},${-depth}v${-height}l${-width},${-depth} ${-width},${depth}Z`} fill="url(#terrain-wood)" stroke="#3c3021" strokeWidth=".6"/><path d={`M0,${depth}v${-height}l${width},${-depth}v${height}Z`} fill="#171710" opacity=".4"/><path d={`M${-width},${-height}L0,${-height-depth} ${width},${-height} 0,${depth-height}Z`} fill="url(#terrain-wood)" stroke="#b4a076" strokeWidth=".45"/></g>;
  if(prop.type==='barrels'||prop.type==='hay') furniture=<image href={`/art/scenery-${prop.type}-v1.webp`} x="-25" y="-40" width="50" height="48"/>;
  else if(prop.type==='table'||prop.type==='bench'){
   const width=prop.type==='bench'?20:22,depth=prop.type==='bench'?4:10,height=prop.type==='bench'?9:17;
   furniture=<><path d={`M${-width+3},-3v${-height+4}M${width-3},-3v${-height+4}M0,${depth}v${-height+4}`} stroke="#403323" strokeWidth="3"/>{plank(0,-height+2,width,depth,3)}{prop.type==='table'&&<><path d="M-8,-22l9,-5 9,5-9,5Z" fill="#d8cdae" stroke="#938668" strokeWidth=".4"/><path d="M-5,-22l7,-2m-4,4l5,-2" stroke="#666348" strokeWidth=".5"/></>}</>;
  }else if(prop.type==='bed') furniture=<>{plank(0,1,23,10,7)}<path d="M-21,-8L0,-19 21,-8 0,3Z" fill="#817e63" stroke="#343c30" strokeWidth=".7"/><path d="M-18,-9l7,-4 10,5-7,4Z" fill="#d0c8a6"/><path d="M-1,-15l18,9-17,9-17,-9Z" fill="#556253" opacity=".85"/><path d="M-22,-7v-12l12,-6v12M11,-5v8" fill="none" stroke="#463723" strokeWidth="3"/></>;
  else furniture=<>{plank(0,3,20,10,20)}<path d="M-12,-14v19M11,-15v19" stroke="#35372a" strokeWidth="2"/><path d="M-20,-16L0,-26 20,-16" fill="none" stroke="#c1ad7a" strokeWidth="1"/><path d="M0,-7v6" stroke="#1e241c" strokeWidth="2"/></>;
  if(size.width>1||size.height>1){
   const height=prop.type==='bed'?8:prop.type==='bench'?9:18;
   furniture=<>
    <polygon points={`${at(x0,y1)} ${at(x1,y1)} ${at(x1,y1,height)} ${at(x0,y1,height)}`} fill="#665037" stroke="#342c20" strokeWidth=".7"/>
    <polygon points={`${at(x1,y0)} ${at(x1,y1)} ${at(x1,y1,height)} ${at(x1,y0,height)}`} fill="#493b29" stroke="#342c20" strokeWidth=".7"/>
    <polygon points={surface(height)} fill={prop.type==='bed'?'#7f856a':'url(#terrain-wood)'} stroke="#b5a781" strokeWidth=".7"/>
    {prop.type==='bed'&&<>
     <polygon points={`${at(x0+.05,y0+.05,height+1)} ${at(x1-.05,y0+.05,height+1)} ${at(x1-.05,y0+.35,height+1)} ${at(x0+.05,y0+.35,height+1)}`} fill="#d9ceb1"/>
     <polygon points={`${at(x0,y0+.5,height+.5)} ${at(x1,y0+.5,height+.5)} ${at(x1,y1,height+.5)} ${at(x0,y1,height+.5)}`} fill="#596d62"/>
     <path d={`M${at(x0,y0)}L${at(x0,y0,18)}L${at(x1,y0,18)}L${at(x1,y0)}`} fill="none" stroke="#493823" strokeWidth="3"/>
    </>}
   </>;
  }
  return [{key:`prop-${prop.id}`,depth:prop.x+size.width-1+prop.y+size.height-1+.02,node:<g data-prop-id={prop.id} data-prop-type={prop.type} data-footprint={`${size.width}x${size.height}`} transform={`translate(${p.x} ${p.y})`} pointerEvents="none" style={{filter:`brightness(${light(prop.x,prop.y)})`}}><ellipse cx="6" cy="4" rx="23" ry="9" fill="#1d1e14" opacity=".3"/>{furniture}</g>}];
 });
}
