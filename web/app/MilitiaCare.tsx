import {operativeLocation,operativeInTransit} from '../../game/squads.js';
import {careAssignmentReason} from '../../game/medical-care.js';
import {militiaWoundLoss} from '../../game/garrison.js';
export default function MilitiaCare({state,sectorId,roster}:{state:any;sectorId:string;roster:any[]}){
 const defenders=(state.garrisons?.[sectorId]??[]).filter((u:any)=>u.hp>0);
 const wounded=defenders.filter((u:any)=>u.bleeding>0||u.hp<u.maxHp);
 const doctors=roster.filter(op=>state.recruited.includes(op.id)&&state.operativeState[op.id]?.alive&&!operativeInTransit(state,op.id)&&operativeLocation(state,op.id)===sectorId&&state.operativeState[op.id].assignment==='militia_doctor');
 const available=doctors.filter(op=>!careAssignmentReason(state,op,'militia_doctor'));
 const fighting=state.pendingBattle?.sector===sectorId;
 const reason=fighting?'La atención de campaña espera hasta el regreso del despliegue.':state.sectors[sectorId]?.owner!=='patriot'?'La atención necesita un sector seguro.':!wounded.length?'No hay milicianos heridos en la guarnición.':!doctors.length?'Asigná a un combatiente presente como «Médico de milicias».':!available.length?'Los médicos asignados no pueden trabajar. Revisá sus botiquines, energía y descanso.':`Atención a cargo de ${available.map(op=>op.nickname??op.name).join(', ')}.`;
 return <section className="militia-care" aria-label="Atención de las milicias">
  <h3>Atención de las milicias</h3>
  <p>{state.sectors[sectorId]?.militia.reduce((sum:number,count:number)=>sum+count,0)??0} defensores · {wounded.length} {wounded.length===1?'herido registrado':'heridos registrados'}</p>
  <p role="status">{reason}</p>
  {wounded.length>0&&<ul>{wounded.map((u:any,index:number)=><li key={u.id}>{u.name} {index+1} · Salud {u.hp}/{u.maxHp}{u.bleeding>0?` · Hemorragia ${u.bleeding}`:u.hp<15?' · Estado crítico':' · Heridas estabilizadas'}</li>)}</ul>}
  {defenders.length>0&&<details aria-label="Salud de la guarnición"><summary>Salud y experiencia de los defensores</summary><ul>{defenders.map((u:any)=><li key={u.id}>{u.name} · {['Cívico','Montonero','Veterano'][u.militiaRank]??'Miliciano'} · {u.militiaExperience??0} puntos de combate · {u.hp}/{u.maxHp} salud · {u.bleeding??0} hemorragia{u.bleeding>0?` · pierde ${militiaWoundLoss(state,u)} salud/h fuera del combate`:''}</li>)}</ul></details>}
  <p>Un médico atiende a un defensor por hora y consume un botiquín personal. Primero detiene las hemorragias; después recupera salud. Los defensores conservan sus armas, munición y experiencia.</p>
 </section>;
}
