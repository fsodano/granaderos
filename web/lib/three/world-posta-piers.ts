import {worldWallRecords,wallAtPoint,wallFrameRecords} from './world-wall-records';
import {Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {buildingStyle} from '../../../game/building-types.js';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The posta's front corner piers are taller and broader than its porch posts.
 * Their stepped foot, shaft and capital all stay in their real support cell. */
export function postaPiers(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,legacy=false){
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),inset=buildingArtInset(b,input),profile=getBuildingProfile(b),appearance=buildingAppearance(b),V=25.066666666666666,batch=new WorldBatch(geometry),light=illuminationAt(input,b);
  const authored=!(legacy&&b.wallFinish===undefined),texture='/art/architecture-plaster-v2.png',wall=materials.get(appearance.wallFinish,authored?{architectureRole:'volume',texture}:{colour:buildingStyle(b).wall}),stone=materials.get('stone',authored?{architectureRole:'volume',colour:'#a99a79'}:{}),copingColours:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},trim=authored?materials.get('posta-pier-coping',{colour:copingColours[appearance.wallFinish]??copingColours.adobe}):materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x));
  // The current pier() uses plaster for every authored pigment, with a separate warm stone foot.
  if(authored)applyArchitectureFinish(wall,{...architectureFinish(appearance.wallFinish,'volume')!,texture,textureOpacity:.36,multiplyOpacity:0});
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,material=wall)=>{const p=frame.at(u,v);batch.primitive('box',material,[(p.x+inset)*T,base+y,(p.y+inset)*T],[w*T,h,d*T],rotation,light);};
  const shift=(value:number,inset:number,axis:{x:number;y:number})=>value-(.4-inset)*(axis.x+axis.y),top=height-3/V,foot=Math.min(profile.plinthHeight/V,top*.35);
  const walking=(u:number,v:number,w:number,d:number)=>{const p=frame.at(u,v),x=(p.x+inset)*T,z=(p.y+inset)*T,halfX=(Math.abs(frame.u.x)*w+Math.abs(frame.v.x)*d)*T*.5,halfZ=(Math.abs(frame.u.y)*w+Math.abs(frame.v.y)*d)*T*.5;return (input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+top+1.5/V+.01&&(surface.x+.5)*T>x-halfX+1e-6&&(surface.x-.5)*T<x+halfX-1e-6&&(surface.y+.5)*T>z-halfZ+1e-6&&(surface.y-.5)*T<z+halfZ-1e-6);};
  const shaftTop=authored?top-3.5/V:top;
  if(shaftTop>foot+.20)for(const u of [0,frame.width]){
    const p=frame.at(u,0);if(wallAtPoint(walls,p)?.type!=='wall')continue;
    const footU=inset===0?u:shift(u,.27,frame.u),footV=inset===0?(authored?-.095:-.145):shift(0,.195,frame.v);
    if(authored&&walking(footU,footV,.44,.59))continue;
    if(inset===0){
      box(u,authored?-.095:-.20,(shaftTop+foot)*.5,.30,shaftTop-foot,.49);
      box(u,footV,foot*.5,.44,foot,.59,stone);
      box(u,authored?-.09:-.15,top-1.25/V,.40,4.5/V,.56);
      box(u,authored?-.09:-.15,top+1.25/V,.40,.5/V,.56,trim);
    }else{
      box(shift(u,.34,frame.u),shift(0,.245,frame.v),(shaftTop+foot)*.5,.30,shaftTop-foot,.49);
      box(shift(u,.27,frame.u),shift(0,.195,frame.v),foot*.5,.44,foot,.59,stone);
      box(shift(u,.29,frame.u),shift(0,.21,frame.v),top-1.25/V,.40,4.5/V,.56);
      box(shift(u,.29,frame.u),shift(0,.21,frame.v),top+1.25/V,.40,.5/V,.56,trim);
    }
  }
  return batch.finish(`building-detail:${b.id}:posta-corner-piers`);
}
