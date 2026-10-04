import {Group,Quaternion,Vector3} from 'three';
import {getBuildingProfile,entranceFrame} from '../../../game/building-profile.js';
import {buildingAppearance} from '../../../game/building-appearance.js';
import {buildingStyle} from '../../../game/building-types.js';
import {BUILDING_OPENINGS} from '../../../game/building-scale.js';
import {roomDecorProfile} from '../../../game/room-dressing.js';
import {WorldBatch,cellTop} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldBuilding,WorldInput,WorldTile} from './world-types';

const V=25.066666666666666,wallInset=.4;
type Axis='x'|'y';
export function normalizedBuilding(b:WorldBuilding){const kind=b.kind??b.architecture;return {...b,kind:kind==='estancia'?'farmhouse':kind==='mansion'?'palace':kind};}
function appearanceFor(b:WorldBuilding){return buildingAppearance({...b,roofFinish:b.roofFinish??(b.roof==='thatch'?'thatch':undefined)});}
export function effectiveRooms(input:WorldInput){
  const rooms=new Set(input.revealedRooms??[]),level=input.cursorLevel??0;
  if(level){const terraces=new Set((input.terrain.upperSurfaces??[]).filter(surface=>surface.kind==='roof'&&(surface.tacticalLevel??0)===level).map(surface=>surface.buildingId));for(const building of input.terrain.buildings??[])if(terraces.has(building.id))for(const room of building.rooms??[])if(!(room.tacticalLevel??0))rooms.delete(room.id);}
  return rooms;
}
export function roofOwners(b:WorldBuilding){
  const owners=new Map<string,string>(),queue:{x:number;y:number}[]=[];
  for(const room of b.rooms??[])for(const cell of room.cells){const key=`${cell.x},${cell.y}`;if(!owners.has(key)){owners.set(key,room.id);queue.push(cell);}}
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
  const b=normalizedBuilding(b0),known=effectiveRooms(input),profile=getBuildingProfile(b),appearance=appearanceFor(b),legacy=Boolean(b0.architecture&&(!b0.kind||b0.roof==='terrace'));
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&['wall','door','window'].includes(tile.type)),allWalls=input.terrain.tiles.filter(tile=>['wall','door','window'].includes(tile.type)),occupied=new Set(allWalls.map(tile=>`${tile.x},${tile.y}`));
  const roofs=(input.terrain.upperSurfaces??[]).filter(surface=>surface.kind==='roof'&&surface.buildingId===b.id),base=input.terrain.tiles.find(tile=>tile.x===b.x&&tile.y===b.y)?.elevation??0;
  const allOpen=(b.rooms?.length??0)>0&&b.rooms!.every(room=>known.has(room.id)),someOpen=b.rooms?.some(room=>known.has(room.id))??false;
  // Existing metric slabs and cover metadata win over artwork pixel heights.
  const fullHeight=roofs.length?Math.min(...roofs.map(surface=>(surface.elevation??3)-base)):Math.max(2.5,(legacy?buildingStyle(b).height:profile.wallHeight)/V);
  const floorHeight=roofs.length?fullHeight:Math.min(fullHeight,Math.max(2.5,profile.groundFloorHeight/V));
  const height=profile.floors>1&&someOpen?floorHeight:fullHeight,batch=new WorldBatch(geometry),group=new Group();group.name=`building:${b.id}`;group.userData.semanticId=`building:${b.id}`;
  const wallMat=materials.get(appearance.wallFinish,legacy?{colour:buildingStyle(b).wall}:{}),trim=materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),wood=materials.get('wood'),iron=materials.get('iron');
  const doorHeight=BUILDING_OPENINGS.doorHeight/V,doorWidth=T*.60,thickness=.18,cutaway=BUILDING_OPENINGS.cutawayHeight/V;
  const openingRecords:{id:string;type:string;open:boolean;axis:Axis;height:number;width:number}[]=[];
  for(const tile of walls){
    const onX=tile.x===b.x||tile.x===b.x+b.width-1,onY=tile.y===b.y||tile.y===b.y+b.height-1,corner=onX&&onY;
    const roomOpen=allOpen||b.rooms?.some(room=>known.has(room.id)&&room.cells.some(cell=>corner?Math.abs(cell.x-tile.x)<=1&&Math.abs(cell.y-tile.y)<=1:Math.abs(cell.x-tile.x)+Math.abs(cell.y-tile.y)===1));
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
      if(tile.type!=='door'||!opening){box(mid,.065,len,.13,thickness+.045,materials.get('stone'));box(mid,h-.045,len,.09,thickness+.04,trim);}
      if(opening){
        const id=tile.doorId??`${tile.type}:${tile.x},${tile.y}`,openingHeight=cut?Math.min(h,.28):top-sill;
        openingRecords.push({id,type:tile.type,open:Boolean(tile.open),axis,height:openingHeight,width:ow});
        if(tile.type==='door'){
          const leafGroup=new Group();leafGroup.name=`door:${id}`;leafGroup.userData.semanticId=`door:${id}`;leafGroup.userData.open=Boolean(tile.open);leafGroup.userData.broken=Boolean(tile.broken);
          const double=(tile.style??appearance.doorStyle)==='double';
          for(let side=0;side<(double?2:1);side++){
            const w=double?ow*.5:ow,hinge=new Group();hinge.position.set(axis==='x'?mid-ow*.5+side*ow:cross,tileBase+sill,axis==='x'?cross:mid-ow*.5+side*ow);hinge.rotation.y=axis==='x'?0:-Math.PI*.5;
            if(tile.open)hinge.rotation.y+=(side===1?-1:1)*Math.PI*.48;
            const part=new WorldBatch(geometry),sign=side===1?-1:1;
            part.box(wood,sign*w*.5,openingHeight*.5,0,w,.98*openingHeight,.06,light);
            for(let n=1;n<5;n++)part.box(materials.get('darkwood'),sign*w*n/5,openingHeight*.5,-.034,.012,openingHeight*.93,.01,light);
            for(const y of [.12,Math.max(.15,openingHeight-.15)])part.box(iron,sign*w*.5,y,-.04,w*.82,.03,.015,light);
            part.primitive('sphere',materials.get('brass'),[sign*w*.82,openingHeight*.47,-.045],[.023,.023,.018],undefined,light);
            if(tile.broken)part.box(materials.get('darkwood'),sign*w*.5,openingHeight*.54,-.043,w*.9,.035,.025,light);
            hinge.add(part.finish(`door-leaf:${id}:${side}`));leafGroup.add(hinge);
          }
          group.add(leafGroup);
        }else if(!cut){
          const windowMat=materials.get('glass',{opacity:.38});box(mid,(top+sill)*.5,ow,top-sill,.025,windowMat);
          const style=tile.style??appearance.windowStyle;
          if(['barred','lattice','small','arched'].includes(style)){for(let n=0;n<4;n++)box(mid-ow*.38+ow*.25*n,(top+sill)*.5,.018,top-sill,.035,iron);box(mid,sill+(top-sill)*.48,ow,.018,.035,iron);}
          if(style==='shutters'){box(mid-ow*.64,(top+sill)*.5,ow*.28,top-sill,.07,wood);box(mid+ow*.64,(top+sill)*.5,ow*.28,top-sill,.07,wood);}
        }
      }
    }
  }
  for(const [index,room]of (b.rooms??[]).entries())if(known.has(room.id)){
    const decor=roomDecorProfile(b,room,index),floor=materials.terrain(decor.floor==='stone'?'cobble':decor.floor),level=room.tacticalLevel??0;
    for(const cell of room.cells){const surface=(level?input.terrain.upperSurfaces:input.terrain.tiles)?.find(tile=>tile.x===cell.x&&tile.y===cell.y&&(tile.tacticalLevel??0)===(cell.tacticalLevel??level)),y=surface?.elevation??base;cellTop(batch,floor,(cell.x-.5)*T,(cell.y-.5)*T,(cell.x+.5)*T,(cell.y+.5)*T,y+.006,illuminationAt(input,{...cell,tacticalLevel:level}));}
  }
  if(!roofs.length&&!allOpen){
    const frame=entranceFrame({...b,walls:walls as WorldTile[]}),e=profile.eave,rise=Math.min(profile.roofRise/V,Math.max(.4,frame.width*.28)),roofMat=materials.get(appearance.roofFinish),panels:Vector3[][]=[];
    const at=(u:number,v:number,y:number)=>{const p=frame.at(u,v);return new Vector3((p.x+wallInset)*T,base+y,(p.y+wallInset)*T);};
    const lo=-e,hi=frame.width+e,front=-e,back=frame.depth+e,mid=frame.width*.5;
    if(b.roof==='terrace')panels.push([at(lo,front,height),at(lo,back,height),at(hi,back,height),at(hi,front,height)]);
    else if(profile.roofShape==='hip'){
      const inset=Math.min(frame.width*.44,frame.depth*.3),a=at(mid,inset,height+rise),c=at(mid,frame.depth-inset,height+rise),corners=[at(lo,front,height),at(lo,back,height),at(hi,back,height),at(hi,front,height)];panels.push([corners[0],corners[1],c,a],[corners[2],corners[3],a,c],[corners[3],corners[0],a],[corners[1],corners[2],c]);
    }else if(profile.roofShape==='shed')panels.push([at(lo,front,height),at(lo,back,height+rise),at(hi,back,height+rise),at(hi,front,height)]);
    else{const a=at(mid,front,height+rise),c=at(mid,back,height+rise);panels.push([at(lo,front,height),at(lo,back,height),c,a],[at(hi,back,height),at(hi,front,height),a,c]);for(const d of [0,frame.depth])batch.polygon(wallMat,[at(0,d,height),at(frame.width,d,height),at(mid,d,height+rise)],illuminationAt(input,b));}
    const owners=roofOwners(b),hidden=(b.rooms??[]).filter(room=>!known.has(room.id)),whole=!someOpen;
    for(const panel of panels){
      if(whole)batch.polygon(roofMat,panel,illuminationAt(input,b));
      else for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(hidden.some(room=>room.id===owners.get(`${x},${y}`))){const clipped=clipRoofCell(panel,(x-.5+wallInset)*T,(y-.5+wallInset)*T,(x+.5+wallInset)*T,(y+.5+wallInset)*T);batch.polygon(roofMat,clipped,illuminationAt(input,{x,y}));}
    }
  }
  if(!someOpen)architecturalDetails(batch,b,input,T,height,base,materials,legacy);
  group.add(batch.finish(`building-fabric:${b.id}`));group.userData.kind='building';group.userData.openings=openingRecords;group.userData.cutawayRooms=(b.rooms??[]).filter(room=>known.has(room.id)).map(room=>room.id);group.userData.height=height;return group;
}

