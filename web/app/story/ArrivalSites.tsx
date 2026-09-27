'use client';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
import {ARRIVAL_FACILITIES,arrivalFacilityOptions,defaultArrivalSites} from '../../../game/arrival-sites.js';
export default function ArrivalSites({draft,onChange}:{draft:any;onChange:(next:any)=>void}){
 const sites=draft.arrivalSites??defaultArrivalSites();
 function toggle(sector:string,facility:string){
  const current=sites.find((s:any)=>s.sector===sector)?.facilities??[];
  const facilities=current.includes(facility)?current.filter((f:string)=>f!==facility):[...current,facility];
  onChange({...draft,arrivalSites:[...sites.filter((s:any)=>s.sector!==sector),...(facilities.length?[{sector,facilities}]:[])]});
 }
 return <section className="test-panel" aria-label="Llegadas de contratados">
  <h2>Puntos de llegada de contratados</h2>
  <p>Marcá los lugares que pueden recibir contratados. Al jugar, el destino debe estar bajo tu control y sin enemigos. Un bloqueo impide llegar a un lugar que solo tiene acceso por agua.</p>
  <p>Una celda de río no es un embarcadero. Los pasos cordilleranos tampoco son puntos de recepción. El tiempo de viaje se configura en la ficha de cada contratado.</p>
  <button onClick={()=>onChange({...draft,arrivalSites:defaultArrivalSites()})}>Restaurar puntos de llegada</button>
  <div className="table-wrap"><table><thead><tr><th>Localidad</th>{Object.entries(ARRIVAL_FACILITIES).map(([id,label])=><th key={id}>{label}</th>)}</tr></thead><tbody>
   {CAMPAIGN_SECTORS.map(sector=><tr key={sector.id}><th scope="row">{sector.name}</th>{Object.entries(ARRIVAL_FACILITIES).map(([id,label])=><td key={id}>
    {arrivalFacilityOptions(sector.id).includes(id)?<input type="checkbox" aria-label={`${label} en ${sector.name}`} checked={sites.some((s:any)=>s.sector===sector.id&&s.facilities.includes(id))} onChange={()=>toggle(sector.id,id)}/>:<span aria-label="Sin acceso compatible">—</span>}
   </td>)}</tr>)}
  </tbody></table></div>
  {!sites.length&&<p role="status">No hay puntos habilitados. Esta campaña no podrá recibir contratados.</p>}
 </section>;
}
