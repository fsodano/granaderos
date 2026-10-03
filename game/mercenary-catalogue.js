import {contractQuote} from './contracts.js';
import {pendingHire} from './hiring-arrivals.js';
// Catalogue queries do not change campaign state or contract rules.
const normalize=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');
export function filterMercenaries(roster,state,{query='',specialty='all',availability='all',sort='name'}={}){
 const needle=normalize(query.trim());
 const fields={marksman:'marksmanship',medic:'medical',mechanic:'mechanical',artillery:'explosives',leader:'leadership'};
 const visible=roster.filter(op=>{
  if(needle&&!normalize(`${op.name} ${op.nickname} ${op.role}`).includes(needle))return false;
  if(specialty in fields&&op[fields[specialty]]<70)return false;
  if(specialty==='scout'&&!op.traits.includes('guerrilla_tactician'))return false;
  if(specialty==='rider'&&!op.traits.some(t=>['expert_rider','cavalry_commander'].includes(t)))return false;
  const alive=state.operativeState?.[op.id]?.alive!==false,hired=state.recruited.includes(op.id);
  return availability==='available'?alive&&!hired&&!pendingHire(state,op.id)&&!state.operativeState?.[op.id]?.captured:availability==='pending'?Boolean(pendingHire(state,op.id)):availability==='hired'?hired:availability==='fallen'?!alive:true;
 });
 const daily=op=>contractQuote(state,op,'day').daily;
 return visible.sort((a,b)=>(sort==='price'?daily(a)-daily(b):sort==='marksmanship'?b.marksmanship-a.marksmanship:sort==='medical'?b.medical-a.medical:0)||a.name.localeCompare(b.name,'es'));
}
