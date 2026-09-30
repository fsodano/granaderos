import {BUILDING_OPENINGS as O} from '../../game/building-scale.js';

/** Openings stay on their collision wall plane and clear a standing soldier. */
export function BuildingOpening({tile,wallHeight,cut,plaster}:{tile:any;wallHeight:number;cut:boolean;plaster:string}){
 const door=tile.type==='door',left=(40-O.doorWidth)/2,right=40-left;
 const top=door?O.doorHeight:O.windowTop,sill=door?0:O.windowSill;
 if(cut)return <g data-opening-height={O.cutawayHeight}>
  <path d={`M0,0V-${O.cutawayHeight}H${left}V0ZM${right},0V-${O.cutawayHeight}H40V0Z`} fill={plaster}/>
  <path d={`M${left},0H${right}`} stroke="#b9a580" strokeWidth="3"/>
  {door&&!tile.open&&<path d={`M${left+1},-3H${right-1}`} stroke="#62452c" strokeWidth="4"/>}
  {!door&&<rect x={left} y={-O.cutawayHeight+2} width={O.doorWidth} height={O.cutawayHeight-2} fill={plaster}/>}
 </g>;
 return <g data-opening-height={top} data-opening-width={O.doorWidth}>
  <path d={`M0,0V-${wallHeight}H40V0H${right}V-${top}H${left}V0Z`} fill={plaster}/>
  {!door&&<rect x={left-1} y={-sill} width={O.doorWidth+2} height={sill} fill={plaster}/>}
  <rect x={left} y={-top} width={O.doorWidth} height={top-sill} fill="url(#building-recess)"/>
  <path d={`M${left-1},-${sill}V-${top+2}H${right+1}V-${sill}M${left-3},-${top+4}H${right+3}`} fill="none" stroke="#e3d5b5" strokeWidth="1.4"/>
  {door?<g transform={tile.open?`translate(${left} 0) skewY(-25) scale(.22 1) translate(${-left} 0)`:undefined}>
   <rect x={left+1} y={-top} width={O.doorWidth-2} height={top} fill="url(#building-timber)" stroke="#5c4931" strokeWidth=".8"/>
   {[left+5,20,right-5].map(x=><path key={x} d={`M${x},-${top-1}V-1`} stroke="#413725" strokeWidth=".7"/>)}
   <path d={`M${left+1},-${top*.8}H${right-1}M${left+1},-${top*.23}H${right-1}`} stroke="#413725" strokeWidth="1.1"/>
   <circle cx={right-4} cy={-top*.47} r="1.2" fill="#c1a16a"/>
  </g>:<>
   {[left+4,left+9,right-9,right-4].map(x=><path key={x} d={`M${x},-${top-1}V-${sill+1}`} stroke="#383b30" strokeWidth="1"/>)}
   <path d={`M${left+1},-${top-7}H${right-1}M${left+1},-${sill+8}H${right-1}`} stroke="#383b30" strokeWidth="1"/>
   <path d={`M${left-2},-${sill}H${right+2}`} stroke="#e3d2a5" strokeWidth="2"/>
  </>}
 </g>;
}
