import {cityForSector} from './cities.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {MILITIA_LIMIT} from './militia.js';
import {materializeGarrisonRank} from './garrison.js';
import {entryFromSector} from './tactical-exits.js';

const sum=counts=>counts.reduce((a,b)=>a+b,0);
const records=(s,id)=>s.garrisons?.[id]??[];
const mobile=u=>u.hp>=15&&!u.bleeding&&!u.unconscious&&!u.asleep&&!u.routed&&!u.surrendered&&(u.energy??100)>10;
const heldCounts=(s,id)=>[0,1,2].map(rank=>records(s,id).filter(u=>u.militiaRank===rank&&!mobile(u)).length);
const trainees=(s,id)=>(s.militiaTraining??[]).filter(t=>t.sector===id).reduce((n,t)=>n+t.count,0);
const safe=(s,id)=>s.sectors[id]?.owner==='patriot'&&!(s.enemyGroups??[]).some(g=>g.target===id&&['waiting','engaged','stationed'].includes(g.status));
const name=id=>CAMPAIGN_SECTORS.find(x=>x.id===id)?.name??id;
function cityPath(s,city,from,to){
 const queue=[[from]],seen=new Set([from]);
 while(queue.length){const path=queue.shift(),at=path.at(-1);if(at===to)return path;
  for(const id of CAMPAIGN_SECTORS.find(x=>x.id===at)?.neighbors??[])if(city.sectors.includes(id)&&safe(s,id)&&!seen.has(id)){seen.add(id);queue.push([...path,id]);}
 }
 return null;
}
export function militiaDistributionStatus(s,sector){
 const city=cityForSector(sector),blocked=reason=>({city,sectors:[],reason});
 if(!city)return blocked('Las milicias solo se redistribuyen dentro de su ciudad.');
 if(s.defeated)return blocked('La campaña ha terminado.');
 if(s.pendingBattle||s.pendingEncounter)return blocked('Resolvé el despliegue o encuentro antes de redistribuir milicias.');
 if(!safe(s,sector))return blocked('La redistribución necesita un sector propio sin ocupación enemiga.');
 const sectors=city.sectors.filter(id=>safe(s,id)&&cityPath(s,city,sector,id));
 return {city,sectors,reason:sectors.length<2?'No hay otro sector propio conectado en esta ciudad.':''};
}
export function militiaTransferPreview(s,{from,to,rank,count}){
 const status=militiaDistributionStatus(s,from),bad=reason=>({valid:false,reason,available:0,room:0});
 if(status.reason)return bad(status.reason);
 if(from===to||!status.sectors.includes(to))return bad('Elegí otro sector propio conectado de la misma ciudad.');
 if(![0,1,2].includes(rank)||!Number.isInteger(count)||count<1||count>MILITIA_LIMIT)return bad('Elegí un grado y una cantidad entera entre 1 y 60.');
 const available=s.sectors[from].militia[rank]-heldCounts(s,from)[rank],room=Math.max(0,MILITIA_LIMIT-sum(s.sectors[to].militia)-trainees(s,to));
 return {valid:count<=available&&count<=room,available,room,reason:count>available?'No hay suficientes defensores de ese grado en condiciones de trasladarse.':count>room?'El destino no tiene espacio; la instrucción también reserva plazas.':''};
}
export function militiaDistributionPreview(s,sector){
 const status=militiaDistributionStatus(s,sector);if(status.reason)return {...status,valid:false};
 const {sectors}=status,targets=Object.fromEntries(sectors.map(id=>[id,heldCounts(s,id)])),used=Object.fromEntries(sectors.map(id=>[id,sum(targets[id])+trainees(s,id)]));
 const total=sectors.reduce((n,id)=>n+sum(s.sectors[id].militia)+trainees(s,id),0);
 if(total>sectors.length*MILITIA_LIMIT||sectors.some(id=>used[id]>MILITIA_LIMIT))return {...status,valid:false,reason:'No hay plazas para distribuir a todos los defensores. Trasladá grupos por separado.'};
 // Share experienced ranks first. Capacity includes immobile patients and
 // reserved trainees; neither can be teleported out of their existing custody.
 for(const rank of [2,1,0]){
  const count=sectors.reduce((n,id)=>n+s.sectors[id].militia[rank]-targets[id][rank],0);
  for(let n=0;n<count;n++){
   const target=sectors.filter(id=>used[id]<MILITIA_LIMIT).sort((a,b)=>used[a]-used[b]||targets[a][rank]-targets[b][rank]||Number(s.sectors[b].militia[rank]>targets[b][rank])-Number(s.sectors[a].militia[rank]>targets[a][rank]))[0];
   targets[target][rank]++;used[target]++;
  }
 }
 const changed=sectors.some(id=>targets[id].some((count,rank)=>count!==s.sectors[id].militia[rank]));
 return {...status,valid:changed,targets,reason:changed?'':'Los defensores ya están distribuidos.'};
}
function transfer(s,city,from,to,rank,count){
 const existing=records(s,from).filter(u=>u.militiaRank===rank),available=existing.filter(mobile);
 materializeGarrisonRank(s,from,rank,existing.length+Math.max(0,count-available.length));
 const selected=records(s,from).filter(u=>u.militiaRank===rank&&mobile(u)).sort((a,b)=>a.id-b.id).slice(0,count),ids=new Set(selected.map(u=>u.id));
 if(selected.length!==count)throw Error('Los defensores ya no están disponibles.');
 const path=cityPath(s,city,from,to),entry=entryFromSector(path.at(-2),to);if(!entry)throw Error('El destino no tiene una entrada válida.');
 s.garrisons[from]=records(s,from).filter(u=>!ids.has(u.id));s.garrisons[to]??=[];
 for(const u of selected){u.entryReason='arrival';u.entryEdge=entry.entryEdge;u.entryAnchor={...entry.entryAnchor};s.garrisons[to].push(u);}
 s.sectors[from].militia[rank]-=count;s.sectors[to].militia[rank]+=count;
}
export function redistributeMilitia(s,action){
 if(action.type==='transferMilitia'){
  const preview=militiaTransferPreview(s,action);if(!preview.valid)throw Error(preview.reason);
  transfer(s,cityForSector(action.from),action.from,action.to,action.rank,action.count);
  return `${action.count} defensores se trasladan de ${name(action.from)} a ${name(action.to)} con su equipo y sus heridas.`;
 }
 const preview=militiaDistributionPreview(s,action.sector);if(!preview.valid)throw Error(preview.reason);
 for(const rank of [2,1,0])for(const from of preview.sectors){
  let surplus=s.sectors[from].militia[rank]-preview.targets[from][rank];if(surplus<=0)continue;
  for(const to of preview.sectors){const count=Math.min(surplus,preview.targets[to][rank]-s.sectors[to].militia[rank]);if(count<=0)continue;transfer(s,preview.city,from,to,rank,count);surplus-=count;}
 }
 return `Las milicias se distribuyen entre los sectores propios conectados de ${preview.city.name}. Los heridos inestables y los alumnos conservan su destino.`;
}
