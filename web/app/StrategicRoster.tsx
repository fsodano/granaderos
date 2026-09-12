import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {squadTravelStatus} from '../../game/squad-travel.js';
import {ALL_ASSIGNMENTS} from '../../game/medical-care.js';
import {portraitFor} from '../lib/portraits';
const grid=(id:string)=>CAMPAIGN_SECTORS.find(d=>d.id===id)?.grid??'—';
export default function StrategicRoster({state:s,roster,onSquad,onDossier,onOpenDesk,onManage}:{state:any;roster:any[];onSquad:(id:string)=>void;onDossier:(id:number)=>void;onOpenDesk:()=>void;onManage:()=>void}){
 const selected=s.squads.find((q:any)=>q.id===s.activeSquadId);
 return <aside className="strategy-personnel" aria-label="Escuadras y combatientes">
 <div className="personnel-title"><h2>Escuadras</h2><span>{s.recruited.length} soldados</span></div>
 <p className="roster-hint">Seleccioná una escuadra y después su destino en el mapa.</p>
 <div className="strategy-roster-scroll"><table className="squad-map-table"><thead><tr><th>Escuadra</th><th>Ubic.</th><th>Destino</th></tr></thead><tbody>{s.squads.map((q:any)=>{const j=squadTravelStatus(q);return <tr key={q.id} data-selected={q.id===s.activeSquadId}><th><button type="button" aria-pressed={q.id===s.activeSquadId} disabled={Boolean(s.pendingBattle||s.defeated)} onClick={()=>onSquad(q.id)}>{q.name}<small>{q.members.length}/6</small></button></th><td>{j?.status==='moving'?'→ ':''}{grid(q.location)}</td><td>{j?<>{grid(j.destination)}<small>{j.status==='ready'?'Listos':j.status==='paused'?'Detenida':`${j.remaining} h`}</small></>:'—'}</td></tr>;})}</tbody></table>
 <h3 className="roster-subtitle">Nómina</h3>
 {selected.members.length===0&&<p className="roster-hint">Sin combatientes. Creá tu oficial o contratá soldados en el escritorio.</p>}
 <table className="merc-map-table"><thead><tr><th>Nombre</th><th>Salud</th><th>Asignación</th></tr></thead><tbody>{[...selected.members,...s.recruited.filter((id:number)=>!selected.members.includes(id))].map((id:number)=>{const op=roster.find(o=>o.id===id),record=s.operativeState[id];return <tr key={id} data-active-member={selected.members.includes(id)} title={s.squads.find((q:any)=>q.members.includes(id))?.name??'Sin escuadra'}><th><button type="button" onClick={()=>onDossier(id)}>{portraitFor(op.portraitId??id)&&<img src={portraitFor(op.portraitId??id)!} alt=""/>}{op.nickname}</button></th><td>{Math.round(record.hp)}</td><td>{record.captured?'Prisionero':!record.alive?'Caído':record.asleep?'Durmiendo':ALL_ASSIGNMENTS[(record.assignment??'active') as keyof typeof ALL_ASSIGNMENTS]}</td></tr>;})}</tbody></table>
 </div><div className="roster-footer"><button className="line-button" onClick={onManage}>Organizar escuadras</button>{!s.recruited.length&&<button className="line-button" onClick={onOpenDesk}>Crear o contratar</button>}<strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong></div>
 </aside>;
}
