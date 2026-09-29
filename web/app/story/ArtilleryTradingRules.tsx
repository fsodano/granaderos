'use client';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
import {DEFAULT_ARTILLERY_TRADING,ARTILLERY_TRADING_FIELDS} from '../../../game/artillery-trading-rules.js';
export default function ArtilleryTradingRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.artilleryTrading??DEFAULT_ARTILLERY_TRADING,overrides=rules.buyingOverrides,nextLocation=CAMPAIGN_SECTORS.find(s=>!Object.hasOwn(overrides,s.id));
 const update=(fields:any)=>onChange({...draft,artilleryTrading:{...rules,...fields}});
 return <section aria-label="Reglas de comercio de artillería"><h2>Comercio de artillería</h2>
  <label>Permitir venta y recompra de artillería<input type="checkbox" checked={rules.enabled} onChange={e=>update({enabled:e.target.checked})}/></label>
  <div className="fields">{ARTILLERY_TRADING_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>update({[key]:e.target.valueAsNumber})}/></label>)}</div>
  <p>Los fondos se entregan una sola vez a cada taller al comenzar sus operaciones. Vender una pieza reduce su caja; recomprarla le devuelve dinero. No se renueva al guardar o al pasar el tiempo. Los porcentajes se aplican al precio de cada modelo.</p>
  <h3>Pagos locales del taller</h3><p>Estas excepciones reemplazan el pago general. Se aplican si existe un taller en esa localidad; no crean instalaciones nuevas.</p>
  {Object.entries(overrides).map(([at,percent]:any)=><fieldset key={at} data-artillery-trade-rate={at}><legend>{CAMPAIGN_SECTORS.find(s=>s.id===at)?.name}</legend>
   <label>Localidad del precio especial<select value={at} onChange={e=>{const next=e.target.value;if(next!==at&&Object.hasOwn(overrides,next))return;update({buyingOverrides:Object.fromEntries(Object.entries(overrides).map(([key,value])=>[key===at?next:key,value]))});}}>{CAMPAIGN_SECTORS.map(s=><option key={s.id} value={s.id} disabled={s.id!==at&&Object.hasOwn(overrides,s.id)}>{s.name}</option>)}</select></label>
   <label>Pago local (% del precio)<input type="number" min={0} max={100} step={1} value={Number.isFinite(percent)?percent:''} onChange={e=>update({buyingOverrides:{...overrides,[at]:e.target.valueAsNumber}})}/></label>
   <button onClick={()=>update({buyingOverrides:Object.fromEntries(Object.entries(overrides).filter(([id])=>id!==at))})}>Quitar precio local</button>
  </fieldset>)}
  <button disabled={!nextLocation} onClick={()=>{if(nextLocation)update({buyingOverrides:{...overrides,[nextLocation.id]:rules.buyPercent}});}}>Agregar precio local</button>
  <p>Cero permite operaciones sin pago. Un pago de compra mayor al de recompra permite beneficiar al jugador hasta agotar la caja del taller. Las piezas conservan su identidad, munición y recarga.</p>
  <button onClick={()=>{const next={...draft};delete next.artilleryTrading;onChange(next);}}>Restaurar comercio de artillería original</button>
 </section>;
}
