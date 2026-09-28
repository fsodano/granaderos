'use client';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
export default function DialogueConditions({conditions=[],characters,onChange}:{conditions?:any[];characters:any[];onChange:(conditions:any[])=>void}){
 const update=(index:number,value:any)=>onChange(conditions.map((c,i)=>i===index?value:c));
 const initial=(type:string)=>type==='character'?{type,character:characters[0].id,state:'alive'}:type==='sector'?{type,sector:'retiro',owner:'patriot'}:{type,min:type==='day'?1:0,max:null};
 return <div><p>La opción aparece cuando se cumplen todas sus condiciones.</p>
  {conditions.map((c,i)=><fieldset key={i} aria-label={`Condición ${i+1}`}><legend>Condición {i+1}</legend>
   <label>Tipo de condición<select value={c.type} onChange={e=>update(i,initial(e.target.value))}><option value="day">Día de campaña</option><option value="treasury">Pesos disponibles</option><option value="sector">Control de una localidad</option><option value="character">Estado de un personaje</option></select></label>
   {c.type==='character'?<>
    <label>Personaje de la condición<select value={c.character} onChange={e=>update(i,{...c,character:e.target.value})}>{characters.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label>Estado requerido<select value={c.state} onChange={e=>update(i,{...c,state:e.target.value})}><option value="alive">Vivo</option><option value="dead">Muerto</option><option value="serving">Incorporado al servicio</option><option value="present">Presente en el mundo</option></select></label>
   </>:c.type==='sector'?<>
    <label>Localidad de la condición<select value={c.sector} onChange={e=>update(i,{...c,sector:e.target.value})}>{CAMPAIGN_SECTORS.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
    <label>Control requerido<select value={c.owner} onChange={e=>update(i,{...c,owner:e.target.value})}><option value="patriot">Patriota</option><option value="royalist">Realista</option></select></label>
   </>:<>
    <label>{c.type==='day'?'Desde el día':'Pesos mínimos'}<input type="number" min={c.type==='day'?1:0} max={1000000000} value={c.min} onChange={e=>update(i,{...c,min:e.target.valueAsNumber})}/></label>
    <label>{c.type==='day'?'Hasta el día (opcional)':'Pesos máximos (opcional)'}<input type="number" min={c.min} max={1000000000} value={c.max??''} onChange={e=>update(i,{...c,max:e.target.value===''?null:e.target.valueAsNumber})}/></label>
   </>}
   <button type="button" onClick={()=>onChange(conditions.filter((_,index)=>index!==i))}>Quitar condición {i+1}</button>
  </fieldset>)}
  <button type="button" disabled={conditions.length>=6} onClick={()=>onChange([...conditions,initial('day')])}>Agregar condición</button>
 </div>;
}
