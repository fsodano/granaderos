import {Group,Vector3} from 'three';
import {getBuildingProfile,entranceFrame} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {buildingStyle} from '../../../game/building-types.js';
import {BUILDING_OPENINGS} from '../../../game/building-scale.js';
import {roomDecorProfile} from '../../../game/room-dressing.js';
import {WorldBatch,cellTop,roofTextureProjector} from './world-geometry';
import {illuminationAt} from './world-materials';
import {architecturalDetails,roofEdgeDetails} from './world-building-details';
import {addWallSurfaceDetails} from './world-building-surfaces';
import {addDoorLeaf} from './world-building-doors';
import {climbOpenings} from './world-climb-openings';
import {addWindowFace} from './world-building-windows';
import {buildingArtInset,buildingFloorRectangles} from './world-building-placement';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput,WorldTile} from './world-types';

const V=25.066666666666666;
type Axis='x'|'y';
/** Masonry fills the rectangle above the arch, leaving a true curved opening. */
function openingArch(batch:WorldBatch,wall:ReturnType<WorldMaterials['get']>,trim:ReturnType<WorldMaterials['get']>,axis:Axis,mid:number,cross:number,base:number,top:number,width:number,thickness:number,light:number){
  const radius=width*.5,spring=top-radius;
  const at=(u:number,y:number,d:number)=>axis==='x'?new Vector3(mid+u,base+y,cross+d):new Vector3(cross+d,base+y,mid+u);
  for(let n=0;n<12;n++){
    const a=n*Math.PI/12,b=(n+1)*Math.PI/12,ua=Math.cos(a)*radius,ub=Math.cos(b)*radius,ya=spring+Math.sin(a)*radius,yb=spring+Math.sin(b)*radius;
    for(const side of [-1,1])batch.polygon(wall,[at(ua,ya,side*thickness*.5),at(ub,yb,side*thickness*.5),at(ub,top,side*thickness*.5),at(ua,top,side*thickness*.5)],light);
    batch.polygon(wall,[at(ua,ya,-thickness*.5),at(ua,ya,thickness*.5),at(ub,yb,thickness*.5),at(ub,yb,-thickness*.5)],light);
    batch.cylinder(trim,at(ua,ya,-thickness*.53),at(ub,yb,-thickness*.53),.039,light);batch.cylinder(trim,at(ua,ya,thickness*.53),at(ub,yb,thickness*.53),.039,light);
  }
}
export function normalizedBuilding(b:WorldBuilding){const kind=b.kind??b.architecture;return {...b,kind:kind==='estancia'?'farmhouse':kind==='mansion'?'palace':kind};}
function appearanceFor(b:WorldBuilding){return buildingAppearance({...b,roofFinish:b.roofFinish??(b.roof==='thatch'?'thatch':undefined)});}
export function effectiveRooms(input:WorldInput){
  const rooms=new Set(input.revealedRooms??[]),level=input.cursorLevel??0;
  if(level){const terraces=new Set((input.terrain.upperSurfaces??[]).filter(surface=>surface.kind==='roof'&&(surface.tacticalLevel??0)===level).map(surface=>surface.buildingId));for(const building of input.terrain.buildings??[])if(terraces.has(building.id))for(const room of building.rooms??[])if(!(room.tacticalLevel??0))rooms.delete(room.id);}
  return rooms;
}
export function roofOwners(b:WorldBuilding){
  const owners=new Map<string,string>(),queue:{x:number;y:number}[]=[];
  for(const room of b.rooms??[])if(!(room.tacticalLevel??room.cells[0]?.tacticalLevel??0))for(const cell of room.cells){const key=`${cell.x},${cell.y}`;if(!owners.has(key)){owners.set(key,room.id);queue.push(cell);}}
  for(let head=0;head<queue.length;head++){
    const cell=queue[head],owner=owners.get(`${cell.x},${cell.y}`)!;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=cell.x+dx,y=cell.y+dy,key=`${x},${y}`;if(x<b.x||y<b.y||x>=b.x+b.width||y>=b.y+b.height||owners.has(key))continue;owners.set(key,owner);queue.push({x,y});}
  }
  return owners;
}
export function upperSurfaceShown(surface:WorldTile,input:WorldInput){
  if(surface.kind!=='roof'||!surface.buildingId||(input.cursorLevel??0)>=(surface.tacticalLevel??0))return true;
  const b=input.terrain.buildings?.find(building=>building.id===surface.buildingId);if(!b)return true;
  const owner=roofOwners(b).get(`${surface.x},${surface.y}`);if(!owner||!effectiveRooms(input).has(owner))return true;
  return (input.admittedActorPoints??[]).some(point=>(point.tacticalLevel??0)===(surface.tacticalLevel??0)&&Math.abs(point.x-surface.x)<.65&&Math.abs(point.y-surface.y)<.65);
}
export function shownUpperSurfaces(input:WorldInput){
  const known=effectiveRooms(input),owners=new Map((input.terrain.buildings??[]).map(building=>[building.id,roofOwners(building)]));
  return (input.terrain.upperSurfaces??[]).filter(surface=>{
    if(surface.kind!=='roof'||!surface.buildingId||(input.cursorLevel??0)>=(surface.tacticalLevel??0))return true;
    const owner=owners.get(surface.buildingId)?.get(`${surface.x},${surface.y}`);if(!owner||!known.has(owner))return true;
    return (input.admittedActorPoints??[]).some(point=>(point.tacticalLevel??0)===(surface.tacticalLevel??0)&&Math.abs(point.x-surface.x)<.65&&Math.abs(point.y-surface.y)<.65);
  });
}
function clipPlane(points:readonly Vector3[],axis:'x'|'z',bound:number,greater:boolean){
  const result:Vector3[]=[];
  for(let n=0;n<points.length;n++){
    const a=points[n],b=points[(n+1)%points.length],ain=greater?a[axis]>=bound:a[axis]<=bound,bin=greater?b[axis]>=bound:b[axis]<=bound;
    if(ain)result.push(a.clone());if(ain!==bin)result.push(a.clone().lerp(b,(bound-a[axis])/(b[axis]-a[axis])));
  }
  return result;
}
export function clipRoofCell(points:readonly Vector3[],x0:number,z0:number,x1:number,z1:number){let result=[...points];for(const [axis,bound,greater]of [['x',x0,true],['x',x1,false],['z',z0,true],['z',z1,false]] as const)result=clipPlane(result,axis,bound,greater);return result;}
export function buildingWallAxes(tile:WorldTile,b:WorldBuilding|undefined,occupied:ReadonlySet<string>):Axis[]{
  const onX=b&&(tile.x===b.x||tile.x===b.x+b.width-1),onY=b&&(tile.y===b.y||tile.y===b.y+b.height-1);
  const result:Axis[]=b?[...(onX?['y' as const]:[]),...(onY?['x' as const]:[])]:[];
  if(!result.length){if(occupied.has(`${tile.x-1},${tile.y}`)||occupied.has(`${tile.x+1},${tile.y}`))result.push('x');if(occupied.has(`${tile.x},${tile.y-1}`)||occupied.has(`${tile.x},${tile.y+1}`))result.push('y');if(!result.length)result.push('x');}
  return result;
}
export function buildBuilding(b0:WorldBuilding,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const b=normalizedBuilding(b0),wallInset=buildingArtInset(b,input),known=effectiveRooms(input),profile=getBuildingProfile(b),appearance=appearanceFor(b),legacy=Boolean(b0.architecture&&(!b0.kind||b0.roof==='terrace'));
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),allWalls=input.terrain.tiles.filter(tile=>['wall','door','window'].includes(tile.type)),occupied=new Set(allWalls.map(tile=>`${tile.x},${tile.y}`));
  const roofs=(input.terrain.upperSurfaces??[]).filter(surface=>surface.kind==='roof'&&surface.buildingId===b.id),base=input.terrain.tiles.find(tile=>tile.x===b.x&&tile.y===b.y)?.elevation??0;
  const groundRooms=(b.rooms??[]).filter(room=>!(room.tacticalLevel??room.cells[0]?.tacticalLevel??0)),allOpen=groundRooms.length>0&&groundRooms.every(room=>known.has(room.id)),someOpen=groundRooms.some(room=>known.has(room.id));
  // Existing metric slabs and cover metadata win over artwork pixel heights.
  const fullHeight=roofs.length?Math.min(...roofs.map(surface=>(surface.elevation??3)-base)):Math.max(2.5,(legacy?buildingStyle(b).height:profile.wallHeight)/V);
  const floorHeight=roofs.length?fullHeight:Math.min(fullHeight,Math.max(2.5,profile.groundFloorHeight/V));
  const height=profile.floors>1&&someOpen?floorHeight:fullHeight,batch=new WorldBatch(geometry),surfaces=new WorldBatch(geometry),group=new Group();group.name=`building:${b.id}`;group.userData.semanticId=`building:${b.id}`;
  const wallMat=materials.get(appearance.wallFinish,legacy&&b.wallFinish===undefined?{colour:buildingStyle(b).wall}:{architectureRole:'wall'}),trim=materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),wood=materials.get('wood'),iron=materials.get('iron');
  const doorHeight=BUILDING_OPENINGS.doorHeight/V,doorWidth=T*.60,thickness=.18,cutaway=BUILDING_OPENINGS.cutawayHeight/V;
  const openingRecords:{id:string;type:string;open:boolean;axis:Axis;height:number;width:number}[]=[];
  for(const tile of walls){
    const onX=tile.x===b.x||tile.x===b.x+b.width-1,onY=tile.y===b.y||tile.y===b.y+b.height-1,corner=onX&&onY;
    const roomOpen=allOpen||groundRooms.some(room=>known.has(room.id)&&room.cells.some(cell=>corner?Math.abs(cell.x-tile.x)<=1&&Math.abs(cell.y-tile.y)<=1:Math.abs(cell.x-tile.x)+Math.abs(cell.y-tile.y)===1));
    const light=illuminationAt(input,tile),tileBase=tile.elevation??base;
    for(const [index,axis]of buildingWallAxes(tile,b,occupied).entries()){
      const front=axis==='x'?tile.y===b.y+b.height-1:tile.x===b.x+b.width-1,cut=Boolean(roomOpen&&(front||!onX&&!onY)),h=cut?cutaway:onX||onY?height:floorHeight;
      const along=axis==='x'?tile.x:tile.y,lower=(axis==='x'?b.x:b.y)+wallInset,upper=(axis==='x'?b.x+b.width-1:b.y+b.height-1)+wallInset,first=Math.max(along-.5,lower)*T,last=Math.min(along+.5,upper)*T;
      const mid=(first+last)*.5,len=last-first,cross=((axis==='x'?tile.y:tile.x)+wallInset)*T;
      const box=(u:number,y:number,w:number,hi:number,d:number,material=wallMat)=>axis==='x'?batch.box(material,u,tileBase+y,cross,w,hi,d,light):batch.box(material,cross,tileBase+y,u,d,hi,w,light);
      const opening=tile.type!=='wall'&&index===0,ow=Math.min(doorWidth,len*.65),top=Math.min(h-.12,tile.type==='door'?doorHeight:BUILDING_OPENINGS.windowTop/V),sill=tile.type==='window'?Math.min(top-.25,BUILDING_OPENINGS.windowSill/V):0;
      if(!opening){box(mid,h*.5,len,h,thickness);}
      else{
        box((first+mid-ow*.5)*.5,h*.5,(len-ow)*.5,h,thickness);box((mid+ow*.5+last)*.5,h*.5,(len-ow)*.5,h,thickness);
        if(!cut)box(mid,top+(h-top)*.5,ow,h-top,thickness);if(sill>0&&!cut)box(mid,sill*.5,ow,sill,thickness);
        box(mid-ow*.5-.03,(top+sill)*.5,.065,top-sill+.10,thickness+.06,trim);box(mid+ow*.5+.03,(top+sill)*.5,.065,top-sill+.10,thickness+.06,trim);box(mid,top+.03,ow+.14,.09,thickness+.06,trim);
      }
      addWallSurfaceDetails(surfaces,materials,{axis,first,last,cross,base:tileBase,height:h,thickness,opening:opening?tile.type as 'door'|'window':undefined,openingWidth:ow,finish:appearance.wallFinish,colour:wallMat.color,x:tile.x,y:tile.y,face:index,cut,light});
      if(tile.type!=='door'||!opening)box(mid,h-.045,len,.09,thickness+.04,trim);
      if(opening){
        const id=tile.doorId??`${tile.type}:${tile.x},${tile.y}`,openingHeight=cut?Math.min(h,.28):top-sill;
        if(!cut&&(tile.style??(tile.type==='door'?appearance.doorStyle:appearance.windowStyle))==='arched')openingArch(batch,wallMat,trim,axis,mid,cross,tileBase,top,ow,thickness,light);
        openingRecords.push({id,type:tile.type,open:Boolean(tile.open),axis,height:openingHeight,width:ow});
        if(tile.type==='door'){
          const leafGroup=new Group();leafGroup.name=`door:${id}`;leafGroup.userData.semanticId=`door:${id}`;leafGroup.userData.open=Boolean(tile.open);leafGroup.userData.broken=Boolean(tile.broken);
          const style=tile.style??appearance.doorStyle,double=style==='double';
          for(let side=0;side<(double?2:1);side++){
            const w=double?ow*.5:ow,hinge=new Group();hinge.position.set(axis==='x'?mid-ow*.5+side*ow:cross,tileBase+sill,axis==='x'?cross:mid-ow*.5+side*ow);hinge.rotation.y=axis==='x'?0:-Math.PI*.5;
            if(tile.open)hinge.rotation.y+=(side===1?-1:1)*Math.PI*.48;
            const part=new WorldBatch(geometry),sign=side===1?-1:1;
            addDoorLeaf(part,materials,{width:w,height:openingHeight,sign,style,broken:Boolean(tile.broken),light});
            const leaf=part.finish(`door-leaf:${id}:${side}`);leaf.userData.style=style;hinge.add(leaf);leafGroup.add(hinge);
          }
          group.add(leafGroup);
        }else if(!cut){
          addWindowFace(batch,materials,{axis,mid,cross,base:tileBase,sill,top,width:ow,style:tile.style??appearance.windowStyle,light});
        }
      }
    }
  }
  const openings=climbOpenings(input,T);
  for(const [index,room]of (b.rooms??[]).entries())if(known.has(room.id)){
    const decor=roomDecorProfile(b,room,index),floor=materials.terrain(decor.floor==='stone'?'cobble':decor.floor),level=room.tacticalLevel??0;
    for(const cell of room.cells){const cellLevel=cell.tacticalLevel??level,surface=(cellLevel?input.terrain.upperSurfaces:input.terrain.tiles)?.find(tile=>tile.x===cell.x&&tile.y===cell.y&&(tile.tacticalLevel??0)===cellLevel),y=surface?.elevation??base;
      for(const part of buildingFloorRectangles(b,input,{...cell,tacticalLevel:cellLevel,elevation:y},T,openings,wallInset))cellTop(batch,floor,part.minX,part.minZ,part.maxX,part.maxZ,y+.006,illuminationAt(input,{...cell,tacticalLevel:cellLevel}));
    }
  }
  if(!roofs.length&&!allOpen){
    const frame=entranceFrame({...b,walls:walls as WorldTile[]}),e=profile.eave,rise=Math.min(profile.roofRise/V,Math.max(.4,frame.width*.28));
    const terrace=b.roof==='terrace',roofMat=terrace&&!b.roofFinish?materials.get('stone',{colour:'#b2b0a4'}):materials.get(appearance.roofFinish),panels:Vector3[][]=[];
    // The wall coping and the roof meet at the same height. Bias the roof
    // surface in depth so the shared join cannot flicker into white triangles.
    roofMat.polygonOffset=true;roofMat.polygonOffsetFactor=-1;roofMat.polygonOffsetUnits=-1;
    const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3((p.x+wallInset)*T,base+y,(p.y+wallInset)*T);};
    const lo=-e,hi=frame.width+e,front=-e,back=frame.depth+e,mid=frame.width*.5;
    if(b.roof==='terrace')panels.push([at(lo,front,height),at(lo,back,height),at(hi,back,height),at(hi,front,height)]);
    else if(profile.roofShape==='hip'){
      const inset=Math.min(frame.width*.44,frame.depth*.3),a=at(mid,inset,height+rise),c=at(mid,frame.depth-inset,height+rise),corners=[at(lo,front,height),at(lo,back,height),at(hi,back,height),at(hi,front,height)];panels.push([corners[0],corners[1],c,a],[corners[2],corners[3],a,c],[corners[3],corners[0],a],[corners[1],corners[2],c]);
    }else if(profile.roofShape==='shed')panels.push([at(lo,front,height),at(hi,front,height),at(hi,back,height+rise),at(lo,back,height+rise)]);
    else{const a=at(mid,front,height+rise),c=at(mid,back,height+rise);panels.push([at(lo,front,height),at(lo,back,height),c,a],[at(hi,back,height),at(hi,front,height),a,c]);for(const d of [0,frame.depth])batch.polygon(wallMat,[at(0,d,height),at(frame.width,d,height),at(mid,d,height+rise)],illuminationAt(input,b));}
    const owners=roofOwners(b),hidden=groundRooms.filter(room=>!known.has(room.id)),whole=!someOpen;
    for(const panel of panels){
      const projectUV=terrace?undefined:roofTextureProjector(panel);
      if(whole)batch.polygon(roofMat,panel,illuminationAt(input,b),projectUV);
      else for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(hidden.some(room=>room.id===owners.get(`${x},${y}`))){const clipped=clipRoofCell(panel,(x-.5+wallInset)*T,(y-.5+wallInset)*T,(x+.5+wallInset)*T,(y+.5+wallInset)*T);batch.polygon(roofMat,clipped,illuminationAt(input,{x,y}),projectUV);}
    }
    if(whole)group.add(roofEdgeDetails(b.id,panels,height,geometry,roofMat,materials.get(terrace?'stone':'darkwood'),illuminationAt(input,b),terrace));
  }
  if(!someOpen)group.add(architecturalDetails(b,input,T,height,base,geometry,materials,legacy));
  group.add(surfaces.finish(`building-surfaces:${b.id}`),batch.finish(`building-fabric:${b.id}`));group.userData.kind='building';group.userData.openings=openingRecords;group.userData.cutawayRooms=groundRooms.filter(room=>known.has(room.id)).map(room=>room.id);group.userData.height=height;return group;
}

