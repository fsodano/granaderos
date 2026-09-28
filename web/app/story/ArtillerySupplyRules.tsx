'use client';
import {DEFAULT_ARTILLERY_SUPPLY,ARTILLERY_SUPPLY_FIELDS} from '../../../game/artillery-supply-rules.js';
export default function ArtillerySupplyRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.artillerySupply??DEFAULT_ARTILLERY_SUPPLY;
 return <section aria-label="Reglas de munición de artillería"><h2>Munición de artillería</h2>
  <label>Permitir reposición de munición de artillería<input type="checkbox" checked={rules.enabled} onChange={e=>onChange({...draft,artillerySupply:{...rules,enabled:e.target.checked}})}/></label>
  <div className="fields">{ARTILLERY_SUPPLY_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,artillerySupply:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>La escuadra puede comprar una munición por vez para una pieza emplazada en un sector controlado, despejado y comunicado con el cuartel general. Se paga en pesos y la munición queda en reserva; la dotación debe cargarla.</p>
  <p>El límite impide nuevas compras cuando la reserva lo alcanza. No elimina munición existente ni cambia la entrega inicial de una carga y seis reservas por pieza nueva. Cero pesos permite reposición gratuita.</p>
  <button onClick={()=>{const next={...draft};delete next.artillerySupply;onChange(next);}}>Restaurar munición de artillería original</button>
 </section>;
}
