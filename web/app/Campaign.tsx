'use client';
import MilitiaDistribution from './MilitiaDistribution';
import MilitiaTraining from './MilitiaTraining';
import {careAssignmentBusy} from '../../game/medical-care.js';
import {historicalLossReason} from '../../game/historical-loss.js';
import {campaignStory} from '../../game/campaign-story.js';
import StoryQuestJournal from './StoryQuestJournal';

import StrategicMap from './StrategicMap';
import {incomeSources,incomeSummary} from '../../game/economy.js';
import {missionStatus} from '../../game/missions.js';
import MissionBriefing from './MissionBriefing';
import {useState} from 'react';
import {campaignObjectives,deploymentCost,rosterFor,operativeLocation,militiaAssignment} from '../../game/campaign.js';
import {getCityStatus} from '../../game/cities.js';
import {contractStatus} from '../../game/contracts.js';
import {campaignPlace,worldCell,worldOwner,cellTravelPlan} from '../../game/world-cells.js';
import {portraitFor} from '../lib/portraits';
import CharacterDossier from './CharacterDossier';
import Squads from './Squads';
import MedicalCare from './MedicalCare';
import './strategy.css';
const place=campaignPlace;
export default function Campaign({state:s,dispatch,onBattle,onOpenDesk}:{state:any;dispatch:(a:any)=>void;onBattle:()=>void;onOpenDesk:()=>void}){
 const [selected,setSelected]=useState(s.location),[dossier,setDossier]=useState<number|null>(null),[manage,setManage]=useState(false),[hours,setHours]=useState(1);
 const roster=rosterFor(s),hired=s.recruited.map((id:number)=>roster.find(o=>o.id===id)).filter(Boolean),def=place(selected)!,sector=s.sectors[selected],physical=worldCell(selected)!,owner=worldOwner(s,selected),city=getCityStatus(s,physical.locality);
 const objective=campaignStory(s)?campaignObjectives(s).find((c:any)=>c.active):null;
 const careBusy=s.squad.some((id:number)=>careAssignmentBusy(s.operativeState[id].assignment));
 const gridTravel=!worldCell(s.location)?.anchor||!physical.anchor,route=gridTravel?cellTravelPlan(s,selected):null;
 const blocked=owner==='royalist'&&!physical.anchor?'Liberá el sector principal para recorrer sus barrios.':route?.reason;
 return <section className="strategy-screen"><header className="strategy-top"><div><p className="eyebrow">CARTA DE OPERACIONES</p><h1>Provincias Unidas</h1></div><div className="strategy-time"><span>Día {Math.floor(s.hour/24)+1} · {String(s.hour%24).padStart(2,'0')}:00</span><select aria-label="Tiempo a avanzar" value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>1 hora</option><option value={6}>6 horas</option><option value={24}>1 día</option></select><button className="line-button" disabled={Boolean(s.pendingBattle)||s.defeated} onClick={()=>dispatch({type:'wait',hours})}>Avanzar</button></div><button className="gold-button" onClick={onOpenDesk}>Escritorio →</button></header>
 {s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}{s.defeated&&<p className="notice error">{campaignStory(s)?.defeat??historicalLossReason(s)??'La campaña terminó. Conservá tu partida o comenzá otra desde el menú.'}</p>}{s.completed&&<p className="notice">{campaignStory(s)?.victory??'Las provincias están libres. Podés continuar administrando tus fuerzas.'}</p>}
 <>{objective&&<section className="notice" aria-label="Objetivo actual de campaña"><strong>{objective.name}</strong><p>{objective.objective}</p></section>}</>
 <div className="strategy-layout"><aside className="strategy-personnel"><div className="personnel-title"><h2>Granaderos</h2><span>{hired.length}</span></div>{!hired.length?<div className="empty-personnel"><p>Todavía no hay nadie en tus filas.</p><button className="line-button" onClick={onOpenDesk}>Crear o contratar en el escritorio</button></div>:<ul>{hired.map((o:any)=>{const record=s.operativeState[o.id],contract=contractStatus(s,o.id);return <li key={o.id}><button className="personnel-row" onClick={()=>{setDossier(o.id);setSelected(operativeLocation(s,o.id));}}>{portraitFor((o as any).portraitId??o.id)?<img src={portraitFor((o as any).portraitId??o.id)!} alt=""/>:<span className="personnel-initials">{o.nickname.slice(0,2)}</span>}<span><strong>{o.nickname}</strong><small>{worldCell(operativeLocation(s,o.id))?.grid} · {record.alive?`${Math.round(record.hp)} salud`:'Caído'}</small><small>{militiaAssignment(s,o.id)?'Instruyendo milicias':contract?.remaining===null?'Servicio permanente':`${contract?.remaining??0} h de contrato`}</small></span></button></li>;})}</ul>}<label>Escuadra<select aria-label="Escuadra activa" value={s.activeSquadId} onChange={e=>dispatch({type:'selectSquad',id:e.target.value})}>{s.squads.map((q:any)=><option key={q.id} value={q.id}>{q.name} · {q.members.length}/6</option>)}</select></label><button className="dossier-link" onClick={()=>setManage(!manage)}>{manage?'Cerrar organización':'Organizar escuadras'}</button><p className="strategy-treasury">{s.resources.treasury.toLocaleString('es-AR')} pesos<br/><small>+{incomeSummary(s).daily} por día · cobro en {incomeSummary(s).hoursUntilPayment} h</small></p></aside>
 <StrategicMap state={s} selected={selected} onSelect={setSelected} dispatch={dispatch}/>
 <aside className="strategy-orders"><p className="eyebrow">CELDA {physical.grid}</p><h2>{def.name.split(' · ')[0]}</h2><p>{owner==='patriot'?'Bajo control patriota':owner==='royalist'?'Ocupación realista':physical.land?'Terreno abierto':'Agua abierta'}</p>{sector&&<p>{incomeSources(s).find(site=>site.id===selected)?.income} pesos por día · {incomeSources(s).find(site=>site.id===selected)?.status}</p>}{city?<p className="city-summary">{city.name}<br/><strong>{city.sectors.length-city.uncontrolled.length}/{city.sectors.length} sectores · {city.loyalty}% lealtad</strong></p>:<p>{physical.land?'Zona rural':'Sin acceso terrestre'}</p>}
 {s.pendingBattle?<button className="gold-button" onClick={onBattle}>Volver al sector táctico</button>:selected===s.location&&owner!=='royalist'&&physical.land?<button className="gold-button" disabled={!s.squad.length||careBusy} onClick={()=>dispatch({type:'visitSector',sector:selected})}>Entrar al sector · {deploymentCost(s)} pesos</button>:<button className="gold-button" disabled={careBusy||!s.squad.length||Boolean(blocked)&&!(owner==='royalist'&&physical.anchor)} onClick={()=>dispatch({type:owner==='royalist'?'attack':'travel',sector:selected,mode:'march'})}>{owner==='royalist'?`Combatir · ${deploymentCost(s)} pesos`:'Mover escuadra aquí'}</button>}
 {careBusy&&<p className="notice">Hay personas en atención médica o descanso en la escuadra activa. Ponelos en servicio o dejalos en otra escuadra antes de marchar.</p>}
 {blocked&&!(owner==='royalist'&&physical.anchor)&&<p className="muted">{blocked}</p>}{route&&!route.reason&&selected!==s.location&&<p>Marcha a pie · {route.hours} horas</p>}
 {!campaignStory(s)&&selected==='tucuman'&&s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&owner==='patriot'&&s.squad.length>0&&!careBusy} blocked={Boolean(s.pendingBattle)||careBusy} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}
 {sector?<><button className="line-button" disabled={sector.owner!=='patriot'||sector.fort>=3||s.resources.treasury<150||Boolean(s.pendingBattle)} onClick={()=>dispatch({type:'fortify',sector:selected})}>Fortificar · 150 pesos ({sector.fort}/3)</button><MilitiaTraining key={selected} state={s} sectorId={selected} dispatch={dispatch}/><MilitiaDistribution key={`distribution-${selected}`} state={s} sector={selected} dispatch={dispatch}/></>:<p>Esta celda conserva su propio terreno y sus objetos. Los servicios y las milicias se administran en el sector principal de la localidad.</p>}</aside></div>
 <StoryQuestJournal state={s}/>{manage&&<div className="strategy-management"><Squads state={s} dispatch={dispatch}/><MedicalCare state={s} dispatch={dispatch}/></div>}<CharacterDossier operative={hired.find((o:any)=>o.id===dossier)} record={s.operativeState[dossier??-1]} onClose={()=>setDossier(null)}/></section>;
}
