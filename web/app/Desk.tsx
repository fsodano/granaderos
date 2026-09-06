'use client';
import {missionStatus} from '../../game/missions.js';
import MissionBriefing from './MissionBriefing';
import {useState} from 'react';
import Recruitment from './Recruitment';
import CharacterCreator from './CharacterCreator';
import CampaignOffice from './CampaignOffice';
import {incomeSummary} from '../../game/economy.js';
import {PHASES} from '../../game/data.js';
import {rosterFor} from '../../game/campaign.js';
import {ENCOUNTERS} from '../../game/encounters.js';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {portraitFor} from '../lib/portraits';
import './desk.css';
const tabs=[['overview','Resumen'],['create','Tu granadero'],['hire','Contrataciones'],['contacts','Correspondencia'],['workshop','Tesorería'],['diplomacy','Cabildo'],['journal','Cuaderno']];
export default function Desk({state:s,dispatch,onClose}:{state:any;dispatch:(action:any)=>void;onClose:()=>void}){
 const [tab,setTab]=useState('overview');const own=rosterFor(s).find(o=>o.id===1000);const phase=PHASES[s.phase];
 return <div className="desk-screen"><aside className="desk-sidebar"><p className="eyebrow">CUARTEL GENERAL</p><h1>Escritorio</h1><div className="desk-seal" aria-hidden="true">G</div><nav aria-label="Carpetas del escritorio">{tabs.map(([id,name])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{name}{id==='create'&&s.officer?' ✓':''}</button>)}</nav><div className="desk-balance"><span>Tesorería</span><strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong><small>+{incomeSummary(s).daily} pesos por día</small><small>{s.recruited.length} {s.recruited.length===1?'granadero':'granaderos'} en servicio</small></div><button className="gold-button" onClick={onClose}>Carta de operaciones →</button></aside>
 <main className="desk-paper"><header><p className="eyebrow">PROVINCIAS UNIDAS · DÍA {Math.floor(s.hour/24)+1}</p><h2>{tabs.find(t=>t[0]===tab)?.[1]}</h2></header>{s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}
 {tab==='overview'&&<section className="desk-overview">{s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&s.sectors.tucuman.owner==='patriot'&&s.squad.length>0} blocked={Boolean(s.pendingBattle)} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}<p className="desk-lead">La campaña empieza con tu nombre.</p><p>El Cabildo pone los recursos a tu disposición. Vos elegís quién marchará, qué pueblos defender y en quién confiar.</p><ol className="desk-checklist"><li><strong>{s.officer?'✓ Tu hoja de servicio está firmada':'Creá tu granadero'}</strong><p>Elegí un rostro, un oficio y tus aptitudes. Tus respuestas definen la forma de afrontar la campaña.</p><button className="line-button" onClick={()=>setTab('create')}>{s.officer?'Ver mi granadero':'Crear mi granadero'}</button></li><li><strong>Reuní tu escuadra</strong><p>Consultá antecedentes y contratá por un día, una semana o un mes. Los especialistas de élite aceptan un día por vez.</p><button className="line-button" onClick={()=>setTab('hire')}>Examinar candidatos</button></li><li><strong>{phase.name}</strong><p>{phase.objective}</p>{!s.flags.academy&&<button className="gold-button" disabled={Boolean(s.pendingBattle)} onClick={()=>dispatch({type:'academy'})}>Fundar el regimiento · 300 pesos</button>}{s.phase===1&&s.sectors.san_nicolas.owner==='patriot'&&!s.flags.sanLorenzo&&<button className="gold-button" disabled={Boolean(s.pendingBattle)} onClick={()=>dispatch({type:'attack',sector:'san_lorenzo'})}>Marchar a San Lorenzo</button>}<button className="line-button" onClick={onClose}>Abrir la carta</button></li></ol></section>}
 {tab==='create'&&(s.officer&&own?<section className="creator-finished">{portraitFor((own as any).portraitId??own.id)&&<img src={portraitFor((own as any).portraitId??own.id)!} alt={own.name}/>}<h3>{own.name}</h3><p>{own.role}</p><p>Tu personaje ya está creado. Su hoja de servicio y su progreso se consultan desde la carta de operaciones.</p><button className="gold-button" onClick={onClose}>Ver mi granadero en la carta</button></section>:<CharacterCreator onCreate={(name,answers,profile)=>dispatch({type:'createOfficer',name,answers,profile})}/>)}
 {tab==='hire'&&<Recruitment state={s} dispatch={dispatch}/>}
 {tab==='contacts'&&<section><p>Estos contactos se encuentran en el territorio. Su colaboración depende de conversaciones y compromisos cumplidos.</p><div className="contact-list">{ENCOUNTERS.filter((n:any)=>n.operativeId!==undefined&&!s.recruited.includes(n.operativeId)).map(n=><article key={n.id}><strong>{n.name}</strong><span>{CAMPAIGN_SECTORS.find(d=>d.id===n.sector)?.name}</span></article>)}</div></section>}
 {['workshop','diplomacy','journal'].includes(tab)&&<CampaignOffice state={s} dispatch={dispatch} section={tab}/>}
 </main></div>;
}
