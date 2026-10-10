import {worldWallRecords,wallFrameRecords} from './world-wall-records';
import {Group,Vector3} from 'three';
import {entranceFrame} from '../../../game/building-profile.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The current stable sprite has a broad timber gable vent with six slats.
 * It belongs to the real pitched roof, never to an authored flat roof route. */
export function stableVentilation(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,rise:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name=`building-stable-ventilation:${b.id}`;
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),V=25.066666666666666,span=frame.width-.8,inset=buildingArtInset(b,input);
  if(span<=.4||rise<=7/V)return root;
  const center=frame.width*.5,half=.45*span,front=-.11/T,bottom=height+2/V,top=height+rise-3/V;
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3((p.x+inset)*T,base+y,(p.y+inset)*T);};
  const point=at(center,front,0),width=2*half+.08/T,depth=.08/T;
  if((input.terrain.upperSurfaces??[]).some(surface=>{
    const x=surface.x*T-point.x,z=surface.y*T-point.z;
    return !surface.blocked&&(surface.tacticalLevel??0)>0&&Math.abs(x*frame.u.x+z*frame.u.y)<(width+1)*T*.5-1e-6&&Math.abs(x*frame.v.x+z*frame.v.y)<(depth+1)*T*.5-1e-6;
  }))return root;
  const batch=new WorldBatch(geometry),light=illuminationAt(input,b),wood=materials.get('wood'),shadow=materials.get('stable-loft-shadow',{colour:'#594c35'}),slats=materials.get('stable-loft-timber',{colour:'#ac9467'}),panel=[at(center-half,front,bottom),at(center+half,front,bottom),at(center,front,top)];
  batch.polygon(shadow,panel,light);
  for(let n=0;n<3;n++)batch.cylinder(wood,panel[n],panel[(n+1)%3],.04,light);
  for(const x of [8,13,18,23,28,33]){
    const u=.4+x/40*span,slatBottom=bottom+1/V,slatTop=bottom+Math.max(1/V,(rise-7/V)*(1-Math.abs(x-20)/18));
    if(slatTop-slatBottom>.025)batch.cylinder(slats,at(u,front-.015/T,slatBottom),at(u,front-.015/T,slatTop),.6/V,light);
  }
  root.add(batch.finish(`building-detail:${b.id}:stable-ventilation`));return root;
}
