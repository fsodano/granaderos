'use client';
import {campaignStory,campaignChapterIndex} from '../../game/campaign-story.js';
import {startingTerritoryDescription} from '../../game/content-territory.js';
import {missionStatus} from '../../game/missions.js';
import MissionBriefing from './MissionBriefing';
import MissionAssault from './MissionAssault';
import {useState} from 'react';
import Recruitment from './Recruitment';
import CharacterCreator from './CharacterCreator';
import CampaignOffice from './CampaignOffice';
import {incomeSummary} from '../../game/economy.js';
import {campaignChapters} from '../../game/campaign-headquarters.js';
import {rosterFor} from '../../game/campaign.js';
import {encounterContacts} from '../../game/encounters.js';
import {portraitFor} from '../lib/portraits';
import './desk.css';
const tabs=[['overview','Resumen'],['create','Tu granadero'],['hire','Contrataciones'],['contacts','Correspondencia'],['workshop','Tesorería'],['diplomacy','Cabildo'],['journal','Cuaderno']];
export default function Desk({state:s,dispatch,onClose,initialTab='overview'}:{state:any;dispatch:(action:any)=>void;onClose:()=>void;initialTab?:string}){
 const serving=s.recruited.filter((id:number)=>{const r=s.operativeState[id];return r?.alive&&r.hp>0&&!r.captured;}).length;
 const [tab,setTab]=useState(initialTab);const own=rosterFor(s).find(o=>o.id===1000);const phase=campaignChapters(s)[campaignChapterIndex(s)];
 return <div className="desk-screen"><aside className="desk-sidebar"><p className="eyebrow">CUARTEL GENERAL</p><h1>Escritorio</h1><div className="desk-seal" aria-hidden="true">G</div><nav aria-label="Carpetas del escritorio">{tabs.map(([id,name])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{name}{id==='create'&&s.officer?' ✓':''}</button>)}</nav><div className="desk-balance"><span>Tesorería</span><strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong><small>+{incomeSummary(s).daily} pesos por día</small><small>{serving} {serving===1?'granadero':'granaderos'} en servicio</small></div><button className="gold-button" onClick={onClose}>Carta de operaciones →</button></aside>
 <main className="desk-paper"><header><p className="eyebrow">PROVINCIAS UNIDAS · DÍA {Math.floor(s.hour/24)+1}</p><h2>{tabs.find(t=>t[0]===tab)?.[1]}</h2></header>{s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}
 {tab==='overview'&&<section className="desk-overview">{!campaignStory(s)&&s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&s.sectors.tucuman.owner==='patriot'&&s.squad.length>0} blocked={Boolean(s.pendingBattle)} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}<p className="desk-lead">{campaignStory(s)?.introduction??'Reuní tu primera escuadra.'}</p><p>{startingTerritoryDescription(s)} Podés contratar combatientes, crear tu granadero o combinar ambas opciones. Con una sola persona ya podés partir.</p><ol className="desk-checklist"><li><strong>{s.officer?'✓ Tu hoja de servicio está firmada':'Creá tu granadero · Opcional'}</strong><p>Elegí un rostro, un oficio y tus aptitudes. Tus respuestas definen la forma de afrontar la campaña.</p><button className="line-button" onClick={()=>setTab('create')}>{s.officer?'Ver mi granadero':'Crear mi granadero'}</button></li><li><strong>Reuní tu escuadra</strong><p>No necesitás crear un personaje propio. Consultá antecedentes y contratá por un día, una semana o un mes. Si hay un viaje pendiente, esperá su llegada al cuartel.</p><button className="line-button" onClick={()=>setTab('hire')}>Examinar candidatos</button></li><li><strong>{phase.name}</strong><p>{phase.objective}</p>{!campaignStory(s)&&s.phase===1&&s.sectors.san_nicolas.owner==='patriot'&&!s.flags.sanLorenzo&&<MissionAssault key={s.activeSquadId} state={s} dispatch={dispatch}/>}<button className="line-button" onClick={onClose}>Abrir la carta</button></li></ol></section>}
 {tab==='create'&&(s.officer&&own?<section className="creator-finished">{portraitFor((own as any).portraitId??own.id)&&<img src={portraitFor((own as any).portraitId??own.id)!} alt={own.name}/>}<h3>{own.name}</h3><p>{own.role}</p><p>Tu personaje ya está creado. Su hoja de servicio y su progreso se consultan desde la carta de operaciones.</p><button className="gold-button" onClick={onClose}>Ver mi granadero en la carta</button></section>:<CharacterCreator onCreate={(name,answers,profile)=>dispatch({type:'createOfficer',name,answers,profile})}/>)}
 {tab==='hire'&&<Recruitment state={s} dispatch={dispatch}/>}
 {tab==='contacts'&&<section><p>Estos contactos se encuentran en el territorio. Su colaboración depende de conversaciones y compromisos cumplidos.</p><div className="contact-list">{encounterContacts(s).map(n=><article key={n.id}><strong>{n.name}</strong><span>{n.locationLabel}</span></article>)}</div></section>}
 {['workshop','diplomacy','journal'].includes(tab)&&<CampaignOffice state={s} dispatch={dispatch} section={tab}/>}
 </main></div>;
}
