'use client';
import {sitePath} from '../lib/site-path.js';
import {propSize} from '../../game/props.js';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import {roomDressings} from '../../game/room-dressing.js';
import type {ReactNode} from 'react';
type Props={state:any;revealed:Set<string>;project:(x:number,y:number)=>{x:number;y:number};light:(x:number,y:number)=>number;includeDressing?:boolean};
/** Furniture shares the simulation's tile and depth; roofs conceal unknown interiors. */
export function buildPropObjects({state, revealed, project, light,includeDressing=true}:Props){
 return [...(state.props??[]),...(includeDressing?roomDressings(state):[])].flatMap((prop:any)=>{
  if(!isInteriorVisible(state,prop,revealed))return [];
  const p=project(prop.x,prop.y),size=propSize(prop);let furniture:ReactNode;
  // Multi-cell furniture is projected from its actual ground footprint. Vertical
  // dimensions stay fixed rather than stretching with the floor area.
  const at=(x:number,y:number,z=0)=>{const v=project(prop.x+x,prop.y+y);return `${v.x-p.x},${v.y-p.y-z}`;};
  const x0=-.4,y0=-.4,x1=size.width-.6,y1=size.height-.6;
  const bedPoint=(u:number,v:number,z:number)=>{const rotation=prop.rotation??0;const x=rotation===90?1-v:rotation===180?1-u:rotation===270?v:u,y=rotation===90?u:rotation===180?1-v:rotation===270?1-u:v;return at(x0+(x1-x0)*x,y0+(y1-y0)*y,z);};
  const surface=(z:number)=>`${at(x0,y0,z)} ${at(x1,y0,z)} ${at(x1,y1,z)} ${at(x0,y1,z)}`;
  const plank=(x:number,y:number,width:number,depth:number,height:number)=><g transform={`translate(${x} ${y})`}><path d={`M${-width},0l${width},${depth} ${width},${-depth}v${-height}l${-width},${-depth} ${-width},${depth}Z`} fill="url(#terrain-wood)" stroke="#3c3021" strokeWidth=".6"/><path d={`M0,${depth}v${-height}l${width},${-depth}v${height}Z`} fill="#171710" opacity=".4"/><path d={`M${-width},${-height}L0,${-height-depth} ${width},${-height} 0,${depth-height}Z`} fill="url(#terrain-wood)" stroke="#b4a076" strokeWidth=".45"/></g>;
  if(prop.type==='hearth')furniture=<g data-historical-dressing="hearth"><path d="M-20,-4l20,10 19,-10v-19L0,-33-20,-23Z" fill="#82775f" stroke="#413d30"/><path d="M-10,-2v-15l10,-5 10,5V-2L0,3Z" fill="#352f25"/><path d="M-18,-20L0,-29 18,-20M-11,-18L0,-24 11,-18M-17,-9v-9m34,9v-9" fill="none" stroke="#b2a68b" strokeWidth="1"/><path d="M-5,-1L6,-7m-10,-7L8,-2" stroke="#665039" strokeWidth="3"/><path d="M1,-22v-8" stroke="#272b23" strokeWidth="2"/><path d="M-8,-22q8,-8 16,0q-1,12-8,12t-8,-12" fill="#363a32" stroke="#8b8e7c" strokeWidth=".7"/><path d="M-8,-26q8,-9 16,0" fill="none" stroke="#636a5d"/></g>;
  else if(prop.type==='washstand')furniture=<g data-historical-dressing="washstand">{plank(-4,-8,16,8,4)}<path d="M-17,-8v12M8,-8v12" stroke="#50412c" strokeWidth="3"/><ellipse cx="-4" cy="-18" rx="12" ry="5" fill="#d2c8a7" stroke="#7b7865"/><path d="M-16,-18q2,11 12,11t12,-11" fill="#bcb795" stroke="#747464"/><ellipse cx="-4" cy="-18" rx="9" ry="3" fill="#829a91"/><path d="M12,-20v12q8,5 8,-2v-10Z" fill="#bd9b69" stroke="#65573e"/><path d="M20,-18q7,2 1,7" fill="none" stroke="#bd9b69" strokeWidth="2"/><path d="M-15,-9l4,15 7,-1-2,-15" fill="#ddd2af"/></g>;
  else if(prop.type==='shelf')furniture=<g data-historical-dressing="shelf"><path d="M-20,-14L0,-24 18,-14M-20,-28L0,-38 18,-28" fill="none" stroke="#675235" strokeWidth="4"/><path d="M-16,-12v-25M13,-12v-25" stroke="#473e2b" strokeWidth="2"/><path d="M-12,-31v-8h6v8m12,-1v-10h5v10" stroke="#ac8059" strokeWidth="4"/><path d="M-10,-17v-6h6v6M5,-18v-9h7v9" stroke="#c2b58f" strokeWidth="4"/></g>;
  else if(prop.type==='pottery')furniture=<g data-historical-dressing="pottery"><path d="M-10,-19h7v4q12,16 2,19q-14,1-13,-7q0,-7 4,-12Z" fill="#b98050" stroke="#6e5135"/><ellipse cx="-6" cy="-19" rx="4" ry="1.8" fill="#654936"/><path d="M3,-17h8l2,12q0,8-6,8t-6,-8Z" fill="#a89872" stroke="#706347"/><path d="M9,-13q11,4 1,9" fill="none" stroke="#a89872" strokeWidth="2"/></g>;
  else if(prop.type==='sacks')furniture=<g data-historical-dressing="sacks"><path d="M-15,-14l3,-8h7l2,8q12,20-5,19t-7,-19" fill="#b7a377" stroke="#776547"/><path d="M1,-11l3,-10h7l1,10q11,17-5,17t-6,-17" fill="#9d8e62" stroke="#776547"/><path d="M-11,-18h7M4,-16h7m-17,4l-2,12M8,-10l1,12" fill="none" stroke="#756746"/></g>;
  else if(prop.type==='rug')furniture=<g data-historical-dressing="rug"><path d="M-24,0L0,-12 24,0 0,12Z" fill="#815349" stroke="#c1a57b" strokeWidth="1.4"/><path d="M-17,0L0,-8 17,0 0,8Z" fill="none" stroke="#c1a57b"/><path d="M-23,-2l-5,2m8,0-5,3m46,-3l5,2m-7,1,5,2" stroke="#b8a681"/></g>;
  else if(prop.type==='candle')furniture=<g data-historical-dressing="candle"><path d="M-8,-7h16M-4,-7v-6h8v6" stroke="#a69060" strokeWidth="2"/><path d="M-1,-13v-11h3v11" fill="#d8cba2" stroke="#9f9068"/><path d="M0,-25q-3,-4 1,-8q4,6-1,8" fill="#ecc27a"/>{state.night&&<ellipse cx="1" cy="-27" rx="8" ry="9" fill="#efb86a" opacity=".16"/>}</g>;
  else if(prop.type==='rubble'||prop.type==='broken-timber')furniture=<g data-historical-dressing={prop.type}><path d="M-21,-1l7,-9 12,5 10,-4 15,8-9,6-13,-2-12,4Z" fill="#8b8068" stroke="#5e5a49"/><path d="M-18,-3l10,4 4,-7m8,2 7,6M-11,7 14,-8" stroke="#b8aa8a" strokeWidth="2"/>{prop.type==='broken-timber'&&<path d="M-22,6L19,-12M-7,-11L10,6" stroke="#695037" strokeWidth="4"/>}</g>;
  else if(prop.type==='cart')furniture=<image data-cart-art="true" href={sitePath('/art/buildings/cart-v1.webp')} x="-27" y="-48" width="90" height="60" style={{imageRendering:'pixelated'}}/>;
  else if(prop.type==='barrels'||prop.type==='hay') furniture=<image href={sitePath(`/art/scenery-${prop.type}-v1.webp`)} x="-25" y="-40" width="50" height="48"/>;
  else if(prop.type==='table'||prop.type==='bench'){
   const width=prop.type==='bench'?20:22,depth=prop.type==='bench'?4:10,height=prop.type==='bench'?9:17;
   furniture=<><path d={`M${-width+3},-3v${-height+4}M${width-3},-3v${-height+4}M0,${depth}v${-height+4}`} stroke="#403323" strokeWidth="3"/>{plank(0,-height+2,width,depth,3)}{prop.type==='table'&&<><path d="M-8,-22l9,-5 9,5-9,5Z" fill="#d8cdae" stroke="#938668" strokeWidth=".4"/><path d="M-5,-22l7,-2m-4,4l5,-2" stroke="#666348" strokeWidth=".5"/></>}</>;
  }else if(prop.type==='bed') furniture=<>{plank(0,1,23,10,7)}<path d="M-21,-8L0,-19 21,-8 0,3Z" fill="#817e63" stroke="#343c30" strokeWidth=".7"/><path d="M-18,-9l7,-4 10,5-7,4Z" fill="#d0c8a6"/><path d="M-1,-15l18,9-17,9-17,-9Z" fill="#556253" opacity=".85"/><path d="M-22,-7v-12l12,-6v12M11,-5v8" fill="none" stroke="#463723" strokeWidth="3"/></>;
  else furniture=<>{plank(0,3,20,10,20)}<path d="M-12,-14v19M11,-15v19" stroke="#35372a" strokeWidth="2"/><path d="M-20,-16L0,-26 20,-16" fill="none" stroke="#c1ad7a" strokeWidth="1"/><path d="M0,-7v6" stroke="#1e241c" strokeWidth="2"/></>;
  if(prop.type!=='cart'&&(size.width>1||size.height>1)){
   const height=prop.type==='bed'?8:prop.type==='bench'?9:18;
   furniture=<>
    <polygon points={`${at(x0,y1)} ${at(x1,y1)} ${at(x1,y1,height)} ${at(x0,y1,height)}`} fill="#665037" stroke="#342c20" strokeWidth=".7"/>
    <polygon points={`${at(x1,y0)} ${at(x1,y1)} ${at(x1,y1,height)} ${at(x1,y0,height)}`} fill="#493b29" stroke="#342c20" strokeWidth=".7"/>
    <polygon points={surface(height)} fill={prop.type==='bed'?'#7f856a':'url(#terrain-wood)'} stroke="#b5a781" strokeWidth=".7"/>
    {prop.type==='bed'&&<>
     <polygon points={`${bedPoint(.05,.04,height+1)} ${bedPoint(.95,.04,height+1)} ${bedPoint(.95,.23,height+1)} ${bedPoint(.05,.23,height+1)}`} fill="#d9ceb1"/>
     <polygon points={`${bedPoint(0,.3,height+.5)} ${bedPoint(1,.3,height+.5)} ${bedPoint(1,1,height+.5)} ${bedPoint(0,1,height+.5)}`} fill="#596d62"/>
     <path d={`M${bedPoint(0,0,0)}L${bedPoint(0,0,18)}L${bedPoint(1,0,18)}L${bedPoint(1,0,0)}`} fill="none" stroke="#493823" strokeWidth="3"/>
    </>}
   </>;
  }
  const owner=prop.type==='cart'?state.buildings?.find((b:any)=>prop.id===`${b.id}:cart`):null;
  const depth=owner&&prop.y>=owner.y+owner.height?Math.max(prop.x+size.width-1+prop.y+size.height-1+.02,owner.x+owner.width+owner.y+owner.height-1.4):prop.x+size.width-1+prop.y+size.height-1+.02;
  return [{key:`prop-${prop.id}`,depth:prop.type==='rug'?prop.x+prop.y-.02:depth,node:<g data-prop-id={prop.id} data-prop-type={prop.type} data-footprint={`${size.width}x${size.height}`} data-room-purpose={prop.purpose} data-decoration={prop.decorative||undefined} transform={`translate(${p.x} ${p.y})`} pointerEvents="none" style={{filter:`brightness(${light(prop.x,prop.y)})`}}>{prop.type!=='rug'&&<ellipse cx="6" cy="4" rx="23" ry="9" fill="#1d1e14" opacity=".3"/>}{furniture}</g>}];
 });
}