export function buildIndependentWalls(input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),tiles=input.terrain.tiles.filter(tile=>!tile.buildingId&&['wall','door','window'].includes(tile.type)),occupied=new Set(tiles.map(tile=>`${tile.x},${tile.y}`)),doors=new Group();
  for(const tile of tiles)for(const [n,axis]of buildingWallAxes(tile,undefined,occupied).entries()){
    const h=tile.obstacleHeight??2.5,light=illuminationAt(input,tile),x=tile.x*T,z=tile.y*T,base=tile.elevation??0,material=materials.get(tile.material==='wood'?'wood':tile.material==='stone'?'stone':'adobe');
    const box=(u:number,y:number,w:number,hi:number,m=material)=>axis==='x'?batch.box(m,x+u,base+y,z,w,hi,.18,light):batch.box(m,x,base+y,z+u,.18,hi,w,light);
    if(tile.type==='wall'||n){box(0,h*.5,T,h);continue;}
    const width=T*.6,top=Math.min(h-.12,tile.type==='door'?BUILDING_OPENINGS.doorHeight/V:BUILDING_OPENINGS.windowTop/V),sill=tile.type==='window'?Math.min(top-.25,BUILDING_OPENINGS.windowSill/V):0;
    box(-(T+width)*.25,h*.5,(T-width)*.5,h);box((T+width)*.25,h*.5,(T-width)*.5,h);box(0,top+(h-top)*.5,width,h-top);if(sill)box(0,sill*.5,width,sill);
    if(tile.type==='window'){for(let k=0;k<4;k++)box((k-1.5)*width*.25,(top+sill)*.5,.018,top-sill,materials.get('iron'));continue;}
    const id=tile.doorId??tile.id??`${tile.x},${tile.y}`,leaf=new WorldBatch(geometry);leaf.box(materials.get('wood'),width*.5,top*.5,0,width,top,.055,light);leaf.box(materials.get('iron'),width*.5,top*.7,-.036,width*.75,.033,.01,light);
    const hinge=leaf.finish(`door:${id}`);hinge.position.set(axis==='x'?x-width*.5:x,base,axis==='x'?z:z-width*.5);hinge.rotation.y=(axis==='x'?0:-Math.PI*.5)+(tile.open?Math.PI*.48:0);hinge.userData.semanticId=`door:${id}`;hinge.userData.open=Boolean(tile.open);doors.add(hinge);
  }
  const group=batch.finish('independent-walls');group.add(doors);group.userData.kind='independent-walls';return group;
}
