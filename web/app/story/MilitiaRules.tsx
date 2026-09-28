'use client';
import {DEFAULT_MILITIA_PROGRESSION,MILITIA_PROGRESSION_FIELDS} from '../../../game/militia-progression-rules.js';
export default function MilitiaRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.militiaProgression??DEFAULT_MILITIA_PROGRESSION;
 return <section aria-label="Reglas de ascenso de milicias">
  <h2>Ascensos de milicias</h2>
  <p>Un primer impacto que hiere a un rival apto suma un punto. Abatirlo eleva ese registro a tres puntos. Los puntos se acumulan durante la carrera del miliciano. Al volver vivo de un encuentro con puntos nuevos, puede ganar un grado.</p>
  <div className="fields">{MILITIA_PROGRESSION_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,militiaProgression:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>El umbral de veterano debe superar al de montonero. Las mejoras se aplican también al ascenso pagado a montonero. Cero conserva ese atributo. La puntería y el liderazgo no superan 100; el nivel no supera 10. Ascender conserva la salud, las armas y los suministros restantes. Los veteranos nuevos necesitan combatir.</p>
  <p>Estas reglas se guardan al iniciar la campaña. Cambiar el borrador no cambia una partida en curso.</p>
  <button onClick={()=>{const next={...draft};delete next.militiaProgression;onChange(next);}}>Restaurar ascensos de milicias originales</button>
 </section>;
}
