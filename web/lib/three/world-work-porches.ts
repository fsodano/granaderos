import {Group,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {WorldBatch,roofTextureProjector} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {MeshStandardMaterial} from 'three';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** Source shop/forge porches and the distinct depot loading frame.
 * Shafts and braces bear on actual solid cells; roof planes clear the door. */
export function workPorch(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,edgeDetails:(panels:readonly (readonly Vector3[])[],low:number,roof:MeshStandardMaterial)=>Group){
  const root=new Group();root.name=`building-work-porch:${b.id}`;
  const kind=b.kind??b.architecture,loading=kind==='depot',V=25.066666666666666;
  if(!['pulperia','smithy','depot'].includes(kind??'')||height<2.4)return root;
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),appearance=buildingAppearance(b),profile=getBuildingProfile(b),light=illuminationAt(input,b),wood=materials.get('wood'),stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),roof=materials.get(!loading&&appearance.roofFinish==='thatch'?'clay':appearance.roofFinish),batch=new WorldBatch(geometry),name=loading?'gallery':kind==='smithy'?'forge-canopy':'gallery';
  const wallAt=(u:number)=>{const p=frame.at(u,0);return walls.find(tile=>tile.x===p.x&&tile.y===p.y);};
  const radius=kind==='pulperia'?2:1.25,sourceLo=Math.max(.15,frame.doorU-radius),sourceHi=Math.min(frame.width-.15,frame.doorU+radius),supports=loading?[...new Set([1/6,1/2,5/6].map(r=>Math.round(frame.width*r)))].filter(u=>wallAt(u)?.type==='wall'):Array.from({length:Math.max(1,Math.ceil(sourceHi-sourceLo))},(_,n)=>Math.round(sourceLo)+n).filter(u=>u<=sourceHi&&wallAt(u)?.type==='wall'&&!(u>sourceLo+.7&&u<sourceHi-.7&&u%2));
  if(supports.length<2)return root;
  const lo=loading?Math.min(...supports):sourceLo,hi=loading?Math.max(...supports):sourceHi,low=loading?height-3/V:Math.max(2.12,height*.72),sourceHigh=loading?height+6/V:low+height*.17,flat=b.roof==='terrace'||(input.terrain.upperSurfaces??[]).some(surface=>surface.kind==='roof'&&surface.buildingId===b.id),high=flat?Math.min(sourceHigh,height-.015):sourceHigh;
  if(high<=low+.08)return root;
  // The source's low projected porch would cross the native standing door.
  // Lift the same slope enough for its beam and fascia to clear the aperture.
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,base+y,p.y*T);};
  const rectangle=(u0:number,v0:number,u1:number,v1:number)=>{const a=at(u0,v0,0),c=at(u1,v1,0);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const front=loading?-.46:-.42,back=.42+(loading?0:.01),roofRect=rectangle(lo-(loading?.16:0),front,hi+(loading?.16:0),back);
  if((input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+high+.01&&(surface.x+.5)*T>roofRect.minX+1e-6&&(surface.x-.5)*T<roofRect.maxX-1e-6&&(surface.y+.5)*T>roofRect.minZ+1e-6&&(surface.y-.5)*T<roofRect.maxZ-1e-6))return root;
  const box=(u0:number,v0:number,u1:number,v1:number,bottom:number,top:number,material=wood)=>{const r=rectangle(u0,v0,u1,v1);batch.box(material,(r.minX+r.maxX)*.5,base+(bottom+top)*.5,(r.minZ+r.maxZ)*.5,r.maxX-r.minX,top-bottom,r.maxZ-r.minZ,light);};
  for(const u of supports){
    const half=loading?.11:.07,postFront=loading?-.38:-.39,postBack=loading?-.16:-.25,foot=loading?Math.min(profile.plinthHeight/V,low*.35):0;
    if(loading)box(u-.19,-.44,u+.19,-.10,0,foot,stone);
    box(u-half,postFront,u+half,postBack,foot,low);
    const v=loading?-.29:-.31,start=low-(loading?13:10)/V,end=low-(loading?2:1)/V,tieRadius=(loading?1.4:1)/V,pad=tieRadius/T;
    for(const sign of [-1,1]){const to=Math.max(u-.49+pad,Math.min(u+.49-pad,Math.max(lo,Math.min(hi,u+sign*(loading?.4:.33)))));if(Math.abs(to-u)>.05)batch.cylinder(wood,at(u,v,start),at(to,v,end),tieRadius,light);}
  }
  box(lo-(loading?.13:0),loading?-.42:-.43,hi+(loading?.13:0),loading?-.14:-.23,low-(loading?4:3)/V,low);
  const panels=[[at(lo-(loading?.16:0),front,low),at(hi+(loading?.16:0),front,low),at(hi+(loading?.16:0),back,high),at(lo-(loading?.16:0),back,high)]];
  batch.polygon(roof,panels[0],light,roofTextureProjector(panels[0]));
  const node=batch.finish(`building-detail:${b.id}:${name}`);node.add(edgeDetails(panels,base+low,roof));root.add(node);return root;
}
