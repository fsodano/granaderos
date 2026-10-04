import {sitePath} from '../lib/site-path.js';
import {worldCell} from '../../game/world-cells.js';
import {squadTravelStatus} from '../../game/squad-travel.js';
import {ALL_ASSIGNMENTS} from '../../game/medical-care.js';
import {operativeLocation} from '../../game/squads.js';
import {sleepOrderReason} from '../../game/sleep.js';
import {contractStatus} from '../../game/contracts.js';
import {portraitFor} from '../lib/portraits';
import {travelTime} from '../lib/travel-time';
import {strategicSquadLabel} from '../../game/strategic-squad-assignments.js';
const grid=(id:string)=>worldCell(id)?.grid??'—';
type Props={state:any;roster:any[];onSquad?:(id:string)=>void;onDossier:(id:number)=>void;onOpenDesk:()=>void;onAssignment:(id:number)=>void;onContract:(id:number)=>void;onDestination:(id:string)=>void;dispatch:(a:any)=>void};
export default function StrategicRoster({state:s,roster,onDossier,onOpenDesk,onAssignment,onContract,onDestination,dispatch}:Props){
 const selected=s.squads.find((q:any)=>q.id===s.activeSquadId),blocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated);
 return <aside className="strategy-personnel" aria-label="Nómina de combatientes">
 <div className="personnel-title"><h2>Nómina</h2><span>{s.recruited.length} {s.recruited.length===1?'soldado':'soldados'}</span></div>
 <div className="strategy-roster-scroll">
 {!s.recruited.length&&<p className="roster-hint">Creá tu oficial o contratá soldados en el escritorio.</p>}
 <table className="merc-map-table dense-personnel-table"><colgroup><col className="personnel-name-column"/><col className="personnel-assignment-column"/><col className="personnel-sleep-column"/><col className="personnel-location-column"/><col className="personnel-destination-column"/><col className="personnel-contract-column"/></colgroup><thead><tr><th>Nombre</th><th>Asignación</th><th>Sueño</th><th>Ubic.</th><th>Destino</th><th>Fin contrato</th></tr></thead><tbody>{s.recruited.map((id:number)=>{const op=roster.find(o=>o.id===id),r=s.operativeState[id],q=s.squads.find((q:any)=>q.members.includes(id)),j=q?squadTravelStatus(q):null,c=contractStatus(s,id);return <tr key={id} data-operative-id={id} data-active-member={selected?.members.includes(id)}>
 <th><button type="button" title={op.name} onClick={()=>onDossier(id)}>{portraitFor(op.portraitId??id)&&<img src={sitePath(portraitFor(op.portraitId??id)!)} alt=""/>}<span>{op.nickname}<small>{r.alive?`${Math.round(r.hp)} PS`:'☠ Caído'}</small></span></button></th>
 <td><button aria-label={`Asignación: ${op.nickname}`} title={r.assignment==='active'?q?.name:undefined} disabled={blocked||!r.alive||r.captured} onClick={()=>onAssignment(id)}>{r.captured?'Prisionero':!r.alive?'Caído':(r.assignment??'active')==='active'?q?strategicSquadLabel(s,q.id):'En servicio':ALL_ASSIGNMENTS[(r.assignment??'active') as keyof typeof ALL_ASSIGNMENTS]}</button></td>
 <td><button aria-label={`${r.asleep?'Despertar':'Dormir'}: ${op.nickname}`} disabled={blocked||Boolean(sleepOrderReason(s,id,!r.asleep))} title={sleepOrderReason(s,id,!r.asleep)||undefined} onClick={()=>dispatch({type:'setSleep',operativeId:id,asleep:!r.asleep})}>{r.asleep?'☾':'—'}</button></td>
 <td>{grid(operativeLocation(s,id))}</td><td><button aria-label={`Destino: ${op.nickname}`} title={j?`${grid(j.destination)} · ${j.status==='ready'?'Listos':j.status==='paused'?'Detenida':travelTime(j.remaining)}`:undefined} disabled={blocked||!q||Boolean(q.journey)} onClick={()=>q&&onDestination(q.id)}>{j?<>{grid(j.destination)}<small>{j.status==='ready'?'Listos':j.status==='paused'?'Detenida':travelTime(j.remaining)}</small></>:'Elegir'}</button></td><td><button aria-label={`Fin contrato: ${op.nickname}`} disabled={blocked||!r.alive||!c} onClick={()=>onContract(id)}>{c?.remaining===null?'∞':c?`${Math.ceil(c.remaining/24)} d`:'—'}</button></td>
 </tr>;})}</tbody></table></div>
 <section className="strategic-history" aria-label="Historial estratégico"><h3>Historial</h3><div>{(s.log??[]).slice(0,20).map((entry:any,i:number)=><p key={`${entry.hour}:${i}`}><time>D{Math.floor(entry.hour/24)+1} {String(entry.hour%24).padStart(2,'0')}:{String(Math.floor((entry.secondOfHour??0)/60)).padStart(2,'0')}</time> {entry.text}</p>)}</div></section>
 {!s.recruited.length&&<div className="roster-footer"><button className="line-button" onClick={onOpenDesk}>Crear o contratar</button></div>}
 </aside>;
}
