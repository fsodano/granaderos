import {Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {buildingStyle} from '../../../game/building-types.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The posta's front corner piers are taller and broader than its porch posts.
 * Their stepped foot, shaft and capital all stay in their real support cell. */
export function postaPiers(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,legacy=false){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),inset=buildingArtInset(b,input),profile=getBuildingProfile(b),appearance=buildingAppearance(b),V=25.066666666666666,batch=new WorldBatch(geometry),light=illuminationAt(input,b);
  const wall=materials.get(appearance.wallFinish,legacy?{colour:buildingStyle(b).wall}:{}),stone=materials.get('stone'),trim=materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x));
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,material=wall)=>{const p=frame.at(u,v);batch.primitive('box',material,[(p.x+inset)*T,base+y,(p.y+inset)*T],[w*T,h,d*T],rotation,light);};
  const shift=(value:number,inset:number,axis:{x:number;y:number})=>value-(.4-inset)*(axis.x+axis.y),top=height-3/V,foot=Math.min(profile.plinthHeight/V,top*.35);
  if(top>foot+.20)for(const u of [0,frame.width]){
    const p=frame.at(u,0);if(walls.find(tile=>tile.x===p.x&&tile.y===p.y)?.type!=='wall')continue;
    if(inset===0){
      box(u,-.20,(top+foot)*.5,.30,top-foot,.49);
      box(u,-.145,foot*.5,.44,foot,.59,stone);
      box(u,-.15,top-1.25/V,.40,4.5/V,.56);
      box(u,-.15,top+1.25/V,.40,.5/V,.56,trim);
    }else{
      box(shift(u,.34,frame.u),shift(0,.245,frame.v),(top+foot)*.5,.30,top-foot,.49);
      box(shift(u,.27,frame.u),shift(0,.195,frame.v),foot*.5,.44,foot,.59,stone);
      box(shift(u,.29,frame.u),shift(0,.21,frame.v),top-1.25/V,.40,4.5/V,.56);
      box(shift(u,.29,frame.u),shift(0,.21,frame.v),top+1.25/V,.40,.5/V,.56,trim);
    }
  }
  return batch.finish(`building-detail:${b.id}:posta-corner-piers`);
}
