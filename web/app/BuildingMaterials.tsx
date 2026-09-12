import {BUILDING_TYPES} from '../../game/building-types.js';
export const wallMaterial=(b:any)=>b?.architecture==='warehouse'?'url(#building-brick)':b?.architecture==='barracks'?'url(#building-timber)':`url(#building-plaster-${b?.architecture??'house'})`;
export function BuildingMaterials(){return <defs>
 {['plaster','clay','brick','timber','thatch','terrace',...Object.keys(BUILDING_TYPES).map(k=>`plaster-${k}`)].map(name=><pattern key={name} id={`building-${name}`} patternUnits="userSpaceOnUse" width={name==='timber'?100:128} height={name==='timber'?100:128}><image href={`/art/buildings/${name}-v1.webp`} width={name==='timber'?100:128} height={name==='timber'?100:128} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/></pattern>)}
 <linearGradient id="building-wall-age" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#171b13" stopOpacity=".28"/><stop offset=".2" stopColor="#171b13" stopOpacity="0"/><stop offset=".65" stopColor="#171b13" stopOpacity="0"/><stop offset="1" stopColor="#333322" stopOpacity=".4"/></linearGradient>
 <linearGradient id="building-recess" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#111910"/><stop offset=".55" stopColor="#363d2b"/><stop offset="1" stopColor="#575a41"/></linearGradient>
 </defs>;}
