import {SERVICE_REFUSAL_LIMIT,SERVICE_REFUSAL_REASON_LIMIT,PREFERRED_COMPANION_LIMIT} from '../../../game/service-relationships.js';
import {PREFERRED_COMPANION_EXPLANATION} from '../PreferredCompanionsSummary';

export default function ServiceRelationshipsEditor({character,characters,onChange}:{character:any;characters:any[];onChange:(patch:any)=>void}){
 const choices=characters.filter(c=>c.id!==character.id);
 const fields=[
  {field:'serviceRefusals',other:'preferredCompanions',limit:SERVICE_REFUSAL_LIMIT,title:'Rechazos de servicio',person:'Persona incompatible',reason:'Motivo del rechazo',remove:'Quitar rechazo',add:'Añadir rechazo de servicio',initialReason:'No acepta servir con esta persona.',description:'Rechaza contratarse o renovar mientras la persona elegida siga en servicio. El rechazo no acorta los contratos ya pagados.'},
  {field:'preferredCompanions',other:'serviceRefusals',limit:PREFERRED_COMPANION_LIMIT,title:'Compañeros preferidos',person:'Compañero preferido',reason:'Motivo de la preferencia',remove:'Quitar compañero preferido',add:'Añadir compañero preferido',initialReason:'Confía en su apoyo durante el combate.',description:PREFERRED_COMPANION_EXPLANATION},
 ];
 return <>{fields.map(option=>{
  const preferences=character[option.field]??[],opposed=character[option.other]??[];
  const change=(index:number,patch:any)=>onChange({[option.field]:preferences.map((p:any,i:number)=>i===index?{...p,...patch}:p)});
  const used=(id:string,index=-1)=>preferences.some((p:any,i:number)=>i!==index&&p.character===id)||opposed.some((p:any)=>p.character===id);
  const available=choices.filter(c=>!used(c.id));
  return <fieldset key={option.field} aria-label={option.title}><legend>{option.title}</legend>
   <p>{option.description}</p>
   {preferences.map((preference:any,index:number)=><div key={index}>
    <label>{option.person}<select aria-label={`${option.person} ${index+1}`} value={preference.character} onChange={e=>change(index,{character:e.target.value})}>
     {!choices.some(c=>c.id===preference.character)&&<option value={preference.character}>Personaje inexistente: {preference.character}</option>}
     {choices.map(c=><option key={c.id} value={c.id} disabled={used(c.id,index)}>{c.name}</option>)}
    </select></label>
    <label>Motivo<textarea aria-label={`${option.reason} ${index+1}`} maxLength={SERVICE_REFUSAL_REASON_LIMIT} rows={2} value={preference.reason} onChange={e=>change(index,{reason:e.target.value})}/></label>
    <button type="button" className="line-button" onClick={()=>onChange({[option.field]:preferences.filter((_:any,i:number)=>i!==index)})}>{option.remove} {index+1}</button>
   </div>)}
   <button type="button" className="line-button" disabled={preferences.length>=option.limit||!available.length} onClick={()=>onChange({[option.field]:[...preferences,{character:available[0].id,reason:option.initialReason}]})}>{option.add}</button>
  </fieldset>;
 })}</>;
}
