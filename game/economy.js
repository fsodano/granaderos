import {sectorIncomeDetails} from './sector-income.js';
import {CAMPAIGN_SECTORS} from './data.js';

// Town trade and local contributions funded the independence armies.
// Amounts are game balance values, not reconstructed historical revenue.
export function incomeSources(state){
 return CAMPAIGN_SECTORS.map(sector=>{
  const details=sectorIncomeDetails(state,sector);
  return {id:sector.id,name:sector.name,source:sector.theater==='coast'?'Comercio y aduana':'Contribución local',base:details.base,income:details.daily,status:details.limits.length?details.limits.join(' · '):'Activa'};
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
 const cashKey=id=>id===key||id.startsWith(`${key}:`);
 const carriers=snapshot.units.filter(u=>u.side==='player'&&u.hp>0&&(!snapshot.returnLedger||snapshot.returnLedger.entries.some(e=>e.unitId===String(u.id)&&['resident','departed'].includes(e.kind))));
 const held=carriers.reduce((sum,u)=>sum+Object.entries(u.inventory??{}).reduce((n,[id,item])=>n+(cashKey(id)?item.count:0),0),0);
 if(held!==amount||!snapshot.groundItems?.some(g=>g.id===key&&g.type==='money'&&g.count===0))return;
 state.resources.treasury+=amount;state.foundMoney.push(sectorId);
 const ids=new Set(carriers.map(u=>String(u.id)));
 const records=[...carriers,...Object.entries(state.operativeState).filter(([id])=>ids.has(id)).map(([,unit])=>unit),...(state.sectorStates?.[sectorId]?.units??[]).filter(u=>ids.has(String(u.id)))];
 for(const unit of records){
  const removed=new Set(Object.keys(unit.inventory??{}).filter(cashKey).map(id=>`inventory:${id}`));
  for(const item of removed)delete unit.inventory[item.slice(10)];
  if(removed.has(unit.activeItem)){delete unit.activeItem;if(unit.activeSlot==='item')unit.activeSlot='unarmed';}
  if(removed.has(unit.leftHandItem))unit.leftHandItem=null;
  if(unit.pocketOrder)unit.pocketOrder=unit.pocketOrder.filter(p=>!removed.has(p.item));
 }
 state.log.unshift({hour:state.hour,text:`Se recuperan ${amount} pesos encontrados en el terreno.`});state.log=state.log.slice(0,80);
}
