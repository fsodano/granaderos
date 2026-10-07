import {surfaceRectangles,subtractRectangle} from './world-climb-openings';
import type {ClimbOpening,SurfaceRectangle} from './world-climb-openings';
import type {WorldBuilding,WorldInput,WorldPoint} from './world-types';

/** Centred warehouse walls expose their supported masonry on every face.
 * Corner openings retain the original shell to preserve their clipped spans. */
export function buildingArtInset(b:WorldBuilding,input:WorldInput){
  if((b.kind??b.architecture)!=='warehouse')return .4;
  const cornerOpening=input.terrain.tiles.some(tile=>tile.buildingId===b.id&&['door','window'].includes(tile.type)&&(tile.x===b.x||tile.x===b.x+b.width-1)&&(tile.y===b.y||tile.y===b.y+b.height-1));
  return cornerOpening ? .4 : 0;
}

/** A disclosed floor meets the inner faces of centred perimeter walls.
 * The returns occupy blocked wall cells and retain physical hatch clipping. */
export function buildingFloorRectangles(b:WorldBuilding,input:WorldInput,cell:WorldPoint,T:number,openings:readonly ClimbOpening[],inset:number):SurfaceRectangle[]{
  if(inset!==0||(cell.tacticalLevel??0)!==0||cell.x<=b.x||cell.x>=b.x+b.width-1||cell.y<=b.y||cell.y>=b.y+b.height-1)return surfaceRectangles(cell,T,openings);
  const rect={minX:(cell.x-.5)*T,maxX:(cell.x+.5)*T,minZ:(cell.y-.5)*T,maxZ:(cell.y+.5)*T},halfWall=.09;
  const wall=(x:number,y:number)=>input.terrain.tiles.some(tile=>tile.buildingId===b.id&&tile.x===x&&tile.y===y&&['wall','door','window'].includes(tile.type)&&(x===b.x||x===b.x+b.width-1||y===b.y||y===b.y+b.height-1));
  if(wall(cell.x-1,cell.y))rect.minX=(cell.x-1)*T+halfWall;
  if(wall(cell.x+1,cell.y))rect.maxX=(cell.x+1)*T-halfWall;
  if(wall(cell.x,cell.y-1))rect.minZ=(cell.y-1)*T+halfWall;
  if(wall(cell.x,cell.y+1))rect.maxZ=(cell.y+1)*T-halfWall;
  let parts=[rect];
  for(const opening of openings)if(opening.level===(cell.tacticalLevel??0)&&Math.abs(opening.height-(cell.elevation??0))<1e-6)parts=parts.flatMap(part=>subtractRectangle(part,opening));
  return parts;
}
