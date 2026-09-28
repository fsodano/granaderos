'use client';
import {DEFAULT_CARE_RULES,CARE_RULE_FIELDS,STRATEGIC_BLEEDING_FIELD,DEFAULT_STRATEGIC_BLEEDING_PERCENT} from '../../../game/campaign-care-rules.js';
export default function CareRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.careRules??DEFAULT_CARE_RULES;
 return <section aria-label="Reglas de atención y descanso">
  <h2>Atención médica y descanso</h2>
  <p>Estas reglas quedan guardadas al iniciar una campaña. Cada hora de atención consume una venda. Primero se detiene la hemorragia; luego se recupera la salud base más un punto por cada grupo de medicina indicado.</p>
  <div className="fields">{[...CARE_RULE_FIELDS,STRATEGIC_BLEEDING_FIELD].map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:key==='bleedingDamagePercent'&&rules[key]===undefined?DEFAULT_STRATEGIC_BLEEDING_PERCENT:''} onChange={e=>onChange({...draft,careRules:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>Las heridas y la visión nocturna modifican el ritmo base de descanso. La recuperación de salud por descanso requiere al menos 15 de salud y ninguna hemorragia. El precio de las vendas se aplica tanto a la compra por cantidad como a la reposición del taller. Cero permite vendas gratuitas o elimina ese costo de energía o fatiga; un ritmo de descanso en cero no recupera ese valor.</p>
  <p>Fuera del combate, una hemorragia sin atender resta salud en cada cambio de hora, también durante la marcha. El porcentaje se aplica a su intensidad y se redondea hacia arriba: con 25 %, una hemorragia de 5 resta 2 de salud. Cero desactiva este daño. El médico atiende primero; el descanso y la recuperación diaria no curan a quien sigue sangrando.</p>
  <button onClick={()=>{const next={...draft};delete next.careRules;onChange(next);}}>Restaurar atención y descanso originales</button>
 </section>;
}
