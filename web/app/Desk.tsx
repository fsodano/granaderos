'use client';
import Recruitment from './Recruitment';
import {ENCOUNTERS} from '../../game/encounters.js';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
export default function Desk({state,dispatch,onClose}:{state:any;dispatch:(action:any)=>void;onClose:()=>void}){
 return <div className="campaign"><header className="campaign-heading"><div><p className="eyebrow">CUARTEL GENERAL · CORRESPONDENCIA</p><h1>Escritorio de campaña</h1><p>Hojas de servicio, recomendaciones y contactos de las provincias.</p></div><button className="line-button" onClick={onClose}>← Volver a la carta de operaciones</button></header>
 {state.lastError&&<p className="notice error" role="alert">{state.lastError}</p>}
 <Recruitment state={state} dispatch={dispatch}/>
 <section className="recruit-heading"><p className="eyebrow">CONTACTOS EN EL TERRITORIO</p><h2>Encuentros y alianzas</h2><p>Viajá hasta el sector y conversá personalmente. Su colaboración depende de tus actos, del liderazgo del interlocutor y de la situación de la campaña.</p><div className="roster-grid">{ENCOUNTERS.filter((n:any)=>n.operativeId!==undefined&&!state.recruited.includes(n.operativeId)).map(n=><article className="officer" key={n.id}><h3>{n.name}</h3><p>{CAMPAIGN_SECTORS.find(s=>s.id===n.sector)?.name}</p><small>Encuentro personal · No se contrata por correspondencia</small></article>)}</div></section>
 </div>;
}
