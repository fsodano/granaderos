import {worldWallRecords,wallAtPoint,wallFrameRecords} from './world-wall-records';
import {Group,Vector3} from 'three';
import {entranceFrame} from '../../../game/building-profile.js';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** The current shop sprite hangs a marked timber plaque at the porch front.
 * Keep its whole board and bracket in one actual solid cell. */
export function pulperiaSign(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name=`building-detail:${b.id}:trade-sign`;
  if((b.kind??b.architecture)!=='pulperia'||b.wallFinish===undefined||height<2.4||buildingArtInset(b,input)!==0)return root;
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),V=25.066666666666666;
  const anchor=Math.max(.4,frame.doorU-1.35),center=anchor+14/26,support=Math.round(center),cell=frame.at(support,0),tile=wallAtPoint(walls,cell);
  if(tile?.type!=='wall')return root;
  // Source screen x=-21..-7 becomes the entrance-relative along interval.
  // The shallow front plane clears the exposed porch shafts and beam.
  // Retain the source plaque proportions, placing its rail on the already
  // lifted native canopy rather than leaving it floating on a taller slab.
  const u0=anchor+7/26,u1=anchor+21/26,front=-.455,depth=.030/T,stroke=1.5/V,porchLow=Math.max(2.12,height*.72),anchorY=Math.min(height-.08,porchLow+4/V),bottom=anchorY-18/V,top=anchorY-8/V;
  const point=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,base+y,p.y*T);};
  const bounds=(u0:number,v0:number,u1:number,v1:number)=>{const a=point(u0,v0,0),c=point(u1,v1,0);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const full=bounds(anchor-stroke/(2*T),front-Math.max(stroke*.5,.030*.5+.004+.003)/T,Math.max(u1+.7/(2*26),center+stroke/(2*T)),-.32);
  if(full.minX<(tile.x-.49)*T||full.maxX>(tile.x+.49)*T||full.minZ<(tile.y-.49)*T||full.maxZ>(tile.y+.49)*T)return root;
  if((input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+anchorY+stroke*.5+.01&&(surface.x+.5)*T>full.minX+1e-6&&(surface.x-.5)*T<full.maxX-1e-6&&(surface.y+.5)*T>full.minZ+1e-6&&(surface.y-.5)*T<full.maxZ-1e-6))return root;
  const light=illuminationAt(input,b),board=materials.get('pulperia-sign-board',{colour:'#645039'}),edge=materials.get('pulperia-sign-edge',{colour:'#c1a676'}),mark=materials.get('pulperia-sign-mark',{colour:'#d5c096'}),bracket=materials.get('pulperia-sign-bracket',{colour:'#5f472e'});
  const feature=(name:string,draw:(batch:WorldBatch)=>void)=>{const batch=new WorldBatch(geometry);draw(batch);root.add(batch.finish(`building-pulperia-sign:${b.id}:${name}`));};
  const box=(batch:WorldBatch,u0:number,v0:number,u1:number,v1:number,low:number,high:number,material:ReturnType<WorldMaterials['get']>)=>{const r=bounds(u0,v0,u1,v1);batch.box(material,(r.minX+r.maxX)*.5,base+(low+high)*.5,(r.minZ+r.maxZ)*.5,r.maxX-r.minX,high-low,r.maxZ-r.minZ,light);};
  feature('board',batch=>box(batch,u0,front-depth*.5,u1,front+depth*.5,bottom,top,board));
  // Both thin timber faces carry the same retained marks, so the plaque
  // remains legible when the real building faces the opposite direction.
  for(const side of [-1,1]){
    const face=front+side*(depth*.5+.004/T),thickness=.006/T,rim=.7/V;
    feature(`face-${side}`,batch=>{
      for(const y of [bottom,top])box(batch,u0,face-thickness*.5,u1,face+thickness*.5,y-rim*.5,y+rim*.5,edge);
      for(const u of [u0,u1])box(batch,u-.7/(2*26),face-thickness*.5,u+.7/(2*26),face+thickness*.5,bottom,top,edge);
      for(const x of [-16,-12])box(batch,anchor-x/26-.9/(2*26),face-thickness*.5,anchor-x/26+.9/(2*26),face+thickness*.5,anchorY-17/V,anchorY-11/V,mark);
      box(batch,anchor+11/26,face-thickness*.5,anchor+17/26,face+thickness*.5,anchorY-14/V-.9/(2*V),anchorY-14/V+.9/(2*V),mark);
    });
  }
  feature('bracket',batch=>{
    const half=stroke/(2*T),v0=front-stroke/(2*T),v1=front+stroke/(2*T),rail=anchorY-4/V;
    box(batch,anchor-half,v0,anchor+half,v1,anchorY-10/V,anchorY,bracket);
    box(batch,anchor,v0,center,v1,rail-stroke*.5,rail+stroke*.5,bracket);
    box(batch,center-half,v0,center+half,v1,top,rail,bracket);
    // A short return joins the bracket to the actual porch fascia.
    box(batch,anchor-half,v0,anchor+half,-.32,rail-stroke*.5,rail+stroke*.5,bracket);
  });
  return root;
}
