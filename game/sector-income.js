import {CAMPAIGN_SECTORS} from './data.js';

// This route is shared by the payment and the displayed local-income details.
export function isSectorSupplied(state,id){
 const origin=state.contentCampaign?.package.headquarters??'retiro';
 if(state.sectors[id]?.owner!=='patriot'||state.sectors[origin]?.owner!=='patriot')return false;
 const seen=new Set([origin]),queue=[origin];
 while(queue.length){const here=queue.shift();for(const next of CAMPAIGN_SECTORS.find(sector=>sector.id===here).neighbors){if(!seen.has(next)&&state.sectors[next]?.owner==='patriot'){seen.add(next);queue.push(next);}}}
 return seen.has(id);
}

// Local cooperation limits revenue, as town loyalty limits JA2 mine output.
// Sector bases and disruption factors are Granaderos campaign tuning.
export function sectorIncomeDetails(state,definition,isSupplied=isSectorSupplied){
 const region=state.sectors[definition.id];
 const controlled=region?.owner==='patriot',loyalty=Math.max(0,Math.min(100,region?.loyalty??0));
 const damaged=Boolean(region?.damageUntil>state.hour),blockaded=definition.theater==='coast'&&Boolean(state.blockade);
 const supplied=controlled&&isSupplied(state,definition.id);
 const base=definition.income;
 const daily=controlled?Math.floor(base*loyalty/100*(damaged?.25:1)*(blockaded?.25:1)*(supplied?1:.5)):0;
 const limits=!controlled?['Ocupación realista']:[...(loyalty<100?[`Lealtad local: ${loyalty}%`]:[]),...(damaged?['Daños: conserva el 25%']:[]),...(blockaded?['Bloqueo: conserva el 25%']:[]),...(!supplied?['Sin abastecimiento: conserva el 50%']:[])];
 return {sectorId:definition.id,base,loyalty,controlled,damaged,blockaded,supplied,daily,limits};
}
export const sectorIncome=(state,definition,isSupplied)=>sectorIncomeDetails(state,definition,isSupplied).daily;
export const totalSectorIncome=(state,isSupplied)=>CAMPAIGN_SECTORS.reduce((sum,definition)=>sum+sectorIncome(state,definition,isSupplied),0);
