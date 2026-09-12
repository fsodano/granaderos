'use client';
import LogisticsAttention from './LogisticsAttention';
import {missionStatus} from '../../game/missions.js';
import SectorIncome from './SectorIncome';
import SectorEnvironment from './SectorEnvironment';
import MissionBriefing from './MissionBriefing';
import {useState} from 'react';
import {CAMPAIGN_SECTORS,rosterFor,operativeLocation,isSupplied,militiaCourse,militiaAssignment} from '../../game/campaign.js';
import {getCityStatus} from '../../game/cities.js';
import {militiaEligibility,MILITIA_NAMES,MILITIA_COHORT,MILITIA_LIMIT} from '../../game/militia.js';
import CharacterDossier from './CharacterDossier';
import Squads from './Squads';
import TravelStatus from './TravelStatus';
import {activeSquad,operativeInTransit} from '../../game/squads.js';
import MedicalCare from './MedicalCare';
import EnemyEncounters from './EnemyEncounters';
import AssignmentAttention from './AssignmentAttention';
import ContractAttention from './ContractAttention';
import './strategy.css';
import StrategicMap from './StrategicMap';
import StrategicRoster from './StrategicRoster';
import {previewStrategicRoute} from '../../game/strategic-route.js';
const place=(id:string)=>CAMPAIGN_SECTORS.find(s=>s.id===id);
export default function Campaign({state:s,dispatch,onBattle,onOpenDesk}:{state:any;dispatch:(a:any)=>void;onBattle:()=>void;onOpenDesk:()=>void}){
 const [selected,setSelected]=useState(s.location),[dossier,setDossier]=useState<number|null>(null),[trainerId,setTrainerId]=useState(''),[hours,setHours]=useState(1);
 const roster=rosterFor(s),hired=s.recruited.map((id:number)=>roster.find(o=>o.id===id)).filter(Boolean),def=place(selected)!,sector=s.sectors[selected],city=getCityStatus(s,selected),eligibility=militiaEligibility(s,selected),training=s.militiaTraining?.find((t:any)=>t.sector===selected);
 const [panel,setPanel]=useState(s.squads.some((q:any)=>q.journey)||s.travelNotice?'travel':'sector');
 const [plot,setPlot]=useState<{squadId:string;destination:string;mode:string}|null>(null);
 const [hover,setHover]=useState('');
 const plotting=plot?.squadId===s.activeSquadId&&!s.pendingBattle&&!s.pendingEncounter&&!s.defeated&&!activeSquad(s).journey?plot:null;
 const candidate=plotting&&(plotting.destination||hover);
 const preview=plotting?previewStrategicRoute(s,plotting.squadId,candidate,plotting.mode):null;
 const cancelPlot=()=>{setPlot(null);setHover('');};
 const selectSquad=(id:string)=>{if(s.pendingBattle||s.defeated)return;const q=s.squads.find((q:any)=>q.id===id);dispatch({type:'selectSquad',id});setSelected(q.location);setHover('');setPlot(q.journey||!q.members.length?null:{squadId:id,destination:'',mode:'march'});setPanel(q.journey?'travel':'sector');};
 const confirmRoute=()=>{if(!plotting?.destination||!preview?.valid)return;dispatch(preview.action);cancelPlot();setPanel('travel');};
 const selectSector=(id:string)=>{setSelected(id);if(plotting){if(plotting.destination===id&&preview?.valid)confirmRoute();else setPlot({...plotting,destination:id});}};
 const moving=Boolean(activeSquad(s).journey);
 const trainers=hired.filter((o:any)=>!operativeInTransit(s,o.id)&&s.operativeState[o.id]?.alive&&operativeLocation(s,o.id)===selected&&o.leadership>=30&&!militiaAssignment(s,o.id)&&(s.operativeState[o.id].assignment??'active')==='active').sort((a:any,b:any)=>militiaCourse(a,0).hours-militiaCourse(b,0).hours);const trainer=trainers.find((o:any)=>String(o.id)===trainerId)??trainers[0];
 const rank=sector.militia[0]>=3?1:0;const roomForCourse=rank>0||sector.militia.reduce((a:number,b:number)=>a+b,0)+MILITIA_COHORT<=MILITIA_LIMIT;const course=trainer?militiaCourse(trainer,rank):null;
 return <section className="strategy-screen strategy-command-screen" onKeyDown={e=>{if(e.key==='Escape'){cancelPlot();}}} onContextMenu={e=>{if(plotting){e.preventDefault();cancelPlot();}}}><header className="strategy-top"><div><p className="eyebrow">CARTA DE OPERACIONES</p><h1>Provincias Unidas</h1></div><div className="strategy-time"><span>Día {Math.floor(s.hour/24)+1} · {String(s.hour%24).padStart(2,'0')}:00</span><select aria-label="Tiempo a avanzar" value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>1 hora</option><option value={6}>6 horas</option><option value={24}>1 día</option></select><button className="line-button" disabled={Boolean(s.pendingBattle||s.pendingEncounter)||s.defeated} onClick={()=>dispatch({type:'wait',hours})}>Avanzar</button></div><button className="gold-button" onClick={onOpenDesk}>Escritorio →</button></header>

 {s.lastError&&<p className="notice error" role="alert">{s.lastError}</p>}{s.defeated&&<p className="notice error">La campaña terminó. Conservá tu partida o comenzá otra desde el menú.</p>}{s.completed&&<p className="notice">Las provincias están libres. Podés continuar administrando tus fuerzas.</p>}
 <div className="strategy-encounters"><LogisticsAttention state={s}/><AssignmentAttention state={s} roster={roster}/><ContractAttention state={s} roster={roster} dispatch={dispatch}/><EnemyEncounters state={s} dispatch={dispatch}/></div>
 <div className="strategy-layout"><StrategicRoster state={s} roster={roster} onSquad={selectSquad} onDossier={setDossier} onOpenDesk={onOpenDesk} onManage={()=>{cancelPlot();setPanel('squads');}}/>
 <StrategicMap state={s} selected={selected} onSelect={selectSector} dispatch={dispatch} plotting={Boolean(plotting)} onHover={setHover} previewPath={preview?.valid?preview.path:[]} onSquad={selectSquad}/>
 <aside className="strategy-orders"><nav className="strategy-panel-tabs" aria-label="Panel de campaña">{[['sector','Sector'],['travel','Marchas'],['care','Personal'],['squads','Escuadras']].map(([id,label])=><button key={id} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{label}</button>)}</nav>
 {plotting&&<section className="map-route-order" aria-label="Trazar ruta"><h2>{activeSquad(s).name}</h2><label>Transporte<select aria-label="Transporte de la ruta" value={plotting.mode} onChange={e=>setPlot({...plotting,mode:e.target.value})}><option value="march">A pie</option><option value="posta">Posta</option><option value="flotilla">Flotilla</option><option value="carts">Carretas</option></select></label><p aria-live="polite">{candidate?(preview?.valid?`${preview.path.map((id:string)=>place(id)?.grid).join(' → ')} · ${preview.hours} h${preview.action?.type==='attack'?' · Avance al límite enemigo':''}`:preview?.reason):'Elegí un destino en el mapa.'}</p>{plotting.destination&&<strong>{place(plotting.destination)?.name}</strong>}<button className="gold-button" disabled={!plotting.destination||!preview?.valid} onClick={confirmRoute}>Confirmar ruta</button><button className="line-button" onClick={cancelPlot}>Cancelar trazado</button><small>Un segundo clic en el destino confirma. Esc o clic derecho cancela el trazado. Después, avanzá el reloj.</small></section>}
 <div className="strategy-panel-content">
 {panel==='travel'?<>{!s.squads.some((q:any)=>q.journey)&&!s.travelNotice&&<p>Sin marchas pendientes. Seleccioná una escuadra para trazar su ruta.</p>}<TravelStatus state={s} dispatch={dispatch}/></>:panel==='care'?<><MedicalCare state={s} sectorId={selected} dispatch={dispatch}/></>:panel==='squads'?<Squads state={s} dispatch={dispatch}/>:<>
<p className="eyebrow">SECTOR {def.grid}</p><h2>{def.name.split(' · ')[0]}</h2><p>{sector.owner==='patriot'?'Bajo control patriota':'Ocupación realista'}</p>{city?<p className="city-summary">{city.name}<br/><strong>{city.sectors.length-city.uncontrolled.length}/{city.sectors.length} sectores · {city.loyalty}% lealtad</strong></p>:<p>Zona rural</p>}
 {s.pendingBattle?<button className="gold-button" onClick={onBattle}>Volver al sector táctico</button>:(s.enemyGroups??[]).some((g:any)=>g.target===selected&&g.status==='stationed')?<button className="gold-button" disabled={moving||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'attack',sector:selected,queue:true})}>Contraatacar ocupación</button>:selected===s.location&&sector.owner==='patriot'?<button className="gold-button" disabled={moving||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>dispatch({type:'visitSector',sector:selected})}>Entrar al sector</button>:<button className="gold-button" disabled={moving||!s.squad.length||Boolean(s.pendingEncounter)} onClick={()=>{setPlot({squadId:s.activeSquadId,destination:selected,mode:'march'});setHover('');}}>{sector.owner==='patriot'?'Mover escuadra aquí':'Avanzar y combatir'}</button>}
 {selected==='tucuman'&&s.phase>=2&&!missionStatus(s,'yatasto').completed&&<MissionBriefing mission={missionStatus(s,'yatasto')} canEnter={s.location==='tucuman'&&sector.owner==='patriot'&&s.squad.length>0} blocked={moving||Boolean(s.pendingBattle)} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>}
 <SectorEnvironment sector={selected} hour={s.hour} local={selected===s.location}/>
 <SectorIncome state={s} definition={def}/>
 <section className="simple-militia"><h3>Milicias</h3><small>Los veteranos ascienden en combate. La instrucción forma nuevos defensores o mejora a los cívicos.</small><p>{sector.militia.reduce((a:number,b:number)=>a+b,0)} defensores</p><p>{sector.militia.map((count:number,rank:number)=>`${MILITIA_NAMES[rank]}: ${count}`).join(" · ")}</p>{training?<><p>{training.count} en instrucción · {training.remaining} h</p>{(!eligibility.eligible||!isSupplied(s,selected))&&<small>Instrucción detenida: {!eligibility.eligible?eligibility.reason:'falta abastecimiento.'}</small>}<button className="line-button" onClick={()=>dispatch({type:'cancelMilitia',sector:selected})}>Suspender instrucción</button></>:!eligibility.eligible?<p className="muted">{eligibility.reason}</p>:<><label>Instructor<select aria-label="Instructor de milicias" value={trainer?.id??''} onChange={e=>setTrainerId(e.target.value)}>{!trainers.length&&<option value="">Necesitás un granadero presente</option>}{trainers.map((o:any)=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select></label><button className="line-button" disabled={!trainer||!roomForCourse||!isSupplied(s,selected)||Boolean(s.pendingBattle)} onClick={()=>dispatch({type:'militia',sector:selected,rank,trainerId:trainer?.id})}>Entrenar milicias{course?` · ${course.cost.treasury} pesos`:''}</button>{!roomForCourse&&<small>No hay espacio para otra cohorte. El grado veterano requiere combate.</small>}{course&&roomForCourse&&<small>{course.hours} horas · {rank===0?'Tres nuevos defensores':'Promover tres defensores'}</small>}</>}</section></>}</div></aside></div>
 <CharacterDossier operative={hired.find((o:any)=>o.id===dossier)} record={s.operativeState[dossier??-1]} onClose={()=>setDossier(null)}/></section>;
}
