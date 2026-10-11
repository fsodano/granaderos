'use client';
import MissionBriefing from '../../../web/app/MissionBriefing';
import MissionAssault from './MissionAssault';
import {missionStatus} from '../../../game/missions.js';
import {foundryFor} from '../../../game/campaign-foundry.js';
import {ownedArtilleryCount} from '../../../game/campaign-artillery.js';
import {headquartersFor} from '../../../game/campaign-headquarters.js';
import {policyStatus} from '../../../game/politics.js';
import {mentorDispatch} from '../../../game/campaign.js';
import {royalistIntel} from '../../../game/narrative.js';
import {campaignFactions} from '../../../game/campaign-definition.js';
import {sitePath} from '../../../web/lib/site-path.js';
import type {CampaignUI,StatePanelProps,SectorPanelProps,MissionFinishProps,PreparationOrder} from '../../../web/lib/campaign-ui';

function DeskBriefing({state:s,dispatch}:StatePanelProps){
 const mission=missionStatus(s,'yatasto');
 return s.phase>=2&&!mission.completed?<MissionBriefing eyebrow="MISIÓN HISTÓRICA" entryLabel="Visitar la posta de Yatasto" unavailableText="La escuadra debe llegar a Tucumán, bajo control patriota, después de San Lorenzo." mission={mission} canEnter={s.location==='tucuman'&&s.sectors.tucuman.owner==='patriot'&&s.squad.length>0} blocked={Boolean(s.pendingBattle)} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>:null;
}
function DeskObjective({state:s,dispatch}:StatePanelProps){
 return s.phase===1&&s.sectors.san_nicolas.owner==='patriot'&&!s.flags.sanLorenzo?<MissionAssault key={s.activeSquadId} state={s} dispatch={dispatch}/>:null;
}
function SectorBriefing({state:s,selected,owner,careBusy,moving,dispatch}:SectorPanelProps){
 const mission=missionStatus(s,'yatasto');
 return selected==='tucuman'&&s.phase>=2&&!mission.completed?<MissionBriefing eyebrow="MISIÓN HISTÓRICA" entryLabel="Visitar la posta de Yatasto" unavailableText="La escuadra debe llegar a Tucumán, bajo control patriota, después de San Lorenzo." mission={mission} canEnter={s.location==='tucuman'&&owner==='patriot'&&s.squad.length>0&&!careBusy} blocked={moving||Boolean(s.pendingBattle)||careBusy} onEnter={()=>dispatch({type:'visitMission',mission:'yatasto'})}/>:null;
}
function preparationOrders(s:any,sector:string):PreparationOrder[]{
 const orders:PreparationOrder[]=[];
 if(sector===foundryFor(s).sector&&!s.flags.parliament)orders.push({type:'diplomacy',kind:'parliament',label:'Acordar el tránsito por los pasos',price:200});
 if(sector==='salta'&&!s.flags.northPact)orders.push({type:'diplomacy',kind:'northPact',label:'Acordar la defensa con Güemes',price:300});
 if(sector==='tucuman'&&!s.flags.partisanSupply)orders.push({type:'diplomacy',kind:'partisanSupply',label:'Abastecer a las partidas del norte',price:250});
 if(sector===headquartersFor(s)){
  if(!s.flags.emancipation)orders.push({type:'diplomacy',kind:'emancipation',label:'Garantizar la libertad de las familias',price:150});
  else if(!s.flags.commission)orders.push({type:'diplomacy',kind:'commission',label:'Comisionar oficiales pardos y morenos',price:100});
 }
 return orders;
}
function Diplomacy({state:s,dispatch}:StatePanelProps){
 const FACTIONS=campaignFactions(s);
 return <section className="diplomacy"><div className="section-intro"><h2>Una revolución, muchas voluntades</h2><p>Los acuerdos abren rutas y suman combatientes. Cada decisión afecta la confianza en el ejército.</p></div><div className="faction-grid">{FACTIONS.map((f:any)=><article className="faction" key={f.id}><h3>{f.name}</h3><p>{f.description}</p><div className="stat-pair"><span>{f.id==='royalists'?'Enemigo permanente':s.reputation[f.id]>=40?'Aliados':s.reputation[f.id]<0?'Hostiles':'En diálogo'}</span><b>{s.reputation[f.id]}</b></div><div className="reputation-meter"><i style={{width:`${(s.reputation[f.id]+100)/2}%`}}/></div></article>)}</div><p>Las relaciones comerciales modifican el precio de los cargamentos. Las contribuciones nacionales vencen cada siete días.</p><div className="accord-grid"><button className="accord" disabled={!policyStatus(s).taxDue} onClick={()=>dispatch({type:'policy',kind:'tax'})}><span>Abonar contribución nacional</span><small>{policyStatus(s).taxDue?'120 pesos · +8 apoyo del Directorio':'Sin contribución pendiente'}</small></button><button className="accord" disabled={!policyStatus(s).requisitionReady} onClick={()=>dispatch({type:'policy',kind:'frontierRequisition'})}><span>Exigir contribución de frontera</span><small>En Cuyo: +160 pesos · rompe el parlamento y reduce la confianza</small></button>{[{id:'northPact',name:'Pactar con Güemes',desc:'300 pesos'},{id:'partisanSupply',name:'Abastecer a las partidas',desc:'250 pesos para la resistencia'},{id:'parliament',name:'Parlamento pehuenche',desc:'200 pesos'},{id:'emancipation',name:'Proclamar la emancipación',desc:'150 pesos para proteger a las familias'},{id:'commission',name:'Comisionar oficiales pardos',desc:'100 pesos para nuevas comisiones'},{id:'gift',name:'Enviar presentes a la frontera',desc:'80 pesos'},{id:'autonomy',name:'Respetar la autonomía provincial',desc:'80 pesos para las autoridades locales'},{id:'requisition',name:'Exigir contribución local',desc:'+200 pesos; reduce la lealtad'}].map(x=><button key={x.id} className="accord" disabled={Boolean(s.flags[x.id])||(x.id==='requisition'&&!policyStatus(s).requisitionReady)} onClick={()=>dispatch({type:'diplomacy',kind:x.id})}><span>{x.name}{s.flags[x.id]?' ✓':' →'}</span><small>{x.id==='requisition'&&!policyStatus(s).requisitionReady?`${policyStatus(s).nextRequisition} horas de recuperación`:x.desc}</small></button>)}</div></section>;
}
function JournalReference({state:s}:StatePanelProps){
 const mentor=mentorDispatch(s),intelligence=royalistIntel(s);
 return <>{<article className="mentor-dispatch"><img src={sitePath('/campaigns/granaderos/assets/portrait-57.webp')} alt="José de San Martín"/><div><p className="eyebrow">{mentor.role} · Despacho dramatizado</p><h3>{mentor.name}</h3><p>{mentor.text}</p></div></article>}<div className="command-intelligence">{intelligence.map((c:any)=><article key={c.id}><p className="eyebrow">MANDO REALISTA · REFERENCIA</p><h3>{c.name}</h3><p><strong>{c.commander}</strong>{c.deputy&&` · ${c.deputy}`}</p><p>{c.objective}</p><small>{c.doctrine}</small></article>)}</div></>;
}
function MissionFinish({state,mission,busy,onFinish}:MissionFinishProps){
 return state.sceneId==='yatasto'&&onFinish?<button className="line-button" disabled={busy||!(mission.objectives||[]).every((o:any)=>o.done)} onClick={onFinish}>Concluir el encuentro</button>:null;
}
function FundingProgress({state}:StatePanelProps){
 return <><p>Reuní tres piezas propias de artillería para preparar la campaña de los Andes. Explorá los arsenales conquistados y abrí sus cofres para recuperar piezas con munición finita. Los pasos se fortifican desde la carta.</p><p>{Math.min(3,ownedArtilleryCount(state))}/3 piezas propias de artillería</p></>;
}
export const granaderosUI:CampaignUI={DeskBriefing,DeskObjective,SectorBriefing,Diplomacy,JournalReference,MissionFinish,FundingProgress,preparationOrders,journalLabel:'EL CAMINO A LA INDEPENDENCIA',victoryText:'Las provincias están libres. Podés continuar administrando tus fuerzas.',battleVictory:{title:'¡Victoria patriota!',text:'El enemigo abandona el campo. La patria avanza.'}};
