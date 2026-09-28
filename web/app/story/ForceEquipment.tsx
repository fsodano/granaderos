'use client';
import {FORCE_EQUIPMENT,defaultForceEquipment} from '../../../game/content-force-equipment.js';

export default function ForceEquipment({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 return <section aria-label="Armamento de las tropas">
  <h2>Armamento de las tropas</h2>
  <p>Elegí el arma de fuego de cada tipo de tropa. Los soldados reciben su equipo al crearse y lo conservan al volver al sector.</p>
  {Object.entries(FORCE_EQUIPMENT).map(([field,group])=><fieldset key={field}>
   <legend>{group.label}</legend>
   {draft[field]===undefined ? <>
    <p>Este paquete conserva las armas originales de este grupo.</p>
    <button onClick={()=>onChange({...draft,[field]:defaultForceEquipment(field,draft.weapons)})}>Configurar armas de {group.label.toLowerCase()}</button>
   </> : <div className="fields">{Object.entries(group.roles).map(([role,label])=><label key={role}>{label}
    <select value={draft[field][role]??''} onChange={e=>onChange({...draft,[field]:{...draft[field],[role]:e.target.value||null}})}>
     <option value="">Sin arma de fuego</option>
     {draft.weapons.filter((w:any)=>w.template<1809).map((weapon:any)=><option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
    </select>
   </label>)}</div>}
  </fieldset>)}
 </section>;
}
