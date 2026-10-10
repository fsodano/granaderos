import {worldWallRecords,wallAtPoint,wallFrameRecords} from './world-wall-records';
import {Group,Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The current barracks gate uses two broad plaster piers with warm stone
 * feet and a supported entablature. Its source plaque stays above the door. */
export function barracksGate(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name=`building-barracks-gate:${b.id}`;
  if(height<2.4)return root;
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),V=25.066666666666666,appearance=buildingAppearance(b),profile=getBuildingProfile(b),light=illuminationAt(input,b),supports=[Math.round(frame.doorU-1),Math.round(frame.doorU+1)].filter(u=>u>=0&&u<=frame.width&&wallAtPoint(walls,frame.at(u,0))?.type==='wall');
  if(!supports.length)return root;
  const lo=Math.min(...supports)-.245,hi=Math.max(...supports)+.245,front=-.39,back=.20,a=frame.at(lo,front),c=frame.at(hi,back),minX=Math.min(a.x,c.x)*T,maxX=Math.max(a.x,c.x)*T,minZ=Math.min(a.y,c.y)*T,maxZ=Math.max(a.y,c.y)*T;
  // The complete gate includes the plaque and the capitals above the shell.
  if((input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+height+5/V+.03&&(surface.x+.5)*T>minX+1e-6&&(surface.x-.5)*T<maxX-1e-6&&(surface.y+.5)*T>minZ+1e-6&&(surface.y-.5)*T<maxZ-1e-6))return root;
  const recipe=architectureFinish(appearance.wallFinish,'volume')!,texture='/art/architecture-plaster-v2.png',wall=materials.get(appearance.wallFinish,{architectureRole:'volume',texture}),stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),copingColours:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},coping=materials.get('barracks-pier-coping',{colour:copingColours[appearance.wallFinish]??copingColours.adobe}),plaque=materials.get('barracks-plaque',{colour:'#c9bc93'}),edge=materials.get('barracks-plaque-edge',{colour:'#998660'}),mark=materials.get('barracks-plaque-mark',{colour:'#7b6945'}),batch=new WorldBatch(geometry),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x));
  // The source pier and entablature use plaster even with stone/brick pigment.
  applyArchitectureFinish(wall,{...recipe,texture,textureOpacity:.36,multiplyOpacity:0});
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,base+y,p.y*T);};
  const box=(u:number,v:number,bottom:number,top:number,w:number,d:number,material=wall)=>batch.primitive('box',material,at(u,v,(bottom+top)*.5),[w*T,top-bottom,d*T],rotation,light);
  const foot=profile.plinthHeight/V,capitalBottom=height-.5/V,capitalTop=height+4.5/V;
  for(const u of supports){
    box(u,-.095,0,foot,.49,.59,stone);
    box(u,-.095,foot,capitalBottom,.35,.49);
    box(u,-.09,capitalBottom,capitalTop-.5/V,.45,.56);
    box(u,-.09,capitalTop-.5/V,capitalTop,.45,.56,coping);
  }
  if(supports.length===2){
    const first=Math.max(0,frame.doorU-1.2),last=Math.min(frame.width,frame.doorU+1.2);
    box((first+last)*.5,-.06,height-4/V,height+3/V,last-first,.50);
    // Reproduce the current geometric plaque and its two crossed marks.
    // This does not assert a named regiment or a historical coat of arms.
    const y=height-8/V,v=-.32,points=[at(frame.doorU-.20,v,y),at(frame.doorU-.20,v,y+13/V),at(frame.doorU+.20,v,y+13/V),at(frame.doorU+.20,v,y),at(frame.doorU,v,y-5/V)];
    batch.polygon(plaque,points,light);
    for(let n=0;n<points.length;n++)batch.cylinder(edge,points[n],points[(n+1)%points.length],.4/V,light);
    for(const sign of [-1,1])batch.cylinder(mark,at(frame.doorU-sign*.10,v-.012,y+8/V),at(frame.doorU+sign*.10,v-.012,y),.6/V,light);
  }
  const node=batch.finish(`building-detail:${b.id}:barracks-gate`);if(node.children.length)root.add(node);
  return root;
}
