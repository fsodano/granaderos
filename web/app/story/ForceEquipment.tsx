'use client';
import {FORCE_EQUIPMENT,defaultForceEquipment,defaultForceBlades} from '../../../game/content-force-equipment.js';
import {hasGenericCharacterDefinitions} from '../../../game/content-character-ids.js';
import {APPEARANCE_LABELS} from '../../../game/content-character-presentation.js';

export default function ForceEquipment({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const generic=hasGenericCharacterDefinitions(draft);
 return <section aria-label="Armamento de las tropas">
  <h2>Armamento de las tropas</h2>
  <p>Elegí el arma principal y el arma blanca de cada tipo de tropa. Los soldados reciben su equipo al crearse y lo conservan al volver al sector.</p>
  {Object.entries(FORCE_EQUIPMENT).map(([field,group])=><fieldset key={field}>
   <legend>{group.label}</legend>
   {draft[field]===undefined ? <>
    <p>{generic?'Este grupo empieza sin arma principal.':'Este paquete conserva las armas originales de este grupo.'}</p>
    <button onClick={()=>onChange({...draft,[field]:generic?Object.fromEntries(Object.keys(group.roles).map(role=>[role,null])):defaultForceEquipment(field,draft.weapons)})}>Configurar armas de {group.label.toLowerCase()}</button>
   </> : <div className="fields">{Object.entries(group.roles).map(([role,label])=><label key={role}>{label}
    <select value={draft[field][role]??''} onChange={e=>onChange({...draft,[field]:{...draft[field],[role]:e.target.value||null}})}>
     <option value="">Sin arma principal</option>
     {draft.weapons.map((weapon:any)=><option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
    </select>
   </label>)}</div>}
   {draft[group.bladeField]===undefined ? <>
    <p>{generic?'Este grupo empieza sin arma blanca.':'Las armas blancas de este grupo conservan sus valores originales.'}</p>
    <button onClick={()=>onChange({...draft,[group.bladeField]:generic?Object.fromEntries(Object.keys(group.roles).map(role=>[role,null])):defaultForceBlades(field,draft.weapons)})}>Configurar armas blancas de {group.label.toLowerCase()}</button>
   </> : <div className="fields">{Object.entries(group.roles).map(([role,label])=><label key={role}>{`Arma blanca · ${label}`}
    <select value={draft[group.bladeField][role]??''} onChange={e=>onChange({...draft,[group.bladeField]:{...draft[group.bladeField],[role]:e.target.value||null}})}>
     <option value="">{generic?'Sin arma blanca':'Arma blanca original'}</option>
     {draft.weapons.filter((w:any)=>w.template>=1809).map((weapon:any)=><option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
    </select>
   </label>)}</div>}
   {draft[group.appearanceField]===undefined?<><p>{generic?'Sin una selección, usan la apariencia neutral y piel morena.':'Sin una selección, usan su apariencia original.'}</p><button type="button" onClick={()=>onChange({...draft,[group.appearanceField]:Object.fromEntries(Object.keys(group.roles).map(role=>[role,{spriteAppearance:generic?'worker':field==='oppositionEquipment'?'royalist':'granadero',skinTone:'brown'}]))})}>Configurar apariencia de {group.label.toLowerCase()}</button></>:<div className="fields">{Object.entries(group.roles).map(([role,label])=><fieldset key={role}><legend>{label} · apariencia</legend><label>Apariencia de la tropa<select value={draft[group.appearanceField][role]?.spriteAppearance??'worker'} onChange={e=>onChange({...draft,[group.appearanceField]:{...draft[group.appearanceField],[role]:{...draft[group.appearanceField][role],spriteAppearance:e.target.value}}})}>{Object.entries(APPEARANCE_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Piel de la tropa<select value={draft[group.appearanceField][role]?.skinTone??'brown'} onChange={e=>onChange({...draft,[group.appearanceField]:{...draft[group.appearanceField],[role]:{...draft[group.appearanceField][role],skinTone:e.target.value}}})}><option value="light">Clara</option><option value="brown">Morena</option><option value="dark">Oscura</option></select></label></fieldset>)}</div>}
  </fieldset>)}
 </section>;
}
