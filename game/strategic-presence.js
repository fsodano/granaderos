import {enemyIntelligenceReports} from './enemy-intelligence.js';
import {operativeInTransit,operativeLocation} from './squads.js';
import {worldCell} from './world-cells.js';
import {strategicSector} from './deployment-return.js';

const present=unit=>unit?.hp>0&&!unit.captured&&!unit.surrendered&&!unit.departure&&!unit.fled;

// Map markers are a read model. Enemy numbers come only from admitted reports,
// never from hidden group units or retained tactical scenes.
export function strategicSectorPresence(state,battle=null){
 const rows=new Map();
 const at=location=>{
  const cell=worldCell(location);if(!cell)return null;
  if(!rows.has(cell.location))rows.set(cell.location,{sector:cell.location,players:[],militia:0,enemies:0,unknownEnemy:false,staleEnemy:false,enemyAgeHours:0});
  return rows.get(cell.location);
 };
 for(const id of new Set(state.recruited??[])){
  const record=state.operativeState[id];
  if(!record?.alive||record.hp<=0||record.captured||record.departure||record.fled||operativeInTransit(state,id))continue;
  at(operativeLocation(state,id))?.players.push(id);
 }
 for(const [sector,record]of Object.entries(state.sectors)){
  const row=at(sector);if(!row)continue;
  row.militia=record.owner==='patriot'?record.militia.reduce((sum,count)=>sum+count,0):0;
  // Occupation is already public map information; its garrison size is not.
  row.unknownEnemy=record.owner==='royalist';
 }
 // Promotion reserves existing local soldiers outside the deployable totals.
 // New rank-zero courses have no soldiers to display before completion.
 const militiaIds=new Set([...Object.values(state.garrisons??{}).flat(),...(state.pendingBattle?.garrison??[])].map(unit=>String(unit.id)));
 for(const course of state.militiaTraining??[]){
  if(course.rank<=0||state.sectors[course.sector]?.owner!=='patriot')continue;
  const row=at(course.sector);if(!row)continue;
  if(course.trainees===undefined){row.militia+=course.count;continue;} // Earlier saved promotions kept counts only.
  for(const unit of course.trainees){
   const id=String(unit.id);if(!present(unit)||militiaIds.has(id))continue;
   militiaIds.add(id);row.militia++;
  }
 }
 // The map can be opened before a tactical casualty/exit is settled. Read only
 // our live actors from that scene; its hostile actors are never map evidence.
 if(battle&&state.pendingBattle?.id===battle.battleId){
  const row=at(strategicSector(state.pendingBattle));
  if(row){
   const own=(battle.units??[]).filter(unit=>unit.side==='player'),issued=new Set((state.pendingBattle.squad??[]).map(unit=>String(unit.id)));
   for(const unit of own)if(!unit.militia)issued.add(String(unit.id));
   for(const existing of rows.values())existing.players=existing.players.filter(id=>!issued.has(String(id)));
   row.players.push(...own.filter(unit=>!unit.militia&&present(unit)).map(unit=>unit.id));
   const deployedMilitia=new Set((state.pendingBattle.garrison??[]).map(unit=>String(unit.id)));
   row.militia=Math.max(0,row.militia-deployedMilitia.size)+own.filter(unit=>unit.militia&&deployedMilitia.has(String(unit.id))&&present(unit)).length;
  }
 }
 const observed=new Map();
 for(const report of enemyIntelligenceReports(state)){
  const row=at(report.sector);if(!row)continue;
  if(!observed.has(row.sector))observed.set(row.sector,{count:0,unknown:false,stale:false,age:0});
  const knowledge=observed.get(row.sector);
  if(report.strength===null||report.stale)knowledge.unknown=true;
  else knowledge.count+=report.strength;
  knowledge.stale||=report.stale;
  knowledge.age=Math.max(knowledge.age,report.ageHours);
 }
 for(const [sector,knowledge]of observed){
  const row=rows.get(sector);
  row.enemies=knowledge.count;row.unknownEnemy=knowledge.unknown;row.staleEnemy=knowledge.stale;row.enemyAgeHours=knowledge.age;
 }
 return [...rows.values()].filter(row=>row.players.length||row.militia||row.enemies||row.unknownEnemy);
}

export function strategicPresenceLabel(row){
 if(!row)return '';
 const parts=[];
 if(row.players.length)parts.push(`${row.players.length} combatientes propios`);
 if(row.militia)parts.push(`${row.militia} milicianos`);
 if(row.enemies)parts.push(`${row.enemies} realistas observados`);
 if(row.unknownEnemy)parts.push(row.staleEnemy?`Último parte hace ${row.enemyAgeHours} h; presencia actual sin confirmar`:'Fuerza realista sin confirmar');
 return parts.join(' · ');
}

export function strategicTravelPresence(state,squad){
 return squad.members.filter(id=>{
  const record=state.operativeState[id];
  return state.recruited.includes(id)&&record?.alive&&record.hp>0&&!record.captured&&!record.departure&&!record.fled;
 });
}
