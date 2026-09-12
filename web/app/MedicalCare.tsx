'use client';
import {operativeInTransit} from '../../game/squads.js';
import {maximumEnergy} from '../../game/fatigue.js';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,isSupplied,operativeLocation,rosterFor,WEAPONS} from '../../game/campaign.js';
import {CARE_ASSIGNMENTS,ALL_ASSIGNMENTS,MEDICAL_KIT_PRICE,careAssignmentReason,careStatus} from '../../game/medical-care.js';
import {WORK_ASSIGNMENTS,STUDY_SKILLS,TOOLKIT_PRICE,TOOLKIT_POINTS,workAssignmentReason,workStatus,repairEquipmentQueue} from '../../game/assignments.js';
import {sleepNeedStatus} from '../../game/sleep-needs.js';
import {sleepOrderReason} from '../../game/sleep.js';
import {moraleStatus} from '../../game/morale.js';
import {equipmentInventoryUsage,medicalSupplyStock,MEDICAL_STOCK_CAP,MEDICAL_DAILY_RESTOCK} from '../../game/equipment.js';
import './medical-care.css';
const equipment=WEAPONS as Record<number,{capacity?:number;name:string}>;

export function MedicalSupplyPurchase({s,op,blocked,pharmacy,dispatch}:{s:any;op:any;blocked:boolean;pharmacy:boolean;dispatch:(action:any)=>void}){
  const record=s.operativeState[op.id],quantity=Math.min(5,medicalSupplyStock(s)),price=quantity*MEDICAL_KIT_PRICE;
  const fits=!equipmentInventoryUsage(s,op).overloaded&&!equipmentInventoryUsage(s,op,{medkits:(record.medkits??0)+quantity}).overloaded;
  const reason=!quantity?'La maestranza no tiene botiquines disponibles.':!fits?`No queda espacio para ${quantity} botiquines.`:pharmacy?'Entrega inmediata al combatiente.':'Reuní al combatiente y su escuadra en una maestranza abastecida.';
  return <div className="care-supplies"><span>{record.medkits??2} botiquines</span><button className="line-button" disabled={blocked||!record.alive||!pharmacy||quantity<1||!fits||s.resources.treasury<price} title={reason} onClick={()=>dispatch({type:'purchaseMedicalSupplies',operativeId:op.id,quantity})}>{quantity?`Comprar ${quantity} · ${price} pesos`:'Botiquines agotados'}</button></div>;
}

