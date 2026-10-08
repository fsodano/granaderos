import {Group,Vector3} from 'three';
import type {MeshStandardMaterial} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {WorldBatch,roofTextureProjector} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput,WorldTile} from './world-types';

/** The authored Cabildo keeps its current single arcade and shallow clock
 * cupola. Taller edited shells retain their separate native upper arcade. */
export function cabildoFacade(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials,edgeDetails:(panels:readonly (readonly Vector3[])[],eave:number,roof:MeshStandardMaterial)=>Group){
  const root=new Group();root.name=`building-cabildo-facade:${b.id}`;
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),profile=getBuildingProfile(b),appearance=buildingAppearance(b),V=25.066666666666666,storey=height>=4?height*.5:height,light=illuminationAt(input,b),texture='/art/architecture-plaster-v2.png';
  const recipe=architectureFinish(appearance.wallFinish,'volume')!,wall=materials.get(appearance.wallFinish,{architectureRole:'volume',texture}),stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),trims:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},shadows:Record<string,string>={adobe:'#776448',limewash:'#aaa18a',ochre:'#8f754f',stone:'#5e635c',brick:'#6f5140'},trim=materials.get('cabildo-coping',{colour:trims[appearance.wallFinish]??trims.limewash}),pierCoping=materials.get('cabildo-pier-coping',{colour:trims[appearance.wallFinish]??trims.limewash}),shadow=materials.get('cabildo-arcade-shadow',{colour:shadows[appearance.wallFinish]??shadows.limewash});
  // The source solid() default is plaster for arcade piers and tower volumes,
  // including explicitly saved stone/brick main-wall paints.
  applyArchitectureFinish(wall,{...recipe,texture,textureOpacity:.36,multiplyOpacity:0});
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3(p.x*T,base+y,p.y*T);};
  const rect=(u0:number,v0:number,u1:number,v1:number)=>{const a=at(u0,v0,0),c=at(u1,v1,0);return {minX:Math.min(a.x,c.x),maxX:Math.max(a.x,c.x),minZ:Math.min(a.z,c.z),maxZ:Math.max(a.z,c.z)};};
  const clip=(tile:WorldTile,r:ReturnType<typeof rect>)=>({minX:Math.max(r.minX,(tile.x-.49)*T),maxX:Math.min(r.maxX,(tile.x+.49)*T),minZ:Math.max(r.minZ,(tile.y-.49)*T),maxZ:Math.min(r.maxZ,(tile.y+.49)*T)});
  const walking=(r:ReturnType<typeof rect>,top:number)=>(input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=base+top+.01&&(surface.x+.5)*T>r.minX+1e-6&&(surface.x-.5)*T<r.maxX-1e-6&&(surface.y+.5)*T>r.minZ+1e-6&&(surface.y-.5)*T<r.maxZ-1e-6);
  const feature=(name:string,draw:(batch:WorldBatch)=>void)=>{const batch=new WorldBatch(geometry);draw(batch);const node=batch.finish(`building-detail:${b.id}:${name}`);if(node.children.length)root.add(node);return node;};
  const box=(batch:WorldBatch,r:ReturnType<typeof rect>,bottom:number,top:number,material=wall)=>{if(top>bottom&&r.maxX>r.minX&&r.maxZ>r.minZ)batch.box(material,(r.minX+r.maxX)*.5,base+(bottom+top)*.5,(r.minZ+r.maxZ)*.5,r.maxX-r.minX,top-bottom,r.maxZ-r.minZ,light);};
  const rhythm=[...new Set([0,...Array.from({length:Math.max(0,Math.floor(frame.width/2)-1)},(_,n)=>(n+1)*2),frame.width])],columns=rhythm.filter(u=>{const p=frame.at(u,0);return walls.find(tile=>tile.x===p.x&&tile.y===p.y)?.type==='wall';});
  feature('civic-ground-arcade',batch=>{
    const top=storey-5.5/V,capitalBottom=storey-10.5/V,foot=Math.min(profile.plinthHeight/V,capitalBottom*.6);
    for(const u of columns){const p=frame.at(u,0),tile=walls.find(tile=>tile.x===p.x&&tile.y===p.y)!,footRect=clip(tile,rect(u-.20,-.39,u+.20,.20));if(walking(footRect,top)||capitalBottom<=foot+.10)continue;
      box(batch,footRect,0,foot,stone);box(batch,clip(tile,rect(u-.13,-.34,u+.13,.15)),foot,capitalBottom);
      const cap=clip(tile,rect(u-.18,-.37,u+.18,.19));box(batch,cap,capitalBottom,top-.5/V);box(batch,cap,top-.5/V,top,pierCoping);
    }
    if(storey>2.4)for(let n=1;n<rhythm.length;n++){
      if(!columns.includes(rhythm[n-1])||!columns.includes(rhythm[n]))continue;
      const left=rhythm[n-1]+.14,right=rhythm[n]-.14;if(right<=left)continue;
      const spring=storey*V-24,points=[[0,3],[0,spring],...Array.from({length:24},(_,n)=>[20-20*Math.cos((n+1)*Math.PI/24),spring+17*Math.sin((n+1)*Math.PI/24)]),[40,3]];
      if(walking(rect(left,-.35,right,-.35),storey-7/V+.12))continue;
      // These are the actual facade-local SVG strokes: six shadow units
      // beneath 4.5 trim units. Flat, joined bands retain their glyph-space
      // width; nested opaque tubes would hide the smaller pale stroke.
      const normals=points.slice(1).map((p,n)=>{const dx=p[0]-points[n][0],dy=p[1]-points[n][1],length=Math.hypot(dx,dy);return [-dy/length,dx/length];});
      for(const [width,material,depth]of [[6,shadow,-.35],[4.5,trim,-.35-.001/T]] as const){
        const sides=points.map((p,n)=>{const a=normals[Math.max(0,n-1)],c=normals[Math.min(n,normals.length-1)],length=Math.hypot(a[0]+c[0],a[1]+c[1]),x=(a[0]+c[0])/length,y=(a[1]+c[1])/length,scale=width*.5/(x*c[0]+y*c[1]);return [at(left+(p[0]+x*scale)*(right-left)/40,depth,(p[1]+y*scale)/V),at(left+(p[0]-x*scale)*(right-left)/40,depth,(p[1]-y*scale)/V)];});
        for(let p=1;p<sides.length;p++)batch.polygon(material,[sides[p-1][0],sides[p][0],sides[p][1],sides[p-1][1]],light);
      }
    }
  });
  const header=rect(-.12,-.40,frame.width+.12,.21);if(!walking(header,storey-3/V))feature('civic-source-entablature',batch=>box(batch,header,storey-9/V,storey-3/V));

  const u=frame.width*.5,footprint=rect(u-.81,-.4,u+.81,.51),bearing=Array.from({length:Math.ceil(1.4)+1},(_,n)=>Math.floor(u-.7)+n).filter(a=>a>=u-.7-.5&&a<=u+.7+.5),supported=bearing.every(a=>{const p=frame.at(a,0);return walls.some(tile=>tile.x===p.x&&tile.y===p.y);});
  if(!supported||frame.width<1.62||walking(footprint,height+75/V))return root;
  const crown=feature('civic-clock-tower',batch=>{
    box(batch,rect(u-.7,-.27,u+.7,.40),height-3/V,height+53/V);
    box(batch,rect(u-.78,-.35,u+.78,.47),height+53/V,height+57.5/V);box(batch,rect(u-.78,-.35,u+.78,.47),height+57.5/V,height+58/V,trim);
    const face=materials.get('linen',{colour:'#ddd0aa'}),ring=materials.get('cabildo-clock-ring',{colour:'#9b8964'}),hands=materials.get('cabildo-clock-hands',{colour:'#554931'}),ticks=materials.get('cabildo-clock-ticks',{colour:'#665439'}),cy=height+20/V;
    // The source clock is a fixed glyph on the plain tower face. Its back
    // face is retained as a full-3D adaptation of the existing native clock.
    for(const side of [-1,1]){const v=side===-1?-.28:.41,point=(x:number,y:number,out=0)=>at(u+x*1.4/40,v+side*out,cy+y/V),disc=Array.from({length:48},(_,n)=>point(Math.sin(n*Math.PI/24)*10,Math.cos(n*Math.PI/24)*10));batch.polygon(face,disc,light);
      for(let n=0;n<48;n++)batch.cylinder(ring,disc[n],disc[(n+1)%48],.65/V,light);
      batch.cylinder(hands,point(0,7,.02),point(0,0,.02),.55/V,light);batch.cylinder(hands,point(0,0,.02),point(6,-2,.02),.55/V,light);
      for(let n=0;n<12;n++){const a=n*Math.PI/6;batch.cylinder(ticks,point(Math.sin(a)*8,Math.cos(a)*8,.02),point(Math.sin(a)*6.5,Math.cos(a)*6.5,.02),.325/V,light);}
    }
  });
  // pyramid() deliberately uses clay for a saved thatch cupola. Retain that
  // local source exception while leaving the building's main roof selection.
  const roof=materials.get(appearance.roofFinish==='thatch'?'clay':appearance.roofFinish),corners=[at(u-.81,-.4,height+58/V),at(u+.81,-.4,height+58/V),at(u+.81,.51,height+58/V),at(u-.81,.51,height+58/V)],apex=at(u,.055,height+75/V),panels=corners.map((point,n)=>[point,corners[(n+1)%4],apex]);
  const tiles=feature('civic-cupola-roof',batch=>{for(const panel of panels)batch.polygon(roof,panel,light,roofTextureProjector(panel));});tiles.add(edgeDetails(panels,base+height+58/V,roof));crown.add(tiles);return root;
}