function architecturalDetails(batch:WorldBatch,b:WorldBuilding,input:WorldInput,T:number,height:number,base:number,materials:WorldMaterials,legacy:boolean){
  const walls=input.terrain.tiles.filter(tile=>tile.buildingId===b.id&&tile.type==='door'),frame=entranceFrame({...b,walls}),kind=b.kind??b.architecture??'house',appearance=appearanceFor(b),wall=materials.get(appearance.wallFinish,legacy?{colour:buildingStyle(b).wall}:{}),trim=materials.get('trim',legacy?{colour:buildingStyle(b).trim}:{}),wood=materials.get('wood'),roof=materials.get(appearance.roofFinish),light=illuminationAt(input,b);
  const at=(u:number,v:number,y:number)=>{const point=frame.at(u,v);return new Vector3((point.x+wallInset)*T,base+y,(point.y+wallInset)*T);};
  const box=(u:number,v:number,y:number,w:number,h:number,d:number,material=wall)=>{const point=at(u,v,y);batch.primitive('box',material,point,[w*T,h,d*T],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-frame.u.y,frame.u.x)),light);};
  const tower=(u:number,v:number,w:number,top:number)=>{
    box(u,v,top*.5,w,top,w);for(const y of [height,top-.12])box(u,v,y,w+.15,.12,w+.15,trim);
    const p=at(u,v,top+.30);batch.primitive('cone',roof,p,[w*T*.77,.60,w*T*.77],undefined,light);
    const cross=at(u,v,top+.89);batch.box(materials.get('iron'),cross.x,cross.y,cross.z,.055,.48,.055,light);batch.box(materials.get('iron'),cross.x,cross.y+.07,cross.z,.29,.045,.045,light);
    for(const face of [-1,1]){const p=at(u,v+face*w*.51,top-.50);batch.box(materials.get('darkwood'),p.x,p.y,p.z,w*T*.46,.62,.035,light);}
  };
  const gallery=(depth=.65)=>{
    const roofY=height*.81;for(let u=.35;u<frame.width;u+=1.20){batch.cylinder(trim,at(u,-depth,.08),at(u,-depth,roofY),.055,light);box(u,-depth,.06,.15,.12,.15,materials.get('stone'));}
    batch.polygon(roof,[at(-.10,-depth-.15,roofY),at(frame.width+.10,-depth-.15,roofY),at(frame.width+.10,.08,roofY+.20),at(-.10,.08,roofY+.20)],light);
    box(frame.width*.5,-depth,roofY-.05,frame.width+.18,.12,.13,wood);
  };
  if(['church','chapel'].includes(kind)){
    tower(.62,.38,kind==='church'?.88:.62,height+(kind==='church'?2.25:1.1));
    const center=frame.width*.5;batch.polygon(wall,[at(center-1,0,height),at(center+1,0,height),at(center,0,height+.72)],light);
    for(let v=1;v<frame.depth;v+=1.6)for(const u of [0,frame.width])box(u,v,.80,.20,1.6,.32,trim);
  }else if(['cabildo','townhall'].includes(kind)){
    const columns=Math.max(3,Math.floor(frame.width/1.1));for(let n=0;n<columns;n++){
      const u=(n+.5)*frame.width/columns;box(u,-.38,height*.40,.22,height*.8,.38,trim);
      if(n<columns-1){const a=u+.15,c=(n+1.5)*frame.width/columns-.15,r=(c-a)*T*.5,y=height*.73;for(let k=0;k<10;k++){const angle=Math.PI*k/10,next=Math.PI*(k+1)/10,pa=at((a+c)*.5+Math.cos(angle)*r/T,-.58,y+Math.sin(angle)*r*.6),pb=at((a+c)*.5+Math.cos(next)*r/T,-.58,y+Math.sin(next)*r*.6);batch.cylinder(trim,pa,pb,.06,light);}}
    }
    box(frame.width*.5,-.36,height*.84,frame.width,.16,.44,trim);tower(frame.width*.5,.1,.86,height+1.35);
  }else if(['farmhouse','estancia','posta','pulperia'].includes(kind))gallery(kind==='pulperia'?.75:.55);
  else if(kind==='palace'){
    const center=frame.width*.5;for(const u of [center-.78,center+.78])batch.cylinder(trim,at(u,-.58,.08),at(u,-.58,height*.52),.10,light);box(center,-.48,height*.53,2,.17,.75,trim);batch.polygon(wall,[at(center-1.1,-.88,height*.57),at(center+1.1,-.88,height*.57),at(center,-.88,height*.78)],light);
  }else if(['warehouse','depot','stable','barracks'].includes(kind)){
    for(let v=.3;v<frame.depth;v+=1.7)for(const u of [0,frame.width])box(u,v,.5,.18,1,.22,trim);
    if(kind==='depot'){gallery(.60);box(frame.doorU,-.52,1.2,.10,2.4,.1,wood);const p=at(frame.doorU,-.75,2.2);batch.primitive('torus',materials.get('iron'),p,[.12,.12,.12],undefined,light);}
  }else if(kind==='smithy'){
    box(frame.width-.65,frame.depth-.55,(height+1)*.5,.42,height+1,.42,materials.get('brick'));box(frame.width-.65,frame.depth-.55,height+1,.56,.14,.56,trim);
  }
  if(profileHasUpper(kind))for(let u=.7;u<frame.width;u+=1.35){const p=at(u,-.012,height*.71);batch.box(materials.get('darkwood'),p.x,p.y,p.z,.45,.65,.04,light);}
}
function profileHasUpper(kind:string){return ['palace','townhall','mansion','cabildo'].includes(kind);}
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
