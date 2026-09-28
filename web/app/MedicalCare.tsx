'use client';
import {militiaWoundLoss} from '../../game/garrison.js';
import {useState} from 'react';
import {rosterFor,isSupplied,operativeLocation} from '../../game/campaign.js';
import {CARE_ASSIGNMENTS,careAssignmentReason,careStatus,medicalSupplyQuote} from '../../game/medical-care.js';
import {campaignPlace} from '../../game/world-cells.js';
import './squads.css';
export default function MedicalCare({state:s,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const [quantities,setQuantities]=useState<Record<number,number>>({});
 const roster=rosterFor(s),hired=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive);
 return <section className="squads-panel medical-care" aria-label="Atención médica en campaña">
  <h2>Atención médica y descanso</h2>
  <p>Asigná un médico y pacientes en la misma celda controlada. Médico de milicias atiende a los heridos de la guarnición local. Primero se detiene la hemorragia; después se recupera salud. Cada hora de atención consume una venda del médico. Elegí Descanso para recuperar energía y reducir fatiga sin atender pacientes. Para marchar, volvé a ponerlos en servicio.</p>
  {!hired.length?<p>No hay combatientes disponibles.</p>:<div className="squads-personnel squads-table-scroll"><table><thead><tr><th>Combatiente</th><th>Estado</th><th>Asignación</th><th>Vendas</th></tr></thead><tbody>{hired.map(o=>{
   const r=s.operativeState[o.id],quantity=quantities[o.id]??4,quote=medicalSupplyQuote(s,o,quantity,isSupplied(s,s.location));
   return <tr key={o.id} data-care-id={o.id}>
    <th>{o.name}<small>{campaignPlace(operativeLocation(s,o.id))?.name}</small></th>
    <td>{Math.round(r.hp)}/{o.maxHp} salud · {r.bleeding??0} hemorragia<small>Energía: {Math.round(r.energy??100)} · Fatiga: {Math.round(r.fatigue??0)}</small><small>{careStatus(s,o,roster)}</small></td>
    <td><label>Asignación<select aria-label={`Asignación de ${o.name}`} value={r.assignment??'active'} disabled={Boolean(s.pendingBattle)||s.defeated} onChange={e=>dispatch({type:'assignCare',id:o.id,assignment:e.target.value})}>
     {Object.entries(CARE_ASSIGNMENTS).map(([id,label])=>{const reason=careAssignmentReason(s,o,id);return <option key={id} value={id} disabled={Boolean(reason)} title={reason||undefined}>{label}</option>;})}
    </select></label><small>Medicina: {o.medical}</small></td>
    <td>{r.medkits??2} disponibles<label>Cantidad a comprar<input aria-label={`Vendas para ${o.name}`} type="number" min={1} max={20} step={1} value={quantity} onChange={e=>setQuantities(current=>({...current,[o.id]:e.target.valueAsNumber}))}/></label>
     <button className="line-button" disabled={Boolean(s.pendingBattle)||s.defeated||!quote.available} title={quote.reason||undefined} onClick={()=>dispatch({type:'purchaseMedicalSupplies',id:o.id,quantity})}>Comprar vendas · {Number.isFinite(quote.cost)?quote.cost:0} pesos</button>
     {quote.reason&&<small>{quote.reason}</small>}
    </td>
   </tr>;
  })}</tbody></table></div>}
  {(s.garrisons?.[s.location]?.length??0)>0&&<section aria-label="Salud de la guarnición">
   <h3>Guarnición de {campaignPlace(s.location)?.name}</h3>
   <ul>{s.garrisons[s.location].map((u:any,index:number)=><li key={u.id}>{index+1}. {u.name}: {Math.round(u.hp)}/{u.maxHp} salud · {u.bleeding??0} hemorragia<small>{['Cívico','Montonero','Veterano'][u.militiaRank]} · {u.militiaExperience??0} puntos de combate</small>{u.bleeding>0&&<small>Sin atender: pierde {militiaWoundLoss(s,u)} salud/h fuera del combate.</small>}</li>)}</ul>
  </section>}
 </section>;
}
