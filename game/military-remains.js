import {expandCellScene} from './cell-scene-storage.js';
import {CRITICAL_HEALTH,refreshMilitaryCondition} from './actor-condition.js';

export function previousDeploymentScene(campaign,request){
 return expandCellScene(request.sceneId?campaign.sceneStates[request.sceneId]:campaign.sectorStates[request.sector]);
}

// Keep dead bodies and incapacitated enemy casualties across visits. Only a
// new enemy garrison can reuse an identity. A casualty never becomes that recruit.
export function retainedMilitaryBodies(previous,deployed,sector){
 const used=new Set([...deployed,...(previous?.units??[])].map(u=>String(u.id)));
 return (previous?.units??[]).filter(u=>u.hp<=0||previous.sectorCleared&&u.side==='enemy'&&u.hp<CRITICAL_HEALTH).map(raw=>{
  const body=structuredClone(raw),existing=deployed.find(u=>String(u.id)===String(raw.id));
  if(existing&&existing.hp!==0){
   if(raw.side!=='enemy')throw Error('Un soldado fallecido no puede volver a entrar vivo.');
   body.originalUnitId=raw.id;const base=`${raw.hp<=0?'corpse':'casualty'}:${previous.battleId??sector}:${raw.id}`;let id=base,suffix=0;
   while(used.has(id))id=`${base}:${++suffix}`;
   body.id=id;used.add(id);
  }
  return refreshMilitaryCondition(body);
 });
}

// The UI includes visible player bodies in its report. Exclude only deaths
// already stored in this scene and outside the current deployed roster.
export function withoutPreviousCasualties(previous,request,reports,snapshot){
 if(!Array.isArray(reports)||new Set(reports.map(r=>String(r?.id))).size!==reports.length)throw Error('El parte de la escuadra es inválido.');
 const deployed=new Set([...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[])].map(u=>String(u.id)));
 const bodies=new Set((previous?.units??[]).filter(u=>u.side==='player'&&u.hp===0&&!deployed.has(String(u.id))).map(u=>String(u.id)));
 for(const unit of snapshot?.units??[])if(bodies.has(String(unit.id))&&unit.hp!==0)throw Error('El parte modifica una baja ya confirmada.');
 return reports.filter(report=>{
  if(!report||typeof report!=='object')throw Error('El parte de la escuadra es inválido.');
  if(!bodies.has(String(report.id)))return true;
  if(report.hp!==0||!snapshot?.units.some(u=>String(u.id)===String(report.id)&&u.side==='player'&&u.hp===0))throw Error('El parte modifica una baja ya confirmada.');
  return false;
 });
}
