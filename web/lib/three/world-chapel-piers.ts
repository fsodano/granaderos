import {worldWallRecords,wallAtPoint,wallFrameRecords} from './world-wall-records';
import {Group,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {WorldBatch} from './world-geometry';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import {addChapelPierEdges} from './world-chapel-pier-edges';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput,WorldTile} from './world-types';

/** Two closed front corner piers follow the current chapel sprite.
 * They keep actual supports, authored openings and upper routes clear. */
export function chapelPiers(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,legacy=false){
  const root=new Group();root.name=`building-chapel-piers:${b.id}`;
  if(legacy&&b.wallFinish===undefined)return root;
  const walls=worldWallRecords(input).filter(tile=>tile.buildingId===b.id),frame=entranceFrame({...b,walls:wallFrameRecords(walls)}),inset=buildingArtInset(b,input),V=25.066666666666666,appearance=buildingAppearance(b),profile=getBuildingProfile(b),light=illuminationAt(input,b);
  const recipe=architectureFinish(appearance.wallFinish,'volume')!,texture='/art/architecture-plaster-v2.png',wall=materials.get(appearance.wallFinish,{architectureRole:'volume',texture}),stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),copingColours:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},coping=materials.get('chapel-pier-coping',{colour:copingColours[appearance.wallFinish]??copingColours.adobe});
  // pier() uses plaster even when its authored pigment is stone or brick.
  applyArchitectureFinish(wall,{...recipe,texture,textureOpacity:.36,multiplyOpacity:0});
  const shadows:Record<string,string>={adobe:'#776448',limewash:'#aaa18a',ochre:'#8f754f',stone:'#5e635c',brick:'#6f5140'},outline=materials.get('chapel-pier-outline',{colour:shadows[appearance.wallFinish]??shadows.adobe}),stoneOutline=materials.get('chapel-foot-outline',{colour:'#776d54'});
  // A clipped fallback stroke can share its support plane. Bias only these
  // local borders so they retain the source line without depth flicker.
  for(const material of [outline,stoneOutline]){material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;}
  const at=(u:number,v:number)=>{const p=frame.at(u,v);return new Vector3((p.x+inset)*T,0,(p.y+inset)*T);};
  const rectangle=(u0:number,v0:number,u1:number,v1:number)=>{const a=at(u0,v0),c=at(u1,v1);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const walking=(rect:ReturnType<typeof rectangle>,top:number)=>(input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+top+.01&&(surface.x+.5)*T>rect.minX+1e-6&&(surface.x-.5)*T<rect.maxX-1e-6&&(surface.y+.5)*T>rect.minZ+1e-6&&(surface.y-.5)*T<rect.maxZ-1e-6);
  const feature=(name:string,draw:(batch:WorldBatch)=>void)=>{const batch=new WorldBatch(geometry);draw(batch);const node=batch.finish(`building-detail:${b.id}:${name}`);if(node.children.length)root.add(node);};
  const box=(batch:WorldBatch,rect:ReturnType<typeof rectangle>,bottom:number,top:number,material:ReturnType<WorldMaterials['get']>)=>batch.box(material,(rect.minX+rect.maxX)*.5,base+(bottom+top)*.5,(rect.minZ+rect.maxZ)*.5,rect.maxX-rect.minX,top-bottom,rect.maxZ-rect.minZ,light);
  const supported=(tile:WorldTile,rect:ReturnType<typeof rectangle>)=>({minX:Math.max(rect.minX,(tile.x-.49)*T),maxX:Math.min(rect.maxX,(tile.x+.49)*T),minZ:Math.max(rect.minZ,(tile.y-.49)*T),maxZ:Math.min(rect.maxZ,(tile.y+.49)*T)});
  const capitalBottom=height-2.5/V,capitalTop=height+2.5/V,foot=Math.min(profile.plinthHeight/V,capitalBottom*.35);
  if(capitalBottom>foot+.20)feature('chapel-corner-piers',batch=>{
    for(const u of [0,frame.width]){
      const p=frame.at(u,0),tile=wallAtPoint(walls,p);if(tile?.type!=='wall')continue;
      const footRect=supported(tile,rectangle(u-.21,-.39,u+.21,.20)),radius=.5/V*.5;
      if(walking({minX:footRect.minX-radius,maxX:footRect.maxX+radius,minZ:footRect.minZ-radius,maxZ:footRect.maxZ+radius},capitalTop+radius))continue;
      box(batch,footRect,0,foot,stone);
      const shaft=supported(tile,rectangle(u-.14,-.34,u+.14,.15));box(batch,shaft,foot,capitalBottom,wall);
      const capital=supported(tile,rectangle(u-.19,-.37,u+.19,.19));
      box(batch,capital,capitalBottom,capitalTop-.5/V,wall);box(batch,capital,capitalTop-.5/V,capitalTop,coping);
      const support={minX:(tile.x-.49)*T,maxX:(tile.x+.49)*T,minZ:(tile.y-.49)*T,maxZ:(tile.y+.49)*T},border={support,base,light};
      addChapelPierEdges(batch,stoneOutline,{...border,rect:footRect,bottom:0,top:foot,bottomStroke:true,topStroke:.45});
      addChapelPierEdges(batch,outline,{...border,rect:shaft,bottom:foot,top:capitalBottom});
      addChapelPierEdges(batch,outline,{...border,rect:capital,bottom:capitalBottom,top:capitalTop,bottomStroke:true,topStroke:.5});
    }
  });

  return root;
}
