import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import type {WorldBuilding,WorldInput} from './world-types';

const V=25.066666666666666,projection=.21,thickness=.075;
/** The source cap is at wallHeight+1. Seat the real roof underside on that
 * cap, keeping the native ridge and the source cornice section unchanged. */
export function civicCorniceRoofJoin(b:WorldBuilding,input:WorldInput,height:number,wallInset:number,legacy:boolean){
  if(!['townhall','palace'].includes(b.kind??'')||!Number.isFinite(height)||height<4||wallInset!==0||legacy&&b.wallFinish===undefined||b.roof==='terrace'||(input.terrain.upperSurfaces??[]).some(surface=>surface.kind==='roof'&&surface.buildingId===b.id))return;
  const profile=getBuildingProfile(b);if(profile.roofShape!=='hip')return;
  const frame=entranceFrame({...b,walls:input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type))});if(frame.width<=0||frame.depth<=0)return;
  const eave=Math.max(profile.eave,projection),rise=Math.min(profile.roofRise/V,Math.max(.4,frame.width*.28)),inset=Math.min(frame.width*.44,frame.depth*.3),fraction=(eave-projection)/Math.max(frame.width*.5+eave,inset+eave);
  // The hip is linear between its eave and fixed ridge. Solve its lowest
  // underside over the complete cornice footprint, including every return.
  const lift=(1/V+thickness-rise*fraction)/(1-fraction);
  return {eave,lift,projection,bottom:height-4/V,top:height+1/V,thickness};
}
