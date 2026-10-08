import {Group,Quaternion,Vector3} from 'three';
import {entranceFrame} from '../../../game/building-profile.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** Retained industrial brick chimney, supported by an actual side wall.
 * Slabs supply zero rise. An occupied upper route excludes the whole cap. */
export function smithyChimney(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,rise:number,geometry:WorldGeometry,materials:WorldMaterials){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),V=25.066666666666666;
  const root=new Group();root.name=`building-smithy-chimney:${b.id}`;
  const bottom=height-1/V,top=height+rise+38/V,capBottom=top-2/V,capTop=top+2/V,flueTop=top+2.3/V;
  if(capBottom<=bottom)return root;
  const supports=[frame.width,0].flatMap(u=>Array.from({length:Math.max(0,Math.floor(frame.depth)-1)},(_,n)=>({u,v:n+1}))).filter(({u,v})=>{
    const point=frame.at(u,v);
    return walls.find(tile=>tile.x===point.x&&tile.y===point.y)?.type==='wall'&&!(input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+flueTop+.01&&surface.x+.5>point.x-.35+1e-6&&surface.x-.5<point.x+.35-1e-6&&surface.y+.5>point.y-.35+1e-6&&surface.y-.5<point.y+.35-1e-6);
  }).sort((a,c)=>Math.abs(a.v-frame.depth*.66)-Math.abs(c.v-frame.depth*.66));
  if(!supports.length)return root;
  const {u,v}=supports[0],at=(du:number,dv:number,y:number)=>{const point=frame.at(u+du,v+dv);return new Vector3(point.x*T,base+y,point.y*T);};
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x)),light=illuminationAt(input,b),brick=materials.get('brick',{architectureRole:'volume',colour:'#9b6849'}),flue=materials.get('forge-flue',{colour:'#40382b'}),batch=new WorldBatch(geometry);
  batch.primitive('box',brick,at(0,0,(bottom+capBottom)*.5),[.58*T,capBottom-bottom,.58*T],rotation,light);
  batch.primitive('box',brick,at(0,0,(capBottom+capTop)*.5),[.70*T,capTop-capBottom,.70*T],rotation,light);
  batch.polygon(flue,[at(-.23,-.23,flueTop),at(.23,-.23,flueTop),at(.23,.23,flueTop),at(-.23,.23,flueTop)],light);
  root.add(batch.finish(`building-detail:${b.id}:forge-chimney`));
  return root;
}
