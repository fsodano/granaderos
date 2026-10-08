import {Group,Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {BUILDING_OPENINGS} from '../../../game/building-scale.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {civicCorniceRoofJoin} from './world-civic-cornice';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** Source civic stone bands and the plaster cornice use actual supported
 * wall cells. Flat/edited/legacy roofs keep their released upper trim. */
export function civicStoreyBands(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),profile=getBuildingProfile(b),V=25.066666666666666,storey=height*profile.groundFloorHeight/profile.wallHeight,light=illuminationAt(input,b),batch=new WorldBatch(geometry);
  const stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),stoneCap=materials.get('civic-band-stone-coping',{colour:'#c7b795'});
  // Only the coplanar source cap is biased; its physical altitude stays exact.
  stoneCap.polygonOffset=true;stoneCap.polygonOffsetFactor=-1;stoneCap.polygonOffsetUnits=-1;
  const join=civicCorniceRoofJoin(b,input,height,0,false),stages:[number,number,number,typeof stone,typeof stone|undefined][]=[[storey-2/V,storey+4/V,.22,stone,undefined],[storey+3/V,storey+5/V,.30,stone,stoneCap]];
  if(join){
    const appearance=buildingAppearance(b),texture='/art/architecture-plaster-v2.png',wall=materials.get(appearance.wallFinish,{architectureRole:'volume',texture}),trims:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},cap=materials.get('civic-band-plaster-coping',{colour:trims[appearance.wallFinish]??trims.limewash});
    applyArchitectureFinish(wall,{...architectureFinish(appearance.wallFinish,'volume')!,texture,textureOpacity:.36,multiplyOpacity:0});
    cap.polygonOffset=true;cap.polygonOffsetFactor=-1;cap.polygonOffsetUnits=-1;stages.push([join.bottom,join.top,join.projection,wall,cap]);
  }
  const at=(u:number,v:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,0,p.y*T);};
  const rect=(u0:number,v0:number,u1:number,v1:number)=>{const a=at(u0,v0),c=at(u1,v1);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const walking=(r:ReturnType<typeof rect>,top:number)=>(input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+top+.01&&(surface.x+.5)*T>r.minX+1e-6&&(surface.x-.5)*T<r.maxX-1e-6&&(surface.y+.5)*T>r.minZ+1e-6&&(surface.y-.5)*T<r.maxZ-1e-6);
  const sides=[{length:frame.width,point:(a:number,o:number)=>[a,-o] as const},{length:frame.width,point:(a:number,o:number)=>[a,frame.depth+o] as const},{length:frame.depth,point:(a:number,o:number)=>[-o,a] as const},{length:frame.depth,point:(a:number,o:number)=>[frame.width+o,a] as const}];
  for(const side of sides)for(const [bottom,top,outward,material,cap]of stages){
    const ranges:{first:number;last:number}[]=[];
    for(let along=0;along<=side.length;along++){
      const [u,v]=side.point(along,0),p=frame.at(u,v),tile=walls.find(tile=>tile.x===p.x&&tile.y===p.y);if(!tile)continue;
      // An edited metric storey can move a band down into an opening. Keep
      // the complete standing aperture instead of masking its upper portion.
      if(tile.type!=='wall'&&bottom<Math.min(height-.12,(tile.type==='door'?BUILDING_OPENINGS.doorHeight:BUILDING_OPENINGS.windowTop)/V)+.05)continue;
      const first=Math.max(0,along-.5),last=Math.min(side.length,along+.5),a=side.point(first,outward),c=side.point(last,-.12),r=rect(a[0],a[1],c[0],c[1]);if(walking(r,top))continue;
      const previous=ranges[ranges.length-1];if(previous&&Math.abs(previous.last-first)<1e-6)previous.last=last;else ranges.push({first,last});
    }
    for(const {first,last}of ranges){
      const a=side.point(first,outward),c=side.point(last,-.12),r=rect(a[0],a[1],c[0],c[1]);
      batch.box(material,(r.minX+r.maxX)*.5,base+(bottom+top)*.5,(r.minZ+r.maxZ)*.5,r.maxX-r.minX,top-bottom,r.maxZ-r.minZ,light);
      if(cap)batch.polygon(cap,[new Vector3(r.minX,base+top,r.minZ),new Vector3(r.minX,base+top,r.maxZ),new Vector3(r.maxX,base+top,r.maxZ),new Vector3(r.maxX,base+top,r.minZ)],light);
    }
  }
  // Flat and usable roofs retain their released trim and physical height.
  if(!join){
  const trim=materials.get('trim'),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x)),y=height-.10;
  const box=(u:number,v:number,w:number,d:number)=>{const p=at(u,v);p.y=base+y;batch.primitive('box',trim,p,[w*T,.15,d*T],rotation,light);};
  for(const v of [0,frame.depth])box(frame.width*.5,v+(v===0?-.10:.10)/T,frame.width+.20/T,.29/T);
  for(const u of [0,frame.width])box(u+(u===0?-.10:.10)/T,frame.depth*.5,.29/T,frame.depth);
  }
  const node=batch.finish(`building-detail:${b.id}:${b.kind==='palace'?'palace':'townhall'}-storey-bands`);
  return node.children.length?node:new Group();
}
