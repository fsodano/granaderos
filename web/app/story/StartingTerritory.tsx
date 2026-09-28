'use client';
import {HEADQUARTERS_OPTIONS} from '../../../game/campaign-headquarters.js';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
import {defaultStartingTerritory} from '../../../game/content-territory.js';
export default function StartingTerritory({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const headquarters=draft.headquarters??'retiro',territory=draft.startingTerritory??defaultStartingTerritory(headquarters);
 function chooseHeadquarters(id:string){onChange({...draft,headquarters:id,startingTerritory:{...territory,[id]:{...territory[id],owner:'patriot'}}});}
 function change(id:string,field:string,value:string|number){onChange({...draft,startingTerritory:{...territory,[id]:{...territory[id],[field]:value}}});}
 return <section aria-label="Territorio inicial" className="test-panel">
  <h2>Territorio al iniciar la campaña</h2>
  <p>Elegí quién controla cada localidad y su lealtad inicial. Sus barrios comparten el control; el terreno abierto conserva su estado neutral. Las apariciones de personajes se eligen por celda en su ficha.</p>
  <label>Cuartel general<select value={headquarters} onChange={e=>chooseHeadquarters(e.target.value)}>{HEADQUARTERS_OPTIONS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <p>La primera escuadra comienza en el cuartel. Allí nace el abastecimiento y funciona una sala de armas con taller. Debe comenzar bajo control patriota; perderlo termina la campaña. Al elegirlo, esa localidad pasa a control patriota. Revisá también sus puntos de recepción en Llegadas.</p>
  <p>Los capítulos posteriores y los contactos históricos conservan sus funciones actuales. El puerto de importaciones se configura a continuación.</p>
  <p>Estas opciones se aplican una sola vez. El juego conserva las conquistas, pérdidas y cambios de lealtad al guardar. El control inicial no concede recompensas de combate ni completa misiones.</p>
  <div className="table-wrap"><table><thead><tr><th>Localidad</th><th>Control inicial</th><th>Lealtad inicial (%)</th></tr></thead><tbody>{CAMPAIGN_SECTORS.map(s=><tr key={s.id}>
   <th scope="row">{s.name}</th>
   <td><select aria-label={`Control inicial de ${s.name}`} value={territory[s.id].owner} disabled={s.id===headquarters} onChange={e=>change(s.id,'owner',e.target.value)}><option value="patriot">Patriota</option><option value="royalist">Realista</option></select></td>
   <td><input aria-label={`Lealtad inicial de ${s.name}`} type="number" min={0} max={100} step={1} value={Number.isFinite(territory[s.id].loyalty)?territory[s.id].loyalty:''} onChange={e=>change(s.id,'loyalty',e.target.valueAsNumber)}/></td>
  </tr>)}</tbody></table></div>
  <button onClick={()=>onChange({...draft,headquarters:'retiro',startingTerritory:defaultStartingTerritory()})}>Restaurar territorio original</button>
 </section>;
}
