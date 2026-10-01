import {artillerySupplyRules} from './artillery-supply-rules.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {careAssignmentBusy} from './medical-care.js';
const parent=id=>id==='san_lorenzo'?'san_nicolas':id;
export function artillerySupplyQuote(s,sector,gunId,supplied){
 const rules=artillerySupplyRules(s),scene=s.sectorStates?.[sector],gun=scene?.artillery?.find(g=>g.id===gunId),cost=gun?rules[gun.type]:0;
 const present=(s.squad??[]).some(id=>{const r=s.operativeState[id];return r?.alive&&r.hp>=15&&(r.energy??100)>0&&!r.captured&&!r.asleep&&!r.unconscious&&!r.routed&&!r.surrendered&&!operativeInTransit(s,id)&&!careAssignmentBusy(r.assignment)&&operativeLocation(s,id)===s.location;});
 const hostiles=scene?.units?.some(u=>u.side==='enemy'&&u.hp>=15&&(u.energy??100)>0&&!u.routed&&!u.surrendered&&!u.departure&&!u.fled);
 const reason=s.defeated?'La campaña ha terminado.':s.pendingBattle||s.pendingEncounter?'Salí de la escena táctica antes de comprar munición.':!rules.enabled?'Esta campaña no permite reponer munición de artillería.':
  !gun||parent(sector)!==s.location?'La pieza debe estar emplazada en este sector.':gun.side!=='player'||s.sectors[parent(sector)]?.owner!=='patriot'?'La pieza y el sector deben estar bajo tu control.':
  hostiles?'Aún quedan enemigos capaces de combatir en este sector.':!present?'Se necesita un combatiente disponible de la escuadra en el sector.':!supplied?'El sector debe estar comunicado con el cuartel general.':
  gun.ammo>=rules.reserveLimit?'La reserva de la pieza ya alcanza el límite de reposición.':s.resources.treasury<cost?'No hay suficientes pesos.':'';
 return {available:!reason,reason,cost,limit:rules.reserveLimit};
}
