'use client';
import {DEFAULT_MILITIA_PATROL,MILITIA_PATROL_FIELDS} from '../../../game/militia-patrol-rules.js';
export default function MilitiaPatrolRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.militiaPatrol??DEFAULT_MILITIA_PATROL;
 return <section aria-label="Reglas de patrulla de milicias">
  <h2>Patrullas de milicias</h2>
  <label>Activar patrullas y búsqueda de milicias<input type="checkbox" checked={rules.enabled} onChange={e=>onChange({...draft,militiaPatrol:{...rules,enabled:e.target.checked}})}/></label>
  <p>Las patrullas siguen puntos fijos del mapa. Un intervalo equivale a seis segundos de exploración o a un turno de búsqueda en combate. Desactivarlas mantiene a los defensores en su puesto cuando no ven enemigos; pueden seguir combatiendo y reaccionando.</p>
  <div className="fields">{MILITIA_PATROL_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,militiaPatrol:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>En exploración, si un paso dejaría al defensor por debajo de la reserva de energía, descansa ese intervalo. La recuperación nunca supera 100 de energía. Estas opciones no recargan armas, curan heridas ni cambian los puntos de acción de combate.</p>
  <p>Las reglas quedan guardadas con cada campaña nueva. Cambiar el borrador no modifica una partida en curso.</p>
  <button onClick={()=>{const next={...draft};delete next.militiaPatrol;onChange(next);}}>Restaurar patrullas de milicias originales</button>
 </section>;
}
