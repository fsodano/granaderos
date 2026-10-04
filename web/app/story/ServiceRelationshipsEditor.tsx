import {SERVICE_REFUSAL_LIMIT,SERVICE_REFUSAL_REASON_LIMIT} from '../../../game/service-relationships.js';

export default function ServiceRelationshipsEditor({character,characters,onChange}:{character:any;characters:any[];onChange:(patch:any)=>void}){
 const preferences=character.serviceRefusals??[],choices=characters.filter(c=>c.id!==character.id);
 const change=(index:number,patch:any)=>onChange({serviceRefusals:preferences.map((p:any,i:number)=>i===index?{...p,...patch}:p)});
 const available=choices.filter(c=>!preferences.some((p:any)=>p.character===c.id));
 return <fieldset aria-label="Rechazos de servicio"><legend>Rechazos de servicio</legend>
  <p>Rechaza contratarse o renovar mientras la persona elegida siga en servicio. El rechazo no acorta los contratos ya pagados.</p>
  {preferences.map((preference:any,index:number)=><div key={index}>
   <label>Persona incompatible<select aria-label={`Persona incompatible ${index+1}`} value={preference.character} onChange={e=>change(index,{character:e.target.value})}>
    {!choices.some(c=>c.id===preference.character)&&<option value={preference.character}>Personaje inexistente: {preference.character}</option>}
    {choices.map(c=><option key={c.id} value={c.id} disabled={preferences.some((p:any,i:number)=>i!==index&&p.character===c.id)}>{c.name}</option>)}
   </select></label>
   <label>Motivo<textarea aria-label={`Motivo del rechazo ${index+1}`} maxLength={SERVICE_REFUSAL_REASON_LIMIT} rows={2} value={preference.reason} onChange={e=>change(index,{reason:e.target.value})}/></label>
   <button type="button" className="line-button" onClick={()=>onChange({serviceRefusals:preferences.filter((_:any,i:number)=>i!==index)})}>Quitar rechazo {index+1}</button>
  </div>)}
  <button type="button" className="line-button" disabled={preferences.length>=SERVICE_REFUSAL_LIMIT||!available.length} onClick={()=>onChange({serviceRefusals:[...preferences,{character:available[0].id,reason:'No acepta servir con esta persona.'}]})}>Añadir rechazo de servicio</button>
 </fieldset>;
}
