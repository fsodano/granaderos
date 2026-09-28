'use client';
import {CAMPAIGN_PROJECT_LABELS} from '../../../game/campaign-projects.js';
import {isWorldCharacter} from '../../../game/content-character-ids.js';
import {QUEST_STATE_LABELS} from '../../../game/content-quests.js';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
export default function DialogueConditions({conditions=[],characters,quests,onChange,campaign=false}:{campaign?:boolean;conditions?:any[];characters:any[];quests:any[];onChange:(conditions:any[])=>void}){
 const residents=characters.filter(isWorldCharacter);
 const update=(index:number,value:any)=>onChange(conditions.map((c,i)=>i===index?value:c));
 const initial=(type:string)=>type==='project'?{type,project:'foundry',completed:true}:type==='meeting'?{type,character:residents[0].id}:type==='quest'?{type,quest:quests[0].id,status:'active'}:type==='character'?{type,character:characters[0].id,state:'alive'}:type==='sector'?{type,sector:'retiro',owner:'patriot'}:{type,min:type==='day'?1:0,max:null};
 return <div><p>{campaign?'Se evalúan todas las condiciones en el estado de la campaña.':'La opción aparece cuando se cumplen todas sus condiciones.'}</p>
  {conditions.map((c,i)=><fieldset key={i} aria-label={`Condición ${i+1}`}><legend>Condición {i+1}</legend>
   <label>Tipo de condición<select value={c.type} onChange={e=>update(i,initial(e.target.value))}><option value="day">Día de campaña</option><option value="treasury">Pesos disponibles</option><option value="sector">Control de una localidad</option><option value="project">Estado de un proyecto</option><option value="character" disabled={!characters.length}>Estado de un personaje</option>{!campaign&&<option value="meeting" disabled={!residents.length}>Personaje en su encuentro</option>}<option value="quest" disabled={!quests.length}>Estado de un encargo</option></select></label>
   {c.type==='project'?<>
    <label>Proyecto de la condición<select value={c.project} onChange={e=>update(i,{...c,project:e.target.value})}>{Object.entries(CAMPAIGN_PROJECT_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Estado del proyecto requerido<select value={c.completed?'complete':'pending'} onChange={e=>update(i,{...c,completed:e.target.value==='complete'})}><option value="complete">Completado</option><option value="pending">Pendiente</option></select></label>
    <p>Comprueba el paso cumplido en la campaña. No exige que su responsable siga en servicio ni que la localidad conserve el control.</p>
   </>:c.type==='meeting'?<>
    <label>Personaje que debe llegar<select value={c.character} onChange={e=>update(i,{...c,character:e.target.value})}>{residents.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <p>Debe estar consciente y sin peligro inmediato en el destino de su última llamada, dentro del sector abierto. Una orden pendiente o un tiempo transcurrido no bastan.</p>
   </>:c.type==='quest'?<>
    <label>Encargo de la condición<select value={c.quest} onChange={e=>update(i,{...c,quest:e.target.value})}>{quests.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}</select></label>
    <label>Estado del encargo requerido<select value={c.status} onChange={e=>update(i,{...c,status:e.target.value})}>{Object.entries(QUEST_STATE_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </>:c.type==='character'?<>
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
