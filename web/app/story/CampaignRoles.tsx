'use client';
import {rolesForContent} from '../../../game/campaign-roles.js';
export default function CampaignRoles({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const roles=rolesForContent(draft);
 return <section aria-label="Funciones de campaña"><h2>Funciones de campaña</h2>
  <p>Asigná estas funciones a personajes de tu elenco. Necesitan estar incorporados, con vida, libres y con servicio vigente. La contratación pendiente no activa la función.</p>
  {([['foundryEngineer','Responsable de fundición'],['marchCommander','Responsable de marcha']] as const).map(([key,label])=><label key={key}>{label}<select value={roles[key]??''} onChange={e=>onChange({...draft,campaignRoles:{...roles,[key]:e.target.value||null}})}><option value="">Ninguno</option>{draft.characters.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
  <p>La fundición usa la ubicación y los costos de Fundición y preparación. El responsable de marcha evita el aumento de fatiga por viajes de todas las escuadras mientras siga en servicio.</p>
  <p>Estas funciones no cambian las habilidades de combate, los requisitos de incorporación ni los papeles de San Lorenzo o Yatasto. No se transfieren al copiar una ficha ni al aparecer un sucesor. La campaña histórica necesita organizar la fundición para avanzar.</p>
  <button type="button" onClick={()=>{const next={...draft};delete next.campaignRoles;onChange(next);}}>Restaurar funciones originales</button>
 </section>;
}
