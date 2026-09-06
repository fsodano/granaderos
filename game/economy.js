import {CAMPAIGN_SECTORS} from './data.js';

// Town trade and local contributions funded the independence armies.
// Amounts are game balance values, not reconstructed historical revenue.
export function incomeSources(state){
 return CAMPAIGN_SECTORS.map(sector=>{
  const region=state.sectors[sector.id],controlled=region.owner==='patriot';
  const recovering=region.damageUntil>state.hour,blocked=sector.theater==='coast'&&state.blockade;
  const income=controlled?Math.floor(sector.income*(recovering?.25:1)*(blocked?.25:1)):0;
  return {id:sector.id,name:sector.name,source:sector.theater==='coast'?'Comercio y aduana':'Contribución local',base:sector.income,income,status:!controlled?'Ocupada':recovering&&blocked?'En recuperación y bloqueada':recovering?'En recuperación':blocked?'Bloqueada':'Activa'};
 });
}
export function dailyIncome(state){return incomeSources(state).reduce((sum,site)=>sum+site.income,0);}
export function incomeSummary(state){return {daily:dailyIncome(state),hoursUntilPayment:24-state.hour%24};}
export function artilleryCount(state){return ['bronze4','field8','swivel'].reduce((sum,key)=>sum+(state.armory?.[key]??0),0);}


export function sectorCash(sectorId){const index=CAMPAIGN_SECTORS.findIndex(s=>s.id===sectorId);return index<0?0:100+index*10;}
export function collectSectorCash(state,snapshot){
 if(!snapshot)return;
 const sectorId=state.pendingBattle.sector,key=`cash:${sectorId}`,amount=sectorCash(sectorId);
 state.foundMoney??=[];
 if(!amount||state.foundMoney.includes(sectorId))return;
 const carrier=snapshot.units.find(u=>u.side==='player'&&u.hp>0&&Object.entries(u.inventory??{}).some(([id,item])=>id.startsWith(key)&&item.count===amount));
 if(!carrier||!snapshot.groundItems?.some(g=>g.id===key&&g.type==='money'&&g.count===0))return;
 state.resources.treasury+=amount;state.foundMoney.push(sectorId);
 for(const unit of [...snapshot.units,...Object.values(state.operativeState),...(state.sectorStates?.[sectorId]?.units??[])])for(const id of Object.keys(unit.inventory??{}))if(id.startsWith(key))delete unit.inventory[id];
 state.log.unshift({hour:state.hour,text:`Se recuperan ${amount} pesos encontrados en el terreno.`});state.log=state.log.slice(0,80);
}
