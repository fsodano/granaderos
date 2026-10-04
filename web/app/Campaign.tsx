'use client';
import SectorPreparation from './SectorPreparation';
import MilitiaDistribution from './MilitiaDistribution';
import MilitiaTraining from './MilitiaTraining';
import {careAssignmentBusy} from '../../game/medical-care.js';
import {historicalLossReason} from '../../game/historical-loss.js';
import {campaignStory} from '../../game/campaign-story.js';

import StrategicMap from './StrategicMap';
import StrategicPanel from './StrategicPanel';
import LogisticsAttention from './LogisticsAttention';
import {missionStatus} from '../../game/missions.js';
import SectorIncome from './SectorIncome';
import SectorEnvironment from './SectorEnvironment';
import MissionBriefing from './MissionBriefing';
import {useState} from 'react';
import {useStrategicClock} from '../lib/useStrategicClock';
import {STRATEGIC_CLOCK_SPEEDS} from '../../game/strategic-clock.js';
import {assaultGroups,squadHasHorses} from '../../game/squad-travel.js';
import StrategicPersonnelMenu from './StrategicPersonnelMenu';
import {rosterFor,campaignObjectives} from '../../game/campaign.js';
import {getCityStatus} from '../../game/cities.js';
import {campaignPlace,worldCell,worldOwner} from '../../game/world-cells.js';
import CharacterDossier from './CharacterDossier';
import {activeSquad} from '../../game/squads.js';
import MedicalCare from './MedicalCare';
import EnemyEncounters from './EnemyEncounters';
import AssignmentAttention from './AssignmentAttention';
import ContractAttention from './ContractAttention';
import './strategy.css';
import StrategicRoster from './StrategicRoster';
import {previewStrategicRoute} from '../../game/strategic-route.js';
import {travelTime} from '../lib/travel-time';
import TransientNotice from './TransientNotice';
const place=campaignPlace;
export default function Campaign({state:s,battle,dispatch,onBattle,onOpenDesk}:{state:any;battle?:any;dispatch:(a:any)=>void;onBattle:()=>void;onOpenDesk:()=>void}){
 const [selected,setSelected]=useState(s.location),[dossier,setDossier]=useState<number|null>(null),[personMenu,setPersonMenu]=useState<{id:number;kind:'assignment'|'contract'|'destination'}|null>(null);
 const clock=useStrategicClock(s,dispatch);
 const roster=rosterFor(s),hired=s.recruited.map((id:number)=>roster.find(o=>o.id===id)).filter(Boolean),def=place(selected)!,sector=s.sectors[selected],physical=worldCell(selected)!,owner=worldOwner(s,selected),city=getCityStatus(s,physical.locality);
 const objective=campaignStory(s)?campaignObjectives(s).find((c:any)=>c.active):null;
 const careBusy=s.squad.some((id:number)=>careAssignmentBusy(s.operativeState[id].assignment));
 const [panel,setPanel]=useState<string|null>(null);
 const [plot,setPlot]=useState<{squadId:string;destination:string;mode:string;waypoints:string[]}|null>(null);
 const [hover,setHover]=useState('');
 const plotting=plot?.squadId===s.activeSquadId&&!s.pendingBattle&&!s.pendingEncounter&&!s.defeated&&!activeSquad(s).journey?plot:null;
 const candidate=plotting&&(hover||plotting.destination);
 const selectedPreview=plotting?previewStrategicRoute(s,plotting.squadId,plotting.destination,plotting.mode,plotting.waypoints):null;
 const preview=plotting?previewStrategicRoute(s,plotting.squadId,candidate,plotting.mode,hover&&plotting.destination&&hover!==plotting.destination&&selectedPreview?.valid?[...plotting.waypoints,plotting.destination]:plotting.waypoints):null;
 const cancelPlot=()=>{setPlot(null);setHover('');};
 const selectSquad=(id:string,operativeId?:number)=>{clock.pause();if(s.pendingBattle||s.pendingEncounter||s.defeated)return;const q=s.squads.find((q:any)=>q.id===id);if(!q)return;setPanel(null);setHover('');setSelected(q.location);if(q.journey){cancelPlot();if(q.id!==s.activeSquadId)dispatch({type:'selectSquad',id});setPersonMenu({id:operativeId??q.members[0],kind:'destination'});return;}dispatch({type:'selectSquad',id});setPlot(q.members.length?{squadId:id,destination:'',mode:'march',waypoints:[]}:null);};
 const confirmRoute=()=>{if(!plotting?.destination||!selectedPreview?.valid||!selectedPreview.action)return;clock.pause();dispatch(selectedPreview.action);cancelPlot();setPanel(null);};
 const selectSector=(id:string)=>{setSelected(id);if(plotting){if(plotting.destination===id&&selectedPreview?.valid)confirmRoute();else if((id!==activeSquad(s).location||plotting.destination||plotting.waypoints.length)&&plotting.waypoints.length<8){const append=plotting.destination&&plotting.destination!==id&&selectedPreview?.valid;setPlot({...plotting,destination:id,waypoints:append?[...plotting.waypoints,plotting.destination]:plotting.waypoints});setHover('');}}};
 const moving=Boolean(activeSquad(s).journey);
 const readyAssaults=assaultGroups(s).filter(group=>group.ready.length),assaultBlocked=Boolean(s.pendingBattle||s.pendingEncounter||s.defeated);
 const openPanel=(id:string)=>{clock.pause();cancelPlot();setPanel(id);};
 const inspectSector=(id:string)=>{if(!plotting){setSelected(id);openPanel('sector');}};
 const rosterPanel=()=><StrategicRoster state={s} roster={roster} onDossier={id=>{clock.pause();setPanel(null);setDossier(id);}} onOpenDesk={onOpenDesk} onAssignment={(id:number)=>{clock.pause();setPanel(null);setPersonMenu({id,kind:'assignment'});}} onContract={(id:number)=>{clock.pause();setPanel(null);setPersonMenu({id,kind:'contract'});}} onDestination={selectSquad} dispatch={dispatch}/>;
 return <section className="strategy-screen strategy-command-screen" onKeyDown={e=>{if(e.key==='Escape'){cancelPlot();setPanel(null);}}} onContextMenu={e=>{if(plotting){e.preventDefault();cancelPlot();}}}>
 <header className="strategy-top"><h1>Provincias Unidas</h1><div className="strategy-funds" aria-label="Fondos disponibles"><span>Fondos</span><strong>{s.resources.treasury.toLocaleString('es-AR')} pesos</strong></div>{s.pendingBattle&&<button className="line-button strategy-tactical-return" aria-label="Volver al sector táctico" onClick={()=>{clock.pause();onBattle();}}><span aria-hidden="true">▷</span> Sector táctico</button>}<button className="gold-button" onClick={onOpenDesk}>Escritorio →</button></header>
 <TransientNotice message={s.lastError} eventKey={s}/>{s.defeated&&<p className="notice error">{campaignStory(s)?.defeat??historicalLossReason(s)??'La campaña terminó. Conservá tu partida o comenzá otra desde el menú.'}</p>}{s.completed&&<p className="notice">{campaignStory(s)?.victory??'Las provincias están libres. Podés continuar administrando tus fuerzas.'}</p>}
 {objective&&<section className="notice" aria-label="Objetivo actual de campaña"><strong>{objective.name}</strong><p>{objective.objective}</p></section>}
 <div className="strategy-encounters"><LogisticsAttention state={s}/><AssignmentAttention state={s} roster={roster}/><ContractAttention state={s} roster={roster} dispatch={dispatch}/>{s.pendingEncounter&&<EnemyEncounters state={s} dispatch={dispatch}/>}</div>

 <div className="strategy-layout">{rosterPanel()}
 <StrategicMap state={s} battle={battle} selected={selected} onSelect={selectSector} onInspect={inspectSector} onOpenPanel={clock.pause} dispatch={dispatch} plotting={Boolean(plotting)} onHover={setHover} previewPath={preview?.valid?preview.path:[]} onSquad={selectSquad}/>
</div>
 <footer className="strategy-bottom-controls">
 <nav className="strategy-tools" aria-label="Órdenes de campaña">{[['roster','Nómina'],['sector','Sector'],['care','Personal']].map(([id,label])=><button key={id} className={`line-button${id==='roster'?' strategy-roster-open':''}`} aria-haspopup="dialog" aria-expanded={panel===id} onClick={()=>openPanel(id)}>{label}</button>)}{readyAssaults.map(group=><button key={group.sector} className="gold-button strategy-ready-assault" data-assault-target={group.sector} title={`${group.ready.reduce((sum:number,q:any)=>sum+q.members.length,0)} combatientes listos${group.incoming.length?` · En camino: ${group.incoming.map((q:any)=>`${q.name} (${travelTime(q.remaining)}${q.status==='paused'?', detenida':''})`).join(', ')}`:''}`} disabled={assaultBlocked} onClick={()=>{clock.pause();dispatch({type:'beginAssault',sector:group.sector});}}>Atacar · {place(group.sector)?.name??group.sector}{group.incoming.length>0&&<small> · {group.incoming.length} en camino</small>}</button>)}</nav>
 <div className="strategy-time"><span>Día {Math.floor(s.hour/24)+1} · {String(s.hour%24).padStart(2,'0')}:{String(Math.floor((s.secondOfHour??0)/60)).padStart(2,'0')}</span><button className="line-button" aria-pressed={clock.running} title={clock.cause||undefined} aria-description={clock.cause||undefined} disabled={Boolean(s.pendingBattle||s.pendingEncounter)||s.defeated} onClick={clock.toggle}>{clock.running?'Ⅱ Pausar':'▶ Iniciar'}</button><select aria-label="Velocidad del tiempo" value={clock.speed} onChange={e=>clock.setSpeed(Number(e.target.value))}>{STRATEGIC_CLOCK_SPEEDS.map(speed=><option key={speed} value={speed}>{speed}×</option>)}</select><span className="sr-only" role="status" aria-live="polite">{clock.cause}</span></div>
 </footer>
 {plotting&&<section className="map-route-order strategic-route-overlay" aria-label="Trazar ruta"><h2>{activeSquad(s).name}</h2><label>Transporte<select aria-label="Transporte de la ruta" value={plotting.mode} onChange={e=>setPlot({...plotting,mode:e.target.value})}><option value="march">A pie · caminos</option><option value="horse" disabled={!squadHasHorses(s,activeSquad(s))}>A caballo</option><option value="posta">Posta</option><option value="flotilla">Flotilla</option><option value="carts">Carretas</option></select></label><p aria-live="polite">{candidate?(preview?.valid?`${preview.path.map((id:string)=>place(id)?.grid).join(' → ')} · ${preview.hours} h${preview.action?.type==='attack'?' · Avance al límite enemigo':''}`:preview?.reason):'Elegí un destino en el mapa.'}</p>{plotting.destination&&<strong>{place(plotting.destination)?.name}</strong>}<button className="gold-button" disabled={!plotting.destination||!selectedPreview?.valid} onClick={confirmRoute}>Confirmar ruta</button><button className="line-button" onClick={cancelPlot}>Cancelar trazado</button><small>Otro clic en el último destino confirma. Un destino diferente agrega una escala. Esc o clic derecho cancela. Después, iniciá el reloj.</small></section>}
 {panel&&<StrategicPanel title={panel==='roster'?'Nómina':panel==='sector'?`Sector · ${def.name.split(' · ')[0]}`:'Personal'} onClose={()=>setPanel(null)}><div className="strategy-orders"><nav className="strategy-panel-tabs" aria-label="Panel de campaña">{[['sector','Sector'],['care','Personal']].map(([id,label])=><button key={id} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{label}</button>)}</nav>
 <div className="strategy-panel-content">
 {panel==='roster'?rosterPanel():panel==='care'?<><MedicalCare state={s} sectorId={selected} dispatch={dispatch}/></>:<>
<p className="eyebrow">CELDA {physical.grid}</p><h2>{def.name.split(' · ')[0]}</h2><p>{owner==='patriot'?'Bajo control patriota':owner==='royalist'?'Ocupación realista':physical.land?'Terreno abierto':'Agua abierta'}</p>{city?<p className="city-summary">{city.name}<br/><strong>{city.sectors.length-city.uncontrolled.length}/{city.sectors.length} sectores · {city.loyalty}% lealtad</strong></p>:<p>{physical.land?'Zona rural':'Sin acceso terrestre'}</p>}
 {s.pendingBattle?null:(s.enemyGroups??[]).some((g:any)=>g.target===selected&&g.status==='stationed')?<button className="gold-button" disabled={moving||careBusy||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'attack',sector:selected,queue:true})}>Contraatacar ocupación</button>:selected===s.location&&owner!=='royalist'&&physical.land?<button className="gold-button" disabled={moving||careBusy||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'visitSector',sector:selected})}>Entrar al sector</button>:<button className="gold-button" disabled={moving||careBusy||!physical.land||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>{setPlot({squadId:s.activeSquadId,destination:selected,mode:'march',waypoints:[]});setHover('');setPanel(null);}}>{owner==='royalist'?'Avanzar y combatir':'Mover escuadra aquí'}</button>}
 {careBusy&&<p className="notice">Hay personas en atención médica, descanso o trabajo en la escuadra activa. Ponelos en servicio o dejalos en otra escuadra antes de marchar.</p>}
 {!campaignStory(s)&&selected==='tucuman'&&s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&owner==='patriot'&&s.squad.length>0&&!careBusy} blocked={moving||Boolean(s.pendingBattle)||careBusy} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}
 <SectorPreparation state={s} sector={selected} dispatch={dispatch} onOpen={clock.pause}/><SectorEnvironment sector={selected} hour={s.hour} local={selected===s.location}/>
 {sector?<><SectorIncome state={s} definition={def}/><button className="line-button" disabled={sector.owner!=='patriot'||sector.fort>=3||s.resources.treasury<150||Boolean(s.pendingBattle)||s.defeated} onClick={()=>dispatch({type:'fortify',sector:selected})}>Fortificar · 150 pesos ({sector.fort}/3)</button><MilitiaTraining key={selected} state={s} sectorId={selected} dispatch={dispatch}/><MilitiaDistribution key={`distribution-${selected}`} state={s} sector={selected} dispatch={dispatch}/></>:<p>Esta celda conserva su propio terreno y sus objetos. Los servicios y las milicias se administran en el sector principal de la localidad.</p>}
 </>}</div></div></StrategicPanel>}
 {personMenu&&<StrategicPersonnelMenu key={`${personMenu.id}:${personMenu.kind}`} state={s} roster={roster} id={personMenu.id} kind={personMenu.kind} onClose={()=>setPersonMenu(null)} dispatch={dispatch}/>}
 <CharacterDossier state={s} operative={hired.find((o:any)=>o.id===dossier)} record={s.operativeState[dossier??-1]} onClose={()=>setDossier(null)}/></section>;
}
