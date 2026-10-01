import {workshopAccessReason} from './workshop-access.js';
export {workshopAccessReason} from './workshop-access.js';
import {careRules} from './campaign-care-rules.js';
import {refillCost,firearmRepairCost,needsResupply} from './equipment.js';

export function workshopServiceQuote(s,op,service,supplied){
 if(!['resupply','repairWeapon'].includes(service))return {available:false,cost:0,reason:'El servicio de taller no existe.'};
 const r=s.operativeState[op?.id],cost=r?(service==='resupply'?refillCost(r,careRules(s).dressingPrice):firearmRepairCost(r)):0;
 const complete=r&&(service==='resupply'?!needsResupply(r):cost===0);
 const reason=workshopAccessReason(s,op,supplied)||(complete?(service==='resupply'?'Las provisiones ya están completas.':'El arma ya está en perfecto estado.'):s.resources.treasury<cost?'No hay suficientes pesos.':'');
 return {available:!reason,cost,reason};
}
