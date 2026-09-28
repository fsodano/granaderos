'use client';
import {useState} from 'react';
import {militiaProgression} from '../../game/militia-progression-rules.js';
import {careAssignmentBusy} from '../../game/medical-care.js';
import {rosterFor,operativeLocation,isSupplied,militiaCourse,militiaAssignment} from '../../game/campaign.js';
import {militiaPromotionStatus} from '../../game/garrison.js';
import {militiaEligibility,MILITIA_LIMIT,MILITIA_COHORT} from '../../game/militia.js';
export default function MilitiaTraining({state:s,sectorId,dispatch}:{state:any;sectorId:string;dispatch:(action:any)=>void}){
 const [choice,setChoice]=useState<number|null>(null),[trainerId,setTrainerId]=useState('');
 const sector=s.sectors[sectorId],eligibility=militiaEligibility(s,sectorId),training=s.militiaTraining?.find((t:any)=>t.sector===sectorId);
 const roster=rosterFor(s),hired=s.recruited.map((id:number)=>roster.find(o=>o.id===id)).filter(Boolean);
 const trainers=hired.filter((o:any)=>s.operativeState[o.id]?.alive&&operativeLocation(s,o.id)===sectorId&&o.leadership>=30&&!militiaAssignment(s,o.id)&&!careAssignmentBusy(s.operativeState[o.id].assignment)).sort((a:any,b:any)=>militiaCourse(a,0).hours-militiaCourse(b,0).hours);
 const trainer=trainers.find((o:any)=>String(o.id)===trainerId)??trainers[0],rank=choice??(sector.militia[0]>=MILITIA_COHORT?1:0),course=trainer?militiaCourse(trainer,rank):null;
 const promotion=rank===1?militiaPromotionStatus(s,sectorId,rank):null,total=sector.militia.reduce((a:number,b:number)=>a+b,0),progression=militiaProgression(s),supplied=isSupplied(s,sectorId);
 const shortage=Math.max(0,(course?.cost.treasury??0)-s.resources.treasury);
 const reason=s.defeated?'La campaña terminó.':s.pendingBattle?'Volvé del despliegue antes de iniciar un curso.':!trainer?'Necesitás un instructor disponible.':!supplied?'La instrucción necesita abastecimiento.':rank===0&&total+MILITIA_COHORT>MILITIA_LIMIT?`La guarnición admite ${MILITIA_LIMIT} milicianos; no hay lugar para otros ${MILITIA_COHORT}.`:promotion&&!promotion.ready?promotion.reason:shortage>0?`${shortage===1?'Falta 1 peso':`Faltan ${shortage} pesos`} para este curso.`:'';
 return <section className="simple-militia"><h3>Milicias</h3>
  <p>{total} defensores</p><p>{sector.militia[0]} {sector.militia[0]===1?'cívico':'cívicos'} · {sector.militia[1]} {sector.militia[1]===1?'montonero':'montoneros'} · {sector.militia[2]} {sector.militia[2]===1?'veterano':'veteranos'}</p>
  <small>Los veteranos ascienden por experiencia de combate. Montonero: {progression.regularThreshold} puntos · Veterano: {progression.veteranThreshold} puntos.</small>
  {training?<><p>{training.count} en instrucción · {training.remaining} h</p>
   {training.trainees&&<ul aria-label="Milicianos en instrucción">{training.trainees.map((u:any)=><li key={u.id}>{u.name} · {Math.round(u.hp)}/{u.maxHp} salud</li>)}</ul>}
   {(!eligibility.eligible||!supplied)&&<small>Instrucción detenida: {!eligibility.eligible?eligibility.reason:'falta abastecimiento.'}</small>}
   <button className="line-button" onClick={()=>dispatch({type:'cancelMilitia',sector:sectorId})}>Suspender instrucción</button>
  </>:!eligibility.eligible?<p className="muted">{eligibility.reason}</p>:<>
   <label>Tipo de instrucción<select aria-label="Tipo de instrucción de milicias" value={rank} onChange={e=>setChoice(Number(e.target.value))}>
    <option value={0}>Formar tres nuevos cívicos</option><option value={1}>Ascender tres cívicos a montoneros</option>
   </select></label>
   <label>Instructor<select aria-label="Instructor de milicias" value={trainer?.id??''} onChange={e=>setTrainerId(e.target.value)}>{!trainers.length&&<option value="">Necesitás un instructor disponible</option>}{trainers.map((o:any)=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select></label>
   <button className="line-button" disabled={Boolean(reason)} onClick={()=>dispatch({type:'militia',sector:sectorId,rank,trainerId:trainer?.id})}>Entrenar milicias{course?` · ${course.cost.treasury} pesos`:''}</button>
   {course&&<small>{course.hours} horas · {rank===0?'Tres nuevos defensores':'Promover tres defensores: conservan su salud, armas y suministros.'}</small>}
   {reason&&<p className="notice">{reason}</p>}
  </>}
 </section>;
}
