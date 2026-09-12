import {spacePoint,surfaceAt,surfaceHeight,tacticalLevel} from './tactical-space.js';
import {absoluteBodyHeight,relativeBodyHeight,geometryCells,obstacleVolumesAt,rayHeightIntersection} from './sight-geometry.js';

const epsilon=1e-9;
const cellAt=point=>({x:Math.floor(point.x+.5),y:Math.floor(point.y+.5),tacticalLevel:tacticalLevel(point)});
const lerp=(from,to,fraction)=>from+(to-from)*fraction;

function clearSupportBelow(state,cell,height){
 const ground=surfaceAt(state,{x:cell.x,y:cell.y});
 const surfaces=[ground,...(state.upperSurfaces??[]).filter(surface=>surface.x===cell.x&&surface.y===cell.y)]
  .filter(surface=>surface&&(surface.elevation??0)<=height+epsilon)
  .sort((a,b)=>(b.elevation??0)-(a.elevation??0)||tacticalLevel(b)-tacticalLevel(a));
 // An occupied roof still catches an object. Do not skip its slab and put
 // the object downstairs when furniture prevents recovery from that cell.
 const support=surfaces[0];
 if(!support||support.blocked)return null;
 const blocked=(state.props??[]).some(prop=>{
  const size=prop.footprint??{width:1,height:1};
  return prop.blocksMovement!==false&&tacticalLevel(prop)===tacticalLevel(support)&&
   cell.x>=prop.x&&cell.y>=prop.y&&cell.x<prop.x+size.width&&cell.y<prop.y+size.height;
 });
 return blocked?null:spacePoint(support);
}

function landingBefore(state,cells,start,end,stop,impact){
 // A descending knife striking the top of a slab stays on that roof. A
 // side impact must fall on the near side, not through the slab or wall.
 const topImpact=impact?.volume?.kind==='slab'&&end<start&&Math.abs(lerp(start,end,stop)-impact.volume.top)<epsilon;
 const nearFace=impact?.volume&&Math.abs(stop-impact.cell.entry)<epsilon&&!topImpact;
 for(let index=cells.length-1;index>=0;index--){
  const cell=cells[index];
  if(cell.entry>stop+epsilon||cell.exit-cell.entry<epsilon)continue;
  if(nearFace&&cell.entry>=stop-epsilon)continue;
  const fraction=Math.min(cell.exit,stop),height=lerp(start,end,fraction);
  const landing=clearSupportBelow(state,cell,height);
  if(landing)return landing;
 }
 return null;
}

// One direct ray; no scatter, penetration, damage, ownership or random draw.
// Public previews pass only observed bodies in state.units. A target point
// never inserts a body into that roster. For scattered/off-map points, pass
// the original aim height in options.destinationHeight.
export function knifeFlight(state,attacker,target,hitLocation='torso',options={}){
 const location=['head','torso','legs'].includes(hitLocation)?hitLocation:'torso';
 const start=absoluteBodyHeight(state,attacker,'muzzle');
 const end=options.destinationHeight??absoluteBodyHeight(state,target,location);
 const fallback=Number.isFinite(start)?clearSupportBelow(state,cellAt(attacker),start):null;
 const invalid=()=>({victimId:null,hitLocation:location,blocked:true,landing:fallback,impact:{kind:'invalid',x:attacker.x,y:attacker.y,height:start,fraction:0}});
 if(!Number.isFinite(start)||!Number.isFinite(end))return invalid();
 let cells;try{cells=geometryCells(attacker,target);}catch{return invalid();}
 const events=[];
 for(const cell of cells){
  for(const volume of obstacleVolumesAt(state,cell)){
   const hit=rayHeightIntersection(start,end,cell,volume.bottom,volume.top);
   if(hit)events.push({fraction:hit.entry,cell,volume});
  }
  // Corner contacts can meet cover, but do not intersect a body silhouette.
  if(cell.exit-cell.entry<epsilon)continue;
  for(const unit of state.units??[]){
   if(unit.id===attacker.id||!(unit.hp>0)||unit.departure||unit.fled||unit.x!==cell.x||unit.y!==cell.y)continue;
   const base=surfaceHeight(state,unit),head=absoluteBodyHeight(state,unit,'head');
   const hit=base===null||head===null?null:rayHeightIntersection(start,end,cell,base,head+.15);
   if(hit)events.push({fraction:hit.entry,cell,unit,base});
  }
 }
 // Cover wins an exact tie, including an obstacle sharing a body's cell.
 events.sort((a,b)=>a.fraction-b.fraction||Number(Boolean(b.volume))-Number(Boolean(a.volume))||String(a.volume?.id??a.unit.id).localeCompare(String(b.volume?.id??b.unit.id)));
 const event=events[0],fraction=event?.fraction??1,height=lerp(start,end,fraction);
 const victim=event?.unit,relative=victim?height-event.base:null;
 const bodyPart=victim&&victim.id!==target.id?(relative>relativeBodyHeight(victim,'torso')+.2?'head':relative<relativeBodyHeight(victim,'legs')+.15?'legs':'torso'):location;
 const landing=landingBefore(state,cells,start,end,fraction,event)??fallback;
 return {
  victimId:victim?.id??null,hitLocation:bodyPart,blocked:Boolean(event?.volume),landing,
  impact:{kind:victim?'body':event?.volume?.kind==='slab'?'slab':event?'cover':'miss',x:lerp(attacker.x,target.x,fraction),y:lerp(attacker.y,target.y,fraction),height,fraction,
   ...(event?.volume?{obstacleId:event.volume.id,tacticalLevel:event.volume.tacticalLevel}:victim?{tacticalLevel:tacticalLevel(victim)}:{})},
 };
}