function PersonnelCard({s,op,roster,blocked,pharmacy,dispatch}:{s:any;op:any;roster:any[];blocked:boolean;pharmacy:boolean;dispatch:(action:any)=>void}){
  const record=s.operativeState[op.id],maxHp=record.maxHp??op.maxHp;
  const [skill,setSkill]=useState(record.trainingSkill??'marksmanship'),[teacherId,setTeacherId]=useState(String(record.instructorId??'')),[targetId,setTargetId]=useState(String(record.repairTargetId??op.id)),[repairScope,setRepairScope]=useState(record.repairScope??(record.assignment==='repair'?'primary':'equipment'));
  const instructors=roster.filter(o=>o.id!==op.id&&s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&!operativeInTransit(s,o.id)&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&s.operativeState[o.id].assignment==='instructor'&&s.operativeState[o.id].trainingSkill===skill&&o[skill]>op[skill]);
  const teacher=instructors.find(o=>String(o.id)===teacherId)??instructors[0];
  const targets=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&!operativeInTransit(s,o.id)&&operativeLocation(s,o.id)===operativeLocation(s,op.id)&&(repairScope==='equipment'||(equipment[o.weapon]?.capacity??0)>0));
  const target=targets.find(o=>String(o.id)===targetId)??targets[0];
  const work=Object.hasOwn(WORK_ASSIGNMENTS,record.assignment??'active');
  const usage=equipmentInventoryUsage(s,op),sleepReason=sleepOrderReason(s,op.id,!record.asleep);
  const options={skill,instructorId:teacher?.id,targetId:target?.id,repairScope};
  const repairQueue=target&&repairScope==='equipment'?repairEquipmentQueue(s.operativeState[target.id],target):[];
  const reason=(assignment:string)=>Object.hasOwn(CARE_ASSIGNMENTS,assignment)?careAssignmentReason(s,op,assignment):workAssignmentReason(s,op,assignment,options,roster);
  const assign=(assignment:string)=>dispatch(Object.hasOwn(CARE_ASSIGNMENTS,assignment)?{type:'assignCare',operativeId:op.id,assignment}:{type:'assignWork',operativeId:op.id,assignment,...options});
  return <article className={`care-record${record.bleeding>0?' care-bleeding':''}`}>
    <div className="care-name"><h3>{op.nickname}</h3><span>Medicina {op.medical} · Mecánica {op.mechanical}</span></div>
    <div className="care-vitals"><label>Salud <strong>{record.hp}/{maxHp}</strong><meter aria-label={`Salud de ${op.nickname}`} min={0} max={maxHp} value={record.hp}/></label><label>Energía <strong>{Math.round(record.energy??100)}/{maximumEnergy(record)}</strong><meter aria-label={`Energía de ${op.nickname}`} min={0} max={maximumEnergy(record)} value={record.energy??100}/></label></div>
    <p className="care-condition">{!record.alive?'Caído':record.bleeding>0?`Hemorragia ${record.bleeding} · necesita atención`:record.hp<15?'Estado crítico · necesita un médico':record.bandaged>0?`${record.bandaged} puntos de herida vendada`:'Sin hemorragia'} · Fatiga {record.fatigue}</p>
    <p className="care-condition">{sleepNeedStatus({...op,...record})}</p>
    <p className="care-condition">{moraleStatus(s,op.id)}</p>
    <label className="care-order">Asignación<select aria-label={`Asignación de ${op.nickname}`} value={record.assignment??'active'} disabled={blocked||!record.alive} onChange={event=>assign(event.target.value)}>{Object.entries(ALL_ASSIGNMENTS).map(([value,label])=>{const why=reason(value);return <option key={value} value={value} disabled={Boolean(why)} title={why}>{label}</option>;})}</select></label>
    <button className="line-button" aria-label={`${record.asleep?'Despertar':'Dormir'}: ${op.nickname}`} disabled={blocked||Boolean(sleepReason)} title={sleepReason||'Conserva su asignación mientras duerme.'} onClick={()=>dispatch({type:'setSleep',operativeId:op.id,asleep:!record.asleep})}>{record.asleep?'Despertar':'Dormir'}</button>
    <p className="care-status" aria-live="polite">{work?workStatus(s,op,roster):careStatus(s,op,roster)}</p>
    <details className="care-work" open={work||undefined}><summary>Preparar práctica o reparación</summary><div>
      <label>Habilidad<select aria-label={`Habilidad de ${op.nickname}`} value={skill} disabled={blocked||!record.alive} onChange={event=>setSkill(event.target.value)}>{Object.entries(STUDY_SKILLS).map(([value,label])=><option key={value} value={value} disabled={(op[value]??0)<=0}>{label} · {op[value]??0}</option>)}</select></label>
      <label>Instructor<select aria-label={`Instructor de ${op.nickname}`} value={teacher?.id??''} disabled={blocked||!record.alive} onChange={event=>setTeacherId(event.target.value)}>{!instructors.length&&<option value="">Sin instructor de esta habilidad</option>}{instructors.map(o=><option key={o.id} value={o.id}>{o.nickname} · {o[skill]}</option>)}</select></label>
      <label>Equipo de<select aria-label={`Equipo para reparar de ${op.nickname}`} value={target?.id??''} disabled={blocked||!record.alive} onChange={event=>setTargetId(event.target.value)}>{!targets.length&&<option value="">No hay combatientes presentes</option>}{targets.map(o=><option key={o.id} value={o.id}>{o.nickname}{repairScope==='primary'?` · ${s.operativeState[o.id].condition}%`:''}</option>)}</select></label>
      <label>Reparar<select aria-label={`Alcance de reparación de ${op.nickname}`} value={repairScope} disabled={blocked||!record.alive} onChange={event=>setRepairScope(event.target.value)}><option value="equipment">Todo el equipo llevado</option><option value="primary">Solo el arma principal actual</option></select></label>
      {repairScope==='equipment'&&<div aria-label={`Orden de reparación de ${op.nickname}`}><small>Secundaria → principal y bayoneta → mochila. La lista sigue el equipo que lleve esta persona.</small>{repairQueue.length?<ol>{repairQueue.slice(0,4).map((item:any)=><li key={item.key}>{item.label}{item.count>1?` × ${item.count}`:''} · {Math.round(item.condition)}%{item.jammed?' · atascada':''}</li>)}</ol>:<p>No hay equipo dañado ni armas atascadas.</p>}{repairQueue.length>4&&<small>Y {repairQueue.length-4} entradas más.</small>}</div>}
      {work&&<button className="line-button" disabled={blocked||Boolean(reason(record.assignment))} onClick={()=>assign(record.assignment)}>Aplicar selección</button>}
      <small>Primero asigná un instructor. Después elegí su alumno y la misma habilidad. Cada instructor atiende a un alumno.</small>
    </div></details>
    <MedicalSupplyPurchase s={s} op={op} blocked={blocked} pharmacy={pharmacy} dispatch={dispatch}/>
    <p className="care-condition">Mochila: {usage.used}/{usage.capacity} espacios con la reserva de cartuchos.</p>
    <div className="care-supplies"><span>{record.toolkitPoints??0} puntos de herramientas</span><button className="line-button" disabled={blocked||!record.alive||!pharmacy||s.resources.treasury<TOOLKIT_PRICE} title="Las herramientas se venden en las maestranzas abastecidas." onClick={()=>dispatch({type:'purchaseToolkits',operativeId:op.id})}>Comprar {TOOLKIT_POINTS} · {TOOLKIT_PRICE} pesos</button></div>
    <p className="care-condition">{equipment[op.weapon]?.name??'Arma equipada'} · Condición {record.condition}%</p>
  </article>;
}

