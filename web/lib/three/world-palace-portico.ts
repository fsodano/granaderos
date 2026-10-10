import {worldWallRecords,wallFrameRecords} from './world-wall-records';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {civicCorniceRoofJoin} from './world-civic-cornice';
import type {WorldBuilding,WorldInput} from './world-types';

const V=25.066666666666666,returnSupport=.3,roofThickness=.075,ridgeCap=.095;

/** The flat sprite hides its rear gable with painter order. Seat a physical
 * tiled hip on the source entablature's rear edge; retain the front pediment
 * and all four source eave corners. Edited, slab and legacy roofs keep their
 * existing closure unless the complete rear edge can enter the main roof. */
export function palacePorticoHipReturn(b:WorldBuilding,input:WorldInput,height:number,wallInset:number,legacy:boolean,lo:number,hi:number,back:number,eave:number){
  if(b.kind!=='palace'||![lo,hi,back,eave].every(Number.isFinite)||hi<=lo||back<=returnSupport)return;
  const join=civicCorniceRoofJoin(b,input,height,wallInset,legacy);if(!join)return;
  const frame=entranceFrame({...b,walls:wallFrameRecords(worldWallRecords(input).filter(tile=>tile.buildingId===b.id))}),profile=getBuildingProfile(b),rise=Math.min(profile.roofRise/V,Math.max(.4,frame.width*.28)),inset=Math.min(frame.width*.44,frame.depth*.3);
  const mainRoof=(u:number)=>height+join.lift+(rise-join.lift)*Math.min(1,(u+join.eave)/(frame.width*.5+join.eave),(frame.width+join.eave-u)/(frame.width*.5+join.eave),(back+join.eave)/(inset+join.eave),(frame.depth+join.eave-back)/(inset+join.eave));
  if(Math.min(mainRoof(lo),mainRoof(hi))-roofThickness<eave+1/V+ridgeCap)return;
  return {ridgeEnd:returnSupport};
}
