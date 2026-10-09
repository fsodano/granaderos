import {DEFAULT_SLAB_THICKNESS,surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';

// Abstract Granaderos dimensions and resistance, not real ballistic measures.
const resistance={wood:24,adobe:80,stone:120,hay:3};
const furniture={table:{height:.8,material:'wood'},bench:{height:.45,material:'wood'},bed:{height:.55,material:'wood'},chest:{height:.8,material:'wood'},barrels:{height:1.2,material:'wood'},hay:{height:1.3,material:'hay'}};
const heights={standing:{muzzle:1.4,head:1.6,torso:1.1,legs:.45},crouched:{muzzle:.9,head:1,torso:.7,legs:.3},prone:{muzzle:.25,head:.3,torso:.2,legs:.15},mounted:{muzzle:2,head:2.2,torso:1.8,legs:1.1}};
const epsilon=1e-10,columnIndexes=new WeakMap();
const columnKey=point=>`${point.x},${point.y}`;
const containingCell=point=>({x:Math.floor(point.x+.5),y:Math.floor(point.y+.5),tacticalLevel:tacticalLevel(point)});

export const relativeBodyHeight=(unit,part)=>heights[unit.unconscious||unit.knockedDown?'prone':unit.mounted?'mounted':unit.stance??'standing']?.[part]??heights.standing[part];
export const usesElevationGeometry=(state,a,b)=>Boolean(state.upperSurfaces?.length||tacticalLevel(a)!==0||tacticalLevel(b)!==0);
export function absoluteBodyHeight(state,unit,part='head'){
 const base=surfaceHeight(state,containingCell(unit));
 return base===null?null:base+relativeBodyHeight(unit,part);
}
export const groundTileAt=(state,point)=>surfaceAt(state,{x:point.x,y:point.y});

export function terrainCoverProfile(tile){
 if(!tile||tile.type==='door'&&tile.open)return null;
 const low=tile.type==='window'?.8:tile.type==='rubble'?(tile.destroyed?.15:.35):0;
 const solid=tile.blocked&&!['window','water'].includes(tile.type);
 const height=tile.obstacleHeight??(low||(solid?2.5:0));if(!height)return null;
 const material=tile.type==='door'?'wood':Object.hasOwn(resistance,tile.material)?tile.material:tile.type==='stone'||tile.type==='cliff'?'stone':'adobe';
 return {height,material,resistance:tile.projectileResistance??resistance[material]};
}
export function propCoverProfile(prop){
 if(prop.destroyed)return null;
 const spec=furniture[prop.type];if(!spec)return null;
 const material=Object.hasOwn(resistance,prop.material)?prop.material:spec.material;
 return {height:prop.obstacleHeight??spec.height,material,resistance:prop.projectileResistance??resistance[material]};
}

// Include the origin and destination columns: either may contain a ceiling.
// Cell centers have integer coordinates. Fractional light/sight positions are
// sampled in their containing cell, without an unbounded integer-step loop.
export function geometryCells(a,b){
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite))throw new RangeError('Invalid sight coordinates');
 if(![a.x,a.y,b.x,b.y].map(Math.round).every(Number.isSafeInteger)||Math.abs(b.x-a.x)+Math.abs(b.y-a.y)>8192)throw new RangeError('Sight path exceeds tactical bounds');
 const dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy),tx=dx?1/Math.abs(dx):Infinity,ty=dy?1/Math.abs(dy):Infinity;
 let {x,y}=containingCell(a),entry=0;
 let nx=dx?(x+sx*.5-a.x)/dx:Infinity,ny=dy?(y+sy*.5-a.y)/dy:Infinity;
 const result=[];
 while(entry<=1){
  const exit=Math.min(nx,ny,1);result.push({x,y,entry,exit});
  if(exit===1)break;
  if(Math.abs(nx-ny)<epsilon){result.push({x:x+sx,y,entry:exit,exit},{x,y:y+sy,entry:exit,exit});x+=sx;y+=sy;nx+=tx;ny+=ty;}
  else if(nx<ny){x+=sx;nx+=tx;}else{y+=sy;ny+=ty;}
  entry=exit;
 }
 return result;
}

