import {buildingAppearance} from '../../../../packages/game/building-appearance.js';
import {getBuildingProfile} from '../../../../packages/game/building-profile.js';
import type {WorldBuilding} from './world-types';
import type {WorldMaterials} from './world-materials';

export const selectedBuildingStyle=(b:WorldBuilding)=>b.campaignStyleMode==='selected'?b.campaignStyle:undefined;
export function buildingRenderAppearance(b:WorldBuilding){
 const selected=selectedBuildingStyle(b),roofFinish=b.roofFinish??(b.roof==='thatch'?'thatch':selected&&b.roof==='tile'?'clay':undefined);
 return buildingAppearance({...b,roofFinish});
}
export function buildingRenderProfile(b:WorldBuilding){
 const profile=getBuildingProfile(b),style=selectedBuildingStyle(b);
 if(!style)return profile;
 const floors=style.upper===undefined?profile.floors:style.upper?2:1;
 return {...profile,wallHeight:style.height,floors,groundFloorHeight:floors>1?Math.min(profile.groundFloorHeight,style.height*.55):style.height};
}
// Each building gets a view of the shared cache. No cached material is recoloured
// in place, and an explicit map wall finish keeps its authored pigment.
export function buildingRenderMaterials(b:WorldBuilding,materials:WorldMaterials):WorldMaterials{
 const style=selectedBuildingStyle(b);if(!style)return materials;
 const appearance=buildingRenderAppearance(b),scoped=Object.create(materials) as WorldMaterials;
 scoped.get=(kind,options={})=>materials.get(kind,{...options,...(kind==='trim'||kind.endsWith('-coping')?{colour:style.trim}:kind===appearance.wallFinish&&b.wallFinish===undefined?{colour:style.wall}:{})});
 return scoped;
}
