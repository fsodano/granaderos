import {Group,Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The retained depot sprite has substantial stone piers and a timber roof
 * hatch. These details bear on real wall cells; the hatch is exterior scenery. */
export function depotFacade(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,rise:number,geometry:WorldGeometry,materials:WorldMaterials){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),inset=buildingArtInset(b,input),V=25.066666666666666;
  const root=new Group();root.name=`building-depot-facade:${b.id}`;
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x)),light=illuminationAt(input,b),profile=getBuildingProfile(b),stone=materials.get('stone'),wood=materials.get('wood'),iron=materials.get('iron');
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3((p.x+inset)*T,base+y,(p.y+inset)*T);};
  const wallAt=(u:number,v:number)=>{const p=frame.at(u,v);return walls.find(tile=>tile.x===p.x&&tile.y===p.y);};
  const feature=(name:string,draw:(batch:WorldBatch)=>void)=>{const batch=new WorldBatch(geometry);draw(batch);const node=batch.finish(`building-detail:${b.id}:${name}`);if(node.children.length)root.add(node);};
  const box=(batch:WorldBatch,u:number,v:number,y:number,w:number,h:number,d:number,material=stone)=>batch.primitive('box',material,at(u,v,y),[w*T,h,d*T],rotation,light);

  feature('depot-masonry-piers',batch=>{
    for(const u of [0,frame.width])for(let v=0;v<=frame.depth;v++)if((v===0||v===frame.depth||v%3===0)&&wallAt(u,v)?.type==='wall'){
      // Each outer stone face reaches 49% of its solid cell. The shaft joins
      // the art-inset shell, while its wider foot stays clear of walking cells.
      const shift=(value:number,target:number,axis:{x:number;y:number})=>value-(inset-(inset===0?0:target))*(axis.x+axis.y),top=height-3/V,foot=Math.min((profile.plinthHeight+2)/V,top*.40);
      box(batch,shift(u,.20,frame.u),shift(v,.30,frame.v),top*.5,.58,top,.38);
      box(batch,shift(u,.14,frame.u),shift(v,.14,frame.v),foot*.5,.70,foot,.70);
      box(batch,shift(u,.16,frame.u),shift(v,.16,frame.v),height-4.5/V,.66,5/V,.66);
    }
  });

  const support=Math.round(frame.width*.5),u=support-inset*(frame.u.x+frame.u.y),bottom=height+7/V,top=height+rise-7/V;
  if(frame.width<4||wallAt(support,0)?.type!=='wall'||top-bottom<.12)return root;
  const point=at(u,-.16,0),walking=(input.terrain.upperSurfaces??[]).some(surface=>{
    const x=surface.x*T-point.x,z=surface.y*T-point.z;
    return !surface.blocked&&(surface.tacticalLevel??0)>0&&Math.abs(x*frame.u.x+z*frame.u.y)<(.92+1)*T*.5&&Math.abs(x*frame.v.x+z*frame.v.y)<(.68+1)*T*.5;
  });
  if(walking)return root;
  feature('depot-loft-hatch',batch=>{
    box(batch,u,-.0275,(bottom+top)*.5,.92,top-bottom,.095,wood);
    for(const side of [-1,1])box(batch,u+side*.46,-.082,(bottom+top)*.5,.045,top-bottom+.08,.045,wood);
    for(const y of [bottom,top])box(batch,u,-.082,y,1.00,.065,.045,wood);
    for(const y of [bottom+3/V,top-3/V])box(batch,u,-.083,y,.91,1.1/V,.022/T,iron);
    box(batch,u,-.084,(bottom+top)*.5,1.1/V/T,top-bottom,.022/T,iron);
    batch.cylinder(wood,at(u-.39,-.095,bottom+3/V),at(u+.39,-.095,top-3/V),1.5/V*.5,light);
  });
  feature('depot-loft-hoist',batch=>{
    const boom=top+3/V,rope=materials.get('depot-rope',{colour:'#8f7951'});
    box(batch,u,-.16,boom-.5/V,.11,3/V,.62,wood);
    batch.cylinder(wood,at(u,-.04,boom-9/V),at(u,-.43,boom-1/V),2.4/V*.5,light);
    const pulleyRotation=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(frame.u.x,0,frame.u.y));
    batch.primitive('torus',wood,at(u,-.43,boom-1/V),[2/V,2/V,2/V],pulleyRotation,light);
    batch.cylinder(rope,at(u,-.43,boom-1/V),at(u,-.43,bottom-1/V),.012,light);
  });
  return root;
}
