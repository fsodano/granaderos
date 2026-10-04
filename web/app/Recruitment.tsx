'use client';
import {sitePath} from '../lib/site-path.js';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,rosterFor,contractQuote,contractStatus,civicStatus} from '../../game/campaign.js';
import {hiringArrivalOptions,hiringArrivalReason,hiringTravelHours,pendingHire} from '../../game/hiring-arrivals.js';
import {contractTermsFor} from '../../game/contracts.js';
import {filterMercenaries} from '../../game/mercenary-catalogue.js';
import {isContractOperative} from '../../game/content-character-ids.js';
import {characterProfile} from '../../game/characters.js';
import {portraitFor} from '../lib/portraits';
import CharacterDossier from './CharacterDossier';
import ServiceRefusalNotice from './ServiceRefusalNotice';
import './recruitment.css';
type Props={state:any;dispatch:(a:any)=>void};
export default function Recruitment({state:s,dispatch}:Props){
 const [selected,setSelected]=useState<number|null>(null),[periods,setPeriods]=useState<Record<number,string>>({});
 const [query,setQuery]=useState(''),[specialty,setSpecialty]=useState('all'),[availability,setAvailability]=useState('all'),[sort,setSort]=useState('name');
 const [chosenDestination,setDestination]=useState('');
 const terms=Object.entries(contractTermsFor(s)).filter(([id])=>['day','week','fortnight'].includes(id)).map(([id,period])=>[id,period.name]);
 const roster=rosterFor(s).filter(o=>isContractOperative(s,o));
 const serving=roster.filter(o=>{const r=s.operativeState[o.id];return s.recruited.includes(o.id)&&r?.alive&&r.hp>0&&!r.captured;}).length;
 const options=hiringArrivalOptions(s);
 const destination=options.some(o=>o.id===chosenDestination)?chosenDestination:options.find(o=>o.id===s.location)?.id??options[0]?.id??'';
 const visible:typeof roster=filterMercenaries(roster,s,{query,specialty,availability,sort});
 const busy=Boolean(s.pendingBattle||s.pendingEncounter)||s.defeated;
 return <section className="roster-section">
  <p>Cada contrato se paga por adelantado y comienza cuando llega el personaje. Hasta entonces, el contratado permanece fuera del mapa.</p>
  <label className="arrival-destination">Destino de nuevos contratados
   <select value={destination} onChange={e=>setDestination(e.target.value)} disabled={!options.length||busy}>
    {!options.length&&<option value="">No hay destinos disponibles</option>}
    {options.map(o=><option key={o.id} value={o.id}>{o.name} · {o.infrastructure}</option>)}
   </select>
  </label>
  <p className="catalogue-count">El destino debe estar bajo tu control y tener una posta, un cuartel, un puerto o un embarcadero habilitado. Un bloqueo impide la llegada por agua.</p>
  {!options.length&&<p role="status">No hay un punto seguro para recibir contratados. Podés renovar los contratos vigentes.</p>}
  <div className="catalogue-tools">
   <label>Buscar mercenario<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre, apodo u oficio"/></label>
   <label>Especialidad<select value={specialty} onChange={e=>setSpecialty(e.target.value)}>{[['all','Todas'],['marksman','Tiro · 70+'],['medic','Medicina · 70+'],['mechanic','Mecánica · 70+'],['artillery','Artillería · 70+'],['leader','Liderazgo · 70+'],['scout','Exploración'],['rider','Caballería']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label>Estado<select value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">Todos</option><option value="available">Sin contratar · Con vida</option><option value="pending">En viaje</option><option value="hired">En tus filas</option><option value="fallen">Caídos</option></select></label>
   <label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Nombre</option><option value="price">Menor paga diaria</option><option value="marksmanship">Mayor puntería</option><option value="medical">Mayor medicina</option></select></label>
  </div>
  <p className="catalogue-count" role="status">{visible.length} de {roster.length} mercenarios · {serving} en tus filas · {(s.hiringArrivals??[]).length} en viaje</p>
  {!visible.length&&<p className="catalogue-empty">No hay mercenarios con estos filtros. <button className="dossier-link" onClick={()=>{setQuery('');setSpecialty('all');setAvailability('all');}}>Mostrar todos</button></p>}
  <div className="recruit-catalogue">{visible.map(o=>{
   const hired=s.recruited.includes(o.id),arrival=pendingHire(s,o.id),term=periods[o.id]||'day',quote=contractQuote(s,o,term),contract=contractStatus(s,o.id),profile=characterProfile(o),record=s.operativeState[o.id];
   const hours=hiringTravelHours(s,o.id),remaining=arrival?Math.max(0,arrival.dueAt-s.hour):0;
   const held=arrival&&(hiringArrivalReason(s,arrival.destination)||(s.pendingBattle?.sector===arrival.destination?'La llegada espera a que salgas del sector.':null));
   return <article key={o.id} className="contract-card" data-operative-id={o.id}>
    <button className="candidate-face" onClick={()=>setSelected(o.id)} aria-label={`Ver hoja de servicio de ${o.name}`}>{portraitFor((o as any).portraitId??o.id)?<img src={sitePath(portraitFor((o as any).portraitId??o.id)!)} alt={o.name} loading="lazy"/>:<span>{o.nickname.slice(0,2).toUpperCase()}</span>}<span>{o.name}</span></button>
    <p className="eyebrow">{o.role}</p><p className="candidate-greeting">«{profile.speech.hired}»</p><p className="candidate-specialties">{profile.skills.join(' · ')}</p>
    <div className="candidate-stats"><span>Puntería <b>{o.marksmanship}</b></span><span>Liderazgo <b>{o.leadership}</b></span><span>Grado <b>{o.level}</b></span></div>
    <button className="dossier-link" onClick={()=>setSelected(o.id)}>Atributos, carácter y equipo →</button>
    {quote.topTier&&<small className="elite-contract">Especialista de élite</small>}
    {arrival?<>
     <p className="contract-remaining">{remaining?`En viaje · faltan ${remaining} horas`:'Llegada pendiente'} · {CAMPAIGN_SECTORS.find(d=>d.id===arrival.destination)?.name}</p>
     <small>{arrival.serviceHours===null?'Servicio permanente':`${arrival.serviceHours/24} días de servicio al llegar`} · Anticipo: {arrival.paid} pesos.</small>
     {held&&<p role="status">{held}</p>}
     <label>Cambiar destino<select aria-label={`Cambiar destino de ${o.name}`} value={arrival.destination} disabled={busy} onChange={e=>dispatch({type:'redirectHire',id:o.id,destination:e.target.value})}>
      {!options.some(d=>d.id===arrival.destination)&&<option value={arrival.destination}>{CAMPAIGN_SECTORS.find(d=>d.id===arrival.destination)?.name} · No disponible</option>}
      {options.map(d=><option key={d.id} value={d.id}>{d.name} · {d.infrastructure}</option>)}
     </select></label>
     <small>Al cambiar el destino, el viaje de {arrival.travelHours} horas comienza de nuevo. No se cobra otro anticipo.</small>
     <button className="dossier-link" disabled={busy} onClick={()=>dispatch({type:'cancelHireArrival',id:o.id})}>Cancelar llegada · recuperar {arrival.paid} pesos</button>
    </>:<>
     {hired&&<p className="contract-remaining">{contract?.remaining===null?'Servicio permanente':`${contract?.remaining??0} horas de contrato restantes`}</p>}
     {!hired&&<small>{hours?`Viaje previsto: ${hours} horas.`:'Llegada inmediata a un destino seguro.'}</small>}
     {quote.serviceRefusal?<ServiceRefusalNotice state={s} refusal={quote.serviceRefusal} disabled={busy} dispatch={dispatch}/>:quote.reason&&<small>{quote.reason}</small>}
     <label>Duración<select aria-label={`Duración del contrato de ${o.name}`} value={term} onChange={e=>setPeriods({...periods,[o.id]:e.target.value})}>{terms.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     <button className="gold-button" disabled={!quote.available||s.resources.treasury<quote.price||record?.alive===false||busy||(!hired&&(!destination||!civicStatus(s,o.id).available))} onClick={()=>dispatch(hired?{type:'renewContract',id:o.id,term}:{type:'recruitCivic',id:o.id,term,destination})}>{record?.alive===false?'Caído en combate':`${hired?'Renovar':'Contratar'} · ${quote.price} pesos`}</button>
     {hired&&<button className="dossier-link" disabled={busy} onClick={()=>dispatch({type:'dismiss',id:o.id})}>Finalizar servicio</button>}
    </>}
    <small>Personaje ficticio · {profile.personality.split('.')[0]}.</small>
   </article>;
  })}</div>
  <CharacterDossier state={s} operative={roster.find(o=>o.id===selected)} record={s.operativeState[selected??-1]} onClose={()=>setSelected(null)}/>
 </section>;
}
