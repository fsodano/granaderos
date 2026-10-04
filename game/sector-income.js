import {townIncomeSourceForSector,townIncomeSources,dailyTownIncome} from './town-income.js';

// Compatibility for existing callers. Daily town income has no route or
// strategic supply prerequisite; this query now checks local control only.
export const isSectorSupplied=(state,id)=>state.sectors?.[id]?.owner==='patriot';

// Shared-town revenue belongs to its source sector, once. Retiro displays the
// same agreement but cannot duplicate Buenos Aires's port payment.
export function sectorIncomeDetails(state,definition){
 const sectorId=typeof definition==='string'?definition:definition.id,source=townIncomeSourceForSector(sectorId),region=state.sectors?.[sectorId];
 const common={sectorId,loyalty:Math.max(0,Math.min(100,Number(region?.loyalty)||0)),damaged:false,blockaded:false,supplied:null};
 if(!source)return {...common,sourceId:null,eligible:false,controlled:region?.owner==='patriot',activated:false,base:0,daily:0,townDaily:0,limits:['Esta localidad no genera ingresos diarios.']};
 const details=townIncomeSources(state).find(row=>row.id===source.id),primary=sectorId===source.sectorId;
 return {...common,sourceId:source.id,source:details.source,townName:details.name,representative:details.representative,requiredSectors:details.requiredSectors,uncontrolled:details.uncontrolled,eligible:true,controlled:details.controlled,activated:details.activated,base:primary?details.base:0,daily:primary?details.daily:0,townDaily:details.daily,statusCode:details.statusCode,limits:details.statusCode==='active'?[]:[details.status]};
}
export const sectorIncome=(state,definition)=>sectorIncomeDetails(state,definition).daily;
export const totalSectorIncome=dailyTownIncome;
