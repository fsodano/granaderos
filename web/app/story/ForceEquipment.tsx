'use client';
import {FORCE_EQUIPMENT,defaultForceEquipment,defaultForceBlades} from '../../../game/content-force-equipment.js';

export default function ForceEquipment({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 return <section aria-label="Armamento de las tropas">
  <h2>Armamento de las tropas</h2>
  <p>Elegí el arma principal y el arma blanca de cada tipo de tropa. Los soldados reciben su equipo al crearse y lo conservan al volver al sector.</p>
  {Object.entries(FORCE_EQUIPMENT).map(([field,group])=><fieldset key={field}>
   <legend>{group.label}</legend>
   {draft[field]===undefined ? <>
    <p>Este paquete conserva las armas originales de este grupo.</p>
    <button onClick={()=>onChange({...draft,[field]:defaultForceEquipment(field,draft.weapons)})}>Configurar armas de {group.label.toLowerCase()}</button>
   </> : <div className="fields">{Object.entries(group.roles).map(([role,label])=><label key={role}>{label}
    <select value={draft[field][role]??''} onChange={e=>onChange({...draft,[field]:{...draft[field],[role]:e.target.value||null}})}>
     <option value="">Sin arma principal</option>
     {draft.weapons.map((weapon:any)=><option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
    </select>
   </label>)}</div>}
   {draft[group.bladeField]===undefined ? <>
    <p>Las armas blancas de este grupo conservan sus valores originales.</p>
    <button onClick={()=>onChange({...draft,[group.bladeField]:defaultForceBlades(field,draft.weapons)})}>Configurar armas blancas de {group.label.toLowerCase()}</button>
   </> : <div className="fields">{Object.entries(group.roles).map(([role,label])=><label key={role}>{`Arma blanca · ${label}`}
    <select value={draft[group.bladeField][role]??''} onChange={e=>onChange({...draft,[group.bladeField]:{...draft[group.bladeField],[role]:e.target.value||null}})}>
     <option value="">Arma blanca original</option>
     {draft.weapons.filter((w:any)=>w.template>=1809).map((weapon:any)=><option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
    </select>
   </label>)}</div>}
  </fieldset>)}
 </section>;
}
