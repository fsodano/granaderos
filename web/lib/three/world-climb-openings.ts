import {Group} from 'three';
import {WorldBatch,type WorldGeometry} from './world-geometry';
import {illuminationAt,type WorldMaterials} from './world-materials';
import {ladderGeometry} from '../../../game/climb-geometry.js';
import type {WorldInput,WorldPoint} from './world-types';

export type SurfaceRectangle={minX:number;maxX:number;minZ:number;maxZ:number};
export type ClimbOpening=SurfaceRectangle&{height:number;level:number;linkId:string};

/** Split the remaining surface without overlapping fragments or zero areas. */
export function subtractRectangle(rect:SurfaceRectangle,opening:SurfaceRectangle):SurfaceRectangle[]{
  const x0=Math.max(rect.minX,opening.minX),x1=Math.min(rect.maxX,opening.maxX),z0=Math.max(rect.minZ,opening.minZ),z1=Math.min(rect.maxZ,opening.maxZ);
  if(x0>=x1||z0>=z1)return [rect];
  return [
    {minX:rect.minX,maxX:x0,minZ:rect.minZ,maxZ:rect.maxZ},
    {minX:x1,maxX:rect.maxX,minZ:rect.minZ,maxZ:rect.maxZ},
    {minX:x0,maxX:x1,minZ:rect.minZ,maxZ:z0},
    {minX:x0,maxX:x1,minZ:z1,maxZ:rect.maxZ},
  ].filter(part=>part.maxX-part.minX>1e-8&&part.maxZ-part.minZ>1e-8);
}

/** Static authored access records only. No actor or private room data enters. */
export function climbOpenings(input:WorldInput,T:number):ClimbOpening[]{
  const elevation=(point:WorldPoint)=>{
    if(point.elevation!==undefined)return point.elevation;
    const surface=(point.tacticalLevel?input.terrain.upperSurfaces:input.terrain.tiles)?.find(surface=>surface.x===point.x&&surface.y===point.y&&(surface.tacticalLevel??0)===(point.tacticalLevel??0));
    return surface?surface.elevation??0:undefined;
  };
  const result:ClimbOpening[]=[];
  for(const link of input.terrain.climbLinks??[]){
    if(link.kind!=='climb'||link.from.x!==link.to.x||link.from.y!==link.to.y||(link.to.tacticalLevel??0)!==(link.from.tacticalLevel??0)+1)continue;
    const bottom=elevation(link.from),top=elevation(link.to);
    if(typeof bottom!=='number'||typeof top!=='number'||!Number.isFinite(bottom)||!Number.isFinite(top)||top<=bottom)continue;
    const geometry=ladderGeometry([link.from.x*T,bottom,link.from.y*T],[link.to.x*T,top,link.to.y*T],T),hatch=geometry.hatch;
    if(hatch)result.push({linkId:link.id,minX:link.to.x*T+hatch.minAcross,maxX:link.to.x*T+hatch.maxAcross,minZ:link.to.y*T+hatch.minForward,maxZ:link.to.y*T+hatch.maxForward,height:top,level:link.to.tacticalLevel??0});
  }
  return result;
}

export function surfaceRectangles(surface:WorldPoint,T:number,openings:readonly ClimbOpening[]):SurfaceRectangle[]{
  let parts=[{minX:(surface.x-.5)*T,maxX:(surface.x+.5)*T,minZ:(surface.y-.5)*T,maxZ:(surface.y+.5)*T}];
  for(const opening of openings)if(opening.level===(surface.tacticalLevel??0)&&Math.abs(opening.height-(surface.elevation??0))<1e-6)parts=parts.flatMap(part=>subtractRectangle(part,opening));
  return parts;
}

/** A closed cover keeps the saved roof walkable. Only visible playback opens it. */
export function activeClimbLinks(points:readonly WorldPoint[]):Set<string>{
  return new Set(points.flatMap(point=>typeof point.activeClimbLink==='string'?[point.activeClimbLink]:[]));
}
export function buildClimbCovers(openings:readonly ClimbOpening[],active:ReadonlySet<string>,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name='climb-covers';root.userData.kind='climb-covers';
  for(const opening of openings){
    const open=active.has(opening.linkId),batch=new WorldBatch(geometry),wood=materials.get('wood'),iron=materials.get('iron'),width=opening.maxX-opening.minX,depth=opening.maxZ-opening.minZ,cx=(opening.minX+opening.maxX)/2;
    const light=illuminationAt(input,{x:cx/T,y:(opening.minZ+opening.maxZ)/2/T,tacticalLevel:opening.level});
    // The raised leaf lies entirely behind the measured body aperture. Its
    // upper walking face is flush with the floor when the leaf is closed.
    const boards=Math.ceil(width/.16),boardWidth=width/boards,darkwood=materials.get('darkwood');
    if(open)batch.box(wood,cx,opening.height+depth/2,opening.minZ-.02,width,depth,.04,light);
    else batch.box(wood,cx,opening.height-.02,(opening.minZ+opening.maxZ)/2,width,.04,depth,light);
    // Recess-coloured board joins keep a continuous physical cover surface.
    for(let n=1;n<boards;n++){
      const x=opening.minX+n*boardWidth;
      if(open)batch.box(darkwood,x,opening.height+depth/2,opening.minZ+.00025,.001,depth,.0005,light);
      else batch.box(darkwood,x,opening.height+.00025,(opening.minZ+opening.maxZ)/2,.001,.0005,depth,light);
    }
    for(const x of [cx-width*.30,cx+width*.30]){
      // Under-leaf straps stay below closed soles and behind an open body.
      if(open)batch.box(iron,x,opening.height+depth/2,opening.minZ-.043,.045,depth,.006,light);
      else batch.box(iron,x,opening.height-.043,(opening.minZ+opening.maxZ)/2,.045,.006,depth,light);
      batch.box(iron,x,opening.height-.022,opening.minZ-.045,.06,.02,.09,light);
    }
    const node=batch.finish(`climb-cover:${opening.linkId}`);node.userData={kind:'climb-cover',linkId:opening.linkId,open};root.add(node);
  }
  return root;
}
