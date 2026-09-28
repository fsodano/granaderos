'use client';
import {DEFAULT_IMPORT_RULES,IMPORT_PORTS} from '../../../game/campaign-imports.js';
export default function ImportRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.imports??DEFAULT_IMPORT_RULES;
 const change=(key:string,value:string|number|null)=>onChange({...draft,imports:{...rules,[key]:value}});
 return <section aria-label="Importaciones de armas" className="test-panel">
  <h2>Importaciones de armas</h2>
  <div className="fields"><label>Puerto de importación<select value={rules.port??''} onChange={e=>change('port',e.target.value||null)}><option value="">Sin importaciones</option>{IMPORT_PORTS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <label>Plazo mínimo de importación (horas)<input type="number" min={1} max={720} step={1} value={Number.isFinite(rules.minHours)?rules.minHours:''} onChange={e=>change('minHours',e.target.valueAsNumber)}/></label>
  <label>Plazo máximo de importación (horas)<input type="number" min={1} max={720} step={1} value={Number.isFinite(rules.maxHours)?rules.maxHours:''} onChange={e=>change('maxHours',e.target.valueAsNumber)}/></label></div>
  <p>El plazo se sortea una vez al comprar y queda guardado. Usá el mismo mínimo y máximo para un plazo fijo. El pedido se paga por adelantado; la ocupación del puerto o un bloqueo demoran la entrega sin otro cobro.</p>
  <p>Los pedidos necesitan el puerto bajo control patriota y comerciantes dispuestos a negociar. Esta opción afecta los mosquetes Brown Bess, los fusiles Baker y sus variantes. Deshabilitar pedidos conserva las armas que ya llevan los personajes. Los contratados usan los puntos de recepción de Llegadas.</p>
  <button onClick={()=>onChange({...draft,imports:{...DEFAULT_IMPORT_RULES}})}>Restaurar importaciones originales</button>
 </section>;
}
