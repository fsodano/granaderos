import {entryTerrainCells,exteriorComponent} from './sector-entry.js';
import {initializeBattlePerception} from './tactical.js';
import {validEntry} from './tactical-exits.js';
import {tacticalLevel} from './tactical-space.js';

const EDGES=['N','E','S','W'];
const key=p=>`${p.x},${p.y}`;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const need=(ok,message='La colocación de llegada no es válida.')=>{if(!ok)throw Error(message);};
const arrival=u=>u.side==='player'&&u.hp>0&&!u.militia&&!u.missionAlly&&!u.departure&&!u.fled&&u.entryReason==='arrival';
function rows(state,request){
 return state.units.filter(arrival).filter(u=>request.squad.some(raw=>String(raw.id)===u.id)).map(u=>{
  const squad=request.assaultSquads?.find(q=>q.members.some(id=>String(id)===u.id));
  return {id:u.id,edge:u.entryEdge,squadId:squad?.id??'arrival',squadName:squad?.name??squad?.id??'Escuadra'};
 });
}

// Called only during a new world handoff, before sight or initiative runs.
export function beginSectorDeployment(state,request){
 if(request.exploration||request.resumeSnapshot||state.deploymentComplete)return false;
 const units=rows(state,request);if(!units.length)return false;
 state.deployment={version:1,units,placements:{},...(request.defenseGroupId&&request.defenseFort>0?{defenseFort:request.defenseFort}:{})};
 validateSectorDeployment(state,request);return true;
}

function entryMap(state){
 const sample=state.units.find(arrival),component=exteriorComponent(state,sample);
 return Object.fromEntries(EDGES.map(edge=>[edge,entryTerrainCells(state,sample,edge,component).map(t=>({x:t.x,y:t.y}))]));
}

export function validateSectorDeployment(state,request){
 if(state.deploymentComplete!==undefined)need(state.deploymentComplete===true);
 const d=state.deployment;if(d===undefined)return;
 need(!state.deploymentComplete&&object(d)&&d.version===1&&Object.keys(d).filter(key=>key!=='defenseFort').sort().join(',')==='placements,units,version');
 if(Object.hasOwn(d,'defenseFort'))need(Number.isInteger(d.defenseFort)&&d.defenseFort>=1&&d.defenseFort<=3);
 need(state.turn===1&&state.phase==='player'&&state.mode==='exploration'&&state.status==='active'&&
  !state.elapsedSeconds&&!state.syncedSeconds&&!state.roundTimeCharged&&!state.enemyTurns&&!state.contactThisRound&&
  !state.contactInitiative&&!state.interrupt&&!state.enemyTurn&&!state.alliedTurn&&!state.reactionStack?.length);
 need(Array.isArray(d.units)&&d.units.length>0&&d.units.length<=48&&object(d.placements));
 const ids=new Set();
 for(const row of d.units){
  const unit=state.units.find(u=>u.id===row?.id);
  need(object(row)&&Object.keys(row).sort().join(',')==='edge,id,squadId,squadName'&&unit&&arrival(unit)&&!ids.has(row.id)&&
   row.edge===unit.entryEdge&&validEntry(unit.entryEdge,unit.entryAnchor)&&tacticalLevel(unit)===0&&
   typeof row.squadId==='string'&&row.squadId.length>0&&row.squadId.length<=80&&typeof row.squadName==='string'&&row.squadName.length>0&&row.squadName.length<=100);
  ids.add(row.id);
 }
 need(state.units.filter(arrival).every(u=>ids.has(u.id)));
 if(request){
  need(!request.exploration&&!request.resumeSnapshot&&JSON.stringify(rows(state,request))===JSON.stringify(d.units));
  need(d.defenseFort===(request.defenseGroupId&&request.defenseFort>0?request.defenseFort:undefined),'La fortificación de llegada no corresponde a la defensa.');
  for(const row of d.units){const actual=state.units.find(u=>u.id===row.id),issued=request.squad.find(u=>String(u.id)===row.id);need(issued&&issued.entryEdge===actual.entryEdge&&issued.entryAnchor?.x===actual.entryAnchor?.x&&issued.entryAnchor?.y===actual.entryAnchor?.y);}
 }
 const entries=entryMap(state),occupied=new Set();
 for(const [id,point]of Object.entries(d.placements)){
  const row=d.units.find(u=>u.id===id);
  need(ids.has(id)&&object(point)&&Object.keys(point).sort().join(',')==='x,y'&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&
   entries[row.edge].some(p=>p.x===point.x&&p.y===point.y)&&!occupied.has(key(point)));
  occupied.add(key(point));
 }
}

