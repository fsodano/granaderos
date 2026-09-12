import {BUILDING_TYPES, buildingStyle} from '../../game/building-types.js';
import {BUILDING_VERTICAL_SCALE} from '../../game/building-scale.js';
import {surfaceAt, surfaceHeight, tacticalLevel} from '../../game/tactical-space.js';

// BuildingRoof draws the flat plane one architectural unit above its wall.
// Keep raw ground projection and sprite size unchanged.
export const ELEVATION_PIXELS_PER_METRE = (BUILDING_TYPES.house.height + BUILDING_VERTICAL_SCALE) / 3;
export type SurfaceRenderOffset = {x:number;y:number;height:number};
type Point = {x:number;y:number;tacticalLevel?:number;renderedHeight?:number;renderedOffset?:SurfaceRenderOffset};
type Project = (x:number,y:number)=>{x:number;y:number};
export function surfaceRenderOffset(state:any, point:Point):SurfaceRenderOffset {
  const surface=surfaceAt(state,{x:Math.round(point.x),y:Math.round(point.y),tacticalLevel:tacticalLevel(point)});
  const building=surface?.kind==='roof'&&surface.buildingId&&(state.buildings??[]).find((b:any)=>b.id===surface.buildingId);
  // Calibrate only authored building roofs to their existing detailed plane.
  // Independent platforms keep the metric projection without a facade inset.
  return building?{x:.4,y:.4,height:buildingStyle(building).height+BUILDING_VERTICAL_SCALE-(surface.elevation??0)*ELEVATION_PIXELS_PER_METRE}:{x:0,y:0,height:0};
}
export function surfaceMotionPoint(state:any, point:Point, fallbackState=state) {
  const source=surfaceHeight(state,point)===null?fallbackState:state;
  return {...point,renderedHeight:surfaceHeight(source,point)??0,renderedOffset:surfaceRenderOffset(source,point)};
}
export function renderedSurfaceHeight(state:any, point:Point) {
  return point.renderedHeight ?? surfaceHeight(state,{x:Math.round(point.x),y:Math.round(point.y),tacticalLevel:tacticalLevel(point)}) ?? 0;
}
export function projectSurface(state:any, project:Project, point:Point) {
  const offset=point.renderedOffset??surfaceRenderOffset(state,point),p=project(point.x+offset.x,point.y+offset.y);
  return {...p,y:p.y-renderedSurfaceHeight(state,point)*ELEVATION_PIXELS_PER_METRE-offset.height};
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
