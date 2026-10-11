'use client';
import {useState} from 'react';
import DialogueConditions from './DialogueConditions';
import DialogueEffects from './DialogueEffects';
import FieldEditor from '../studio/FieldEditor';
import {DEFAULT_AMMUNITION_MARKET} from '../../../game/ammunition-market-rules.js';
import {DEFAULT_ARTILLERY_SUPPLY} from '../../../game/artillery-supply-rules.js';
import {freshDefaultRoadsideDiscoveries} from '../../../game/roadside-discoveries.js';

export default function AdvancedContent({draft,onChange}:{draft:any;onChange:(next:any)=>void}){
 const [selected,setSelected]=useState(''),events=draft.campaignEvents??[],event=events.find((e:any)=>e.id===selected)??events[0];
 const changeEvents=(next:any[])=>onChange({...draft,campaignEvents:next});
 const update=(patch:any)=>changeEvents(events.map((e:any)=>e.id===event.id?{...e,...patch}:e));
 const add=()=>{let n=1;while(events.some((e:any)=>e.id===`event-${n}`))n++;const id=`event-${n}`;changeEvents([...events,{id,atHour:24,conditions:[],text:'Describí el evento que verá el jugador.',effects:[]}]);setSelected(id);};
 const optional=[['imports','Importaciones',{port:null,minHours:12,maxHours:24}],['artillerySupply','Suministro de artillería',DEFAULT_ARTILLERY_SUPPLY],['artilleryTrading','Comercio de artillería',draft.world?.artilleryTrading],['ammunitionMarket','Munición',{defaults:DEFAULT_AMMUNITION_MARKET,locations:{}}]] as const;
 return <section aria-label="Eventos y suministros de campaña">
  <h2>Eventos programados</h2><p>Cada evento se comprueba una vez, a su hora. Las condiciones, el costo y el encargo se evalúan juntos. Una condición falsa deja un recibo de evento omitido.</p>
  <button type="button" disabled={events.length>=100} onClick={add}>Crear evento</button>
  <div className="editor-columns"><aside className="entry-list">{events.map((e:any)=><button type="button" key={e.id} aria-current={e.id===event?.id?'true':undefined} onClick={()=>setSelected(e.id)}>{e.id} · {e.atHour} h</button>)}</aside>{event&&<fieldset><legend>{event.id}</legend>
   <label>Identidad del evento<input value={event.id} onChange={e=>update({id:e.target.value})}/></label>
   <label>Hora del evento<input type="number" min={0} max={876000} value={event.atHour} onChange={e=>update({atHour:e.target.valueAsNumber})}/></label>
   <label>Texto del evento<textarea rows={3} maxLength={1000} value={event.text} onChange={e=>update({text:e.target.value})}/></label>
   <DialogueConditions content={draft} campaign conditions={event.conditions} characters={draft.characters} quests={draft.quests??[]} onChange={conditions=>update({conditions})}/>
   <DialogueEffects allowMovement={false} effects={event.effects} quests={draft.quests??[]} characters={draft.characters} ownerId="" onChange={effects=>update({effects})}/>
   <button type="button" onClick={()=>changeEvents(events.filter((e:any)=>e.id!==event.id))}>Eliminar evento</button>
  </fieldset>}</div>
  <h2>Hallazgos de camino</h2><p>Este hallazgo contiene una palanca y una camisa de lino. Para otros contenidos usá los objetos físicos del mundo.</p>
  <label><input type="checkbox" checked={Boolean(draft.roadsideDiscoveries?.length)} onChange={e=>{const defaults=freshDefaultRoadsideDiscoveries(),cell=draft.world?.cells.find((c:any)=>c.land&&c.location===(draft.headquarters??draft.world?.defaultHeadquarters))??draft.world?.cells.find((c:any)=>c.land);onChange({...draft,roadsideDiscoveries:e.target.checked?defaults.map((d:any)=>cell?{...d,id:'field-cache',cell:cell.id}:d):[]});}}/>Colocar hallazgo de herramientas y ropa</label>
  {draft.roadsideDiscoveries?.length>0&&<FieldEditor label="Hallazgo" path="roadsideDiscoveries" value={draft.roadsideDiscoveries} onChange={roadsideDiscoveries=>onChange({...draft,roadsideDiscoveries})}/>}
  <h2>Reglas de suministro</h2>{optional.map(([field,label,defaults])=><section key={field}><h3>{label}</h3>{draft[field]===undefined?<><p>Se usa el valor predeterminado de las reglas.</p><button type="button" onClick={()=>onChange({...draft,[field]:structuredClone(defaults??{})})}>Configurar {label.toLowerCase()}</button></>:<><FieldEditor label={label} path={field} value={draft[field]} onChange={value=>onChange({...draft,[field]:value})}/><button type="button" onClick={()=>{const next={...draft};delete next[field];onChange(next);}}>Usar reglas predeterminadas de {label.toLowerCase()}</button></>}</section>)}
 </section>;
}
