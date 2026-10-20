'use client';
import {sitePath} from '../lib/site-path.js';
import {campaignUI} from '../lib/campaign-ui';
import {campaignPresentation,campaignSectors} from '../../game/campaign-definition.js';
import {campaignStory,campaignChapterIndex} from '../../game/campaign-story.js';
import {startingTerritoryDescription} from '../../game/content-territory.js';
import {useState} from 'react';
import Recruitment from './Recruitment';
import CharacterCreator from './CharacterCreator';
import ReceivedCorrespondence from './ReceivedCorrespondence';
import Logistics from './Logistics';
import {incomeSummary} from '../../game/economy.js';
import {campaignChapters} from '../../game/campaign-headquarters.js';
import {rosterFor} from '../../game/campaign.js';
import {portraitFor} from '../lib/portraits';
import './desk.css';
const tabs=[['overview','Resumen'],['create','Tu personaje'],['hire','Contrataciones'],['contacts','Correspondencia'],['transport','Transportes']];
export default function Desk({state:s,dispatch,onClose,initialTab='overview'}:{state:any;dispatch:(action:any)=>void;onClose:()=>void;initialTab?:string}){
 const income=incomeSummary(s),presentation=campaignPresentation(s),ui=campaignUI(s),{DeskBriefing,DeskObjective}=ui;
 const serving=s.recruited.filter((id:number)=>{const r=s.operativeState[id];return r?.alive&&r.hp>0&&!r.captured;}).length;
 const fallen=Object.entries(s.operativeState).filter(([id,r]:[string,any])=>(s.recruited.includes(Number(id))||r.location!==undefined)&&(!r.alive||r.hp<=0)).length;
 // Service locations remain after a contract ends, so an empty later roster
 // must not bring back the first-start guide (including in chapterless campaigns).
 const started=Boolean(s.officer||s.recruited.length||s.hiringArrivals?.length||s.phase>0||s.campaignProgress?.completed.length||s.completed||s.defeated||Object.values(s.operativeState).some((r:any)=>r.location!==undefined));
 const sectors=campaignSectors(s),controlled=sectors.filter(sector=>s.sectors[sector.id]?.owner==='patriot').length,story=campaignStory(s);
 const [tab,setTab]=useState(tabs.some(([id])=>id===initialTab)?initialTab:'overview');const own=rosterFor(s).find(o=>o.id===1000);const phase=campaignChapters(s)[campaignChapterIndex(s)];
 return <div className="desk-screen"><aside className="desk-sidebar"><p className="eyebrow">CUARTEL GENERAL</p><h1>Escritorio</h1><div className="desk-seal" aria-hidden="true">{presentation.deskSeal??'✳'}</div><nav aria-label="Carpetas del escritorio">{tabs.map(([id,name])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{name}{id==='create'&&s.officer?' ✓':''}</button>)}</nav><div className="desk-balance"><span>Fondos disponibles</span><strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong><small>+{income.daily.toLocaleString('es-AR')} pesos por día · {presentation.incomeLabel??'ingresos de campaña'}</small><small>Cobro a medianoche</small><small>{serving} {serving===1?'combatiente':'combatientes'} en servicio</small></div><button className="gold-button" onClick={onClose}>Carta de operaciones →</button></aside>
 <main className="desk-paper"><header><p className="eyebrow">{presentation.eyebrow??presentation.title??'CAMPAÑA'} · DÍA {Math.floor(s.hour/24)+1}</p><h2>{tabs.find(t=>t[0]===tab)?.[1]}</h2></header>{s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}
 {tab==='overview'&&<section className="desk-overview">
  {DeskBriefing&&<DeskBriefing state={s} dispatch={dispatch}/>}
  <p className="desk-lead">{started?(s.defeated?'Campaña terminada.':s.completed?'Campaña concluida.':'La campaña está en marcha.'):(story?.introduction??'Reuní tu primera escuadra.')}</p>
  {started?<p>Control actual: {controlled} de {sectors.length} sectores. {serving} {serving===1?'combatiente':'combatientes'} en servicio · {fallen} {fallen===1?'caído':'caídos'}.</p>:<p>{startingTerritoryDescription(s)} Podés contratar combatientes, crear tu personaje o combinar ambas opciones. Con una sola persona ya podés partir.</p>}
  <ol className={`desk-checklist${started?' desk-progress':''}`}>
   {!started&&<><li><strong>Creá tu personaje · Opcional</strong><p>Elegí un rostro, un oficio y tus aptitudes. Tus respuestas definen la forma de afrontar la campaña.</p><button className="line-button" onClick={()=>setTab('create')}>Crear mi personaje</button></li><li><strong>Reuní tu escuadra</strong><p>No necesitás crear un personaje propio. Consultá antecedentes y contratá por un día, una semana o dos semanas. Si hay un viaje pendiente, esperá su llegada al cuartel.</p><button className="line-button" onClick={()=>setTab('hire')}>Examinar candidatos</button></li></>}
   <li><strong>{s.completed||s.defeated?'Resultado de la campaña':phase.name}</strong><p>{s.defeated?(story?.defeat??'La campaña no puede continuar.'):s.completed?(story?.victory??ui.victoryText??'Los objetivos de la campaña están cumplidos.'):phase.objective}</p>{!s.completed&&!s.defeated&&DeskObjective&&<DeskObjective state={s} dispatch={dispatch}/>}<button className="line-button" onClick={onClose}>Abrir la carta</button></li>
   {started&&<li><strong>Personal y contratos</strong><p>Consultá el estado de tus combatientes y sus contratos en la carta de operaciones. Podés examinar candidatos para incorporar refuerzos.</p>{serving===1&&!s.completed&&!s.defeated&&<p>Con una sola persona ya podés partir.</p>}<button className="line-button" onClick={()=>setTab('hire')}>Examinar candidatos</button> <button className="line-button" onClick={()=>setTab('create')}>{s.officer?'Ver mi personaje':'Crear mi personaje'}</button></li>}
  </ol>
 </section>}
 {tab==='create'&&(s.officer&&own?<section className="creator-finished">{portraitFor((own as any).portrait??(own as any).portraitId??own.id,s)&&<img src={sitePath(portraitFor((own as any).portrait??(own as any).portraitId??own.id,s)!)} alt={own.name}/>}<h3>{own.name}</h3><p>{own.role}</p><p>Tu personaje ya está creado. Su hoja de servicio y su progreso se consultan desde la carta de operaciones.</p><button className="gold-button" onClick={onClose}>Ver mi personaje en la carta</button></section>:<CharacterCreator state={s} onCreate={(name,answers,profile)=>dispatch({type:'createOfficer',name,answers,profile})}/>)}
 {tab==='hire'&&<Recruitment state={s} dispatch={dispatch}/>}
 {tab==='contacts'&&<ReceivedCorrespondence state={s}/>}
 {tab==='transport'&&<Logistics state={s} dispatch={dispatch}/>}
 </main></div>;
}
