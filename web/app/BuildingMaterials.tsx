import {BUILDING_VERTICAL_SCALE} from '../../game/building-scale.js';
import {BUILDING_TYPES} from '../../game/building-types.js';
export const wallMaterial=(b:any,facade=false)=>b?.wallFinish?`url(#architecture-${facade?'facade-':''}finish-${b.wallFinish})`:`url(#building-${facade?'facade-':''}${b?.architecture==='warehouse'?'brick':b?.architecture==='barracks'?'timber':`plaster-${b?.architecture??'house'}`})`;
const materialNames=['plaster','clay','brick','timber','thatch','terrace',...Object.keys(BUILDING_TYPES).map(k=>`plaster-${k}`)];
export function BuildingMaterials(){return <defs>
 {materialNames.flatMap(name=>[false,true].map(facade=>{
  const id=`building-${facade?'facade-':''}${name}`,size=name==='timber'?100:128;
  // Façade ornaments use architectural units. Counter-scale only their texture
  // coordinates, so enlarged walls retain the approved grain and chip density.
  return <pattern key={id} id={id} patternUnits="userSpaceOnUse" width={size} height={size} patternTransform={facade?`scale(1 ${1/BUILDING_VERTICAL_SCALE})`:undefined}><image href={`/art/buildings/${name}-v1.webp`} width={size} height={size} preserveAspectRatio="none" style={{imageRendering:'pixelated'}}/></pattern>;
 }))}
 <linearGradient id="building-wall-age" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#171b13" stopOpacity=".28"/><stop offset=".2" stopColor="#171b13" stopOpacity="0"/><stop offset=".65" stopColor="#171b13" stopOpacity="0"/><stop offset="1" stopColor="#333322" stopOpacity=".4"/></linearGradient>
 <linearGradient id="building-recess" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#111910"/><stop offset=".55" stopColor="#363d2b"/><stop offset="1" stopColor="#575a41"/></linearGradient>
 </defs>;}
