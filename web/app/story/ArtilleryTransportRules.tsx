'use client';
import {DEFAULT_ARTILLERY_TRANSPORT,ARTILLERY_TRANSPORT_FIELDS} from '../../../game/artillery-transport-rules.js';
export default function ArtilleryTransportRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.artilleryTransport??DEFAULT_ARTILLERY_TRANSPORT;
 return <section aria-label="Reglas de traslado de artillería"><h2>Traslado de artillería</h2>
  <label>Permitir traslado de piezas de artillería<input type="checkbox" checked={rules.enabled} onChange={e=>onChange({...draft,artilleryTransport:{...rules,enabled:e.target.checked}})}/></label>
  <div className="fields">{ARTILLERY_TRANSPORT_FIELDS.map(([key,label,min,max]:any)=><label key={key}>{label}<input type="number" min={min} max={max} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,artilleryTransport:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>La duración se aplica a cada conexión entre localidades. El precio se cobra una sola vez por pieza al enviarla, además del costo de organizar la red. Cero pesos permite envíos gratuitos.</p>
  <p>Se conservan la dotación requerida, el control de la ruta, las restricciones de montaña y costa, los bloqueos y la munición de cada pieza. Cambiar estas reglas no modifica las partidas ya iniciadas.</p>
  <button onClick={()=>{const next={...draft};delete next.artilleryTransport;onChange(next);}}>Restaurar traslado de artillería original</button>
 </section>;
}
