'use client';
import {useState} from 'react';
import {DEFAULT_AMMUNITION_MARKET,AMMUNITION_MARKET_LOCATIONS} from '../../../game/ammunition-market-rules.js';
import {AMMUNITION_FAMILIES} from '../../../game/ammunition-families.js';
const fields=[['initial','Existencias iniciales'],['capacity','Máximo de existencias'],['replenish','Cartuchos por reposición']] as const;
export default function AmmunitionMarketRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const [at,setAt]=useState('');
 const market=draft.ammunitionMarket??{defaults:DEFAULT_AMMUNITION_MARKET,locations:{}},override=at&&Object.hasOwn(market.locations,at),rules=override?market.locations[at]:market.defaults;
 const change=(next:any)=>onChange({...draft,ammunitionMarket:at?{...market,locations:{...market.locations,[at]:next}}:{...market,defaults:next}});
 const family=(key:string,patch:any)=>change({...rules,families:{...rules.families,[key]:{...rules.families[key],...patch}}});
 return <section className="ammunition-market-rules" aria-label="Proveedores de munición"><h2>Proveedores de munición</h2>
  <p>Las reglas generales se aplican a todas las localidades. Podés definir un proveedor distinto en cada localidad. Estos cambios se aplican a campañas nuevas.</p>
  <label>Proveedor a configurar<select value={at} onChange={e=>setAt(e.target.value)}><option value="">Reglas generales</option>{AMMUNITION_MARKET_LOCATIONS.map((place:any)=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
  {at&&<label className="check">Usar reglas propias en esta localidad<input type="checkbox" checked={!!override} onChange={e=>{const locations={...market.locations};if(e.target.checked)locations[at]=structuredClone(market.defaults);else delete locations[at];onChange({...draft,ammunitionMarket:{...market,locations}});}}/></label>}
  <fieldset className="ammunition-market-profile" disabled={!!at&&!override}><legend>{at?'Reglas de la localidad':'Reglas generales de proveedores'}</legend>
   <label className="check">Habilitar proveedor<input type="checkbox" checked={rules.enabled} onChange={e=>change({...rules,enabled:e.target.checked})}/></label>
   <label className="check">Comprar automáticamente al preparar la escuadra<input type="checkbox" checked={rules.automaticPurchase} onChange={e=>change({...rules,automaticPurchase:e.target.checked})}/></label>
   <label>Horas de reposición<input type="number" min={1} max={720} step={1} value={Number.isFinite(rules.restockHours)?rules.restockHours:''} onChange={e=>change({...rules,restockHours:e.target.valueAsNumber})}/></label>
   {Object.entries(AMMUNITION_FAMILIES).map(([key,definition]:any)=><fieldset key={key} aria-label={definition.name}><legend>{definition.name}</legend><div className="fields">
    {fields.map(([field,label])=><label key={field}>{label}<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(rules.families[key][field])?rules.families[key][field]:''} onChange={e=>family(key,{[field]:e.target.valueAsNumber})}/></label>)}
    <label className="check">Usar precio general<input type="checkbox" checked={rules.families[key].price===null} onChange={e=>family(key,{price:e.target.checked?null:draft.rules?.cartridgePrice??1})}/></label>
    {rules.families[key].price!==null&&<label>Precio por cartucho (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(rules.families[key].price)?rules.families[key].price:''} onChange={e=>family(key,{price:e.target.valueAsNumber})}/></label>}
   </div></fieldset>)}
  </fieldset>
  <p>La reposición cuenta solo horas bajo control propio y con comunicación al cuartel general. Las existencias iniciales no pueden superar el máximo. Cero pesos permite compras gratuitas; cero reposición impide recuperar existencias.</p>
  <p>Deshabilitar el proveedor impide compras y reposición. Deshabilitar la compra automática permite seguir comprando manualmente. Los cartuchos propios y los depósitos se conservan. Las reglas propias de una localidad no cambian al editar las reglas generales.</p>
  <button onClick={()=>{const next={...draft};delete next.ammunitionMarket;onChange(next);}}>Restaurar proveedores de munición originales</button>
 </section>;
}
