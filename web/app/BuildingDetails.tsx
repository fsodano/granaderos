import {wallMaterial} from './BuildingMaterials';
import {buildingStyle} from '../../game/building-types.js';

/** Details share the wall plane, so doors and cutaway walls remain aligned. */
export function WallDetails({building:b,front,cut,opening}:{building:any;front:boolean;cut:boolean;opening:boolean}){
 const style=buildingStyle(b),kind=b?.architecture;
 if(cut)return null;
 return <g data-architecture-detail={kind??'house'}>
  {style.upper&&kind!=='cabildo'&&<><rect y={-style.height} width="40" height={style.height-46} fill={wallMaterial(b)}/><path d="M0,-47H40M0,-50H40" stroke={style.trim} strokeWidth="2"/>
   <path d={`M10,-55V-${style.height-12}Q20,-${style.height+1} 30,-${style.height-12}V-55Z`} fill="url(#building-recess)" stroke={style.trim} strokeWidth="2"/>
   <path d={`M16,-56V-${style.height-11}M24,-56V-${style.height-11}`} stroke="#776448"/>
   {kind==='mansion'&&<><path d="M6,-53H34M7,-62H33M9,-62V-53M14,-62V-53M20,-62V-53M26,-62V-53M31,-62V-53" stroke="#353a30" strokeWidth="1.2"/><path d="M4,-51H36" stroke={style.trim} strokeWidth="3"/></>}
  </>}
  {kind==='barracks'&&<path d="M0,-9H40" stroke="#915d43" strokeWidth="5" opacity=".8"/>}
  {kind==='farmhouse'&&!opening&&<path d="M2,-4V-34M38,-4V-34M0,-32H40" stroke="#776043" strokeWidth="2"/>}
  {kind==='church'&&!opening&&<path d="M1,0V-59H6V0M34,0V-59H39V0" fill={style.trim}/>}

 </g>;
}
