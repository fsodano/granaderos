import {careRules} from './campaign-care-rules.js';
import {operativeLocation} from './squads.js';
import {worldOwner} from './world-cells.js';
import {hasWorkshop} from './campaign-headquarters.js';
import {refillCost,firearmRepairCost,needsResupply} from './equipment.js';

export function workshopAccessReason(s,op,supplied){
 if(s.defeated)return 'La campaña ha terminado.';
 if(s.pendingBattle)return 'Resolvé la escena táctica antes de usar el taller.';
 if(!op||!s.recruited.includes(op.id)||!s.operativeState[op.id]?.alive||s.operativeState[op.id].captured)return 'El combatiente no está disponible.';
 if(operativeLocation(s,op.id)!==s.location)return 'El combatiente debe estar en el mismo taller que la escuadra seleccionada.';
 if(!hasWorkshop(s,s.location)||worldOwner(s,s.location)!=='patriot'||!supplied)return 'Debes llegar a un taller bajo tu control y comunicado con el cuartel general.';
 return '';
}

export function workshopServiceQuote(s,op,service,supplied){
 if(!['resupply','repairWeapon'].includes(service))return {available:false,cost:0,reason:'El servicio de taller no existe.'};
 const r=s.operativeState[op?.id],cost=r?(service==='resupply'?refillCost(r,careRules(s).dressingPrice):firearmRepairCost(r)):0;
 const complete=r&&(service==='resupply'?!needsResupply(r):cost===0);
 const reason=workshopAccessReason(s,op,supplied)||(complete?(service==='resupply'?'Las provisiones ya están completas.':'El arma ya está en perfecto estado.'):s.resources.treasury<cost?'No hay suficientes pesos.':'');
 return {available:!reason,cost,reason};
}
