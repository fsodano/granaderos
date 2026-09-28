'use client';
import {DEFAULT_FOUNDRY,FOUNDRY_LOCATIONS} from '../../../game/campaign-foundry.js';
export default function FoundryRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const foundry=draft.foundry??DEFAULT_FOUNDRY;
 const change=(key:string,value:string|number)=>onChange({...draft,foundry:{...foundry,[key]:value}});
 return <section aria-label="Fundición y preparación"><h2>Fundición y preparación</h2>
  <div className="fields"><label>Ubicación de la fundición<select value={foundry.sector} onChange={e=>change('sector',e.target.value)}>{FOUNDRY_LOCATIONS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>Nombre de la fundición<input maxLength={100} value={foundry.name} onChange={e=>change('name',e.target.value)}/></label>
   <label>Nombre del ejército<input maxLength={100} value={foundry.armyName} onChange={e=>change('armyName',e.target.value)}/></label>
   <label>Costo de organización (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(foundry.setupCost)?foundry.setupCost:''} onChange={e=>change('setupCost',e.target.valueAsNumber)}/></label>
   <label>Costo de financiación (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(foundry.fundingCost)?foundry.fundingCost:''} onChange={e=>change('fundingCost',e.target.valueAsNumber)}/></label></div>
  <p>La localidad debe estar bajo tu control y el responsable de fundición debe estar en servicio. Cada paso se paga una vez; cero permite hacerlo sin costo. La preparación queda guardada aunque el responsable deje el servicio.</p>
  <p>Al organizarla, la localidad ofrece reparación y abastecimiento mientras esté controlada y comunicada con el cuartel. Los talleres existentes siguen disponibles. Esta opción no mueve edificios ni cambia las misiones originales: la campaña histórica conserva sus pasos y objetivos de Cuyo.</p>
  <button type="button" onClick={()=>onChange({...draft,foundry:{...DEFAULT_FOUNDRY}})}>Restaurar fundición original</button>
 </section>;
}
