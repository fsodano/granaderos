import {CylinderGeometry,Group,Matrix4,Quaternion,Vector3} from 'three';
import {entranceFrame,getBuildingProfile} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {WorldBatch} from './world-geometry';
import {architectureFinish,applyArchitectureFinish} from './world-architecture-finish';
import {illuminationAt} from './world-materials';
import {buildingArtInset} from './world-building-placement';
import type {WorldGeometry,PolygonUV} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput} from './world-types';

/** Closed nave wedges follow the current parish sprite. Each supported
 * wedge stays inside one actual solid wall cell and below the real eave. */
export function churchNave(b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,geometry:WorldGeometry,materials:WorldMaterials){
  const root=new Group();root.name=`building-church-nave:${b.id}`;
  const V=25.066666666666666,inner=height-12/V,outer=Math.min(height*.59,inner-.04);
  if(outer<=.20)return root;
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),frame=entranceFrame({...b,walls}),inset=buildingArtInset(b,input),appearance=buildingAppearance(b),profile=getBuildingProfile(b),batch=new WorldBatch(geometry),light=illuminationAt(input,b);
  // sideButtresses uses plaster for every non-stone authored finish,
  // including edited brick. Retain that local source texture exception.
  const recipe=architectureFinish(appearance.wallFinish,'volume')!,texture=appearance.wallFinish==='stone'?'/art/architecture-stone-v2.png':'/art/architecture-plaster-v2.png',wall=materials.get(appearance.wallFinish,{architectureRole:'volume',texture});
  applyArchitectureFinish(wall,{...recipe,texture,textureOpacity:appearance.wallFinish==='stone'?.60:.36,multiplyOpacity:0});
  const stone=materials.get('stone',{architectureRole:'volume',colour:'#a99a79'}),copingColours:Record<string,string>={adobe:'#cab48e',limewash:'#eee6d1',ochre:'#e4d3ab',stone:'#c5bd9f',brick:'#cfb490'},coping=materials.get('church-nave-coping',{colour:copingColours[appearance.wallFinish]??copingColours.limewash});
  const shadows:Record<string,string>={adobe:'#776448',limewash:'#aaa18a',ochre:'#8f754f',stone:'#5e635c',brick:'#6f5140'},outline=materials.get('church-nave-outline',{colour:shadows[appearance.wallFinish]??shadows.limewash}),stoneOutline=materials.get('church-nave-foot-outline',{colour:'#776d54'});
  const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3((p.x+inset)*T,base+y,(p.y+inset)*T);};
  const face=(material:ReturnType<WorldMaterials['get']>,points:Vector3[],reverseWinding=false)=>{
    const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    const uv:PolygonUV=Math.abs(normal.y)>.5?p=>[p.x,p.z]:Math.abs(normal.x)>Math.abs(normal.z)?p=>[p.z*(normal.x>0?-1:1),p.y]:p=>[p.x*(normal.z>0?1:-1),p.y];
    // Fix the closed vertical face winding without changing its retained
    // metre projector, phase or texture direction.
    const first=uv(points[0]);batch.polygon(material,reverseWinding?[...points].reverse():points,light,p=>{const value=uv(p);return [value[0]-first[0],value[1]];});
  };
  const foot=Math.min((profile.plinthHeight+2)/V,outer*.60);
  const edge=(material:ReturnType<WorldMaterials['get']>,a:Vector3,b:Vector3,width:number)=>{
    const vector=b.clone().sub(a),radius=width/V*.5;if(vector.lengthSq()<1e-12)return;
    const line=new CylinderGeometry(radius,radius,vector.length(),6),matrix=new Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vector.normalize()),new Vector3(1,1,1));
    line.applyMatrix4(matrix);
    // The sprite paints its bottom stroke over the ground. Keep the same
    // visible half of that stroke without extending scenery below the floor.
    const points=line.getAttribute('position');for(let n=0;n<points.count;n++)if(points.getY(n)<base)points.setY(n,base);line.computeVertexNormals();
    batch.add(line,material,undefined,light);line.dispose();
  };
  for(const u of [0,frame.width])for(let v=frame.depth-2;v>0;v-=3){
    const p=frame.at(u,v),tile=walls.find(tile=>tile.x===p.x&&tile.y===p.y);if(tile?.type!=='wall')continue;
    const out=u===0?-1:1,alongShift=inset*(frame.u.x+frame.u.y),depthShift=inset*(frame.v.x+frame.v.y),lo=Math.max(u-.39,u-alongShift-.49),hi=Math.min(u+.39,u-alongShift+.49),front=Math.max(v-.19,v-depthShift-.49),back=Math.min(v+.19,v-depthShift+.49);
    if(hi<=lo||back<=front)continue;
    const plan=[[lo,front],[hi,front],[hi,back],[lo,back]],bottom=plan.map(([a,c])=>at(a,c,0)),feet=plan.map(([a,c])=>at(a,c,foot)),top=plan.map(([a,c])=>at(a,c,inner+(outer-inner)*((a-u)*out+.39)/.78));
    const xs=bottom.map(p=>p.x),zs=bottom.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),topY=Math.max(...top.map(p=>p.y));
    if((input.terrain.upperSurfaces??[]).some(surface=>!surface.blocked&&(surface.tacticalLevel??0)>0&&(surface.elevation??3)<=topY+.01&&(surface.x+.5)*T>minX+1e-6&&(surface.x-.5)*T<maxX-1e-6&&(surface.y+.5)*T>minZ+1e-6&&(surface.y-.5)*T<maxZ-1e-6))continue;
    // The source stone overlay covers the lower plaster. Join those volumes
    // once so their external planes cannot flicker against one another.
    face(coping,[...top].reverse());face(wall,feet);
    for(let n=0;n<4;n++){const next=(n+1)%4;face(wall,[feet[n],feet[next],top[next],top[n]],true);}
    face(stone,[...feet].reverse());face(stone,bottom);
    for(let n=0;n<4;n++){
      const next=(n+1)%4;face(stone,[bottom[n],bottom[next],feet[next],feet[n]],true);
      // ArchitectureVolume outlines each vertical face at .45 source units
      // and the sloping cap at .5. Join shared borders once; the source's
      // final stone overlay supplies the lower seam's warm shadow pigment.
      edge(outline,feet[n],top[n],.45);edge(outline,top[n],top[next],.5);
      edge(stoneOutline,bottom[n],feet[n],.45);edge(stoneOutline,feet[n],feet[next],.45);edge(stoneOutline,bottom[n],bottom[next],.45);
    }
  }
  const node=batch.finish(`building-detail:${b.id}:church-nave-buttresses`);if(node.children.length)root.add(node);return root;
}