// This model deliberately reads no opposing positions, contents or current sight.
export function sectorDeploymentModel(state){
 const d=state.deployment;if(!d)return null;
 const units=d.units.map(row=>{const u=state.units.find(u=>u.id===row.id);return {...row,name:u.name,nickname:u.nickname??u.name,position:d.placements[row.id]?{...d.placements[row.id]}:null};});
 return {sectorName:state.sectorName,width:state.width,height:state.height,units,
  cells:state.tiles.map(({x,y,type,blocked})=>({x,y,type,blocked})),entryCells:entryMap(state),
  ready:units.every(u=>u.position),remaining:units.filter(u=>!u.position).length};
}

function selected(d,ids){
 need(Array.isArray(ids)&&ids.length>0&&ids.length<=48&&ids.every(id=>typeof id==='string')&&new Set(ids).size===ids.length&&ids.every(id=>d.units.some(u=>u.id===id)),'Elegí combatientes que estén llegando.');
 return ids.map(id=>d.units.find(u=>u.id===id));
}
function nearest(cells,point,occupied){
 return cells.filter(p=>!occupied.has(key(p))).sort((a,b)=>Math.abs(a.x-point.x)+Math.abs(a.y-point.y)-Math.abs(b.x-point.x)-Math.abs(b.y-point.y)||a.y-b.y||a.x-b.x)[0];
}

export function sectorDeploymentAction(state,action){
 const next=structuredClone(state);next.lastError=null;
 try{
  need(state.deployment,'La colocación de llegada ya terminó.');validateSectorDeployment(state);
  const d=next.deployment,entries=entryMap(next);
  if(action.type==='clearDeployment'){
   const chosen=selected(d,action.unitIds??d.units.map(u=>u.id));for(const row of chosen)delete d.placements[row.id];
  }else if(action.type==='placeDeployment'){
   const chosen=selected(d,action.unitIds),edge=chosen[0].edge;
   need(chosen.every(u=>u.edge===edge)&&Number.isInteger(action.x)&&Number.isInteger(action.y)&&entries[edge].some(p=>p.x===action.x&&p.y===action.y),'Elegí un paso del borde de llegada indicado.');
   const occupied=new Set(Object.entries(d.placements).filter(([id])=>!action.unitIds.includes(id)).map(([,p])=>key(p)));
   for(const row of chosen){const point=nearest(entries[edge],action,occupied);need(point,'No queda lugar para colocar ese grupo.');d.placements[row.id]={...point};occupied.add(key(point));}
  }else if(action.type==='spreadDeployment'){
   d.placements={};const occupied=new Set();
   for(const edge of EDGES){
    const group=d.units.filter(u=>u.edge===edge),cells=entries[edge].slice().sort((a,b)=>['N','S'].includes(edge)?a.x-b.x:a.y-b.y);
    for(let i=0;i<group.length;i++){const target=cells[Math.floor((i+.5)*cells.length/group.length)];need(target,'No hay pasos suficientes para desplegar.');const point=nearest(cells,target,occupied);need(point,'No hay pasos suficientes para desplegar.');d.placements[group[i].id]={...point};occupied.add(key(point));}
   }
  }else if(action.type==='confirmDeployment'){
   need(d.units.every(row=>d.placements[row.id]),'Colocá a todos los combatientes antes de entrar.');
   const ids=new Set(d.units.map(u=>u.id));
   // Only final commitment considers unseen occupants. Resolve each preferred
   // point to the nearest free point on its own edge, then run perception once.
   const occupied=new Set([...next.units.filter(u=>!ids.has(u.id)&&!u.departure&&!u.fled),...(next.npcs??[]),...(next.artillery??[])].filter(u=>tacticalLevel(u)===0).map(key));
   for(const row of d.units){
    const point=nearest(entries[row.edge],d.placements[row.id],occupied);need(point,'El borde de llegada está cerrado. El despliegue sigue pendiente.');
    const unit=next.units.find(u=>u.id===row.id);Object.assign(unit,point,{facing:{N:4,E:6,S:0,W:2}[row.edge]});occupied.add(key(point));
    if(d.defenseFort){const tile=next.tiles.find(t=>t.x===point.x&&t.y===point.y);tile.cover=Math.max(tile.cover??0,d.defenseFort*10);}
   }
   delete next.deployment;next.deploymentComplete=true;
   return initializeBattlePerception(next);
  }else throw Error('Terminá de colocar el destacamento antes de dar órdenes tácticas.');
  validateSectorDeployment(next);return next;
 }catch(error){const rejected=structuredClone(state);rejected.lastError=error.message;return rejected;}
}
