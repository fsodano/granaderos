import {worldWallRecords,buildingWallAtPoint,wallFrameRecords} from './world-wall-records';
import {Group,Vector3} from 'three';
import {entranceFrame} from '../../../game/building-profile.js';
import {BUILDING_OPENINGS} from '../../../game/building-scale.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** Exposed posts, ties and header follow the current stable sprite. A changed
 * opening removes its support; no low member enters an authored walking cell. */
export function stableTimberFrame(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name=`building-detail:${b.id}:stable-timber-frame`;
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),inset=buildingArtInset(b,input),along=inset*(frame.u.x+frame.u.y),depth=inset*(frame.v.x+frame.v.y),V=25.066666666666666,top=height*.89,wood=materials.get('wood'),light=illuminationAt(input,b);
  const wallAt=(u:number)=>{const p=frame.at(u,0);return buildingWallAtPoint(walls,p,b);};
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,base+y,p.y*T);};
  const rectangle=(u0:number,v0:number,u1:number,v1:number)=>{const a=at(u0,v0,0),c=at(u1,v1,0);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const walking=(rect:ReturnType<typeof rectangle>)=>(input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+top+.01&&(surface.x+.5)*T>rect.minX+1e-6&&(surface.x-.5)*T<rect.maxX-1e-6&&(surface.y+.5)*T>rect.minZ+1e-6&&(surface.y-.5)*T<rect.maxZ-1e-6);
  const feature=(name:string,draw:(batch:WorldBatch)=>void)=>{const batch=new WorldBatch(geometry);draw(batch);const node=batch.finish(`building-detail:${b.id}:${name}`);if(node.children.length)root.add(node);};
  const box=(batch:WorldBatch,rect:ReturnType<typeof rectangle>,bottom:number,upper:number)=>batch.box(wood,(rect.minX+rect.maxX)*.5,base+(bottom+upper)*.5,(rect.minZ+rect.maxZ)*.5,rect.maxX-rect.minX,upper-bottom,rect.maxZ-rect.minZ,light);
  let supports=0;
  feature('stable-posts-and-ties',batch=>{
    for(let u=0;u<=frame.width;u+=2){
      if(wallAt(u)?.type!=='wall')continue;
      const rect=rectangle(Math.max(u-.49,u-.095+along),Math.max(-.49,-.30+depth),Math.min(u+.49,u+.095+along),Math.min(.49,.12+depth));
      if(rect.maxX<=rect.minX||rect.maxZ<=rect.minZ||walking(rect))continue;
      box(batch,rect,0,top);supports++;
      const radius=1.5/V,pad=radius/T,sourceStart=u+along,sourceEnd=Math.min(frame.width,u+.6)+along,runEnd=u+(wallAt(u+1)?.type==='wall'?1:0)+.49-pad,start=Math.max(u-.49+pad,sourceStart),end=Math.min(runEnd,sourceEnd),v=Math.max(-.49+pad,Math.min(.49-pad,-.31+depth));
      if(end-start>.05){
        const y=(a:number)=>top-13/V+(a-sourceStart)/(sourceEnd-sourceStart)*11/V,tieRect=rectangle(start-pad,v-pad,end+pad,v+pad);
        if(!walking(tieRect))batch.cylinder(wood,at(start,v,y(start)),at(end,v,y(end)),radius,light);
      }
    }
  });
  const bottom=top-4/V,doorTop=Math.min(height-.12,BUILDING_OPENINGS.doorHeight/V),rect=rectangle(Math.max(-.49,.02+along),Math.max(-.49,-.28+depth),Math.min(frame.width+.49,frame.width-.02+along),Math.min(.49,.10+depth));
  if(supports>=2&&bottom>=doorTop+.045&&top<=height-.05&&!walking(rect))feature('stable-timber-header',batch=>box(batch,rect,bottom,top));
  return root;
}
