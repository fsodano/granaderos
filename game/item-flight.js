import {surfaceAt,surfaceHeight,spacePoint,tacticalLevel} from './tactical-space.js';
import {absoluteBodyHeight,geometryCells,obstacleVolumesAt,volumeRayCell} from './sight-geometry.js';
import {propSize} from './props.js';

const epsilon=1e-9,propIndexes=new WeakMap();
const key=point=>`${point.x},${point.y}`;
const validHeight=height=>Number.isFinite(height)&&height>=0&&height<=110;
const failed=(reason,blocked=false,path=[])=>({valid:false,blocked,reason,landing:null,path});

function propsByColumn(state){
 const props=state.props??[];
 if(!Array.isArray(props)||props.length>10000)throw Error('Invalid props');
 let index=propIndexes.get(props);
 // Prop coordinates/footprints are map topology. Replace the array when
 // authoring that topology; live door/cover fields stay on original records.
 if(!index||index.length!==props.length||index.width!==state.width||index.height!==state.height){
  const columns=new Map();
  for(const prop of props){
   const size=propSize(prop);
   if(![prop.x,prop.y,size.width,size.height].every(Number.isSafeInteger)||size.width<1||size.height<1||size.width>8||size.height>8||prop.x<0||prop.y<0||prop.x+size.width>state.width||prop.y+size.height>state.height)throw Error('Invalid prop footprint');
   for(let y=prop.y;y<prop.y+size.height;y++)for(let x=prop.x;x<prop.x+size.width;x++){
    const id=`${x},${y}`,column=columns.get(id)??[];column.push(prop);columns.set(id,column);
   }
  }
  index={length:props.length,width:state.width,height:state.height,columns};propIndexes.set(props,index);
 }
 return index.columns;
}

// Exact quadratic-height intersections prevent thin slabs and diagonal corner
// obstacles from falling between the bounded points used only for drawing.
function heightIntersection(height,coefficients,cell,bottom,top){
 const {a,b,c}=coefficients,from=Math.max(0,cell.entry),to=Math.min(1,cell.exit);
 if(height(from)>=bottom-epsilon&&height(from)<=top+epsilon)return from;
 const candidates=[];
 for(const boundary of [bottom,top]){
  if(!Number.isFinite(boundary))continue;
  const discriminant=b*b-4*a*(c-boundary);
  if(discriminant< -epsilon)continue;
  const root=Math.sqrt(Math.max(0,discriminant));
  for(const t of [(-b-root)/(2*a),(-b+root)/(2*a)])if(t>=from-epsilon&&t<=to+epsilon)candidates.push(Math.max(from,Math.min(to,t)));
 }
 return candidates.length?Math.min(...candidates):null;
}

/** Ordinary item transport, not an attack. No RNG, damage, AP, range or actor
 * roster access. Bodies are deliberately ignored in this slice (classic JA2
 * could inflict 1 HP from a generic tossed-object collision).
 * `destination.catch=true` ends at the supplied recipient's torso; otherwise
 * flight ends just above its supporting floor. Landing always names that floor.
 * Heights are absolute world metres. Interior path samples have no floor ID.
 * The arc and 1.5 m cart envelope are Granaderos tuning, not JA2 physics. */
export function itemFlight(state,source,destination){
 const invalid=()=>failed('La trayectoria del objeto no es válida.');
 if(!state||![state.width,state.height].every(n=>Number.isSafeInteger(n)&&n>0&&n<=128)||
  !source||!destination||![source.x,source.y,destination.x,destination.y].every(Number.isSafeInteger))return invalid();
 try{
  const startSurface=surfaceAt(state,source),endSurface=surfaceAt(state,destination);
  if(!startSurface||!endSurface||startSurface.blocked||endSurface.blocked)return failed('No hay una superficie válida para dejar el objeto.');
  const columns=propsByColumn(state),blockingProp=point=>(columns.get(key(point))??[]).some(prop=>tacticalLevel(prop)===tacticalLevel(point)&&prop.blocksMovement!==false);
  if(blockingProp(source)||blockingProp(destination))return failed('No hay espacio para dejar el objeto en esa casilla.');
  const start=absoluteBodyHeight(state,source,'muzzle'),end=destination.catch===true?absoluteBodyHeight(state,destination,'torso'):surfaceHeight(state,destination)+.05;
  if(!validHeight(start)||!validHeight(end))return invalid();
  const distance=Math.hypot(destination.x-source.x,destination.y-source.y),arc=Math.min(1.2,Math.max(.45,distance*.15));
  const coefficients={a:-4*arc,b:end-start+4*arc,c:start};
  const height=t=>(coefficients.a*t+coefficients.b)*t+coefficients.c;
  const point=t=>({x:source.x+(destination.x-source.x)*t,y:source.y+(destination.y-source.y)*t,height:height(t),fraction:t,...(t===0?{tacticalLevel:tacticalLevel(source)}:t===1?{tacticalLevel:tacticalLevel(destination)}:{})});
  const geometryState={width:state.width,height:state.height,tiles:state.tiles,upperSurfaces:state.upperSurfaces,wallEdges:state.wallEdges};
  let stop=null;
  for(const cell of geometryCells(source,destination)){
   if(stop!==null&&cell.entry>stop+epsilon)break;
   const ground=surfaceAt(state,{x:cell.x,y:cell.y}),props=columns.get(key(cell))??[];
   if(!ground)return invalid();
   const groundHeight=ground.elevation??0;if(!validHeight(groundHeight))return invalid();
   const volumes=[{bottom:-Infinity,top:groundHeight},...obstacleVolumesAt({...geometryState,props},cell)];
   // Carts have movement footprints but no shared firearm-cover profile.
   for(const prop of props)if(prop.type==='cart'){
    const base=surfaceHeight(state,prop);if(!validHeight(base))return invalid();
    volumes.push({bottom:base,top:base+(prop.obstacleHeight??1.5)});
   }
   for(const volume of volumes){
    if(!Number.isFinite(volume.top)||volume.bottom!==-Infinity&&!Number.isFinite(volume.bottom)||volume.top<volume.bottom)return invalid();
    const crossed=volumeRayCell(source,destination,cell,volume);if(!crossed)continue;
    const hit=heightIntersection(height,coefficients,crossed,volume.bottom,volume.top);
    if(hit!==null&&(stop===null||hit<stop))stop=hit;
   }
  }
  const last=stop??1,segments=Math.min(64,Math.max(8,Math.ceil(distance*4))),path=Array.from({length:segments+1},(_,i)=>point(last*i/segments));
  if(stop!==null)return failed('La trayectoria del objeto está bloqueada.',true,path);
  return {valid:true,blocked:false,reason:null,landing:spacePoint(destination),path};
 }catch{return invalid();}
}
