'use client';
import {portraitFor} from '../lib/portraits';
import {useState} from 'react';
import {recruitmentStatus,rosterFor,civicStatus} from '../../game/campaign.js';
import {OFFICER_QUESTIONS,OFFICER_TRAITS,CIVIC_RECRUITS} from '../../game/recruitment.js';
import './recruitment.css';
import CharacterDossier from './CharacterDossier';
import {encounterForOperative} from '../../game/encounters.js';

type Props={state:any;dispatch:(action:any)=>void};
export default function Recruitment({state:s,dispatch}:Props){
 const [name,setName]=useState('');const [dossierId,setDossierId]=useState<number|null>(null);
 const [answers,setAnswers]=useState<Record<string,string>>({origin:'',doctrine:'',crisis:''});
 const roster=rosterFor(s),civicIds=new Set(CIVIC_RECRUITS.map(o=>o.id));
 const complete=name.trim().length>=2&&OFFICER_QUESTIONS.every(q=>answers[q.id]);
 const trait=OFFICER_TRAITS.find(t=>t.id===answers.doctrine);
 const card=(o:any)=>{
   const hired=s.recruited.includes(o.id),active=s.squad.includes(o.id),record=s.operativeState[o.id],alive=record?.alive??true;
   const civic=civicIds.has(o.id),gate=civic?civicStatus(s,o.id):recruitmentStatus(s,o.id);
   const full=s.squad.length>=6,only=active&&s.squad.length===1;
   return <article className={`officer ${active?'in-squad':''}`} key={o.id}>
    <div className="officer-head"><button className="officer-avatar dossier-open" aria-label={`Ver hoja de servicio de ${o.name}`} onClick={()=>setDossierId(o.id)}>{portraitFor(o.id)?<img src={portraitFor(o.id)!} alt={o.name}/>:<span aria-hidden="true">{o.name.split(' ').filter(Boolean).slice(0,2).map((part:string)=>part[0]).join('')}</span>}</button><div><p className="eyebrow">{o.role}</p><h3>{o.name}</h3></div></div>
    <p className="officer-bio">{o.biography}</p>{civic&&<small>Personaje ficticio creado para la campaña.</small>}<button className="dossier-link" onClick={()=>setDossierId(o.id)}>Ver atributos, especialidades y equipo →</button>
    <div className="officer-stats"><span>Salud <b>{Math.round(record?.hp??o.maxHp)}/{o.maxHp}</b></span><span>Puntería <b>{o.marksmanship}</b></span><span>Liderazgo <b>{o.leadership}</b></span></div>
    {o.traits?.length>0&&<p className="recruit-trait">{o.traits.map((id:string)=>OFFICER_TRAITS.find(t=>t.id===id)?.name??'Instrucción de campaña').join(' · ')}</p>}
    {civic&&<div className="recruit-experience"><span>Grado {o.level} · {o.xp} puntos de experiencia</span><progress aria-label={`Experiencia de ${o.name}`} max={100} value={o.level>=10?100:o.xp%100}/><small>Mejora sus atributos al sobrevivir a los combates.</small></div>}
    {hired?<><button className={active?'gold-button':'line-button'} disabled={!alive||(!active&&full)||only} onClick={()=>dispatch({type:'squad',ids:active?s.squad.filter((id:number)=>id!==o.id):[...s.squad,o.id]})}>{!alive?'Caído en combate':active?'✓ En la escuadra':full?'Escuadra completa':'Agregar a la escuadra'}</button>{only&&<small>Debe quedar al menos un combatiente en la escuadra.</small>}</>:<><button className="line-button" disabled={!gate.available||s.resources.treasury<o.monthlyPay} onClick={()=>dispatch({type:civic?'recruitCivic':'recruit',id:o.id})}>{gate.available?`Incorporar · ${o.monthlyPay} pesos/mes`:'Requiere un acuerdo'}</button><small>{gate.available&&s.resources.treasury<o.monthlyPay?'La tesorería no alcanza para el primer estipendio.':gate.reason}</small></>}
   </article>;
 };
 return <section className="roster-section"><div className="section-intro"><h2>Al servicio de la patria</h2><p>Consultá los antecedentes de oficiales y voluntarios disponibles. Escuadra actual: {s.squad.length}/6.</p></div>
  <section className="recruit-exam" aria-labelledby="exam-title"><div><p className="eyebrow">EXAMEN DE APTITUD</p><h3 id="exam-title">La comisión del Cabildo</h3><p>Tu formación y tus decisiones definen al oficial que conducirá su propia carrera en la revolución.</p><p className="recruit-price">Comisión inicial: 300 pesos · Estipendio: 300 pesos/mes</p></div>
   {s.officer?<div className="recruit-exam-result"><strong>{s.officer.name}</strong><p>El Cabildo ya otorgó tu comisión. Tu hoja de servicio está junto a las de los oficiales.</p></div>:<form onSubmit={e=>{e.preventDefault();if(complete)dispatch({type:'createOfficer',name,answers});}}>
    <label htmlFor="officer-name">Nombre del oficial<input id="officer-name" name="officer-name" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={30} placeholder="Nombre y apellido" required autoComplete="off"/></label>
    {OFFICER_QUESTIONS.map(q=><label key={q.id} htmlFor={`exam-${q.id}`}>{q.label}<select required id={`exam-${q.id}`} value={answers[q.id]} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}><option value="">Elegí una respuesta</option>{q.choices.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>)}
    {trait&&<p className="recruit-trait-detail">{trait.description}</p>}
    <button type="submit" className="gold-button" disabled={!complete||s.resources.treasury<300}>Presentar el examen · 300 pesos</button>
   </form>}
  </section>
  <div className="recruit-heading"><p className="eyebrow">LOGIA LAUTARO</p><h3>Hojas de servicio disponibles</h3></div><div className="roster-grid">{roster.filter(o=>!civicIds.has(o.id)&&!encounterForOperative(o.id)).map(card)}</div>
  <div className="recruit-heading"><p className="eyebrow">BOLETÍN REVOLUCIONARIO CÍVICO</p><h3>Voluntarios de los pueblos</h3><p>Las municipalidades convocan a sus vecinos. Llegan con equipos sencillos y mejoran su instrucción en cada combate.</p></div><div className="roster-grid">{roster.filter(o=>civicIds.has(o.id)&&o.id<103&&!encounterForOperative(o.id)).map(card)}</div>
<div className="recruit-heading"><p className="eyebrow">RECOMENDACIONES DEL PUERTO</p><h3>Voluntarios extranjeros</h3><p>Marineros y especialistas por estipendio. Estos personajes son ficticios y sus antecedentes se inspiran en los oficios del período.</p></div><div className="roster-grid">{roster.filter(o=>[103,104].includes(o.id)).map(card)}</div>
 <CharacterDossier operative={roster.find(o=>o.id===dossierId)} record={s.operativeState[dossierId??-1]} onClose={()=>setDossierId(null)}/></section>;
}
