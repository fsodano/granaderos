import {campaignWorld} from './campaign-definition.js';

// Shared construction catalogue. Styles are interpretations of 1810–1820 architecture.
export const buildingTypes=context=>campaignWorld(context).buildings.types;
export const buildingFootprints=context=>campaignWorld(context).buildings.footprints;
export const BUILDING_TYPES=Object.freeze(buildingTypes());
export const BUILDING_FOOTPRINTS=Object.freeze(buildingFootprints());
export const buildingStyle=(b,context=null)=>({...buildingTypes(context)[b?.architecture]??buildingTypes(context).house,...b?.campaignStyle});
export function sectorBuildingType(id,index=0,landmark=false,context=null){
 const expansion=campaignWorld(context).expansion;
 if(landmark)return expansion.buildingLandmarks?.[id]??'house';
 const types=expansion.buildingSelections?.[id]??expansion.defaultBuildingSelection;
 return types[index%types.length];
}