// Intersect a sloping ray with a vertical interval inside one crossed column.
// A same-column vertical shot follows the same finite arithmetic.
export function rayHeightIntersection(muzzle,destination,cell,bottom,top,stopFraction=1){
 if(![muzzle,destination,bottom,top,stopFraction].every(Number.isFinite))return null;
 let entry=Math.max(0,cell.entry),exit=Math.min(stopFraction,cell.exit,1);
 if(exit<entry-epsilon)return null;
 const rise=destination-muzzle;
 if(Math.abs(rise)<epsilon)return muzzle>=bottom-epsilon&&muzzle<=top+epsilon?{entry,exit}:null;
 const first=(bottom-muzzle)/rise,last=(top-muzzle)/rise;
 entry=Math.max(entry,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
 return exit>=entry-epsilon?{entry,exit}:null;
}

function upperColumn(state,point){
 const surfaces=state.upperSurfaces;if(!surfaces?.length)return [];
 let index=columnIndexes.get(surfaces);
 // Surface coordinates are authored topology. Replace the array when editing
 // that topology; mutable cover/door fields are read from the original records.
 if(!index||index.length!==surfaces.length){
  const columns=new Map();for(const surface of surfaces){const key=columnKey(surface),column=columns.get(key)??[];column.push(surface);columns.set(key,column);}
  index={length:surfaces.length,columns};columnIndexes.set(surfaces,index);
 }
 return index.columns.get(columnKey(point))??[];
}

// The same world-space volumes serve elevated sight and projectiles. Furniture
// keeps its existing cell-wide abstraction. Floor slabs are deliberately solid
// for this gameplay slice, regardless of the material's penetration resistance.
export function obstacleVolumesAt(state,point){
 const volumes=[],ground=groundTileAt(state,point),upper=upperColumn(state,point);
 for(const surface of [ground,...upper]){
  if(!surface)continue;
  const base=surface.elevation??0,level=tacticalLevel(surface),profile=terrainCoverProfile(surface);
  if(level>0)volumes.push({id:`slab:${surface.id}`,kind:'slab',tacticalLevel:level,bottom:base-(surface.slabThickness??DEFAULT_SLAB_THICKNESS),top:base,material:surface.material??'adobe',resistance:0,solid:true,blocksSight:true});
  if(profile)volumes.push({id:`surface:${level}:${point.x},${point.y}`,kind:'cover',tacticalLevel:level,bottom:base,top:base+profile.height,...profile,blocksSight:surface.type==='window'||Boolean(surface.blocksSight??surface.blocked),stoneFace:surface.material==='stone'&&Boolean(surface.blocked)&&['wall','stone','cliff'].includes(surface.type),bounds:{minX:point.x-.5,maxX:point.x+.5,minY:point.y-.5,maxY:point.y+.5}});
 }
 for(const prop of state.props??[]){
  const size=prop.footprint??{width:1,height:1};
  if(point.x<prop.x||point.y<prop.y||point.x>=prop.x+size.width||point.y>=prop.y+size.height)continue;
  const profile=propCoverProfile(prop),base=surfaceHeight(state,prop);if(!profile||base===null)continue;
  volumes.push({id:`prop:${prop.id}`,kind:'prop',tacticalLevel:tacticalLevel(prop),bottom:base,top:base+profile.height,...profile,blocksSight:prop.blocksSight!==false,stoneFace:prop.material==='stone'&&prop.type!=='hay',bounds:{minX:prop.x-.5,maxX:prop.x+size.width-.5,minY:prop.y-.5,maxY:prop.y+size.height-.5}});
 }
 return volumes;
}

function requestedSightObstacle(state,target){
 // A selected object can expose its near face. Coordinates alone, or an actor
 // occupying the same cell, cannot grant sight through that object's volume.
 if(typeof target.type!=='string'||target.hp!==undefined||target.side!==undefined)return null;
 const cell=containingCell(target),surface=surfaceAt(state,cell);
 if(surface?.type===target.type){
  if(target.doorId!==undefined&&target.doorId!==surface.doorId)return null;
  if(target.id!==undefined&&surface.id!==undefined&&target.id!==surface.id)return null;
  return `surface:${tacticalLevel(cell)}:${cell.x},${cell.y}`;
 }
 const prop=(state.props??[]).find(prop=>{
  const size=prop.footprint??{width:1,height:1};
  return prop.id===target.id&&prop.type===target.type&&tacticalLevel(prop)===tacticalLevel(target)&&
   cell.x>=prop.x&&cell.y>=prop.y&&cell.x<prop.x+size.width&&cell.y<prop.y+size.height;
 });
 return prop?`prop:${prop.id}`:null;
}

// Call only when usesElevationGeometry() is true; the caller retains its exact
// established flat-map sight rules otherwise. No actor roster is inspected here.
export function elevationSightClear(state,a,b){
 const start=absoluteBodyHeight(state,a),end=absoluteBodyHeight(state,b);
 if(start===null||end===null)return false;
 const requested=requestedSightObstacle(state,b);
 for(const cell of geometryCells(a,b))for(const volume of obstacleVolumesAt(state,cell)){
  // Only the requested object's own cover is exempt. Slabs remain solid, even
  // when the requested object is a floor or occupies the terminal column.
  if(volume.kind!=='slab'&&volume.id===requested)continue;
  if(volume.blocksSight&&rayHeightIntersection(start,end,cell,volume.bottom,volume.top))return false;
 }
 return true;
}
