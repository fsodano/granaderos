'use client';
import MilitiaDistribution from './MilitiaDistribution';
import MilitiaTraining from './MilitiaTraining';
import {careAssignmentBusy} from '../../game/medical-care.js';
import {historicalLossReason} from '../../game/historical-loss.js';
import {campaignStory} from '../../game/campaign-story.js';
import StoryQuestJournal from './StoryQuestJournal';

import StrategicMap from './StrategicMap';
import LogisticsAttention from './LogisticsAttention';
import {missionStatus} from '../../game/missions.js';
import SectorIncome from './SectorIncome';
import SectorEnvironment from './SectorEnvironment';
import MissionBriefing from './MissionBriefing';
import {useState} from 'react';
import {rosterFor,deploymentCost,campaignObjectives} from '../../game/campaign.js';
import {getCityStatus} from '../../game/cities.js';
import {campaignPlace,worldCell,worldOwner} from '../../game/world-cells.js';
import CharacterDossier from './CharacterDossier';
import Squads from './Squads';
import TravelStatus from './TravelStatus';
import {activeSquad} from '../../game/squads.js';
import MedicalCare from './MedicalCare';
import EnemyEncounters from './EnemyEncounters';
import AssignmentAttention from './AssignmentAttention';
import ContractAttention from './ContractAttention';
import './strategy.css';
import StrategicRoster from './StrategicRoster';
import {previewStrategicRoute} from '../../game/strategic-route.js';
const place=campaignPlace;
export default function Campaign({state:s,dispatch,onBattle,onOpenDesk}:{state:any;dispatch:(a:any)=>void;onBattle:()=>void;onOpenDesk:()=>void}){
 const [selected,setSelected]=useState(s.location),[dossier,setDossier]=useState<number|null>(null),[hours,setHours]=useState(1);
 const roster=rosterFor(s),hired=s.recruited.map((id:number)=>roster.find(o=>o.id===id)).filter(Boolean),def=place(selected)!,sector=s.sectors[selected],physical=worldCell(selected)!,owner=worldOwner(s,selected),city=getCityStatus(s,physical.locality);
 const objective=campaignStory(s)?campaignObjectives(s).find((c:any)=>c.active):null;
 const careBusy=s.squad.some((id:number)=>careAssignmentBusy(s.operativeState[id].assignment));
 const [panel,setPanel]=useState(s.squads.some((q:any)=>q.journey)||s.travelNotice?'travel':'sector');
 const [plot,setPlot]=useState<{squadId:string;destination:string;mode:string}|null>(null);
 const [hover,setHover]=useState('');
 const plotting=plot?.squadId===s.activeSquadId&&!s.pendingBattle&&!s.pendingEncounter&&!s.defeated&&!activeSquad(s).journey?plot:null;
 const candidate=plotting&&(plotting.destination||hover);
 const preview=plotting?previewStrategicRoute(s,plotting.squadId,candidate,plotting.mode):null;
 const cancelPlot=()=>{setPlot(null);setHover('');};
 const selectSquad=(id:string)=>{if(s.pendingBattle||s.defeated)return;const q=s.squads.find((q:any)=>q.id===id);dispatch({type:'selectSquad',id});setSelected(q.location);setHover('');setPlot(q.journey||!q.members.length?null:{squadId:id,destination:'',mode:'march'});setPanel(q.journey?'travel':'sector');};
 const confirmRoute=()=>{if(!plotting?.destination||!preview?.valid||!preview.action)return;dispatch(preview.action);cancelPlot();setPanel(preview.action.queue?'travel':'sector');};
 const selectSector=(id:string)=>{setSelected(id);if(plotting){if(plotting.destination===id&&preview?.valid)confirmRoute();else setPlot({...plotting,destination:id});}};
 const moving=Boolean(activeSquad(s).journey);
 return <section className="strategy-screen strategy-command-screen" onKeyDown={e=>{if(e.key==='Escape'){cancelPlot();}}} onContextMenu={e=>{if(plotting){e.preventDefault();cancelPlot();}}}><header className="strategy-top"><div><p className="eyebrow">CARTA DE OPERACIONES</p><h1>Provincias Unidas</h1></div><div className="strategy-time"><span>Día {Math.floor(s.hour/24)+1} · {String(s.hour%24).padStart(2,'0')}:00</span><select aria-label="Tiempo a avanzar" value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>1 hora</option><option value={6}>6 horas</option><option value={24}>1 día</option></select><button className="line-button" disabled={Boolean(s.pendingBattle||s.pendingEncounter)||s.defeated} onClick={()=>dispatch({type:'wait',hours})}>Avanzar</button></div><button className="gold-button" onClick={onOpenDesk}>Escritorio →</button></header>

 {s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}{s.defeated&&<p className="notice error">{campaignStory(s)?.defeat??historicalLossReason(s)??'La campaña terminó. Conservá tu partida o comenzá otra desde el menú.'}</p>}{s.completed&&<p className="notice">{campaignStory(s)?.victory??'Las provincias están libres. Podés continuar administrando tus fuerzas.'}</p>}
 {objective&&<section className="notice" aria-label="Objetivo actual de campaña"><strong>{objective.name}</strong><p>{objective.objective}</p></section>}
 <div className="strategy-encounters"><LogisticsAttention state={s}/><AssignmentAttention state={s} roster={roster}/><ContractAttention state={s} roster={roster} dispatch={dispatch}/><EnemyEncounters state={s} dispatch={dispatch}/></div>
 <div className="strategy-layout"><StrategicRoster state={s} roster={roster} onSquad={selectSquad} onDossier={setDossier} onOpenDesk={onOpenDesk} onManage={()=>{cancelPlot();setPanel('squads');}}/>
 <StrategicMap state={s} selected={selected} onSelect={selectSector} dispatch={dispatch} plotting={Boolean(plotting)} onHover={setHover} previewPath={preview?.valid?preview.path:[]} onSquad={selectSquad}/>
 <aside className="strategy-orders"><nav className="strategy-panel-tabs" aria-label="Panel de campaña">{[['sector','Sector'],['travel','Marchas'],['care','Personal'],['squads','Escuadras']].map(([id,label])=><button key={id} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{label}</button>)}</nav>
 {plotting&&<section className="map-route-order" aria-label="Trazar ruta"><h2>{activeSquad(s).name}</h2><label>Transporte<select aria-label="Transporte de la ruta" value={plotting.mode} onChange={e=>setPlot({...plotting,mode:e.target.value})}><option value="march">A pie</option><option value="posta">Posta</option><option value="flotilla">Flotilla</option><option value="carts">Carretas</option></select></label><p aria-live="polite">{candidate?(preview?.valid?`${preview.path.map((id:string)=>place(id)?.grid).join(' → ')} · ${preview.hours} h${preview.action?.type==='attack'?' · Avance al límite enemigo':''}`:preview?.reason):'Elegí un destino en el mapa.'}</p>{plotting.destination&&<strong>{place(plotting.destination)?.name}</strong>}<button className="gold-button" disabled={!plotting.destination||!preview?.valid} onClick={confirmRoute}>Confirmar ruta</button><button className="line-button" onClick={cancelPlot}>Cancelar trazado</button><small>Un segundo clic en el destino confirma. Esc o clic derecho cancela el trazado. {preview?.action?.queue?'Después, avanzá el reloj.':'La marcha entre celdas avanza el reloj al confirmar.'}</small></section>}
 <div className="strategy-panel-content">
 {panel==='travel'?<>{!s.squads.some((q:any)=>q.journey)&&!s.travelNotice&&<p>Sin marchas pendientes. Seleccioná una escuadra para trazar su ruta.</p>}<TravelStatus state={s} dispatch={dispatch}/></>:panel==='care'?<><MedicalCare state={s} sectorId={selected} dispatch={dispatch}/></>:panel==='squads'?<Squads state={s} dispatch={dispatch}/>:<>
<p className="eyebrow">CELDA {physical.grid}</p><h2>{def.name.split(' · ')[0]}</h2><p>{owner==='patriot'?'Bajo control patriota':owner==='royalist'?'Ocupación realista':physical.land?'Terreno abierto':'Agua abierta'}</p>{city?<p className="city-summary">{city.name}<br/><strong>{city.sectors.length-city.uncontrolled.length}/{city.sectors.length} sectores · {city.loyalty}% lealtad</strong></p>:<p>{physical.land?'Zona rural':'Sin acceso terrestre'}</p>}
 {s.pendingBattle?<button className="gold-button" onClick={onBattle}>Volver al sector táctico</button>:(s.enemyGroups??[]).some((g:any)=>g.target===selected&&g.status==='stationed')?<button className="gold-button" disabled={moving||careBusy||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'attack',sector:selected,queue:true})}>Contraatacar ocupación</button>:selected===s.location&&owner!=='royalist'&&physical.land?<button className="gold-button" disabled={moving||careBusy||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'visitSector',sector:selected})}>Entrar al sector · {deploymentCost(s)} pesos</button>:<button className="gold-button" disabled={moving||careBusy||!physical.land||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>{setPlot({squadId:s.activeSquadId,destination:selected,mode:'march'});setHover('');}}>{owner==='royalist'?'Avanzar y combatir':'Mover escuadra aquí'}</button>}
 {careBusy&&<p className="notice">Hay personas en atención médica, descanso o trabajo en la escuadra activa. Ponelos en servicio o dejalos en otra escuadra antes de marchar.</p>}
 {!campaignStory(s)&&selected==='tucuman'&&s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&owner==='patriot'&&s.squad.length>0&&!careBusy} blocked={moving||Boolean(s.pendingBattle)||careBusy} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}
 <SectorEnvironment sector={selected} hour={s.hour} local={selected===s.location}/>
 {sector?<><SectorIncome state={s} definition={def}/><button className="line-button" disabled={sector.owner!=='patriot'||sector.fort>=3||s.resources.treasury<150||Boolean(s.pendingBattle)||s.defeated} onClick={()=>dispatch({type:'fortify',sector:selected})}>Fortificar · 150 pesos ({sector.fort}/3)</button><MilitiaTraining key={selected} state={s} sectorId={selected} dispatch={dispatch}/><MilitiaDistribution key={`distribution-${selected}`} state={s} sector={selected} dispatch={dispatch}/></>:<p>Esta celda conserva su propio terreno y sus objetos. Los servicios y las milicias se administran en el sector principal de la localidad.</p>}
 </>}</div></aside></div><StoryQuestJournal state={s}/>
 <CharacterDossier state={s} operative={hired.find((o:any)=>o.id===dossier)} record={s.operativeState[dossier??-1]} onClose={()=>setDossier(null)}/></section>;
}
