'use client';
import {CONTRACT_RULE_FIELDS,DEFAULT_CONTRACT_RULES} from '../../../game/contract-rules.js';
export default function ContractRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.contractRules??DEFAULT_CONTRACT_RULES;
 const setRules=(next:any)=>onChange({...draft,contractRules:next});
 return <section aria-label="Reglas de contratación">
  <h2>Contratos y paga</h2>
  <p>Estas reglas se guardan al iniciar una campaña. Cambiar el borrador no modifica una partida en curso. Todos los contratables, incluidos los especialistas de élite, pueden usar los tres plazos.</p>
  <div className="fields">
   {([['day','Plazo corto'],['week','Plazo medio'],['month','Plazo largo']] as const).map(([key,label])=><label key={key}>{label} (días)<input type="number" min={1} max={90} step={1} value={Number.isFinite(rules.days[key])?rules.days[key]:''} onChange={e=>setRules({...rules,days:{...rules.days,[key]:e.target.valueAsNumber}})}/></label>)}
   {CONTRACT_RULE_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>setRules({...rules,[key]:e.target.valueAsNumber})}/></label>)}
  </div>
  <p>Los plazos deben aumentar. La paga diaria divide la paga mensual de la ficha por los días indicados y suma el aumento por cada tramo completo de experiencia. Se redondea hacia arriba y se multiplica por los días del contrato. Un aumento de cero mantiene la paga inicial.</p>
  <p>El aviso detiene una espera antes del vencimiento. Con cero, solo avisa al vencer. Renovar suma el plazo al tiempo de servicio restante. El viaje de llegada no consume días de contrato.</p>
  <button onClick={()=>{const next={...draft};delete next.contractRules;onChange(next);}}>Restaurar contratos originales</button>
 </section>;
}
