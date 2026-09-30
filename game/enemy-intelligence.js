import {CAMPAIGN_SECTORS} from './data.js';
import {operativeInTransit,operativeLocation} from './squads.js';

// JA2 map scouting distinguishes counts, presence and no information. The
// neighbor graph and 72-hour report lifetime are Granaderos adaptations.
export const INTELLIGENCE_LIFETIME=72;
const sectors=new Map(CAMPAIGN_SECTORS.map(sector=>[sector.id,sector]));
const active=g=>['marching','waiting','engaged','stationed'].includes(g.status);
const able=u=>u&&u.hp>=15&&!u.captured&&!u.asleep&&!u.unconscious&&!u.routed&&!u.surrendered&&!u.departure;
const location=g=>g.routeIndex>0?g.route[Math.min(g.routeIndex-1,g.route.length-1)]:null;
export function migrateEnemyIntelligence(s){
 if(s.enemyIntelligence===undefined)s.enemyIntelligence={version:1,reports:{}};
 return s.enemyIntelligence;
}
function observers(s,{traveling=[]}={}){
 const seen=new Map(),deployedMilitia=new Set((s.pendingBattle?.garrison??[]).map(u=>String(u.id)));
 for(const sector of CAMPAIGN_SECTORS){
  const militia=s.garrisons?.[sector.id]??[],counts=s.sectors[sector.id]?.militia??[];
  // New paid cohorts can still be count-only. Existing wounded/deployed
  // records occupy their own slots and cannot be replaced by imaginary scouts.
  const unrecorded=counts.some((n,rank)=>n>militia.filter(u=>u.hp>0&&u.militiaRank===rank).length);
  const available=unrecorded||militia.some(u=>able(u)&&!deployedMilitia.has(String(u.id)));
  if(s.sectors[sector.id]?.owner==='patriot'&&available)for(const at of [sector.id,...sector.neighbors])seen.set(at,'militia');
 }
 for(const id of s.recruited??[])if(s.operativeState[id]?.alive&&able(s.operativeState[id])&&!operativeInTransit(s,id)&&!traveling.includes(id)&&!s.pendingBattle?.squad?.some(u=>Number(u.id)===id))seen.set(operativeLocation(s,id),'scouts');
 return seen;
}
function observation(s,g,source){
 return {sector:location(g)??g.target,observedAt:s.hour,source,status:g.status==='marching'?'moving':'present',strength:g.status==='stationed'||source==='contact'||source==='occupation'?null:g.units.filter(u=>u.hp>0&&!u.routed&&!u.departure&&!u.surrendered).length};
}
function currentReports(s,options){
 const reports={},seen=observers(s,options);
 for(const g of s.enemyGroups??[]){
  if(!active(g))continue;
  const at=location(g),source=at&&seen.get(at);
  const contact=s.pendingEncounter?.groupId===g.id||s.pendingBattle?.defenseGroupId===g.id||s.pendingBattle?.occupationGroupIds?.includes(g.id);
  if(source||contact)reports[g.id]=observation(s,g,source||'contact');
 }
 return {reports,seen};
}
function reportState(s,options){
 const live=currentReports(s,options),reports={};
 for(const [id,report] of Object.entries(s.enemyIntelligence?.reports??{})){
  if(s.hour-report.observedAt>INTELLIGENCE_LIFETIME)continue;
  // Scouts at the last reported location can confirm that this group left.
  if(live.seen.has(report.sector)&&!live.reports[id])continue;
  reports[id]=report;
 }
 return {reports:{...reports,...live.reports},live:live.reports};
}
export function refreshEnemyIntelligence(s,options={}){
 const intelligence=migrateEnemyIntelligence(s),{reports}=reportState(s,options);
 intelligence.reports=Object.fromEntries(Object.entries(reports).sort((a,b)=>b[1].observedAt-a[1].observedAt||a[0].localeCompare(b[0])).slice(0,128));
}
export function recordEnemyPresence(s,g){
 migrateEnemyIntelligence(s).reports[g.id]=observation(s,g,'occupation');
}
export function clearEnemyReport(s,id){delete migrateEnemyIntelligence(s).reports[id];}
export function enemyIntelligenceReports(s){
 const {reports,live}=reportState(s);
 return Object.entries(reports).map(([id,r])=>({id,sector:r.sector,observedAt:r.observedAt,source:r.source,status:r.status,strength:r.strength,location:sectors.get(r.sector).name,ageHours:Math.max(0,s.hour-r.observedAt),stale:!live[id]}));
}
export function validateEnemyIntelligence(s){
 const intelligence=migrateEnemyIntelligence(s),object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const need=ok=>{if(!ok)throw Error('Los partes de exploración guardados son inválidos.');};
 need(object(intelligence)&&intelligence.version===1&&object(intelligence.reports)&&Object.keys(intelligence.reports).length<=128);
 for(const [id,r] of Object.entries(intelligence.reports)){
  need(/^enemy-group-[1-9][0-9]*$/.test(id)&&Number(id.slice(12))<s.nextEnemyGroupId&&object(r)&&Object.keys(r).length===5&&Object.keys(r).every(k=>['sector','observedAt','source','status','strength'].includes(k))&&sectors.has(r.sector)&&Number.isInteger(r.observedAt)&&r.observedAt>=0&&r.observedAt<=s.hour&&['scouts','militia','contact','occupation'].includes(r.source)&&['moving','present'].includes(r.status)&&(r.strength===null||Number.isInteger(r.strength)&&r.strength>=0&&r.strength<=30));
 }
}
