import {BUILDING_TYPES} from '../../game/building-types.js';
import {surfaceAt, surfaceHeight, tacticalLevel} from '../../game/tactical-space.js';

// The existing colonial house wall is the visual reference for a 3 m terrace.
// Keep raw ground projection and sprite size unchanged.
export const ELEVATION_PIXELS_PER_METRE = BUILDING_TYPES.house.height / 3;
type Point = {x:number;y:number;tacticalLevel?:number;renderedHeight?:number};
type Project = (x:number,y:number)=>{x:number;y:number};
export function renderedSurfaceHeight(state:any, point:Point) {
  return point.renderedHeight ?? surfaceHeight(state,{x:Math.round(point.x),y:Math.round(point.y),tacticalLevel:tacticalLevel(point)}) ?? 0;
}
export function projectSurface(state:any, project:Project, point:Point) {
  const p=project(point.x,point.y);
  return {...p,y:p.y-renderedSurfaceHeight(state,point)*ELEVATION_PIXELS_PER_METRE};
}
// A building roof is drawn as one detailed object after its front walls.
// Actors and hit targets on that roof must follow it, while retaining their order.
export function surfaceDrawDepth(state:any, point:Point, bias=0) {
  const base=point.x+point.y+bias;
  if(!tacticalLevel(point))return base;
  const surface=surfaceAt(state,{x:Math.round(point.x),y:Math.round(point.y),tacticalLevel:tacticalLevel(point)});
  const building=surface?.buildingId&&(state.buildings??[]).find((b:any)=>b.id===surface.buildingId);
  return building?Math.max(base,building.x+building.width+building.y+building.height+.2+(point.x+point.y)*.001+bias):base;
}
