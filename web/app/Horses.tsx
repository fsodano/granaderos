'use client';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,rosterFor,operativeLocation} from '../../game/campaign.js';
import {MATURITY_HOURS} from '../../game/horses.js';
import './horses.css';
type Props={state:any;dispatch:(action:any)=>void};
export default function Horses({state:s,dispatch}:Props){
 const [name,setName]=useState('');const [sex,setSex]=useState('mare');
 const horses=s.horseState?.horses??[],hour=s.hour,roster=rosterFor(s);
 const place=(id:string)=>CAMPAIGN_SECTORS.find(x=>x.id===id)?.name??id;
 const available=!s.defeated&&!s.pendingBattle&&s.sectors[s.location]?.owner==='patriot';
 const order=(payload:any)=>dispatch({type:'horseAction',order:payload});
 const riders=roster.filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive&&operativeLocation(s,o.id)===s.location);
 return <section className="horses-section"><div className="section-intro"><p className="eyebrow">CABALLADA Y ESTANCIA</p><h2>Una montura para cada jinete</h2><p>Comprá o arrendá caballos en {place(s.location)}. Cada animal conserva su condición, forraje y jinete. Los {s.resources.horses} caballos de reserva se destinan a remudas y entregas de campaña.</p></div>
 <div className="horse-acquire"><label>Nombre de la montura<input maxLength={30} value={name} placeholder="Nombre automático si se deja vacío" onChange={e=>setName(e.target.value)}/></label><label>Sexo<select value={sex} onChange={e=>setSex(e.target.value)}><option value="mare">Yegua</option><option value="stallion">Padrillo</option></select></label><button className="gold-button" disabled={!available||s.resources.treasury<180} onClick={()=>order({type:'acquire',name:name.trim()||undefined,sex})}>Comprar caballo · 180 pesos</button><button className="line-button" disabled={!available||s.resources.treasury<35} onClick={()=>order({type:'hire',name:name.trim()||undefined,sex})}>Arrendar caballo 30 días · 35 pesos</button></div>
 {!available&&<p className="horse-notice">La estancia requiere un sector patriota y una campaña activa, sin despliegue táctico pendiente.</p>}
 <p className="horse-notice">Cada incorporación incluye siete días de forraje. El descanso recupera resistencia; la falta de alimento deteriora la condición. La gestación dura 330 días y la cría necesita tres años para servir de montura.</p>
 {!horses.length&&<p className="horse-empty">La caballada todavía no tiene animales. Incorporá una montura y asignala a un combatiente presente para llevarla al sector táctico.</p>}
 <div className="horse-grid">{horses.map((h:any)=>{
 const adult=hour-h.bornAt>=MATURITY_HOURS,local=h.location===s.location,usable=available&&local&&!h.returned;
 const assigned=roster.find(o=>o.id===h.assignedTo);
 const candidates=riders.filter(o=>!horses.some((other:any)=>!other.returned&&other.id!==h.id&&other.assignedTo===o.id));
 const sires=horses.filter((other:any)=>!other.returned&&!other.hired&&other.sex==='stallion'&&other.location===h.location&&hour-other.bornAt>=MATURITY_HOURS&&other.condition>=60);
 return <article key={h.id} className={`horse-card${h.returned?' horse-returned':''}`}><div className="horse-heading"><h3>{h.name}</h3><span>{h.returned?'Devuelto':h.hired?'Arrendado':adult?'Propio':'Cría'}</span></div><p>{h.sex==='mare'?'Yegua':'Padrillo'} · {place(h.location)}</p><dl><div><dt>Condición</dt><dd>{h.condition}%</dd></div><div><dt>Resistencia</dt><dd>{h.stamina}%</dd></div><div><dt>Forraje</dt><dd>{h.feed} días</dd></div><div><dt>Jinete</dt><dd>{assigned?.name??'Sin asignar'}</dd></div></dl>
 {!adult&&<p>Edad de monta dentro de {Math.ceil((MATURITY_HOURS-hour+h.bornAt)/24)} días.</p>}
 {h.hired&&!h.returned&&<p>Devolución en {Math.max(0,Math.ceil((h.hireUntil-hour)/24))} días.</p>}
 {h.pregnantUntil!==null&&<p>Parto previsto dentro de {Math.max(0,Math.ceil((h.pregnantUntil-hour)/24))} días.</p>}
 {!h.returned&&<><label>Asignar jinete<select aria-label={`Jinete de ${h.name}`} value={h.assignedTo??''} disabled={!usable||!adult||h.condition<30||h.stamina<20} onChange={e=>order(e.target.value?{type:'assign',horseId:h.id,operativeId:Number(e.target.value)}:{type:'unassign',horseId:h.id})}><option value="">Sin asignar</option>{candidates.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}{assigned&&!candidates.some(o=>o.id===assigned.id)&&<option value={assigned.id}>{assigned.name}</option>}</select></label>
 {h.assignedTo!==null&&<button className="line-button" disabled={!usable} onClick={()=>order({type:'unassign',horseId:h.id})}>Liberar montura</button>}
 <button className="line-button" disabled={!usable||s.resources.treasury<60} onClick={()=>order({type:'feed',horseId:h.id,days:30})}>Agregar 30 días de forraje · 60 pesos</button>
 {h.sex==='mare'&&!h.hired&&!h.pregnantUntil&&<label>Iniciar cría · 80 pesos<select aria-label={`Padrillo para ${h.name}`} value="" disabled={!usable||!adult||h.condition<60||!sires.length||s.resources.treasury<80} onChange={e=>{if(e.target.value)order({type:'breed',horseId:h.id,sireId:e.target.value});}}><option value="">Elegí un padrillo propio</option>{sires.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
 {!local&&<small>Viajá a esta estancia para atender al animal.</small>}{adult&&(h.condition<30||h.stamina<20)&&<small>Necesita alimento y descanso antes de recibir un jinete.</small>}</>}
 </article>;})}</div></section>;
}
