import {canSee} from './tactical.js';
import {wallEdgeId,wallEdgeKey} from './wall-geometry.js';

const geometryFields=['x','y','axis','tacticalLevel','elevation','obstacleHeight','material','style','doorId'];
const geometry=edge=>Object.fromEntries(geometryFields.filter(key=>edge?.[key]!==undefined).map(key=>[key,edge[key]]));

/** Static geography stays public; changing structure state needs active shared sight. */
export function sceneWallEdges(state,players=state.units?.filter(actor=>actor.side==='player')??[]){
 if(state.wallEdges===undefined||!state.units?.length)return state.wallEdges;
 const actors=players.filter(actor=>actor.side==='player'&&!actor.departure&&!actor.fled&&actor.hp>0&&!actor.unconscious&&!actor.routed&&!actor.surrendered);
 const authored=new Map();
 for(const building of state.buildings??[])for(const edge of building.walls??[])authored.set(`${building.id}:${wallEdgeKey(edge)}`,{building,edge});
 return state.wallEdges.map(edge=>{
  const source=edge.buildingId&&authored.get(`${edge.buildingId}:${wallEdgeKey(edge)}`),type=source?.edge.type;
  // Unchanged owned masonry already has the same static shape. Only opening,
  // damage and unauthored geometry need an observation query.
  const changing=!source||edge.type==='door'||edge.open||edge.broken||edge.destroyed||edge.structureDamage||edge.type!==type;
  if(changing&&actors.some(actor=>canSee(state,actor,edge)))return edge;
  if(source){
   const closed=type==='door',record={...geometry(source.edge),id:wallEdgeId(edge),buildingId:edge.buildingId,material:source.edge.material??source.building.material??'adobe',type,
    blocked:closed?true:source.edge.blocked??(type==='wall'||type==='window'),blocksSight:closed?true:source.edge.blocksSight??(type==='wall'),cover:source.edge.cover??(type==='wall'?40:type==='window'?25:0)};
   if(record.elevation===undefined&&edge.elevation!==undefined)record.elevation=edge.elevation;
   if(closed)record.open=false;
   return record;
  }
  // No authored shape survives for an independent destroyed window. A fixed
  // opaque face cannot reveal its live type, opening, damage or former height.
  return {...Object.fromEntries(['x','y','axis','tacticalLevel','elevation','buildingId'].filter(key=>edge[key]!==undefined).map(key=>[key,edge[key]])),id:wallEdgeId(edge),type:'wall',material:'adobe',obstacleHeight:2.5,blocked:true,blocksSight:true,cover:40};
 });
}
