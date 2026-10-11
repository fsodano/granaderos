'use client';
import {DEFAULT_FOUNDRY,foundryLocations} from '../../../game/campaign-foundry.js';
import {campaignWorld} from '../../../game/campaign-definition.js';
export default function FoundryRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const original=campaignWorld(draft).defaultFoundry??DEFAULT_FOUNDRY,foundry=draft.foundry??original;
 const change=(key:string,value:string|number)=>onChange({...draft,foundry:{...foundry,[key]:value}});
 return <section aria-label="Fundición y preparación"><h2>Fundición y preparación</h2>
  <div className="fields"><label>Ubicación de la fundición<select value={foundry.sector} onChange={e=>change('sector',e.target.value)}>{foundryLocations(draft).map((s:{id:string;name:string})=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   <label>Nombre de la fundición<input maxLength={100} value={foundry.name} onChange={e=>change('name',e.target.value)}/></label>
   <label>Nombre del ejército<input maxLength={100} value={foundry.armyName} onChange={e=>change('armyName',e.target.value)}/></label>
   <label>Costo de organización (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(foundry.setupCost)?foundry.setupCost:''} onChange={e=>change('setupCost',e.target.valueAsNumber)}/></label>
   <label>Costo de financiación (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(foundry.fundingCost)?foundry.fundingCost:''} onChange={e=>change('fundingCost',e.target.valueAsNumber)}/></label></div>
  <p>La localidad debe estar bajo tu control y el responsable de fundición debe estar en servicio. Cada paso se paga una vez; cero permite hacerlo sin costo. La preparación queda guardada aunque el responsable deje el servicio.</p>
  <p>La organización conserva el control del proyecto y sus costos. No entrega equipo ni habilita compras, reparación o abastecimiento. Las misiones de cada campaña conservan sus propios objetivos.</p>
  <button type="button" onClick={()=>onChange({...draft,foundry:{...original}})}>Restaurar fundición original</button>
 </section>;
}
