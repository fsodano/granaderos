'use client';
import {rosterFor,operativeLocation} from '../../game/campaign.js';
import {campaignPlace} from '../../game/world-cells.js';
import {operativeInTransit} from '../../game/squads.js';
import {MATURITY_HOURS} from '../../game/horses.js';
import './horses.css';
type Props={state:any;dispatch:(action:any)=>void};
export default function Horses({state:s,dispatch}:Props){
 const horses=s.horseState?.horses??[],hour=s.hour,roster=rosterFor(s);
 const place=(id:string)=>campaignPlace(id)?.name??id;
 const available=!s.defeated&&!s.pendingBattle&&!s.pendingEncounter&&s.sectors[s.location]?.owner==='patriot';
 const order=(payload:any)=>dispatch({type:'horseAction',order:payload});
 const riders=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&!s.operativeState[o.id]?.captured&&!operativeInTransit(s,o.id)&&operativeLocation(s,o.id)===s.location);
 return <section className="horses-section"><div className="section-intro"><p className="eyebrow">CABALLADA</p><h2>Monturas y jinetes</h2><p>Asigná las monturas presentes en {place(s.location)}. Cada animal conserva su condición, resistencia y jinete.</p></div>
 {!available&&<p className="horse-notice">La caballada requiere un sector patriota y una campaña activa, sin despliegue táctico pendiente.</p>}
 <p className="horse-notice">El descanso recupera resistencia. Solo una montura presente y en condiciones puede recibir un jinete.</p>
 {!horses.length&&<p className="horse-empty">No hay monturas en la caballada.</p>}
 <div className="horse-grid">{horses.map((h:any)=>{
 const adult=hour-h.bornAt>=MATURITY_HOURS,local=h.location===s.location,usable=available&&local&&!h.returned&&!h.custody&&!operativeInTransit(s,h.assignedTo);
 const assigned=roster.find(o=>o.id===h.assignedTo);
 const candidates=riders.filter(o=>!horses.some((other:any)=>!other.returned&&other.id!==h.id&&other.assignedTo===o.id));
 return <article key={h.id} className={`horse-card${h.returned?' horse-returned':''}`}><div className="horse-heading"><h3>{h.name}</h3><span>{h.custody?'Capturado':h.returned?'Devuelto':h.hired?'Arrendado':adult?'Propio':'Cría'}</span></div><p>{h.sex==='mare'?'Yegua':'Padrillo'} · {place(h.location)}</p><dl><div><dt>Condición</dt><dd>{h.condition}%</dd></div><div><dt>Resistencia</dt><dd>{h.stamina}%</dd></div><div><dt>Jinete</dt><dd>{assigned?.name??'Sin asignar'}</dd></div></dl>
 {!adult&&<p>Edad de monta dentro de {Math.ceil((MATURITY_HOURS-hour+h.bornAt)/24)} días.</p>}
 {h.hired&&!h.returned&&<p>Devolución en {Math.max(0,Math.ceil((h.hireUntil-hour)/24))} días.</p>}
 {!h.returned&&<><label>Asignar jinete<select aria-label={`Jinete de ${h.name}`} value={h.assignedTo??''} disabled={!usable||!adult||h.condition<30||h.stamina<20} onChange={e=>order(e.target.value?{type:'assign',horseId:h.id,operativeId:Number(e.target.value)}:{type:'unassign',horseId:h.id})}><option value="">Sin asignar</option>{candidates.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}{assigned&&!candidates.some(o=>o.id===assigned.id)&&<option value={assigned.id}>{assigned.name}</option>}</select></label>
 {h.assignedTo!==null&&<button className="line-button" disabled={!usable} onClick={()=>order({type:'unassign',horseId:h.id})}>Liberar montura</button>}
 {!local&&<small>Viajá hasta su ubicación para asignar un jinete.</small>}{adult&&(h.condition<30||h.stamina<20)&&<small>No está en condiciones de recibir un jinete.</small>}</>}
 </article>;})}</div></section>;
}