export default function MedicalCare({state:s,sectorId,dispatch}:{state:any;sectorId:string;dispatch:(action:any)=>void}){
  const roster=rosterFor(s),personnel=roster.filter(o=>s.recruited.includes(o.id)&&!operativeInTransit(s,o.id)&&operativeLocation(s,o.id)===sectorId);
  const blocked=Boolean(s.pendingBattle||s.pendingEncounter)||s.defeated;
  const pharmacy=sectorId===s.location&&['retiro','cordoba','mendoza'].includes(sectorId)&&isSupplied(s,sectorId);
  const place=CAMPAIGN_SECTORS.find(o=>o.id===sectorId);
  return <section className="medical-care" aria-labelledby="medical-care-title">
    <header><div><p className="eyebrow">PERSONAL EN {place?.grid}</p><h2 id="medical-care-title">Asignaciones del personal</h2></div><p>Organizá la atención, el descanso, la práctica y las reparaciones. Cada trabajo necesita tiempo y personal presente en un sector seguro.</p></header>
    {['retiro','cordoba','mendoza'].includes(sectorId)&&<p className="care-condition" role="status">Maestranza: {medicalSupplyStock(s,sectorId)}/{MEDICAL_STOCK_CAP} botiquines disponibles. Repone {MEDICAL_DAILY_RESTOCK} cada 24 horas de abastecimiento; próxima reposición en {24-(s.merchants?.[sectorId]?.restockHours??0)} horas abastecidas.</p>}
    {!personnel.length?<p className="care-empty">No hay combatientes contratados en {place?.name}.</p>:<div className="care-personnel">{personnel.map(op=><PersonnelCard key={op.id} s={s} op={op} roster={roster} blocked={blocked} pharmacy={pharmacy} dispatch={dispatch}/>)}</div>}
    <p className="care-help">Las vendas detienen la hemorragia; el médico recupera salud con botiquines. El descanso recupera energía y 1 de salud cada 6 horas sin hemorragia, salvo heridas críticas. La práctica mejora habilidades de forma gradual; un instructor con más habilidad acelera el aprendizaje. Reparar consume herramientas para mantener armas, bayonetas y herramientas llevadas. Desatascar un arma también consume un punto; no repone munición. La fatiga limita la energía máxima. El personal agotado duerme automáticamente y retoma su tarea al recuperarse. Dormir conserva la asignación y recupera energía más rápido que estar en servicio sin actividad. Para marchar, despertá al personal y elegí «En servicio» o dejá al personal en otra escuadra.</p>
  </section>;
}
